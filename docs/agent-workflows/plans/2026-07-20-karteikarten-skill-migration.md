# Karteikarten Skill Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy the existing `karteikarten-erstellen` skill into this repository as a clean, self-contained, validated repository skill without changing its card-generation behavior.

**Architecture:** Preserve the existing Markdown guidance and Python generation heuristics, relocate only skill-path references from `.agents/skills` to `skills`, and exclude generated macOS/Python artifacts. Add UI metadata, pinned runtime requirements, and repository-local smoke tests that do not depend on Sabine's concrete decks.

**Tech Stack:** Codex skills, Python 3.12+, `pdfplumber`, ReportLab, `unittest`, Poppler rendering, skill-creator validation scripts.

## Global Constraints

- Source skill: `/Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen`.
- Target skill: `skills/karteikarten-erstellen`.
- Preserve all existing didactic rules, JSON shape, PDF layout, 4-up duplex ordering, and the `BACK_SIDE_SHIFT_DOWN_MM = -3` printer adjustment.
- Copy `SKILL.md`, `DIDAKTIK.md`, `FORMAT.md`, `SKRIPTE.md`, and every source `.py` file under `scripts/`.
- Do not copy `.DS_Store`, `__pycache__`, or `.pyc` files.
- Replace repository-facing `.agents/skills/karteikarten-erstellen` paths with `skills/karteikarten-erstellen`.
- Do not copy the source project's concrete decks, source PDFs, Markdown extracts, or generated print PDFs.
- Tests must construct all deck and project data in temporary directories.

---

## File Structure

- Create `skills/karteikarten-erstellen/SKILL.md`
  - Repository-local orchestration instructions with corrected script and test paths.
- Create `skills/karteikarten-erstellen/DIDAKTIK.md`
  - Existing didactic card-quality rules, copied without semantic changes.
- Create `skills/karteikarten-erstellen/FORMAT.md`
  - Existing JSON contract and examples, copied without semantic changes.
- Create `skills/karteikarten-erstellen/SKRIPTE.md`
  - Existing whole-script triage rules, copied without semantic changes.
- Create `skills/karteikarten-erstellen/agents/openai.yaml`
  - Human-facing Codex skill metadata.
- Create `skills/karteikarten-erstellen/scripts/*.py`
  - Existing audit, rendering, path, overview, and full-script generators.
- Create `skills/karteikarten-erstellen/scripts/requirements.txt`
  - Runtime dependencies for the copied scripts.
- Create `skills/karteikarten-erstellen/tests/test_skill.py`
  - Self-contained structure and functional smoke tests.
- Create `skills/karteikarten-erstellen/tests/render_smoke_fixture.py`
  - Deterministic sample PDF generator for visual QA.

## Task 1: Copy And Relocate The Skill

**Files:**
- Create: `skills/karteikarten-erstellen/SKILL.md`
- Create: `skills/karteikarten-erstellen/DIDAKTIK.md`
- Create: `skills/karteikarten-erstellen/FORMAT.md`
- Create: `skills/karteikarten-erstellen/SKRIPTE.md`
- Create: `skills/karteikarten-erstellen/agents/openai.yaml`
- Create: `skills/karteikarten-erstellen/scripts/audit_cards.py`
- Create: `skills/karteikarten-erstellen/scripts/build_cards.py`
- Create: `skills/karteikarten-erstellen/scripts/process_overview_pdfs.py`
- Create: `skills/karteikarten-erstellen/scripts/process_script_pdfs.py`
- Create: `skills/karteikarten-erstellen/scripts/project_paths.py`
- Create: `skills/karteikarten-erstellen/scripts/requirements.txt`
- Test: `skills/karteikarten-erstellen/tests/test_skill.py`

**Interfaces:**
- Consumes: the source directory `/Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen`.
- Produces: repository skill `skills/karteikarten-erstellen` with unchanged Python public functions such as `build_cards.validate_deck`, `build_cards.paginate_cards`, `build_cards.build_pdf`, and `project_paths.find_project_root`.

- [ ] **Step 1: Write the failing migration test**

Create `skills/karteikarten-erstellen/tests/test_skill.py` with the initial structure checks:

```python
from __future__ import annotations

import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]


class SkillMigrationTests(unittest.TestCase):
    def test_required_files_are_present(self) -> None:
        required = {
            "SKILL.md",
            "DIDAKTIK.md",
            "FORMAT.md",
            "SKRIPTE.md",
            "agents/openai.yaml",
            "scripts/audit_cards.py",
            "scripts/build_cards.py",
            "scripts/process_overview_pdfs.py",
            "scripts/process_script_pdfs.py",
            "scripts/project_paths.py",
            "scripts/requirements.txt",
        }
        missing = sorted(path for path in required if not (SKILL_ROOT / path).is_file())
        self.assertEqual(missing, [])

    def test_generated_artifacts_are_absent(self) -> None:
        forbidden = [
            path
            for path in SKILL_ROOT.rglob("*")
            if path.name == ".DS_Store" or path.suffix == ".pyc" or path.name == "__pycache__"
        ]
        self.assertEqual(forbidden, [])

    def test_skill_does_not_reference_old_agents_path(self) -> None:
        skill_text = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        self.assertNotIn(".agents/skills/karteikarten-erstellen", skill_text)
        self.assertIn("skills/karteikarten-erstellen/scripts/build_cards.py", skill_text)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the migration test to verify it fails**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/karteikarten-erstellen/tests/test_skill.py -v
```

Expected: FAIL because the copied skill files do not exist yet.

- [ ] **Step 3: Copy only source files**

Create the target directories, then copy the four Markdown files and five Python source files. Do not copy the source folder recursively.

```bash
mkdir -p skills/karteikarten-erstellen/agents skills/karteikarten-erstellen/scripts
cp /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/SKILL.md skills/karteikarten-erstellen/SKILL.md
cp /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/DIDAKTIK.md skills/karteikarten-erstellen/DIDAKTIK.md
cp /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/FORMAT.md skills/karteikarten-erstellen/FORMAT.md
cp /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/SKRIPTE.md skills/karteikarten-erstellen/SKRIPTE.md
cp /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/scripts/audit_cards.py skills/karteikarten-erstellen/scripts/audit_cards.py
cp /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/scripts/build_cards.py skills/karteikarten-erstellen/scripts/build_cards.py
cp /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/scripts/process_overview_pdfs.py skills/karteikarten-erstellen/scripts/process_overview_pdfs.py
cp /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/scripts/process_script_pdfs.py skills/karteikarten-erstellen/scripts/process_script_pdfs.py
cp /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/scripts/project_paths.py skills/karteikarten-erstellen/scripts/project_paths.py
```

- [ ] **Step 4: Correct repository-local paths and test command**

Apply these exact replacements in `skills/karteikarten-erstellen/SKILL.md`:

```diff
-- Skill-Skripte: `.agents/skills/karteikarten-erstellen/scripts/`
-- PDF-Builder: `.agents/skills/karteikarten-erstellen/scripts/build_cards.py`
-- Übersichtsgenerator als Referenz: `.agents/skills/karteikarten-erstellen/scripts/process_overview_pdfs.py`
-- Tests: `Karteikarten/tests/test_build_cards.py`
+- Skill-Skripte: `skills/karteikarten-erstellen/scripts/`
+- PDF-Builder: `skills/karteikarten-erstellen/scripts/build_cards.py`
+- Übersichtsgenerator als Referenz: `skills/karteikarten-erstellen/scripts/process_overview_pdfs.py`
+- Tests: `skills/karteikarten-erstellen/tests/test_skill.py`
```

```diff
-python3 .agents/skills/karteikarten-erstellen/scripts/build_cards.py Karteikarten/decks/<slug>.json Karteikarten/output/<slug>-print.pdf
+python3 skills/karteikarten-erstellen/scripts/build_cards.py Karteikarten/decks/<slug>.json Karteikarten/output/<slug>-print.pdf
```

```diff
-python3 -m unittest Karteikarten.tests.test_build_cards -v
+PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/karteikarten-erstellen/tests/test_skill.py -v
```

- [ ] **Step 5: Add pinned runtime requirements**

Create `skills/karteikarten-erstellen/scripts/requirements.txt`:

```text
pdfplumber>=0.11,<1
reportlab>=4.4,<5
```

- [ ] **Step 6: Generate Codex UI metadata**

Run:

```bash
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/generate_openai_yaml.py \
  skills/karteikarten-erstellen \
  --interface display_name="Karteikarten erstellen" \
  --interface short_description="Juristische PDFs in Lernkarten umwandeln" \
  --interface default_prompt='Use $karteikarten-erstellen to turn my legal PDF into a validated flashcard deck and printable duplex PDF.'
```

Expected `skills/karteikarten-erstellen/agents/openai.yaml`:

```yaml
interface:
  display_name: "Karteikarten erstellen"
  short_description: "Juristische PDFs in Lernkarten umwandeln"
  default_prompt: "Use $karteikarten-erstellen to turn my legal PDF into a validated flashcard deck and printable duplex PDF."
```

