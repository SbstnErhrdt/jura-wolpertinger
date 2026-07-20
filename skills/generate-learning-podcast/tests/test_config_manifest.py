from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from config import PipelineConfig, slugify
from manifest import ManifestStore, atomic_write_text, stable_hash


class ConfigTests(unittest.TestCase):
    def test_slugify_handles_german_title_and_job_dir(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "Öffentliches Recht – Prüfung.pdf"
            source.write_bytes(b"%PDF-test")
            config = PipelineConfig(input_pdf=source, output_base=root / "out")

            self.assertEqual(slugify(source.stem), "oeffentliches-recht-pruefung")
            self.assertEqual(
                config.job_dir,
                (root / "out").resolve() / "oeffentliches-recht-pruefung",
            )
            self.assertEqual(config.text_model, "gpt-5.6")
            self.assertEqual(config.moderator_voice, "cedar")
            self.assertEqual(config.wolpi_voice, "marin")


class ManifestTests(unittest.TestCase):
    def test_atomic_text_write_replaces_the_complete_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "nested" / "transcript.md"

            atomic_write_text(path, "erste Fassung\n")
            atomic_write_text(path, "zweite Fassung\n")

            self.assertEqual(path.read_text(encoding="utf-8"), "zweite Fassung\n")

    def test_completed_stage_is_reused_until_input_or_output_hash_changes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            output = manifest_path.parent / "analysis" / "source-map.json"
            output.parent.mkdir()
            output.write_text("{}\n", encoding="utf-8")
            store = ManifestStore(manifest_path)
            first_hash = stable_hash({"source": "abc", "model": "gpt-5.6"})
            second_hash = stable_hash({"source": "def", "model": "gpt-5.6"})

            self.assertTrue(store.should_run("analysis", first_hash))
            store.begin("analysis", first_hash)
            store.complete("analysis", first_hash, [output])

            self.assertFalse(store.should_run("analysis", first_hash))
            output.write_text('{"changed": true}\n', encoding="utf-8")
            self.assertTrue(store.should_run("analysis", first_hash))
            self.assertTrue(store.should_run("analysis", second_hash))
            persisted = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(persisted["stages"]["analysis"]["status"], "completed")

    def test_failed_stage_redacts_secrets(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            store = ManifestStore(manifest_path)
            input_hash = stable_hash("input")
            fake_key = "sk-" + "testsecret123456"
            store.begin("tts/01/segment-001", input_hash)
            store.fail(
                "tts/01/segment-001",
                input_hash,
                f"temporary TTS error; api_key={fake_key}",
            )

            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            stage = data["stages"]["tts/01/segment-001"]
            self.assertEqual(stage["status"], "failed")
            self.assertEqual(stage["error"], "temporary TTS error; api_key=[redacted]")
            self.assertNotIn(fake_key, manifest_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
