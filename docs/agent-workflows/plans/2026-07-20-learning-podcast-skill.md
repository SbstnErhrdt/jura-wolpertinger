# Learning Podcast Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use $subagent-driven-development (recommended) or $executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repository skill that automatically turns one legal PDF script into a resumable, source-grounded series of supportive two-speaker MP3 learning episodes.

**Architecture:** Keep `SKILL.md` as a thin orchestrator and place deterministic work in focused Python modules. Use OpenAI structured outputs for source analysis, series planning, dialogue, grounding, and audio comparison; use request-based OpenAI TTS for per-turn WAV files; use an automatically resolved FFmpeg binary for final MP3 assembly; persist every stage and artifact hash for restartability.

**Tech Stack:** Codex skills, Python 3.12+, OpenAI Python SDK 2.x, Pydantic 2.x, pypdf 6.x, ReportLab 4.x for tests, `imageio-ffmpeg`, Mutagen, `unittest`, OpenAI Responses/Audio APIs.

## Global Constraints

- Skill path: `skills/generate-learning-podcast`.
- One input PDF per run; the PDF is the only permitted legal source.
- No web search, statute lookup, case-law lookup, or model-knowledge enrichment.
- Default output: `output/learning-podcasts/{pdf-slug}/` relative to the caller's working directory.
- Run automatically from PDF inspection through every MP3 without an approval pause.
- Target 10–15 minutes and 1,350–2,025 spoken words per episode; preserve complete legal learning units over hard duration cuts.
- Include two or three direct retrieval questions with five-second silent pauses in every episode.
- Moderator role: male-read, adult, curious law student; default voice `cedar`.
- Wolpi role: warm, bright, calm, lightly playful legal expert; default voice `marin`.
- Default models: `gpt-5.6`, `gpt-4o-mini-tts`, and `gpt-4o-mini-transcribe`.
- Source-grounding repair limit: two rewrite cycles per episode.
- Structured-output/TTS retry limit: three attempts; transient API retry limit: five attempts with 1–30 second exponential backoff.
- Final audio: mono MP3, 128 kbit/s, -19 LUFS, maximum -1.5 dB True Peak.
- Read the API key only from `OPENAI_API_KEY`; never persist it or include it in logs.
- Send Responses calls with `store=False`.
- Every episode must disclose that it is AI-generated, source-bound to the uploaded PDF, and not an update check or official assessment.
- Spoken dialogue omits routine page citations; Markdown transcripts include source anchors.
- Do not modify Electron, Vue, Supabase, or `jura-voice-api` in this implementation.

---

## File Structure

- Create `skills/generate-learning-podcast/SKILL.md`
  - Thin invocation workflow, dependency preflight, command, success/failure handoff.
- Create `skills/generate-learning-podcast/agents/openai.yaml`
  - Skill display metadata and default invocation prompt.
- Create `skills/generate-learning-podcast/references/artifact-schemas.md`
  - Human-readable contracts for source maps, plans, drafts, checks, and manifests.
- Create `skills/generate-learning-podcast/references/legal-source-rules.md`
  - Strict PDF-only grounding and repair rules.
- Create `skills/generate-learning-podcast/references/voice-and-pronunciation.md`
  - Role prompts, German legal pronunciation, pacing, humor, and disclosure rules.
- Create `skills/generate-learning-podcast/scripts/requirements.txt`
  - Pinned-compatible Python runtime dependencies.
- Create `skills/generate-learning-podcast/scripts/config.py`
  - CLI-independent configuration, defaults, slugging, and semantic fingerprints.
- Create `skills/generate-learning-podcast/scripts/manifest.py`
  - Atomic JSON writes and hash-based stage/turn resume state.
- Create `skills/generate-learning-podcast/scripts/models.py`
  - Pydantic artifact models shared by OpenAI, pipeline, renderer, and validators.
- Create `skills/generate-learning-podcast/scripts/inspect_pdf.py`
  - PDF validation, copy, text/image inspection, and page-chunk creation.
- Create `skills/generate-learning-podcast/scripts/openai_steps.py`
  - OpenAI Responses, TTS, and transcription adapter plus retry behavior.
- Create `skills/generate-learning-podcast/scripts/pipeline.py`
  - Automatic semantic analysis, merge, plan, episode drafting, grounding, TTS, audio QA, and finalization.
- Create `skills/generate-learning-podcast/scripts/render_audio.py`
  - WAV silence, text splitting, FFmpeg resolution/concat/loudness/MP3, and Mutagen checks.
- Create `skills/generate-learning-podcast/scripts/validate_output.py`
  - Cross-artifact and final delivery validation.
- Create `skills/generate-learning-podcast/scripts/run_pipeline.py`
  - User-facing CLI and dependency/API-key preflight.
- Create `skills/generate-learning-podcast/tests/`
  - Standard-library unit, integration, CLI, and explicitly opted-in live smoke tests.

## Task 1: Skill Scaffold, Configuration, And Resumable Manifest

**Files:**
- Create: `skills/generate-learning-podcast/SKILL.md`
- Create: `skills/generate-learning-podcast/agents/openai.yaml`
- Create: `skills/generate-learning-podcast/scripts/requirements.txt`
- Create: `skills/generate-learning-podcast/scripts/config.py`
- Create: `skills/generate-learning-podcast/scripts/manifest.py`
- Test: `skills/generate-learning-podcast/tests/test_config_manifest.py`

**Interfaces:**
- Produces: `PipelineConfig`, `slugify`, `stable_hash`, `atomic_write_json`, and `ManifestStore`.
- `PipelineConfig.job_dir` is consumed by every later task.
- `ManifestStore.should_run(stage, input_hash)` and `ManifestStore.complete(stage, input_hash, outputs)` are consumed by PDF, model, TTS, render, and QA stages.

- [ ] **Step 1: Initialize the skill skeleton**

Run the required skill-creator initializer:

```bash
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/init_skill.py \
  generate-learning-podcast \
  --path skills \
  --resources scripts,references \
  --interface display_name="Lernpodcast erstellen" \
  --interface short_description="Juristische PDFs als MP3-Lernserie erklären" \
  --interface default_prompt='Use $generate-learning-podcast to turn my legal PDF into a source-grounded German MP3 learning series.'
```

Expected: `skills/generate-learning-podcast/` exists with `SKILL.md`, `agents/openai.yaml`, `scripts/`, and `references/`. Keep the skeleton uncommitted until the task's tests pass.

- [ ] **Step 2: Write the failing config and manifest tests**

Create `skills/generate-learning-podcast/tests/test_config_manifest.py`:

```python
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from config import PipelineConfig, slugify
from manifest import ManifestStore, stable_hash


class ConfigTests(unittest.TestCase):
    def test_slugify_handles_german_title_and_job_dir(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "Öffentliches Recht – Prüfung.pdf"
            source.write_bytes(b"%PDF-test")
            config = PipelineConfig(input_pdf=source, output_base=root / "out")

            self.assertEqual(slugify(source.stem), "oeffentliches-recht-pruefung")
            self.assertEqual(config.job_dir, root / "out" / "oeffentliches-recht-pruefung")
            self.assertEqual(config.text_model, "gpt-5.6")
            self.assertEqual(config.moderator_voice, "cedar")
            self.assertEqual(config.wolpi_voice, "marin")


class ManifestTests(unittest.TestCase):
    def test_completed_stage_is_reused_until_input_hash_changes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            store = ManifestStore(manifest_path)
            first_hash = stable_hash({"source": "abc", "model": "gpt-5.6"})
            second_hash = stable_hash({"source": "def", "model": "gpt-5.6"})

            self.assertTrue(store.should_run("analysis", first_hash))
            store.begin("analysis", first_hash)
            output = manifest_path.parent / "analysis/source-map.json"
            output.parent.mkdir()
            output.write_text("{}\n", encoding="utf-8")
            store.complete("analysis", first_hash, [output])

            self.assertFalse(store.should_run("analysis", first_hash))
            output.write_text('{"changed": true}\n', encoding="utf-8")
            self.assertTrue(store.should_run("analysis", first_hash))
            self.assertTrue(store.should_run("analysis", second_hash))
            persisted = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(persisted["stages"]["analysis"]["status"], "completed")

    def test_failed_stage_keeps_last_error_without_secrets(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            store = ManifestStore(manifest_path)
            input_hash = stable_hash("input")
            store.begin("tts/01/turn-001", input_hash)
            store.fail(
                "tts/01/turn-001",
                input_hash,
                "temporary TTS error; api_key=sk-testsecret123456",
            )

            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            stage = data["stages"]["tts/01/turn-001"]
            self.assertEqual(stage["status"], "failed")
            self.assertEqual(stage["error"], "temporary TTS error; api_key=[redacted]")
            self.assertNotIn("sk-testsecret", manifest_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the focused test to verify it fails**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/generate-learning-podcast/tests/test_config_manifest.py -v
```

Expected: FAIL because `config.py` and `manifest.py` do not exist.

