from __future__ import annotations

import dataclasses
import json
import math
import struct
import sys
import tempfile
import unittest
import wave
from collections import Counter
from pathlib import Path

from reportlab.pdfgen import canvas


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from config import PipelineConfig
from models import (
    AudioCheck,
    AudioIssue,
    Concept,
    EpisodeDraft,
    EpisodePlan,
    GroundingReport,
    PauseSegment,
    RecallPrompt,
    SeriesPlan,
    SourceAnchor,
    SourceChunkAnalysis,
    SourceSection,
    SpeechSegment,
)
from pipeline import run_pipeline
from render_audio import resolve_ffmpeg, split_tts_text


def create_pdf(path: Path, marker: str = "erste-fassung") -> None:
    pdf = canvas.Canvas(str(path))
    for page in range(1, 3):
        pdf.drawString(72, 760, f"Wirksamkeit des Verwaltungsakts {marker}")
        pdf.drawString(72, 730, f"Seite {page}: Die Bekanntgabe ist maßgeblich.")
        pdf.showPage()
    pdf.save()


def create_tone(path: Path, frequency: float = 440.0) -> None:
    sample_rate = 24000
    frame_count = 2400
    frames = b"".join(
        struct.pack(
            "<h",
            round(3500 * math.sin(2 * math.pi * frequency * frame / sample_rate)),
        )
        for frame in range(frame_count)
    )
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        audio.writeframes(frames)


class FakeGateway:
    def __init__(self, *, fail_tts_once: bool = False) -> None:
        self.call_counts: Counter[str] = Counter()
        self.fail_tts_once = fail_tts_once
        anchor = SourceAnchor(
            page=1,
            section="Wirksamkeit",
            excerpt="Die Bekanntgabe ist maßgeblich.",
        )
        self.anchor = anchor
        self.section = SourceSection(
            id="section-wirksamkeit",
            title="Wirksamkeit",
            summary="Bekanntgabe und Wirksamkeit",
            anchors=[anchor],
        )
        self.concept = Concept(
            id="concept-wirksamkeit",
            title="Wirksamkeit",
            kind="definition",
            explanation="Das Skript verbindet die Wirksamkeit mit der Bekanntgabe.",
            anchors=[anchor],
            pronunciation_terms=["BayVwVfG"],
        )
        self.plan = EpisodePlan(
            number=1,
            slug="wirksamkeit",
            title="Wirksamkeit verstehen",
            learning_goals=["Wirksamkeit erklären"],
            concept_ids=["concept-chunk-001-wirksamkeit"],
            source_pages=[1],
            target_words=1400,
            recall_prompts=[
                RecallPrompt(
                    question="Was ist maßgeblich?", expected_points=["Bekanntgabe"]
                ),
                RecallPrompt(
                    question="Welche Wirkung folgt?", expected_points=["Wirksamkeit"]
                ),
            ],
            application_kind="example",
        )

    def _draft(self) -> EpisodeDraft:
        padding = " ".join(["Lernpunkt"] * 1350)
        return EpisodeDraft(
            number=1,
            slug="wirksamkeit",
            title="Wirksamkeit verstehen",
            segments=[
                SpeechSegment(
                    id="segment-001",
                    speaker="moderator",
                    purpose="disclosure",
                    text=(
                        "Diese KI-Folge nutzt nur das Skript, nimmt keine Aktualitätsprüfung "
                        "vor und ist keine offizielle Prüfungsbewertung."
                    ),
                ),
                SpeechSegment(
                    id="segment-002",
                    speaker="wolpi",
                    text="Wir lernen die Wirksamkeit. " + padding,
                    anchors=[self.anchor],
                ),
                SpeechSegment(
                    id="segment-003",
                    speaker="moderator",
                    purpose="retrieval-question",
                    text="Was ist maßgeblich?",
                    anchors=[self.anchor],
                ),
                PauseSegment(
                    id="segment-004", duration_ms=5000, purpose="retrieval"
                ),
                SpeechSegment(
                    id="segment-005",
                    speaker="wolpi",
                    purpose="feedback",
                    text="Die Bekanntgabe.",
                    anchors=[self.anchor],
                ),
                SpeechSegment(
                    id="segment-006",
                    speaker="moderator",
                    purpose="retrieval-question",
                    text="Welche Wirkung folgt?",
                    anchors=[self.anchor],
                ),
                PauseSegment(
                    id="segment-007", duration_ms=5000, purpose="retrieval"
                ),
                SpeechSegment(
                    id="segment-008",
                    speaker="wolpi",
                    purpose="feedback",
                    text="Die Wirksamkeit.",
                    anchors=[self.anchor],
                ),
                SpeechSegment(
                    id="segment-009",
                    speaker="wolpi",
                    purpose="application",
                    text="Ein Beispiel aus dem Skript verbindet beides.",
                    anchors=[self.anchor],
                ),
            ],
        )

    def generate_structured(self, *, result_type, **kwargs):
        if result_type is SourceChunkAnalysis:
            self.call_counts["analysis"] += 1
            return SourceChunkAnalysis(
                document_title="Testskript",
                sections=[self.section],
                concepts=[self.concept],
            )
        if result_type is SeriesPlan:
            self.call_counts["plan"] += 1
            return SeriesPlan(title="Testserie", episodes=[self.plan])
        if result_type is EpisodeDraft:
            self.call_counts["content"] += 1
            return self._draft()
        if result_type is GroundingReport:
            self.call_counts["grounding"] += 1
            return GroundingReport(approved=True, issues=[])
        raise AssertionError(f"unexpected result type: {result_type}")

    def synthesize(self, *, output_path: Path, voice: str, **kwargs) -> None:
        self.call_counts["tts"] += 1
        if self.fail_tts_once:
            self.fail_tts_once = False
            raise RuntimeError("temporary failure api_key=sk-fake-secret-123456")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        create_tone(output_path, 440.0 if voice == "cedar" else 554.37)

    def transcribe(self, audio_path: Path) -> str:
        self.call_counts["transcribe"] += 1
        return "Vollständiger verständlicher Dialog über Wirksamkeit und Bekanntgabe."

    def compare_audio(self, draft: EpisodeDraft, transcript: str) -> AudioCheck:
        self.call_counts["audio_check"] += 1
        return AudioCheck(passed=True, issues=[])


