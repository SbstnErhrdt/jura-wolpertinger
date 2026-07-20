from __future__ import annotations

import base64
import sys
import tempfile
import unittest
import wave
from pathlib import Path
from types import SimpleNamespace

from pydantic import BaseModel, ValidationError


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from models import (
    AudioCheck,
    EpisodeDraft,
    GroundingReport,
    PauseSegment,
    SeriesPlan,
    SpeechSegment,
)
from openai_steps import MODERATOR_DELIVERY, OpenAIGateway, StructuredResponseError


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


class FakeSpeechResponse:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        return None

    def stream_to_file(self, path: Path) -> None:
        with wave.open(str(path), "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(24000)
            audio.writeframes(b"\x00\x00" * 2400)


class FakeSpeechEndpoint:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []
        self.with_streaming_response = self

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return FakeSpeechResponse()


class FakeTranscriptions:
    def __init__(self, response: object) -> None:
        self.response = response
        self.calls: list[dict[str, object]] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.response


class ArtifactModelTests(unittest.TestCase):
    def test_episode_schema_uses_openai_supported_union_keyword(self) -> None:
        schema = EpisodeDraft.model_json_schema()

        def keys(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    yield key
                    yield from keys(child)
            elif isinstance(value, list):
                for child in value:
                    yield from keys(child)

        schema_keys = list(keys(schema))
        self.assertNotIn("oneOf", schema_keys)
        self.assertIn("anyOf", schema_keys)

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

    def test_episode_segments_route_by_literal_kind(self) -> None:
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
    def test_transcribes_audio_and_compares_it_with_the_expected_draft(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            audio_path = Path(temp_dir) / "episode.mp3"
            audio_path.write_bytes(b"ID3-test-audio")
            transcriptions = FakeTranscriptions("Transkribierter Dialog")
            check = AudioCheck(passed=True, issues=[])
            responses = FakeResponses(
                [SimpleNamespace(output_parsed=check, output=[])]
            )
            client = SimpleNamespace(
                responses=responses,
                audio=SimpleNamespace(transcriptions=transcriptions),
            )
            gateway = OpenAIGateway(
                client=client,
                text_model="gpt-5.6",
                transcribe_model="gpt-4o-mini-transcribe",
                sleep=lambda _: None,
            )
            draft = EpisodeDraft(
                number=1,
                slug="test",
                title="Test",
                segments=[
                    SpeechSegment(
                        id="segment-001",
                        speaker="moderator",
                        text="Hallo Wolpi.",
                    )
                ],
            )

            transcript = gateway.transcribe(audio_path)
            result = gateway.compare_audio(draft, transcript)

            self.assertEqual(transcript, "Transkribierter Dialog")
            self.assertTrue(result.passed)
            self.assertEqual(
                transcriptions.calls[0]["model"], "gpt-4o-mini-transcribe"
            )
            self.assertEqual(transcriptions.calls[0]["response_format"], "json")
            self.assertEqual(transcriptions.calls[0]["chunking_strategy"], "auto")
            self.assertEqual(transcriptions.calls[0]["language"], "de")
            self.assertIn("TRANSCRIPTION", responses.calls[0]["input"][0]["content"][0]["text"])

    def test_tts_streams_a_non_empty_wav_with_role_instructions(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            speech = FakeSpeechEndpoint()
            client = SimpleNamespace(
                responses=FakeResponses([]),
                audio=SimpleNamespace(speech=speech),
            )
            gateway = OpenAIGateway(
                client=client,
                text_model="gpt-5.6",
                tts_model="gpt-4o-mini-tts",
                sleep=lambda _: None,
            )
            output = Path(temp_dir) / "turn.wav"

            gateway.synthesize(
                text="Wann wird der Verwaltungsakt wirksam?",
                voice="cedar",
                instructions=MODERATOR_DELIVERY,
                output_path=output,
            )

            self.assertGreater(output.stat().st_size, 44)
            self.assertEqual(speech.calls[0]["model"], "gpt-4o-mini-tts")
            self.assertEqual(speech.calls[0]["voice"], "cedar")
            self.assertEqual(speech.calls[0]["response_format"], "wav")
            self.assertIn("135", speech.calls[0]["instructions"])
            self.assertIn("Paragraf", speech.calls[0]["instructions"])

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