- [ ] **Step 7: Run the migration test**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/karteikarten-erstellen/tests/test_skill.py -v
```

Expected: all three tests PASS.

- [ ] **Step 8: Verify the migration diff is semantic-no-op outside paths and metadata**

Run:

```bash
diff -u /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/DIDAKTIK.md skills/karteikarten-erstellen/DIDAKTIK.md
diff -u /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/FORMAT.md skills/karteikarten-erstellen/FORMAT.md
diff -u /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/SKRIPTE.md skills/karteikarten-erstellen/SKRIPTE.md
diff -u /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/scripts/audit_cards.py skills/karteikarten-erstellen/scripts/audit_cards.py
diff -u /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/scripts/build_cards.py skills/karteikarten-erstellen/scripts/build_cards.py
diff -u /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/scripts/process_overview_pdfs.py skills/karteikarten-erstellen/scripts/process_overview_pdfs.py
diff -u /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/scripts/process_script_pdfs.py skills/karteikarten-erstellen/scripts/process_script_pdfs.py
diff -u /Users/sbstn/Documents/sabine/.agents/skills/karteikarten-erstellen/scripts/project_paths.py skills/karteikarten-erstellen/scripts/project_paths.py
```

Expected: every command exits 0 with no diff. `SKILL.md` is excluded from this byte-for-byte check because its repository paths intentionally changed.

- [ ] **Step 9: Commit the clean migration**

```bash
git add skills/karteikarten-erstellen
git commit -m "feat: add repository flashcard creation skill"
```

## Task 2: Add Self-Contained Functional Verification

**Files:**
- Modify: `skills/karteikarten-erstellen/tests/test_skill.py`
- Create: `skills/karteikarten-erstellen/tests/render_smoke_fixture.py`

**Interfaces:**
- Consumes: copied `build_cards.py` and `project_paths.py` without importing concrete Sabine project data.
- Produces: repeatable tests for deck validation, project discovery, duplex ordering, and non-empty PDF output.

- [ ] **Step 1: Extend the test with isolated module loading**

Add these imports and module-loading helpers to `test_skill.py` below `SKILL_ROOT`:

```python
import importlib.util
import json
import tempfile


SCRIPT_ROOT = SKILL_ROOT / "scripts"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {name} from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


