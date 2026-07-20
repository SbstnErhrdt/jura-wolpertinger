from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from inspect_pdf import PdfChunk
from models import (
    Concept,
    EpisodeDraft,
    EpisodePlan,
    GroundingIssue,
    GroundingReport,
    PauseSegment,
    RecallPrompt,
    SeriesPlan,
    SourceAnchor,
    SourceChunkAnalysis,
    SourceMap,
    SourceSection,
    SpeechSegment,
)
from pipeline import (
    analyse_source,
    draft_and_ground,
    plan_series,
    render_series_plan,
    render_transcript,
    source_slice,
    validate_episode,
)


ANCHOR = SourceAnchor(
    page=3,
    section="Wirksamkeit",
    excerpt="Der Verwaltungsakt wird wirksam.",
)
SECTION = SourceSection(
    id="section-wirksamkeit",
    title="Wirksamkeit",
    summary="Wirksamkeit und Bekanntgabe",
    anchors=[ANCHOR],
)
CONCEPT = Concept(
    id="concept-wirksamkeit",
    title="Wirksamkeit",
    kind="definition",
    explanation="Wirksamkeit setzt Bekanntgabe voraus.",
    anchors=[ANCHOR],
    pronunciation_terms=["Art. 43 BayVwVfG"],
)
SOURCE_MAP = SourceMap(
    document_title="Testskript",
    sections=[SECTION],
    concepts=[CONCEPT],
    pronunciation_terms=["Art. 43 BayVwVfG"],
)
PLAN = EpisodePlan(
    number=1,
    slug="wirksamkeit",
    title="Wirksamkeit",
    learning_goals=["Wirksamkeit erklären"],
    concept_ids=["concept-wirksamkeit"],
    source_pages=[3],
    target_words=1400,
    recall_prompts=[
        RecallPrompt(question="Wann wird er wirksam?", expected_points=["Bekanntgabe"]),
        RecallPrompt(
            question="Was ist zu trennen?",
            expected_points=["Wirksamkeit", "Rechtmäßigkeit"],
        ),
    ],
    application_kind="distinction",
)


def valid_draft(extra_text: str = "") -> EpisodeDraft:
    padding = " ".join(["Lernpunkt"] * 1350)
    return EpisodeDraft(
        number=1,
        slug="wirksamkeit",
        title="Wirksamkeit",
        segments=[
            SpeechSegment(
                id="segment-001",
                speaker="moderator",
                purpose="disclosure",
                text=(
                    "Diese KI-Folge nutzt nur das Skript und ist keine "
                    "Aktualitäts- oder Prüfungsbewertung."
                ),
            ),
            SpeechSegment(
                id="segment-002",
                speaker="wolpi",
                text="Wir schauen gelassen auf die Wirksamkeit. " + padding + " " + extra_text,
                anchors=[ANCHOR],
            ),
            SpeechSegment(
                id="segment-003",
                speaker="moderator",
                purpose="retrieval-question",
                text="Wann wird der Verwaltungsakt wirksam?",
                anchors=[ANCHOR],
            ),
            PauseSegment(id="segment-004", duration_ms=5000, purpose="retrieval"),
            SpeechSegment(
                id="segment-005",
                speaker="wolpi",
                purpose="feedback",
                text="Mit der Bekanntgabe.",
                anchors=[ANCHOR],
            ),
            SpeechSegment(
                id="segment-006",
                speaker="moderator",
                purpose="retrieval-question",
                text="Was trennen wir davon?",
                anchors=[ANCHOR],
            ),
            PauseSegment(id="segment-007", duration_ms=5000, purpose="retrieval"),
            SpeechSegment(
                id="segment-008",
                speaker="wolpi",
                purpose="feedback",
                text="Die Rechtmäßigkeit.",
                anchors=[ANCHOR],
            ),
            SpeechSegment(
                id="segment-009",
                speaker="wolpi",
                purpose="application",
                text="Mini-Beispiel: Auch ein fehlerhafter Akt kann wirksam sein.",
                anchors=[ANCHOR],
            ),
        ],
    )


class RoutingGateway:
    def __init__(self, values: list[object]) -> None:
        self.values = values
        self.calls: list[dict[str, object]] = []

    def generate_structured(self, **kwargs):
        self.calls.append(kwargs)
        return self.values.pop(0)


