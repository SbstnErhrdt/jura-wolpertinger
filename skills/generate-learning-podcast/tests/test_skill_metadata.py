from __future__ import annotations

import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]


class SkillMetadataTests(unittest.TestCase):
    def test_skill_guidance_invokes_the_pipeline_and_has_no_placeholders(self) -> None:
        skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")

        self.assertTrue(skill.startswith("---\nname: generate-learning-podcast\n"))
        self.assertIn(
            "python3 skills/generate-learning-podcast/scripts/run_pipeline.py",
            skill,
        )
        self.assertIn("OPENAI_API_KEY", skill)
        self.assertIn("source-check.json", skill)
        self.assertNotIn("TODO", skill)
        self.assertLessEqual(len(skill.splitlines()), 140)

    def test_ui_metadata_names_the_skill_explicitly(self) -> None:
        metadata = (SKILL_ROOT / "agents/openai.yaml").read_text(encoding="utf-8")

        self.assertIn("$generate-learning-podcast", metadata)

    def test_maintainer_references_exist(self) -> None:
        for filename in (
            "artifact-schemas.md",
            "legal-source-rules.md",
            "voice-and-pronunciation.md",
        ):
            with self.subTest(filename=filename):
                self.assertTrue((SKILL_ROOT / "references" / filename).is_file())


if __name__ == "__main__":
    unittest.main()