- [ ] **Step 4: Add runtime requirements**

Create `skills/generate-learning-podcast/scripts/requirements.txt`:

```text
openai>=2.24,<3
pydantic>=2.12,<3
pypdf>=6.10,<7
reportlab>=4.4,<5
imageio-ffmpeg>=0.6,<1
mutagen>=1.47,<2
```

- [ ] **Step 5: Implement configuration**

Create `skills/generate-learning-podcast/scripts/config.py`:

```python
from __future__ import annotations

import re
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path


TRANSLITERATION = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})


def slugify(value: str) -> str:
    lowered = value.strip().lower().translate(TRANSLITERATION)
    normalized = unicodedata.normalize("NFKD", lowered).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return slug or "lern-podcast"


@dataclass(frozen=True)
class PipelineConfig:
    input_pdf: Path
    output_base: Path
    text_model: str = "gpt-5.6"
    tts_model: str = "gpt-4o-mini-tts"
    transcribe_model: str = "gpt-4o-mini-transcribe"
    moderator_voice: str = "cedar"
    wolpi_voice: str = "marin"
    target_minutes_min: int = 10
    target_minutes_max: int = 15
    spoken_words_per_minute: int = 135
    pause_seconds: int = 5
    mp3_bitrate: str = "128k"
    target_lufs: int = -19
    true_peak_db: float = -1.5
    max_structured_attempts: int = 3
    max_transient_attempts: int = 5
    max_grounding_rewrites: int = 2

    @property
    def job_dir(self) -> Path:
        return self.output_base.resolve() / slugify(self.input_pdf.stem)

    def semantic_values(self) -> dict[str, object]:
        values = asdict(self)
        values["input_pdf"] = str(self.input_pdf.resolve())
        values["output_base"] = str(self.output_base.resolve())
        return values
```

- [ ] **Step 6: Implement atomic manifest persistence**

Create `skills/generate-learning-podcast/scripts/manifest.py`:

```python
from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


PIPELINE_VERSION = "learning-podcast-v1"


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def stable_hash(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sanitize_error(value: str) -> str:
    redacted = re.sub(r"sk-[A-Za-z0-9_-]{8,}", "[redacted]", value)
    return re.sub(
        r"(?i)(authorization|api[_-]?key)(\s*[:=]\s*)\S+",
        r"\1\2[redacted]",
        redacted,
    )[:500]


def atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False)
    temp_path = Path(handle.name)
    try:
        with handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


def atomic_write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False)
    temp_path = Path(handle.name)
    try:
        with handle:
            handle.write(value)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


class ManifestStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        if path.exists():
            self.data = json.loads(path.read_text(encoding="utf-8"))
        else:
            self.data = {"pipeline_version": PIPELINE_VERSION, "stages": {}, "created_at": now_iso()}

    def should_run(self, stage: str, input_hash: str) -> bool:
        current = self.data["stages"].get(stage)
        if not current or current.get("status") != "completed" or current.get("input_hash") != input_hash:
            return True
        for output in current.get("outputs", []):
            path = self.path.parent / output["path"]
            if not path.is_file() or file_sha256(path) != output["sha256"]:
                return True
        return False

    def begin(self, stage: str, input_hash: str) -> None:
        self.data["stages"][stage] = {
            "status": "running",
            "input_hash": input_hash,
            "started_at": now_iso(),
            "outputs": [],
            "error": None,
        }
        self._save()

    def complete(self, stage: str, input_hash: str, outputs: list[Path]) -> None:
        records = []
        for path in outputs:
            resolved = path.resolve()
            if not resolved.is_file():
                raise FileNotFoundError(f"stage output does not exist: {resolved}")
            records.append(
                {
                    "path": os.path.relpath(resolved, self.path.parent.resolve()),
                    "sha256": file_sha256(resolved),
                }
            )
        self.data["stages"][stage] = {
            "status": "completed",
            "input_hash": input_hash,
            "completed_at": now_iso(),
            "outputs": records,
            "error": None,
        }
        self._save()

    def fail(self, stage: str, input_hash: str, error: str) -> None:
        self.data["stages"][stage] = {
            "status": "failed",
            "input_hash": input_hash,
            "failed_at": now_iso(),
            "outputs": [],
            "error": sanitize_error(error),
        }
        self._save()

    def set_run_metadata(self, metadata: dict[str, Any]) -> None:
        self.data["run"] = metadata
        self._save()

    def _save(self) -> None:
        atomic_write_json(self.path, self.data)
```

- [ ] **Step 7: Run the focused test**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/generate-learning-podcast/tests/test_config_manifest.py -v
```

Expected: all tests PASS.

- [ ] **Step 8: Commit the foundation**

```bash
git add skills/generate-learning-podcast
git commit -m "feat: scaffold resumable learning podcast skill"
```

## Task 2: PDF Inspection, Local Copy, And Page Chunks

**Files:**
- Create: `skills/generate-learning-podcast/scripts/inspect_pdf.py`
- Test: `skills/generate-learning-podcast/tests/test_inspect_pdf.py`

**Interfaces:**
- Produces dataclasses: `PdfInspection`, `PageInspection`, `PdfChunk`.
- Produces functions: `copy_source_pdf(source, destination)`, `inspect_pdf(path)`, and `write_page_chunks(path, output_dir, pages_per_chunk=20)`.
- Consumed by Task 4 source analysis and `run_pipeline.py`.

- [ ] **Step 1: Write failing PDF tests**

Create `skills/generate-learning-podcast/tests/test_inspect_pdf.py`:

```python
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from inspect_pdf import PdfInputError, copy_source_pdf, inspect_pdf, write_page_chunks


def create_text_pdf(path: Path, page_count: int) -> None:
    pdf = canvas.Canvas(str(path))
    for page in range(1, page_count + 1):
        pdf.drawString(72, 760, f"Kapitel {page}: Verwaltungsakt")
        pdf.drawString(72, 730, "Ein Verwaltungsakt wird anhand der Merkmale des Skripts geprüft.")
        pdf.showPage()
    pdf.save()