class SourceAnalysisTests(unittest.TestCase):
    def test_analysis_offsets_pages_and_namespaces_chunk_ids(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            chunk = PdfChunk(1, 1, 5, Path(temp_dir) / "chunk.pdf")
            chunk.path.write_bytes(b"%PDF")
            gateway = RoutingGateway(
                [
                    SourceChunkAnalysis(
                        document_title="Testskript",
                        sections=[SECTION],
                        concepts=[CONCEPT],
                    )
                ]
            )

            result = analyse_source(gateway, [chunk])

            self.assertEqual(result.sections[0].id, "section-chunk-001-wirksamkeit")
            self.assertEqual(result.concepts[0].id, "concept-chunk-001-wirksamkeit")
            self.assertIn("add 0", gateway.calls[0]["input_text"])

    def test_analysis_rejects_anchor_outside_original_chunk_range(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            chunk = PdfChunk(2, 21, 40, Path(temp_dir) / "chunk.pdf")
            chunk.path.write_bytes(b"%PDF")
            bad_anchor = SourceAnchor(page=2, section="Falsch", excerpt="Falsche Seite")
            gateway = RoutingGateway(
                [
                    SourceChunkAnalysis(
                        document_title="Testskript",
                        sections=[SECTION.model_copy(update={"anchors": [bad_anchor]})],
                        concepts=[CONCEPT.model_copy(update={"anchors": [bad_anchor]})],
                    )
                ]
            )

            with self.assertRaisesRegex(ValueError, "outside"):
                analyse_source(gateway, [chunk])

    def test_plan_covers_each_concept_once_and_source_slice_is_narrow(self) -> None:
        gateway = RoutingGateway(
            [
                SeriesPlan(
                    title="Testserie",
                    episodes=[PLAN],
                )
            ]
        )

        planned = plan_series(gateway, SOURCE_MAP)
        sliced = source_slice(SOURCE_MAP, planned.episodes[0])

        self.assertEqual([concept.id for concept in sliced.concepts], ["concept-wirksamkeit"])
        self.assertEqual(sliced.pronunciation_terms, ["Art. 43 BayVwVfG"])


class ContentPipelineTests(unittest.TestCase):
    def test_validate_episode_requires_one_opening_disclosure_and_exact_recall_pairs(self) -> None:
        broken_disclosure = valid_draft().model_copy(deep=True)
        broken_disclosure.segments[0].purpose = "summary"
        with self.assertRaisesRegex(ValueError, "opening disclosure"):
            validate_episode(PLAN, broken_disclosure)

        extra_question = valid_draft().model_copy(deep=True)
        extra_question.segments[1].purpose = "retrieval-question"
        with self.assertRaisesRegex(ValueError, "retrieval questions"):
            validate_episode(PLAN, extra_question)

    def test_validate_episode_requires_roles_retrieval_pauses_and_disclosure(self) -> None:
        validate_episode(PLAN, valid_draft())
        broken = valid_draft().model_copy(
            update={
                "segments": [
                    segment for segment in valid_draft().segments if segment.kind != "pause"
                ]
            }
        )
        with self.assertRaisesRegex(ValueError, "retrieval pauses"):
            validate_episode(PLAN, broken)

    def test_validate_episode_requires_unique_sequential_segment_ids(self) -> None:
        broken = valid_draft().model_copy(deep=True)
        broken.segments[1].id = "segment-001"
        with self.assertRaisesRegex(ValueError, "sequential"):
            validate_episode(PLAN, broken)

    def test_validate_episode_rejects_anchor_outside_planned_pages(self) -> None:
        broken = valid_draft().model_copy(deep=True)
        broken.segments[1].anchors = [
            SourceAnchor(page=99, section="Fremd", excerpt="Nicht in dieser Folge")
        ]
        with self.assertRaisesRegex(ValueError, "planned source pages"):
            validate_episode(PLAN, broken)

    def test_grounding_issue_triggers_one_rewrite_and_recheck(self) -> None:
        draft = valid_draft("Ungedeckte Behauptung")
        repaired = valid_draft("Reparierte Aussage")
        gateway = RoutingGateway(
            [
                draft,
                GroundingReport(
                    approved=False,
                    issues=[
                        GroundingIssue(
                            segment_id="segment-002",
                            reason="Nicht im Skript belegt",
                        )
                    ],
                ),
                repaired,
                GroundingReport(approved=True, issues=[]),
            ]
        )

        result, report = draft_and_ground(
            gateway,
            PLAN,
            SOURCE_MAP.model_dump_json(indent=2),
            max_rewrites=2,
        )

        self.assertTrue(result.segments[1].text.endswith("Reparierte Aussage"))
        self.assertTrue(report.approved)
        self.assertEqual(len(gateway.calls), 4)
        self.assertTrue(
            all("use only" in call["instructions"].lower() for call in gateway.calls)
        )

    def test_transcript_has_page_anchors_and_series_plan_is_readable(self) -> None:
        transcript = render_transcript(valid_draft())
        plan_markdown = render_series_plan(SeriesPlan(title="Testserie", episodes=[PLAN]))

        self.assertIn("S. 3", transcript)
        self.assertNotIn("S. 3", valid_draft().segments[1].text)
        self.assertIn("## 1. Wirksamkeit", plan_markdown)
        self.assertIn("PDF-Seiten: 3", plan_markdown)


if __name__ == "__main__":
    unittest.main()
