from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from mutagen.mp3 import MP3


TEST_ROOT = Path(__file__).resolve().parent
SCRIPT_ROOT = TEST_ROOT.parent / "scripts"
sys.path.insert(0, str(TEST_ROOT))
sys.path.insert(0, str(SCRIPT_ROOT))

from config import PipelineConfig
from pipeline import run_pipeline
from render_audio import resolve_ffmpeg
from run_pipeline import _last_completed_stage
from test_pipeline_resume import FakeGateway, create_pdf
from validate_output import OutputValidationError, validate_job


class OutputValidationTests(unittest.TestCase):
    def create_valid_job(self, root: Path) -> Path:
        source = root / "skript.pdf"
        create_pdf(source)
        config = PipelineConfig(input_pdf=source, output_base=root / "out")
        return run_pipeline(
            config,
            FakeGateway(),
            resolve_ffmpeg(None),
            minimum_duration_seconds=1.0,
        )

    def test_accepts_complete_job_and_reports_short_target_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            job_dir = self.create_valid_job(Path(temp_dir))

            summary = validate_job(job_dir, minimum_duration_seconds=1.0)

            self.assertEqual(summary["episode_count"], 1)
            self.assertEqual(len(summary["mp3_paths"]), 1)
            self.assertTrue(summary["target_range_warnings"])

    def test_rejects_each_missing_or_failed_delivery_contract(self) -> None:
        mutations = {
            "missing MP3": lambda job, episode, mp3: mp3.unlink(),
            "source grounding": self.reject_grounding,
            "audio comparison": self.reject_audio,
            "AI disclosure metadata": self.remove_disclosure,
        }
        for expected, mutation in mutations.items():
            with self.subTest(expected=expected), tempfile.TemporaryDirectory() as temp_dir:
                job_dir = self.create_valid_job(Path(temp_dir))
                episode_dir = job_dir / "episodes/01-wirksamkeit"
                mp3 = episode_dir / "01-wirksamkeit.mp3"
                mutation(job_dir, episode_dir, mp3)

                with self.assertRaisesRegex(OutputValidationError, expected):
                    validate_job(job_dir, minimum_duration_seconds=1.0)

    @staticmethod
    def reject_grounding(job_dir: Path, episode_dir: Path, mp3: Path) -> None:
        (episode_dir / "source-check.json").write_text(
            json.dumps(
                {
                    "approved": False,
                    "issues": [
                        {
                            "segment_id": "segment-002",
                            "reason": "nicht belegt",
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )

    @staticmethod
    def reject_audio(job_dir: Path, episode_dir: Path, mp3: Path) -> None:
        (episode_dir / "audio-check.json").write_text(
            json.dumps(
                {
                    "passed": False,
                    "issues": [
                        {
                            "segment_id": "segment-002",
                            "expected": "Wirksamkeit",
                            "observed": "Unverständlich",
                            "reason": "Rechtsbegriff fehlt",
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )

    @staticmethod
    def remove_disclosure(job_dir: Path, episode_dir: Path, mp3: Path) -> None:
        audio = MP3(mp3)
        for key in list(audio.tags or {}):
            if key == "TXXX:comment" or key.startswith("COMM"):
                del audio.tags[key]
        audio.save()


class CliPreflightTests(unittest.TestCase):
    def test_last_completed_stage_uses_timestamps_not_json_key_order(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "stages": {
                            "plan": {
                                "status": "completed",
                                "completed_at": "2026-07-20T14:28:42+00:00",
                            },
                            "source": {
                                "status": "completed",
                                "completed_at": "2026-07-20T14:17:11+00:00",
                            },
                        }
                    },
                    sort_keys=True,
                ),
                encoding="utf-8",
            )

            self.assertEqual(_last_completed_stage(manifest_path), "plan")

    def test_missing_api_key_does_not_create_job_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "skript.pdf"
            output_base = root / "out"
            create_pdf(source)
            environment = os.environ.copy()
            environment.pop("OPENAI_API_KEY", None)

            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_ROOT / "run_pipeline.py"),
                    str(source),
                    "--output-base",
                    str(output_base),
                ],
                env=environment,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertEqual(result.returncode, 2)
            self.assertIn("OPENAI_API_KEY is required", result.stderr)
            self.assertFalse(output_base.exists())


if __name__ == "__main__":
    unittest.main()
