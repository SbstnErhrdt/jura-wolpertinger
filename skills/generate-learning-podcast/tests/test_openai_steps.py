from __future__ import annotations

import base64
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from pydantic import BaseModel, ValidationError


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from models import (
    EpisodeDraft,
    GroundingReport,
    PauseSegment,
    SeriesPlan,
    SpeechSegment,
)
from openai_steps import OpenAIGateway, StructuredResponseError


class ExampleResult(BaseModel):
    answer: str


class FakeResponses:
    def __init__(self, outcomes: list[object]) -> None:
        self.outcomes = outcomes
        self.calls: list[dict[str, object]] = []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class ArtifactModelTests(unittest.TestCase):
    def test_series_episode_numbers_must_be_contiguous(self) -> None:
        with self.assertRaisesRegex(ValidationError, "contiguous"):
            SeriesPlan.model_validate(
                {
                    "title": "Testserie",
                    "episodes": [
                        {
                            "number": 2,
                            "slug": "zweite-folge",
                            "title": "Zweite Folge",
                            "learning_goals": ["Ziel"],
                            "concept_ids": ["concept-zwei"],
                            "source_pages": [2],
                            "target_words": 1350,
                            "recall_prompts": [
                                {"question": "Frage 1?", "expected_points": ["A"]},
                                {"question": "Frage 2?", "expected_points": ["B"]},
                            ],
                            "application_kind": "example",
                        }
                    ],
                }
            )

    def test_grounding_approval_must_match_empty_issue_list(self) -> None:
        with self.assertRaisesRegex(ValidationError, "issues is empty"):
            GroundingReport(approved=True, issues=[{"segment_id": "segment-002", "reason": "unsupported"}])

    def test_episode_segments_use_discriminated_union(self) -> None:
        draft = EpisodeDraft.model_validate(
            {
                "number": 1,
                "slug": "test",
                "title": "Test",
                "segments": [
                    {"kind": "speech", "id": "segment-001", "speaker": "moderator", "text": "Hallo"},
                    {"kind": "pause", "id": "segment-002", "duration_ms": 5000, "purpose": "retrieval"},
                ],
            }
        )
        self.assertIsInstance(draft.segments[0], SpeechSegment)
        self.assertIsInstance(draft.segments[1], PauseSegment)


class OpenAIGatewayTests(unittest.TestCase):
    def test_structured_pdf_request_is_private_low_detail_and_schema_parsed(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "source.pdf"
            pdf_path.write_bytes(b"%PDF-source")
            responses = FakeResponses(
                [SimpleNamespace(output_parsed=ExampleResult(answer="Nur aus dem Skript"), output=[])]
            )
            client = SimpleNamespace(responses=responses)
            gateway = OpenAIGateway(client=client, text_model="gpt-5.6", sleep=lambda _: None)

            result = gateway.generate_structured(
                result_type=ExampleResult,
                instructions="Use only the attached PDF.",
                input_text="Analyse the source.",
                input_pdf=pdf_path,
            )

            self.assertEqual(result.answer, "Nur aus dem Skript")
            call = responses.calls[0]
            self.assertFalse(call["store"])
            self.assertIs(call["text_format"], ExampleResult)
            content = call["input"][0]["content"]
            file_part = next(part for part in content if part["type"] == "input_file")
            prefix = "data:application/pdf;base64,"
            self.assertEqual(file_part["detail"], "low")
            self.assertTrue(file_part["file_data"].startswith(prefix))
            self.assertEqual(
                base64.b64decode(file_part["file_data"][len(prefix) :]),
                b"%PDF-source",
            )

    def test_transient_errors_retry_before_success(self) -> None:
        error = RuntimeError("rate limited")
        error.status_code = 429
        responses = FakeResponses(
            [error, SimpleNamespace(output_parsed=ExampleResult(answer="ok"), output=[])]
        )
        delays: list[float] = []
        gateway = OpenAIGateway(
            client=SimpleNamespace(responses=responses),
            text_model="gpt-5.6",
            sleep=delays.append,
        )

        result = gateway.generate_structured(
            result_type=ExampleResult,
            instructions="Return one answer.",
            input_text="test",
        )

        self.assertEqual(result.answer, "ok")
        self.assertEqual(delays, [1.0])

    def test_empty_parse_retries_then_reports_structured_error(self) -> None:
        empty = SimpleNamespace(output_parsed=None, output=[])
        responses = FakeResponses([empty, empty, empty])
        gateway = OpenAIGateway(
            client=SimpleNamespace(responses=responses),
            text_model="gpt-5.6",
            sleep=lambda _: None,
        )

        with self.assertRaisesRegex(StructuredResponseError, "parsed structured output"):
            gateway.generate_structured(
                result_type=ExampleResult,
                instructions="Return one answer.",
                input_text="test",
            )
        self.assertEqual(len(responses.calls), 3)

    def test_non_transient_error_is_not_retried(self) -> None:
        responses = FakeResponses([ValueError("invalid request")])
        gateway = OpenAIGateway(
            client=SimpleNamespace(responses=responses),
            text_model="gpt-5.6",
            sleep=lambda _: None,
        )

        with self.assertRaisesRegex(ValueError, "invalid request"):
            gateway.generate_structured(
                result_type=ExampleResult,
                instructions="Return one answer.",
                input_text="test",
            )
        self.assertEqual(len(responses.calls), 1)


if __name__ == "__main__":
    unittest.main()