class RepairGateway(FakeGateway):
    def compare_audio(self, draft: EpisodeDraft, transcript: str) -> AudioCheck:
        self.call_counts["audio_check"] += 1
        if self.call_counts["audio_check"] == 1:
            return AudioCheck(
                passed=False,
                issues=[
                    AudioIssue(
                        segment_id="segment-005",
                        expected="Die Bekanntgabe.",
                        observed="Unverständlich.",
                        reason="Der Rechtsbegriff fehlt.",
                    )
                ],
            )
        return AudioCheck(passed=True, issues=[])


class PipelineResumeTests(unittest.TestCase):
    def test_audio_check_repairs_only_the_reported_speech_segment(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "skript.pdf"
            create_pdf(source)
            config = PipelineConfig(input_pdf=source, output_base=root / "out")
            gateway = RepairGateway()

            run_pipeline(
                config,
                gateway,
                resolve_ffmpeg(None),
                minimum_duration_seconds=1.0,
            )

            speech_chunk_count = sum(
                len(split_tts_text(segment.text))
                for segment in gateway._draft().segments
                if isinstance(segment, SpeechSegment)
            )
            self.assertEqual(gateway.call_counts["tts"], speech_chunk_count + 1)
            self.assertEqual(gateway.call_counts["audio_check"], 2)

    def test_reuses_complete_run_and_invalidates_only_voice_dependents(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "skript.pdf"
            create_pdf(source)
            config = PipelineConfig(input_pdf=source, output_base=root / "out")
            gateway = FakeGateway()
            ffmpeg = resolve_ffmpeg(None)

            first = run_pipeline(
                config, gateway, ffmpeg, minimum_duration_seconds=1.0
            )
            calls_after_first = gateway.call_counts.copy()
            second = run_pipeline(
                config, gateway, ffmpeg, minimum_duration_seconds=1.0
            )

            self.assertEqual(gateway.call_counts, calls_after_first)
            self.assertEqual(first, second)
            self.assertTrue(
                (
                    first
                    / "episodes/01-wirksamkeit/01-wirksamkeit.mp3"
                ).is_file()
            )

            changed_voice = dataclasses.replace(config, wolpi_voice="coral")
            run_pipeline(
                changed_voice, gateway, ffmpeg, minimum_duration_seconds=1.0
            )

            self.assertEqual(
                gateway.call_counts["analysis"], calls_after_first["analysis"]
            )
            self.assertEqual(gateway.call_counts["plan"], calls_after_first["plan"])
            self.assertGreater(gateway.call_counts["tts"], calls_after_first["tts"])
            self.assertGreater(
                gateway.call_counts["audio_check"],
                calls_after_first["audio_check"],
            )

    def test_changed_source_invalidates_every_model_stage(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "skript.pdf"
            create_pdf(source)
            config = PipelineConfig(input_pdf=source, output_base=root / "out")
            gateway = FakeGateway()
            ffmpeg = resolve_ffmpeg(None)
            run_pipeline(config, gateway, ffmpeg, minimum_duration_seconds=1.0)
            before = gateway.call_counts.copy()

            create_pdf(source, marker="zweite-fassung")
            run_pipeline(config, gateway, ffmpeg, minimum_duration_seconds=1.0)

            for stage in (
                "analysis",
                "plan",
                "content",
                "grounding",
                "tts",
                "audio_check",
            ):
                self.assertGreater(gateway.call_counts[stage], before[stage])

    def test_failed_tts_stage_is_resumable_and_manifest_redacts_key(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "skript.pdf"
            create_pdf(source)
            config = PipelineConfig(input_pdf=source, output_base=root / "out")
            gateway = FakeGateway(fail_tts_once=True)

            with self.assertRaisesRegex(RuntimeError, "temporary failure"):
                run_pipeline(
                    config,
                    gateway,
                    resolve_ffmpeg(None),
                    minimum_duration_seconds=1.0,
                )

            manifest_path = config.job_dir / "manifest.json"
            manifest_text = manifest_path.read_text(encoding="utf-8")
            self.assertNotIn("sk-fake-secret", manifest_text)
            failed = [
                stage
                for stage in json.loads(manifest_text)["stages"].values()
                if stage["status"] == "failed"
            ]
            self.assertEqual(len(failed), 1)

            result = run_pipeline(
                config,
                gateway,
                resolve_ffmpeg(None),
                minimum_duration_seconds=1.0,
            )
            self.assertTrue((result / "summary.json").is_file())


if __name__ == "__main__":
    unittest.main()