build_cards = load_module("repo_skill_build_cards", SCRIPT_ROOT / "build_cards.py")
project_paths = load_module("repo_skill_project_paths", SCRIPT_ROOT / "project_paths.py")
```

Then add this test class:

```python
class SkillFunctionTests(unittest.TestCase):
    def test_project_root_accepts_workspace_and_karteikarten_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            workspace = Path(temp_dir)
            project = workspace / "Karteikarten"
            (project / "input").mkdir(parents=True)
            (project / "decks").mkdir()

            self.assertEqual(project_paths.find_project_root(workspace), project)
            self.assertEqual(project_paths.find_project_root(project), project)

    def test_validate_deck_and_duplex_order(self) -> None:
        deck = {
            "deck": {
                "title": "Testdeck",
                "subject": "Verwaltungsrecht",
                "source": "verwaltungsakt.pdf",
                "print_format": "a4-duplex-4up",
            },
            "cards": [
                {
                    "id": f"card-{index}",
                    "topic": "Verwaltungsakt",
                    "front": ["Definition", f"Begriff: Karte {index}", "Definition wiedergeben."],
                    "back": [f"Antwort {index}"],
                    "tags": ["test"],
                }
                for index in range(1, 5)
            ],
        }

        cards = build_cards.validate_deck(deck)
        pages = build_cards.paginate_cards(cards)

        self.assertEqual([card["id"] for card in pages[0]["fronts"]], ["card-1", "card-2", "card-3", "card-4"])
        self.assertEqual([card["id"] for card in pages[0]["backs"]], ["card-2", "card-1", "card-4", "card-3"])

    def test_build_pdf_creates_non_empty_duplex_document(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            deck_path = root / "deck.json"
            output_path = root / "cards.pdf"
            deck_path.write_text(
                json.dumps(
                    {
                        "deck": {
                            "title": "Testdeck",
                            "subject": "Strafrecht",
                            "source": "notwehr.pdf",
                            "print_format": "a4-duplex-4up",
                        },
                        "cards": [
                            {
                                "id": "notwehr-001",
                                "topic": "Notwehr",
                                "front": ["Definition", "Begriff: Notwehrlage", "Definition wiedergeben."],
                                "back": ["Gegenwärtiger rechtswidriger Angriff."],
                                "tags": ["strafrecht"],
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            build_cards.build_pdf(deck_path, output_path)

            self.assertTrue(output_path.is_file())
            self.assertGreater(output_path.stat().st_size, 1_000)
            self.assertEqual(output_path.read_bytes()[:4], b"%PDF")
```

- [ ] **Step 2: Create the visual smoke fixture script**

Create `skills/karteikarten-erstellen/tests/render_smoke_fixture.py`:

```python
from __future__ import annotations

import importlib.util
import json
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
BUILD_CARDS_PATH = SKILL_ROOT / "scripts" / "build_cards.py"
spec = importlib.util.spec_from_file_location("render_build_cards", BUILD_CARDS_PATH)
if spec is None or spec.loader is None:
    raise ImportError(f"Cannot load build_cards from {BUILD_CARDS_PATH}")
build_cards = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_cards)


def main() -> None:
    output_root = Path("/tmp/jura-wolpi-karteikarten-skill-smoke")
    output_root.mkdir(parents=True, exist_ok=True)
    deck_path = output_root / "deck.json"
    pdf_path = output_root / "cards.pdf"
    cards = []
    for index in range(1, 5):
        cards.append(
            {
                "id": f"verwaltungsakt-{index:03d}",
                "topic": "Verwaltungsakt und Wirksamkeit",
                "front": [
                    "Prüfungsschema-Karte",
                    f"Thema: Prüfungspunkt {index}",
                    "Frage: Welche Voraussetzung ist zu prüfen?",
                ],
                "back": [
                    "Die Rückseite enthält einen klaren Prüfungspunkt mit § 35 Satz 1 VwVfG.",
                    "Sie bleibt kurz genug für eine gut lesbare Karte.",
                ],
                "tags": ["verwaltungsrecht", "smoke"],
            }
        )
    deck_path.write_text(
        json.dumps(
            {
                "deck": {
                    "title": "Skill Smoke Test",
                    "subject": "Verwaltungsrecht",
                    "source": "verwaltungsrecht-smoke.pdf",
                    "print_format": "a4-duplex-4up",
                },
                "cards": cards,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    build_cards.build_pdf(deck_path, pdf_path)
    print(pdf_path)


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Create an isolated test environment and install requirements**

Run:

```bash
python3 -m venv /tmp/jura-wolpi-karteikarten-skill-venv
/tmp/jura-wolpi-karteikarten-skill-venv/bin/python -m pip install --upgrade pip
/tmp/jura-wolpi-karteikarten-skill-venv/bin/python -m pip install -r skills/karteikarten-erstellen/scripts/requirements.txt
```

Expected: installation exits 0 with `pdfplumber` and `reportlab` installed inside the temporary environment.

- [ ] **Step 4: Run Python and skill validation**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 /tmp/jura-wolpi-karteikarten-skill-venv/bin/python -m unittest skills/karteikarten-erstellen/tests/test_skill.py -v
PYTHONPYCACHEPREFIX=/tmp/jura-wolpi-karteikarten-skill-pycache /tmp/jura-wolpi-karteikarten-skill-venv/bin/python -m compileall -q skills/karteikarten-erstellen/scripts skills/karteikarten-erstellen/tests
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/karteikarten-erstellen
```

Expected: all tests PASS, compileall exits 0, and skill validation reports success.

- [ ] **Step 5: Render the smoke PDF for visual inspection**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 /tmp/jura-wolpi-karteikarten-skill-venv/bin/python skills/karteikarten-erstellen/tests/render_smoke_fixture.py
mkdir -p /tmp/jura-wolpi-karteikarten-skill-smoke/preview
pdftoppm -png -r 110 /tmp/jura-wolpi-karteikarten-skill-smoke/cards.pdf /tmp/jura-wolpi-karteikarten-skill-smoke/preview/page
```

Expected: `/tmp/jura-wolpi-karteikarten-skill-smoke/cards.pdf` and two rendered page PNGs exist. Inspect both PNGs and confirm that front/back card frames, source footer, text, and duplex order are visible without clipping or overlap.

- [ ] **Step 6: Check repository cleanliness and commit verification**

Run:

```bash
git diff --check
git status --short
find skills/karteikarten-erstellen -name .DS_Store -o -name __pycache__ -o -name '*.pyc'
```

Expected: no whitespace errors; only intended skill/test files are changed; the `find` command prints nothing.

Commit:

```bash
git add skills/karteikarten-erstellen/tests
git commit -m "test: verify repository flashcard skill"
```