class PdfInspectionTests(unittest.TestCase):
    def test_inspects_text_and_copies_source_atomically(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source.pdf"
            copied = root / "job" / "source" / "source.pdf"
            create_text_pdf(source, 3)

            copy_source_pdf(source, copied)
            result = inspect_pdf(copied)

            self.assertEqual(result.page_count, 3)
            self.assertEqual(result.text_page_count, 3)
            self.assertEqual(len(result.sha256), 64)
            self.assertEqual(result.pages[0].page, 1)
            self.assertIn("Verwaltungsakt", result.pages[0].text)
            self.assertEqual(source.read_bytes(), copied.read_bytes())

    def test_splits_pdf_into_original_page_ranges(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source.pdf"
            create_text_pdf(source, 5)

            chunks = write_page_chunks(source, root / "chunks", pages_per_chunk=2)

            self.assertEqual([(chunk.page_start, chunk.page_end) for chunk in chunks], [(1, 2), (3, 4), (5, 5)])
            self.assertEqual([len(PdfReader(str(chunk.path)).pages) for chunk in chunks], [2, 2, 1])

    def test_rejects_encrypted_and_contentless_pdf(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            encrypted = root / "encrypted.pdf"
            writer = PdfWriter()
            writer.add_blank_page(width=595, height=842)
            writer.encrypt("secret")
            with encrypted.open("wb") as handle:
                writer.write(handle)

            with self.assertRaisesRegex(PdfInputError, "encrypted"):
                inspect_pdf(encrypted)

            empty = root / "empty.pdf"
            writer = PdfWriter()
            writer.add_blank_page(width=595, height=842)
            with empty.open("wb") as handle:
                writer.write(handle)

            with self.assertRaisesRegex(PdfInputError, "readable text or page images"):
                inspect_pdf(empty)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the focused PDF test to verify it fails**

Run in the Task 1 test environment after installing `scripts/requirements.txt`:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/generate-learning-podcast/tests/test_inspect_pdf.py -v
```

Expected: FAIL because `inspect_pdf.py` does not exist.

- [ ] **Step 3: Implement PDF inspection and chunking**

Create `skills/generate-learning-podcast/scripts/inspect_pdf.py`:

```python
from __future__ import annotations

import hashlib
import os
import shutil
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path

from pypdf import PdfReader, PdfWriter


class PdfInputError(ValueError):
    pass


@dataclass(frozen=True)
class PageInspection:
    page: int
    text: str
    has_images: bool


@dataclass(frozen=True)
class PdfInspection:
    filename: str
    sha256: str
    size_bytes: int
    page_count: int
    text_page_count: int
    image_page_count: int
    pages: list[PageInspection]

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class PdfChunk:
    index: int
    page_start: int
    page_end: int
    path: Path


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def copy_source_pdf(source: Path, destination: Path) -> None:
    if source.suffix.lower() != ".pdf" or not source.is_file():
        raise PdfInputError(f"Input must be an existing PDF: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile("wb", dir=destination.parent, delete=False)
    temp_path = Path(handle.name)
    try:
        with source.open("rb") as input_handle, handle:
            shutil.copyfileobj(input_handle, handle)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, destination)
    finally:
        temp_path.unlink(missing_ok=True)


def inspect_pdf(path: Path) -> PdfInspection:
    if path.suffix.lower() != ".pdf" or not path.is_file():
        raise PdfInputError(f"Input must be an existing PDF: {path}")
    try:
        reader = PdfReader(str(path))
    except Exception as error:
        raise PdfInputError(f"Cannot open PDF: {error}") from error
    if reader.is_encrypted:
        raise PdfInputError("PDF is encrypted and cannot be processed")
    if not reader.pages:
        raise PdfInputError("PDF has no pages")

    pages: list[PageInspection] = []
    for index, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        try:
            has_images = len(page.images) > 0
        except Exception:
            resources = page.get("/Resources")
            if hasattr(resources, "get_object"):
                resources = resources.get_object()
            has_images = isinstance(resources, dict) and "/XObject" in resources
        pages.append(PageInspection(page=index, text=text, has_images=has_images))

    text_page_count = sum(bool(page.text) for page in pages)
    image_page_count = sum(page.has_images for page in pages)
    if text_page_count == 0 and image_page_count == 0:
        raise PdfInputError("PDF has no readable text or page images")
    return PdfInspection(
        filename=path.name,
        sha256=file_sha256(path),
        size_bytes=path.stat().st_size,
        page_count=len(pages),
        text_page_count=text_page_count,
        image_page_count=image_page_count,
        pages=pages,
    )


def write_page_chunks(path: Path, output_dir: Path, pages_per_chunk: int = 20) -> list[PdfChunk]:
    if pages_per_chunk < 1:
        raise ValueError("pages_per_chunk must be positive")
    reader = PdfReader(str(path))
    output_dir.mkdir(parents=True, exist_ok=True)
    chunks: list[PdfChunk] = []
    for start in range(0, len(reader.pages), pages_per_chunk):
        writer = PdfWriter()
        end = min(start + pages_per_chunk, len(reader.pages))
        for page in reader.pages[start:end]:
            writer.add_page(page)
        chunk_path = output_dir / f"chunk-{len(chunks) + 1:03d}-pages-{start + 1:04d}-{end:04d}.pdf"
        with chunk_path.open("wb") as handle:
            writer.write(handle)
        chunks.append(PdfChunk(index=len(chunks) + 1, page_start=start + 1, page_end=end, path=chunk_path))
    return chunks
```

- [ ] **Step 4: Run the focused PDF test**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/generate-learning-podcast/tests/test_inspect_pdf.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit PDF ingestion**

```bash
git add skills/generate-learning-podcast/scripts/inspect_pdf.py skills/generate-learning-podcast/tests/test_inspect_pdf.py
git commit -m "feat: inspect and chunk podcast source PDFs"
```

## Task 3: Define Artifact Models And The Structured OpenAI Adapter

**Files:**
- Create: `skills/generate-learning-podcast/scripts/models.py`
- Create: `skills/generate-learning-podcast/scripts/openai_steps.py`
- Test: `skills/generate-learning-podcast/tests/test_openai_steps.py`

**Interfaces:**
- Produces Pydantic contracts for source analysis, series plans, dialogue, grounding, and audio QA.
- Produces `OpenAIGateway.generate_structured(...)` with `store=False`, PDF file input, schema parsing, and bounded retry behavior.
- Later tasks extend the same gateway with `synthesize(...)` and `transcribe(...)`.

- [ ] **Step 1: Write the failing structured-output adapter tests**

Create `skills/generate-learning-podcast/tests/test_openai_steps.py`:

```python
from __future__ import annotations

import base64
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from pydantic import BaseModel


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from openai_steps import OpenAIGateway


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
        return SimpleNamespace(output_parsed=outcome)


class OpenAIGatewayTests(unittest.TestCase):
    def test_structured_pdf_request_is_private_and_schema_parsed(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "source.pdf"
            pdf_path.write_bytes(b"%PDF-source")
            responses = FakeResponses([ExampleResult(answer="Nur aus dem Skript")])
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
            self.assertTrue(file_part["file_data"].startswith(prefix))
            self.assertEqual(base64.b64decode(file_part["file_data"][len(prefix):]), b"%PDF-source")

    def test_transient_errors_retry_before_success(self) -> None:
        error = RuntimeError("rate limited")
        error.status_code = 429
        responses = FakeResponses([error, ExampleResult(answer="ok")])
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
```

- [ ] **Step 2: Run the adapter test to verify it fails**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/generate-learning-podcast/tests/test_openai_steps.py -v
```

Expected: FAIL because `openai_steps.py` does not exist.

- [ ] **Step 3: Implement the shared artifact contracts**

Create `skills/generate-learning-podcast/scripts/models.py`:

```python
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator


class SourceAnchor(BaseModel):
    page: int = Field(ge=1)
    section: str = Field(min_length=1)
    excerpt: str = Field(min_length=1, max_length=350)


class SourceSection(BaseModel):
    id: str = Field(pattern=r"^section-[a-z0-9-]+$")
    title: str
    summary: str
    anchors: list[SourceAnchor] = Field(min_length=1)


class Concept(BaseModel):
    id: str = Field(pattern=r"^concept-[a-z0-9-]+$")
    title: str
    kind: Literal["definition", "norm", "schema", "dispute", "distinction", "example", "note"]
    explanation: str
    anchors: list[SourceAnchor] = Field(min_length=1)
    pronunciation_terms: list[str] = Field(default_factory=list)


class SourceChunkAnalysis(BaseModel):
    document_title: str
    sections: list[SourceSection]
    concepts: list[Concept]


class SourceMap(SourceChunkAnalysis):
    pronunciation_terms: list[str] = Field(default_factory=list)


class RecallPrompt(BaseModel):
    question: str
    expected_points: list[str] = Field(min_length=1)


class EpisodePlan(BaseModel):
    number: int = Field(ge=1)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str
    learning_goals: list[str] = Field(min_length=1, max_length=4)
    concept_ids: list[str] = Field(min_length=1)
    source_pages: list[int] = Field(min_length=1)
    target_words: int = Field(ge=1350, le=2025)
    recall_prompts: list[RecallPrompt] = Field(min_length=2, max_length=3)
    application_kind: Literal["mini-case", "example", "distinction"]


class SeriesPlan(BaseModel):
    title: str
    episodes: list[EpisodePlan] = Field(min_length=1)

    @model_validator(mode="after")
    def episode_numbers_are_contiguous(self) -> "SeriesPlan":
        numbers = [episode.number for episode in self.episodes]
        if numbers != list(range(1, len(numbers) + 1)):
            raise ValueError("episode numbers must be contiguous and start at one")
        if len({episode.slug for episode in self.episodes}) != len(self.episodes):
            raise ValueError("episode slugs must be unique")
        return self


class SpeechSegment(BaseModel):
    kind: Literal["speech"] = "speech"
    id: str = Field(pattern=r"^segment-[0-9]{3,}$")
    speaker: Literal["moderator", "wolpi"]
    text: str = Field(min_length=1)
    anchors: list[SourceAnchor] = Field(default_factory=list)
    delivery: str = "natural"
    purpose: Literal["disclosure", "dialogue", "retrieval-question", "feedback", "application"] = "dialogue"


class PauseSegment(BaseModel):
    kind: Literal["pause"] = "pause"
    id: str = Field(pattern=r"^segment-[0-9]{3,}$")
    duration_ms: int = Field(ge=100, le=10000)
    purpose: Literal["retrieval", "beat"]


EpisodeSegment = Annotated[SpeechSegment | PauseSegment, Field(discriminator="kind")]


class EpisodeDraft(BaseModel):
    number: int = Field(ge=1)
    slug: str
    title: str
    segments: list[EpisodeSegment] = Field(min_length=1)


class GroundingIssue(BaseModel):
    segment_id: str
    reason: str
    suggested_text: str | None = None


class GroundingReport(BaseModel):
    approved: bool
    issues: list[GroundingIssue] = Field(default_factory=list)

    @model_validator(mode="after")
    def approval_matches_issues(self) -> "GroundingReport":
        if self.approved == bool(self.issues):
            raise ValueError("approved must be true exactly when issues is empty")
        return self


class AudioIssue(BaseModel):
    segment_id: str
    expected: str
    observed: str
    reason: str


class AudioCheck(BaseModel):
    passed: bool
    issues: list[AudioIssue] = Field(default_factory=list)

    @model_validator(mode="after")
    def pass_matches_issues(self) -> "AudioCheck":
        if self.passed == bool(self.issues):
            raise ValueError("passed must be true exactly when issues is empty")
        return self
```

- [ ] **Step 4: Implement the structured Responses adapter**

Create `skills/generate-learning-podcast/scripts/openai_steps.py`:

```python
from __future__ import annotations

import base64
import time
from pathlib import Path
from typing import Callable, TypeVar

from pydantic import BaseModel, ValidationError


ResultT = TypeVar("ResultT", bound=BaseModel)


def is_transient(error: Exception) -> bool:
    status = getattr(error, "status_code", None)
    return isinstance(error, (ConnectionError, TimeoutError)) or status in {408, 409, 429} or (
        isinstance(status, int) and status >= 500
    )


class OpenAIGateway:
    def __init__(
        self,
        client,
        text_model: str,
        *,
        max_structured_attempts: int = 3,
        max_transient_attempts: int = 5,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.client = client
        self.text_model = text_model
        self.max_structured_attempts = max_structured_attempts
        self.max_transient_attempts = max_transient_attempts
        self.sleep = sleep

    def _with_transient_retry(self, call: Callable[[], object]):
        for attempt in range(self.max_transient_attempts):
            try:
                return call()
            except Exception as error:
                if not is_transient(error) or attempt + 1 == self.max_transient_attempts:
                    raise
                self.sleep(min(30.0, float(2**attempt)))
        raise AssertionError("unreachable")

    def generate_structured(
        self,
        *,
        result_type: type[ResultT],
        instructions: str,
        input_text: str,
        input_pdf: Path | None = None,
    ) -> ResultT:
        content: list[dict[str, str]] = [{"type": "input_text", "text": input_text}]
        if input_pdf is not None:
            encoded = base64.b64encode(input_pdf.read_bytes()).decode("ascii")
            content.append(
                {
                    "type": "input_file",
                    "filename": input_pdf.name,
                    "file_data": f"data:application/pdf;base64,{encoded}",
                }
            )

        last_error: Exception | None = None
        for _ in range(self.max_structured_attempts):
            try:
                response = self._with_transient_retry(
                    lambda: self.client.responses.parse(
                        model=self.text_model,
                        instructions=instructions,
                        input=[{"role": "user", "content": content}],
                        text_format=result_type,
                        store=False,
                    )
                )
                parsed = response.output_parsed
                if parsed is None:
                    raise ValueError("OpenAI returned no parsed structured output")
                return parsed if isinstance(parsed, result_type) else result_type.model_validate(parsed)
            except ValidationError as error:
                last_error = error
            except ValueError as error:
                last_error = error
        if last_error is not None:
            raise last_error
        raise RuntimeError("structured output failed without an error")
```

- [ ] **Step 5: Run model and adapter tests**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/generate-learning-podcast/tests/test_openai_steps.py -v
PYTHONPYCACHEPREFIX=/tmp/jura-wolpi-learning-podcast-pycache python3 -m compileall -q skills/generate-learning-podcast/scripts/models.py skills/generate-learning-podcast/scripts/openai_steps.py
```

Expected: tests PASS and compileall exits 0.

- [ ] **Step 6: Commit the contracts and adapter**

```bash
git add skills/generate-learning-podcast/scripts/models.py skills/generate-learning-podcast/scripts/openai_steps.py skills/generate-learning-podcast/tests/test_openai_steps.py
git commit -m "feat: add structured podcast generation adapter"
```

## Task 4: Analyse The PDF, Plan The Series, Draft Dialogue, And Enforce Grounding

**Files:**
- Create: `skills/generate-learning-podcast/scripts/pipeline.py`
- Test: `skills/generate-learning-podcast/tests/test_content_pipeline.py`

**Interfaces:**
- Produces `analyse_source`, `plan_series`, `source_slice`, `draft_and_ground`, `validate_episode`, `render_series_plan`, and `render_transcript`.
- Persists `analysis/source-map.json`, `analysis/concepts.json`, `analysis/pronunciation.json`, `series-plan.json`, `series-plan.md`, and per-episode `draft.json`, `source-check.json`, and `transcript.md`.
- Never asks for user approval between plan and episode production.

- [ ] **Step 1: Write failing source-only content tests**

Create `skills/generate-learning-podcast/tests/test_content_pipeline.py` with a routing fake gateway and these assertions:

```python
from __future__ import annotations

import sys
import unittest
from pathlib import Path


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

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
    SourceMap,
    SourceSection,
    SpeechSegment,
)
from pipeline import draft_and_ground, render_transcript, validate_episode


ANCHOR = SourceAnchor(page=3, section="Wirksamkeit", excerpt="Der Verwaltungsakt wird wirksam.")
PLAN = EpisodePlan(
    number=1,
    slug="wirksamkeit",
    title="Wirksamkeit",
    learning_goals=["Wirksamkeit erklären"],
    concept_ids=["concept-wirksamkeit"],
    source_pages=[3],
    target_words=1350,
    recall_prompts=[
        RecallPrompt(question="Wann wird er wirksam?", expected_points=["Bekanntgabe"]),
        RecallPrompt(question="Was ist zu trennen?", expected_points=["Wirksamkeit", "Rechtmäßigkeit"]),
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
            SpeechSegment(id="segment-001", speaker="moderator", purpose="disclosure", text="Diese KI-Folge nutzt nur das Skript und ist keine Aktualitäts- oder Prüfungsbewertung."),
            SpeechSegment(id="segment-002", speaker="wolpi", text="Wir schauen gelassen auf die Wirksamkeit. " + padding + " " + extra_text, anchors=[ANCHOR]),
            SpeechSegment(id="segment-003", speaker="moderator", purpose="retrieval-question", text="Wann wird der Verwaltungsakt wirksam?", anchors=[ANCHOR]),
            PauseSegment(id="segment-004", duration_ms=5000, purpose="retrieval"),
            SpeechSegment(id="segment-005", speaker="wolpi", purpose="feedback", text="Mit der Bekanntgabe.", anchors=[ANCHOR]),
            SpeechSegment(id="segment-006", speaker="moderator", purpose="retrieval-question", text="Was trennen wir davon?", anchors=[ANCHOR]),
            PauseSegment(id="segment-007", duration_ms=5000, purpose="retrieval"),
            SpeechSegment(id="segment-008", speaker="wolpi", purpose="feedback", text="Die Rechtmäßigkeit.", anchors=[ANCHOR]),
            SpeechSegment(id="segment-009", speaker="wolpi", purpose="application", text="Mini-Beispiel: Auch ein fehlerhafter Akt kann wirksam sein.", anchors=[ANCHOR]),
        ],
    )


class RoutingGateway:
    def __init__(self, values: list[object]) -> None:
        self.values = values
        self.calls: list[dict[str, object]] = []

    def generate_structured(self, **kwargs):
        self.calls.append(kwargs)
        return self.values.pop(0)


class ContentPipelineTests(unittest.TestCase):
    def test_validate_episode_requires_roles_retrieval_pauses_and_disclosure(self) -> None:
        validate_episode(PLAN, valid_draft())
        broken = valid_draft().model_copy(
            update={"segments": [segment for segment in valid_draft().segments if segment.kind != "pause"]}
        )
        with self.assertRaisesRegex(ValueError, "retrieval pauses"):
            validate_episode(PLAN, broken)

    def test_grounding_issue_triggers_one_rewrite_and_recheck(self) -> None:
        draft = valid_draft("Ungedeckte Behauptung")
        repaired = valid_draft("Reparierte Aussage")
        gateway = RoutingGateway(
            [
                draft,
                GroundingReport(
                    approved=False,
                    issues=[GroundingIssue(segment_id="segment-002", reason="Nicht im Skript belegt")],
                ),
                repaired,
                GroundingReport(approved=True, issues=[]),
            ]
        )

        result, report = draft_and_ground(gateway, PLAN, "source map", max_rewrites=2)

        self.assertTrue(result.segments[1].text.endswith("Reparierte Aussage"))
        self.assertTrue(report.approved)
        self.assertEqual(len(gateway.calls), 4)
        self.assertTrue(all("only" in call["instructions"].lower() or "ausschließlich" in call["instructions"].lower() for call in gateway.calls))

    def test_transcript_contains_page_anchor_but_spoken_text_does_not_gain_citations(self) -> None:
        transcript = render_transcript(valid_draft())
        self.assertIn("S. 3", transcript)
        self.assertNotIn("S. 3", valid_draft().segments[1].text)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the content tests to verify they fail**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/generate-learning-podcast/tests/test_content_pipeline.py -v
```

Expected: FAIL because `pipeline.py` does not exist.

- [ ] **Step 3: Implement immutable source-only prompt boundaries and validation**

Create `skills/generate-learning-podcast/scripts/pipeline.py`. Start with these imports, then define the prompt constants verbatim at module scope and use them in every respective model request:

```python
from __future__ import annotations

import re
from pathlib import Path

from inspect_pdf import PdfChunk
from manifest import atomic_write_json, atomic_write_text
from models import (
    EpisodeDraft,
    EpisodePlan,
    GroundingReport,
    PauseSegment,
    SeriesPlan,
    SourceChunkAnalysis,
    SourceMap,
    SpeechSegment,
)


SOURCE_ONLY = """Use only the uploaded PDF and the supplied source map. Do not add facts from memory, the web, statutes, cases, or general legal knowledge. Every substantive legal statement must carry at least one page anchor from the PDF. If the source does not support a statement, omit it and say the script does not establish it."""

ANALYSIS_INSTRUCTIONS = SOURCE_ONLY + """ Analyse this PDF chunk into coherent sections and exam-relevant concepts. Preserve definitions, statutory references, schemas, disputes, distinctions, and examples exactly as presented. Page numbers in the returned anchors are absolute PDF page numbers supplied in the request."""

PLAN_INSTRUCTIONS = SOURCE_ONLY + """ Split the material automatically into complete legal learning units. Each episode targets 1,350–2,025 spoken words, two or three retrieval questions, and one source-supported mini-case, example, or distinction. Do not ask the user to approve the plan."""

DRAFT_INSTRUCTIONS = SOURCE_ONLY + """ Write supportive German dialogue between moderator and Wolpi. The moderator is a curious adult law student who genuinely asks follow-up questions. Wolpi is warm, bright, calm, lightly playful, and precise. Begin with an AI/source-limit disclosure. Add exactly the planned retrieval questions, each immediately followed by a 5,000 ms retrieval pause and then feedback. Use the segment purpose fields for disclosure, retrieval-question, feedback, and exactly one application. Do not speak page citations."""

GROUNDING_INSTRUCTIONS = SOURCE_ONLY + """ Audit every legal speech segment against the source anchors. Mark the episode approved only when all legal claims are entailed by the supplied source map and excerpts. Style preferences are not grounding issues."""

REPAIR_INSTRUCTIONS = SOURCE_ONLY + """ Rewrite only the reported segments. Keep segment IDs, roles, retrieval pauses, order, and all already grounded material unchanged. Remove unsupported claims rather than enriching them."""


def spoken_word_count(draft: EpisodeDraft) -> int:
    return sum(
        len(re.findall(r"\b[\wÄÖÜäöüß]+\b", segment.text, flags=re.UNICODE))
        for segment in draft.segments
        if isinstance(segment, SpeechSegment)
    )


def validate_episode(plan: EpisodePlan, draft: EpisodeDraft) -> None:
    if draft.number != plan.number or draft.slug != plan.slug:
        raise ValueError("draft identity does not match episode plan")
    speakers = {segment.speaker for segment in draft.segments if isinstance(segment, SpeechSegment)}
    if speakers != {"moderator", "wolpi"}:
        raise ValueError("episode must contain both moderator and wolpi")
    retrieval_pauses = [
        segment for segment in draft.segments
        if isinstance(segment, PauseSegment) and segment.purpose == "retrieval"
    ]
    if len(retrieval_pauses) != len(plan.recall_prompts) or any(
        pause.duration_ms != 5000 for pause in retrieval_pauses
    ):
        raise ValueError("episode retrieval pauses must match the plan and last 5000 ms")
    for index, segment in enumerate(draft.segments):
        if isinstance(segment, PauseSegment) and segment.purpose == "retrieval":
            if index == 0 or index + 1 == len(draft.segments):
                raise ValueError("retrieval pause must follow a question and precede feedback")
            before, after = draft.segments[index - 1], draft.segments[index + 1]
            if not (
                isinstance(before, SpeechSegment)
                and before.purpose == "retrieval-question"
                and isinstance(after, SpeechSegment)
                and after.purpose == "feedback"
            ):
                raise ValueError("retrieval pause must follow a question and precede feedback")
    if sum(
        isinstance(segment, SpeechSegment) and segment.purpose == "application"
        for segment in draft.segments
    ) != 1:
        raise ValueError("episode must contain exactly one planned application")
    spoken = " ".join(
        segment.text for segment in draft.segments if isinstance(segment, SpeechSegment)
    ).lower()
    disclosure_terms = ("ki", "skript", "aktual", "prüfung")
    if not all(term in spoken for term in disclosure_terms):
        raise ValueError("episode must disclose AI generation and source limitations")
    if not 1350 <= spoken_word_count(draft) <= 2025:
        raise ValueError("episode must contain 1350 to 2025 spoken words")
    legal_segments = [
        segment for segment in draft.segments
        if isinstance(segment, SpeechSegment) and segment.purpose != "disclosure"
    ]
    if any(not segment.anchors for segment in legal_segments):
        raise ValueError("every substantive speech segment needs a source anchor")
```

- [ ] **Step 4: Implement analysis, planning, drafting, repair, and transcript rendering**

In the same file implement the following functions. Serialize model inputs with `model_dump_json(indent=2)` so the exact source scope is inspectable in artifacts and tests:

```python
def analyse_source(gateway, chunks: list[PdfChunk]) -> SourceMap:
    analyses: list[SourceChunkAnalysis] = []
    for chunk in chunks:
        analysis = gateway.generate_structured(
            result_type=SourceChunkAnalysis,
            instructions=ANALYSIS_INSTRUCTIONS,
            input_text=(
                f"This chunk contains original PDF pages {chunk.page_start}-{chunk.page_end}. "
                f"Chunk page 1 equals original PDF page {chunk.page_start}; add {chunk.page_start - 1} "
                "to each chunk-local page number when returning anchors."
            ),
            input_pdf=chunk.path,
        )
        for anchored in [*analysis.sections, *analysis.concepts]:
            if any(not chunk.page_start <= anchor.page <= chunk.page_end for anchor in anchored.anchors):
                raise ValueError(f"chunk {chunk.index} returned an anchor outside its absolute page range")
        analyses.append(analysis)
    sections = [
        section.model_copy(
            update={"id": f"section-chunk-{chunk.index:03d}-{section.id.removeprefix('section-')}"}
        )
        for chunk, analysis in zip(chunks, analyses, strict=True)
        for section in analysis.sections
    ]
    concepts = [
        concept.model_copy(
            update={"id": f"concept-chunk-{chunk.index:03d}-{concept.id.removeprefix('concept-')}"}
        )
        for chunk, analysis in zip(chunks, analyses, strict=True)
        for concept in analysis.concepts
    ]
    terms = sorted({term for concept in concepts for term in concept.pronunciation_terms})
    title = next((analysis.document_title for analysis in analyses if analysis.document_title), "Lernskript")
    return SourceMap(document_title=title, sections=sections, concepts=concepts, pronunciation_terms=terms)


def plan_series(gateway, source_map: SourceMap) -> SeriesPlan:
    plan = gateway.generate_structured(
        result_type=SeriesPlan,
        instructions=PLAN_INSTRUCTIONS,
        input_text=source_map.model_dump_json(indent=2),
    )
    concepts_by_id = {concept.id: concept for concept in source_map.concepts}
    known = set(concepts_by_id)
    planned: list[str] = []
    for episode in plan.episodes:
        unknown = sorted(set(episode.concept_ids) - known)
        if unknown:
            raise ValueError(f"episode references unknown concepts: {unknown}")
        if len(episode.concept_ids) != len(set(episode.concept_ids)):
            raise ValueError(f"episode {episode.number} repeats a concept")
        allowed_pages = {
            anchor.page
            for concept_id in episode.concept_ids
            for anchor in concepts_by_id[concept_id].anchors
        }
        if not set(episode.source_pages) <= allowed_pages:
            raise ValueError(f"episode {episode.number} references pages outside its concepts")
        planned.extend(episode.concept_ids)
    if set(planned) != known or len(planned) != len(set(planned)):
        raise ValueError("series plan must cover every analysed concept exactly once")
    return plan


def source_slice(source_map: SourceMap, plan: EpisodePlan) -> SourceMap:
    concept_ids = set(plan.concept_ids)
    page_ids = set(plan.source_pages)
    concepts = [concept for concept in source_map.concepts if concept.id in concept_ids]
    sections = [
        section
        for section in source_map.sections
        if any(anchor.page in page_ids for anchor in section.anchors)
    ]
    terms = sorted({term for concept in concepts for term in concept.pronunciation_terms})
    if {concept.id for concept in concepts} != concept_ids:
        raise ValueError("episode source slice is missing a planned concept")
    return SourceMap(
        document_title=source_map.document_title,
        sections=sections,
        concepts=concepts,
        pronunciation_terms=terms,
    )


def draft_and_ground(gateway, plan: EpisodePlan, source_map_text: str, max_rewrites: int) -> tuple[EpisodeDraft, GroundingReport]:
    draft = gateway.generate_structured(
        result_type=EpisodeDraft,
        instructions=DRAFT_INSTRUCTIONS,
        input_text=plan.model_dump_json(indent=2) + "\nSOURCE MAP\n" + source_map_text,
    )
    validate_episode(plan, draft)
    report = gateway.generate_structured(
        result_type=GroundingReport,
        instructions=GROUNDING_INSTRUCTIONS,
        input_text=source_map_text + "\nEPISODE\n" + draft.model_dump_json(indent=2),
    )
    for _ in range(max_rewrites):
        if report.approved:
            return draft, report
        draft = gateway.generate_structured(
            result_type=EpisodeDraft,
            instructions=REPAIR_INSTRUCTIONS,
            input_text=(
                source_map_text
                + "\nEPISODE\n"
                + draft.model_dump_json(indent=2)
                + "\nISSUES\n"
                + report.model_dump_json(indent=2)
            ),
        )
        validate_episode(plan, draft)
        report = gateway.generate_structured(
            result_type=GroundingReport,
            instructions=GROUNDING_INSTRUCTIONS,
            input_text=source_map_text + "\nEPISODE\n" + draft.model_dump_json(indent=2),
        )
    if not report.approved:
        raise ValueError(f"episode {plan.number} remains ungrounded after {max_rewrites} rewrites")
    return draft, report


def render_transcript(draft: EpisodeDraft) -> str:
    lines = [f"# Folge {draft.number}: {draft.title}", ""]
    for segment in draft.segments:
        if isinstance(segment, PauseSegment):
            lines.extend([f"_[{segment.duration_ms / 1000:g} Sekunden Denkpause]_", ""])
            continue
        label = "Moderator" if segment.speaker == "moderator" else "Wolpi"
        pages = sorted({anchor.page for anchor in segment.anchors})
        citation = "" if not pages else " " + " ".join(f"[S. {page}]" for page in pages)
        lines.extend([f"**{label}:** {segment.text}{citation}", ""])
    return "\n".join(lines).rstrip() + "\n"


def render_series_plan(plan: SeriesPlan) -> str:
    lines = [f"# {plan.title}", ""]
    for episode in plan.episodes:
        pages = ", ".join(str(page) for page in sorted(set(episode.source_pages)))
        lines.extend(
            [
                f"## {episode.number}. {episode.title}",
                "",
                f"- Zielwörter: {episode.target_words}",
                f"- PDF-Seiten: {pages}",
                f"- Lernziele: {'; '.join(episode.learning_goals)}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"
```

Also add these small persistence helpers. The episode orchestration passes only
`source_slice(source_map, episode_plan).model_dump_json(indent=2)` into `draft_and_ground`, never
the unrestricted full source map:

```python
def write_model(path: Path, model) -> None:
    atomic_write_json(path, model.model_dump(mode="json"))


def write_text(path: Path, text: str) -> None:
    atomic_write_text(path, text)
```

The orchestration function must write the source map and series plan before iterating every episode without any `input()`, confirmation callback, or approval state.

- [ ] **Step 5: Run the content tests and prompt-boundary check**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/generate-learning-podcast/tests/test_content_pipeline.py -v
rg -n "input\(|approval|confirm" skills/generate-learning-podcast/scripts/pipeline.py
```

Expected: tests PASS. The `rg` output may show prose in prompt constants but no interactive call or approval branch.

- [ ] **Step 6: Commit the source-grounded content pipeline**

```bash
git add skills/generate-learning-podcast/scripts/pipeline.py skills/generate-learning-podcast/tests/test_content_pipeline.py
git commit -m "feat: generate source-grounded podcast dialogue"
```

## Task 5: Synthesize Turns And Assemble Validated MP3 Audio

**Files:**
- Modify: `skills/generate-learning-podcast/scripts/openai_steps.py`
- Create: `skills/generate-learning-podcast/scripts/render_audio.py`
- Test: `skills/generate-learning-podcast/tests/test_render_audio.py`

**Interfaces:**
- Extends `OpenAIGateway` with `synthesize(text, voice, instructions, output_path)`.
- Produces one WAV per speech segment, real silent WAVs for pauses, and one normalized mono 128 kbit/s MP3 per episode.
- Resolves FFmpeg from the explicit CLI path, `LEARNING_PODCAST_FFMPEG`, `PATH`, then `imageio-ffmpeg`; does not require `ffprobe`.

- [ ] **Step 1: Write failing audio utility tests**

Create `skills/generate-learning-podcast/tests/test_render_audio.py`:

```python
from __future__ import annotations

import os
import sys
import tempfile
import unittest
import wave
from pathlib import Path


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from render_audio import create_silence_wav, render_mp3, resolve_ffmpeg, split_tts_text, validate_mp3


class RenderAudioTests(unittest.TestCase):
    def test_long_text_splits_at_sentence_boundaries(self) -> None:
        text = ("Das ist ein vollständiger Satz. " * 400).strip()
        chunks = split_tts_text(text, max_chars=1000)
        self.assertGreater(len(chunks), 1)
        self.assertEqual(" ".join(chunks), text)
        self.assertTrue(all(len(chunk) <= 1000 for chunk in chunks))

    def test_silence_has_requested_duration(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "pause.wav"
            create_silence_wav(path, duration_ms=5000)
            with wave.open(str(path), "rb") as audio:
                self.assertEqual(audio.getnchannels(), 1)
                self.assertAlmostEqual(audio.getnframes() / audio.getframerate(), 5.0, places=2)

    def test_rendered_mp3_has_duration_and_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            first = root / "first.wav"
            second = root / "second.wav"
            create_silence_wav(first, duration_ms=600)
            create_silence_wav(second, duration_ms=600)
            output = root / "episode.mp3"

            render_mp3(
                [first, second],
                output,
                title="Wirksamkeit",
                series="Wolpis Lernpodcast",
                source_name="skript.pdf",
                ffmpeg_path=resolve_ffmpeg(None),
            )
            info = validate_mp3(output)

            self.assertGreater(info.duration_seconds, 1.0)
            self.assertEqual(info.channels, 1)
            self.assertEqual(info.title, "Wirksamkeit")
            self.assertIn("AI-generated", info.comment)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the audio tests to verify they fail**

Run inside the podcast virtual environment created in Task 7 if already present; otherwise use the repository Python:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/generate-learning-podcast/tests/test_render_audio.py -v
```

Expected: FAIL because `render_audio.py` does not exist.

- [ ] **Step 3: Extend the OpenAI adapter with streaming WAV TTS**

Add to `OpenAIGateway.__init__` the `tts_model` argument and assignment, then add:

```python
    def synthesize(self, text: str, voice: str, instructions: str, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        def request() -> None:
            with self.client.audio.speech.with_streaming_response.create(
                model=self.tts_model,
                voice=voice,
                input=text,
                instructions=instructions,
                response_format="wav",
            ) as response:
                response.stream_to_file(output_path)

        last_error: Exception | None = None
        for _ in range(self.max_structured_attempts):
            try:
                self._with_transient_retry(request)
                if output_path.stat().st_size <= 44:
                    raise ValueError("TTS returned an empty WAV")
                return
            except (OSError, ValueError) as error:
                last_error = error
                output_path.unlink(missing_ok=True)
        if last_error is not None:
            raise last_error
```

Use these fixed delivery prompts from the approved role design:

```python
MODERATOR_DELIVERY = "German, adult male-read law student; curious, natural, encouraging, concise; ask genuine follow-up questions; never perform a caricature."
WOLPI_DELIVERY = "German, warm bright cute legal expert; calm, precise, gently playful, supportive; explain legal distinctions clearly without sounding childish."
```

- [ ] **Step 4: Implement deterministic audio utilities and FFmpeg assembly**

Create `render_audio.py` with:

```python
from __future__ import annotations

import os
import re
import shutil
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path

import imageio_ffmpeg
from mutagen.mp3 import MP3


@dataclass(frozen=True)
class Mp3Info:
    duration_seconds: float
    channels: int
    bitrate: int
    title: str
    comment: str


def split_tts_text(text: str, max_chars: int = 4000) -> list[str]:
    sentences = re.findall(r".*?(?:[.!?](?=\s|$)|$)", text.strip(), flags=re.DOTALL)
    parts = [sentence.strip() for sentence in sentences if sentence.strip()]
    chunks: list[str] = []
    current = ""
    for part in parts:
        if len(part) > max_chars:
            raise ValueError("single sentence exceeds the TTS chunk limit")
        candidate = part if not current else current + " " + part
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = part
    if current:
        chunks.append(current)
    return chunks


def resolve_ffmpeg(explicit: Path | None) -> Path:
    candidates = [
        str(explicit) if explicit else None,
        os.environ.get("LEARNING_PODCAST_FFMPEG"),
        shutil.which("ffmpeg"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file() and os.access(candidate, os.X_OK):
            return Path(candidate).resolve()
    bundled = Path(imageio_ffmpeg.get_ffmpeg_exe())
    if bundled.is_file() and os.access(bundled, os.X_OK):
        return bundled.resolve()
    raise RuntimeError("No executable FFmpeg binary found")


def create_silence_wav(path: Path, duration_ms: int, sample_rate: int = 24000) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame_count = round(sample_rate * duration_ms / 1000)
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        audio.writeframes(b"\x00\x00" * frame_count)


def render_mp3(
    inputs: list[Path],
    output: Path,
    *,
    title: str,
    series: str,
    source_name: str,
    ffmpeg_path: Path,
) -> None:
    if not inputs:
        raise ValueError("at least one audio input is required")
    output.parent.mkdir(parents=True, exist_ok=True)
    concat_path = output.with_suffix(".concat.txt")
    concat_path.write_text(
        "".join(f"file '{str(path.resolve()).replace(chr(39), chr(39) + chr(92) + chr(39) + chr(39))}'\n" for path in inputs),
        encoding="utf-8",
    )
    command = [
        str(ffmpeg_path), "-hide_banner", "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0", "-i", str(concat_path),
        "-af", "loudnorm=I=-19:TP=-1.5:LRA=7",
        "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "128k",
        "-metadata", f"title={title}",
        "-metadata", f"album={series}",
        "-metadata", "artist=Wolpi und Moderator",
        "-metadata", f"comment=AI-generated learning audio; source: {source_name}; no update check",
        str(output),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"FFmpeg failed: {error.stderr.strip()}") from error
    finally:
        concat_path.unlink(missing_ok=True)


def validate_mp3(path: Path) -> Mp3Info:
    if not path.is_file() or path.stat().st_size == 0:
        raise ValueError(f"missing or empty MP3: {path}")
    audio = MP3(path)
    tags = audio.tags
    if tags is None:
        raise ValueError("MP3 has no ID3 metadata")
    title = str(tags.get("TIT2", ""))
    comments = tags.getall("COMM")
    comment = str(comments[0]) if comments else ""
    if audio.info.channels != 1 or audio.info.bitrate < 120000:
        raise ValueError("MP3 must be mono at approximately 128 kbit/s")
    if "AI-generated" not in comment:
        raise ValueError("MP3 comment must disclose AI generation")
    return Mp3Info(audio.info.length, audio.info.channels, audio.info.bitrate, title, comment)
```

- [ ] **Step 5: Run the offline audio tests**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest skills/generate-learning-podcast/tests/test_render_audio.py -v
```

Expected: all tests PASS using the resolved system or `imageio-ffmpeg` binary, with no API call.

- [ ] **Step 6: Commit TTS and rendering**

```bash
git add skills/generate-learning-podcast/scripts/openai_steps.py skills/generate-learning-podcast/scripts/render_audio.py skills/generate-learning-podcast/tests/test_render_audio.py
git commit -m "feat: synthesize and assemble podcast audio"
```

## Task 6: Add Audio QA, Resume Semantics, Final Validation, And CLI

**Files:**
- Modify: `skills/generate-learning-podcast/scripts/openai_steps.py`
- Modify: `skills/generate-learning-podcast/scripts/pipeline.py`
- Create: `skills/generate-learning-podcast/scripts/validate_output.py`
- Create: `skills/generate-learning-podcast/scripts/run_pipeline.py`
- Test: `skills/generate-learning-podcast/tests/test_pipeline_resume.py`
- Test: `skills/generate-learning-podcast/tests/test_validate_output.py`

**Interfaces:**
- Extends `OpenAIGateway` with transcription.
- Produces an end-to-end `run_pipeline(config, gateway, ffmpeg_path)` that resumes by input hash.
- Produces a CLI accepting one PDF and optional model, voice, output, and FFmpeg overrides.
- Final output is considered complete only after source check, audio comparison, duration, metadata, and file-set validation pass.

- [ ] **Step 1: Write failing resume and invalidation tests**

In `test_pipeline_resume.py`, build a two-page ReportLab PDF and a fake gateway that returns deterministic analysis, plan, draft, grounding, transcription, and audio-check artifacts while writing one-second WAV files for TTS. Assert:

```python
first = run_pipeline(config, gateway, ffmpeg_path)
calls_after_first = gateway.call_counts.copy()
second = run_pipeline(config, gateway, ffmpeg_path)
self.assertEqual(gateway.call_counts, calls_after_first)
self.assertEqual(first, second)
self.assertTrue((first / "episodes/01-wirksamkeit/01-wirksamkeit.mp3").is_file())

changed_voice = dataclasses.replace(config, wolpi_voice="coral")
run_pipeline(changed_voice, gateway, ffmpeg_path)
self.assertEqual(gateway.call_counts["analysis"], calls_after_first["analysis"])
self.assertEqual(gateway.call_counts["plan"], calls_after_first["plan"])
self.assertGreater(gateway.call_counts["tts"], calls_after_first["tts"])
self.assertGreater(gateway.call_counts["audio_check"], calls_after_first["audio_check"])
```

Also assert that a failed stage stays resumable, a changed source hash invalidates analysis and every downstream stage, and no manifest value contains a fake API key.

- [ ] **Step 2: Write failing final-output tests**

In `test_validate_output.py`, create a minimal valid job directory and assert `validate_job(job_dir)` accepts it. Then independently remove the MP3, set `source-check.json` to `approved: false`, set `audio-check.json` to `passed: false`, and remove the AI metadata; assert each mutation raises a specific `OutputValidationError`.

- [ ] **Step 3: Run both new test modules to verify they fail**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest \
  skills/generate-learning-podcast/tests/test_pipeline_resume.py \
  skills/generate-learning-podcast/tests/test_validate_output.py -v
```

Expected: FAIL because orchestration, transcription, validation, and CLI are incomplete.

- [ ] **Step 4: Add transcription and audio comparison**

Extend `OpenAIGateway.__init__` with `transcribe_model`, then add:

```python
    def transcribe(self, audio_path: Path) -> str:
        def request():
            with audio_path.open("rb") as audio:
                return self.client.audio.transcriptions.create(
                    model=self.transcribe_model,
                    file=audio,
                    response_format="text",
                )

        response = self._with_transient_retry(request)
        return response if isinstance(response, str) else response.text

    def compare_audio(self, draft: EpisodeDraft, transcript: str) -> AudioCheck:
        return self.generate_structured(
            result_type=AudioCheck,
            instructions="Compare expected dialogue with the transcription. Report only omissions, substitutions that change legal meaning, speaker-text loss, or unintelligible legal terms. Ignore punctuation and harmless wording normalization.",
            input_text=draft.model_dump_json(indent=2) + "\nTRANSCRIPTION\n" + transcript,
        )
```

- [ ] **Step 5: Implement hash-scoped end-to-end orchestration**

In `pipeline.py`, implement `run_pipeline` with these exact stage dependencies and artifact names:

| Stage key | Input fingerprint | Required outputs |
|---|---|---|
| `source` | PDF SHA-256 + inspection version | `source/source.pdf`, `source/inspection.json`, chunks |
| `analysis` | source hash + text model + analysis prompt version | `analysis/source-map.json`, `analysis/concepts.json` |
| `plan` | source-map hash + text model + plan prompt version | `series-plan.json` |
| `episode/{NN}/content` | plan entry + source-map hash + text model + prompt versions | `draft.json`, `source-check.json`, `transcript.md` |
| `episode/{NN}/tts/{segment-id}` | speech text + role voice + TTS model + delivery prompt | `work/{segment-id}.wav` |
| `episode/{NN}/render` | ordered WAV hashes + audio settings + FFmpeg path/version | `{NN}-{slug}.mp3` |
| `episode/{NN}/audio-qa` | MP3 hash + draft hash + transcription model + text model | `audio-transcript.txt`, `audio-check.json` |
| `final` | plan + every source/audio check + every MP3 hash | `summary.json`, `manifest.json` status `completed` |

For every stage, call `ManifestStore.begin(...)` before work, write outputs atomically, call `complete(...)` only after validation, and call `fail(...)` on exceptions before re-raising. Reuse a stage only when `should_run(...)` is false **and every recorded output still exists with the recorded hash**. Episode iteration starts immediately after the plan is written. For audio issues, regenerate only the named speech segments, rerender, and recheck, for at most two repair cycles; fail the episode after the second unsuccessful comparison.

Use zero-padded directories `episodes/{number:02d}-{slug}`. Speech segments use the configured role voice and delivery prompt; pause segments use `create_silence_wav`. If a speech segment exceeds 4,000 characters, synthesize each `split_tts_text` chunk and concatenate those WAVs before episode assembly. This stays safely below the API's 4,096-character input limit. Preserve every intermediate WAV under the episode's `work/` directory to make resume deterministic.

- [ ] **Step 6: Implement final validation**

Create `validate_output.py` with `OutputValidationError` and `validate_job(job_dir)`. Validation must:

1. Parse `series-plan.json` as `SeriesPlan`.
2. Require exactly one episode directory and MP3 for every plan entry.
3. Parse each `draft.json`, `source-check.json`, and `audio-check.json` through Pydantic.
4. Require `GroundingReport.approved` and `AudioCheck.passed`.
5. Call `validate_episode(plan_entry, draft)` and `validate_mp3(mp3_path)`.
6. Require at least eight minutes of audio, record whether the episode falls inside the 10–15 minute target, and report rather than reject a longer complete learning unit.
7. Require transcript Markdown and audio transcription files to be non-empty.
8. Return a summary containing episode count, total duration, target-range warnings, and absolute MP3 paths; `run_pipeline` atomically writes it to `summary.json` before completing the final stage.

The offline unit fixture may pass `minimum_duration_seconds=1.0` to avoid generating an eight-minute test tone; production CLI must use the default of 480 seconds.

- [ ] **Step 7: Implement the user-facing CLI and preflight**

Create `run_pipeline.py` with:

```python
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate a source-grounded MP3 learning series from one legal PDF.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output-base", type=Path, default=Path("output/learning-podcasts"))
    parser.add_argument("--text-model", default="gpt-5.6")
    parser.add_argument("--tts-model", default="gpt-4o-mini-tts")
    parser.add_argument("--transcribe-model", default="gpt-4o-mini-transcribe")
    parser.add_argument("--moderator-voice", default="cedar")
    parser.add_argument("--wolpi-voice", default="marin")
    parser.add_argument("--ffmpeg", type=Path)
    return parser
```

`main()` must inspect the PDF and resolve FFmpeg before importing/constructing the OpenAI client. It reads only `os.environ["OPENAI_API_KEY"]`; when missing, print `OPENAI_API_KEY is required` to stderr and return exit code 2 without creating the job directory. Construct `PipelineConfig` from the parsed values, lazily import `OpenAI`, construct `OpenAIGateway` with all three model IDs and retry limits, run the pipeline, then print the absolute job directory and each final MP3 path. On failure, print the last completed manifest stage and the identical resume command, then return 1. Never print exception request headers or client objects that might contain credentials.

- [ ] **Step 8: Run resume, invalidation, validation, and CLI tests**

Run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest \
  skills/generate-learning-podcast/tests/test_pipeline_resume.py \
  skills/generate-learning-podcast/tests/test_validate_output.py -v
env -u OPENAI_API_KEY PYTHONDONTWRITEBYTECODE=1 python3 skills/generate-learning-podcast/scripts/run_pipeline.py /tmp/does-not-exist.pdf
```

Expected: unit tests PASS. The CLI exits 2 with a concise input/preflight error and no traceback.

- [ ] **Step 9: Commit complete resumable production**

```bash
git add \
  skills/generate-learning-podcast/scripts/openai_steps.py \
  skills/generate-learning-podcast/scripts/pipeline.py \
  skills/generate-learning-podcast/scripts/validate_output.py \
  skills/generate-learning-podcast/scripts/run_pipeline.py \
  skills/generate-learning-podcast/tests/test_pipeline_resume.py \
  skills/generate-learning-podcast/tests/test_validate_output.py
git commit -m "feat: run and resume complete podcast production"
```

## Task 7: Finish Skill Guidance And Run Full Verification

**Files:**
- Modify: `skills/generate-learning-podcast/SKILL.md`
- Modify: `skills/generate-learning-podcast/agents/openai.yaml`
- Create: `skills/generate-learning-podcast/references/artifact-schemas.md`
- Create: `skills/generate-learning-podcast/references/legal-source-rules.md`
- Create: `skills/generate-learning-podcast/references/voice-and-pronunciation.md`
- Create: `skills/generate-learning-podcast/tests/test_skill_metadata.py`
- Create: `skills/generate-learning-podcast/tests/live_smoke.py`

**Interfaces:**
- `SKILL.md` invokes the tested CLI and reports artifacts; it does not duplicate implementation logic.
- References document artifact, legal-source, and voice contracts for maintainers.
- Live smoke is explicitly opt-in and never spends API credits during the ordinary test suite.

- [ ] **Step 1: Write failing metadata tests**

Create `test_skill_metadata.py` and assert:

```python
skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
self.assertTrue(skill.startswith("---\nname: generate-learning-podcast\n"))
self.assertIn("python3 skills/generate-learning-podcast/scripts/run_pipeline.py", skill)
self.assertIn("OPENAI_API_KEY", skill)
self.assertIn("source-check.json", skill)
self.assertNotIn("TODO", skill)
metadata = (SKILL_ROOT / "agents/openai.yaml").read_text(encoding="utf-8")
self.assertIn('$generate-learning-podcast', metadata)
```

- [ ] **Step 2: Replace the generated placeholder guidance**

Write a concise `SKILL.md` whose YAML description triggers on requests to turn a legal PDF/script into an automatic German MP3 learning podcast. Its workflow must:

1. Require exactly one local PDF path and explain the PDF-only legal-source boundary.
2. Run a dependency/API-key preflight without echoing the key.
3. Invoke `run_pipeline.py` once; do not independently reproduce any analysis/TTS step.
4. Let the CLI resume automatically when the job directory exists.
5. On success, return the `series-plan.json`, episode MP3s, transcripts, source checks, audio checks, and manifest.
6. On failure, report the last completed stage and exact resume command.
7. State that voices and models are configurable but defaults are moderator `cedar` and Wolpi `marin`.
8. State that generated audio must be disclosed as AI-generated and is not a legal update check.

Write the three reference files from the approved design spec:

- `artifact-schemas.md`: artifact tree, Pydantic model names, stage fingerprints, completion rules.
- `legal-source-rules.md`: PDF-only claims, page anchors, no enrichment, two grounding rewrites, transcript citation policy.
- `voice-and-pronunciation.md`: role personalities, delivery constants, 135 wpm target, German section/symbol pronunciation, retrieval-pause behavior, disclosure wording.

Keep `SKILL.md` under 140 lines and link each reference only at the point where it is needed.

- [ ] **Step 3: Regenerate quoted Codex UI metadata**

Run:

```bash
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/generate_openai_yaml.py \
  skills/generate-learning-podcast \
  --interface display_name="Lernpodcast erstellen" \
  --interface short_description="Juristische PDFs als MP3-Lernserie erklären" \
  --interface default_prompt='Use $generate-learning-podcast to turn my legal PDF into a source-grounded German MP3 learning series.'
```

- [ ] **Step 4: Add the explicitly opted-in API smoke test**

Create `live_smoke.py`. When `RUN_OPENAI_LIVE_SMOKE != "1"`, print `SKIP: set RUN_OPENAI_LIVE_SMOKE=1 to enable API smoke test` and exit 0. Otherwise require `OPENAI_API_KEY`, generate a deterministic two-page ReportLab PDF covering one definition and one distinction, run the real CLI into `/tmp/jura-wolpi-learning-podcast-live-smoke`, and call `validate_job` on the result. The script must never be imported by `unittest` discovery and must print estimated/actual artifact paths but no credentials.

- [ ] **Step 5: Create a clean runtime and run every offline check**

Run:

```bash
python3 -m venv /tmp/jura-wolpi-learning-podcast-venv
/tmp/jura-wolpi-learning-podcast-venv/bin/python -m pip install --upgrade pip
/tmp/jura-wolpi-learning-podcast-venv/bin/python -m pip install -r skills/generate-learning-podcast/scripts/requirements.txt
PYTHONDONTWRITEBYTECODE=1 /tmp/jura-wolpi-learning-podcast-venv/bin/python -m unittest discover -s skills/generate-learning-podcast/tests -p 'test_*.py' -v
PYTHONPYCACHEPREFIX=/tmp/jura-wolpi-learning-podcast-pycache /tmp/jura-wolpi-learning-podcast-venv/bin/python -m compileall -q skills/generate-learning-podcast/scripts skills/generate-learning-podcast/tests
python3 /Users/sbstn/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/generate-learning-podcast
```

Expected: dependency installation exits 0, every offline test passes, compileall exits 0, and quick validation reports success.

- [ ] **Step 6: Exercise the live-smoke guard and optional real API run**

Run the no-cost guard unconditionally:

```bash
env -u RUN_OPENAI_LIVE_SMOKE PYTHONDONTWRITEBYTECODE=1 /tmp/jura-wolpi-learning-podcast-venv/bin/python skills/generate-learning-podcast/tests/live_smoke.py
```

Expected in the current environment: `SKIP` and exit 0 because `OPENAI_API_KEY` is not set.

If a key is available during implementation, run:

```bash
RUN_OPENAI_LIVE_SMOKE=1 PYTHONDONTWRITEBYTECODE=1 /tmp/jura-wolpi-learning-podcast-venv/bin/python skills/generate-learning-podcast/tests/live_smoke.py
```

Listen to both roles, the five-second silences, and a sample of legal terms. If `cedar` does not read as an adult male moderator or `marin` is not warm/bright enough for Wolpi, change only the corresponding default voice, update config/tests/references, rerun offline tests, and record the chosen IDs in the manifest.

- [ ] **Step 7: Review source boundaries and repository diff**

Run:

```bash
rg -n "web search|case-law lookup|statute lookup|from memory" skills/generate-learning-podcast
rg -n "OPENAI_API_KEY|api[_-]?key|authorization" skills/generate-learning-podcast
git diff --check
git status --short
```

Expected: source-boundary mentions are prohibitions, credential mentions only read the environment variable without logging values, no whitespace errors exist, and only intended skill files remain uncommitted.

- [ ] **Step 8: Commit documentation and final validation**

```bash
git add skills/generate-learning-podcast
git commit -m "docs: finish learning podcast skill"
```

Record the exact offline test count, quick-validation result, and whether the optional API smoke test ran in the implementation handoff.
