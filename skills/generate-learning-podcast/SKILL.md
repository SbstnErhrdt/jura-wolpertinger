---
name: generate-learning-podcast
description: Turn exactly one local legal PDF script into a complete, supportive German MP3 learning-podcast series with a curious student moderator and Wolpi as the legal expert. Use when the user asks to make, generate, or test an automatic Lernpodcast, audio course, or podcast series from a PDF law script. The workflow is PDF-only, source-grounded, resumable, and includes transcripts plus source and audio checks.
---

# Lernpodcast erstellen

Generate the whole podcast series automatically from one legal PDF. Do not pause for approval between analysis, planning, dialogue, speech, or MP3 assembly.

## Inputs and source boundary

Require exactly one existing local `.pdf` path. Ask for it only if no unambiguous path is available.

Treat the PDF as the sole legal source. Do not browse, look up statutes or cases, or enrich from model memory. The result explains the script; it is not a legal update check or official assessment. Read [legal-source-rules.md](references/legal-source-rules.md) when evaluating a grounding failure or changing source behavior.

## Preflight

Work from the repository root. Use an isolated runtime and never print, persist, or place the API key on the command line.

```bash
python3 -m venv /tmp/jura-wolpi-learning-podcast-venv
/tmp/jura-wolpi-learning-podcast-venv/bin/python -m pip install -r skills/generate-learning-podcast/scripts/requirements.txt
test -n "${OPENAI_API_KEY:-}" || { echo "OPENAI_API_KEY is required" >&2; exit 2; }
```

The defaults are `gpt-5.6`, `gpt-4o-mini-tts`, and `gpt-4o-mini-transcribe`; moderator voice `cedar`; Wolpi voice `marin`. Models and voices may be overridden with CLI flags. Read [voice-and-pronunciation.md](references/voice-and-pronunciation.md) before changing voice behavior or defaults.

## Run once

Activate the runtime and invoke only the tested entry point. Do not recreate pipeline stages manually.

```bash
. /tmp/jura-wolpi-learning-podcast-venv/bin/activate
python3 skills/generate-learning-podcast/scripts/run_pipeline.py "/absolute/path/to/script.pdf"
```

Use `--output-base`, `--text-model`, `--tts-model`, `--transcribe-model`, `--moderator-voice`, `--wolpi-voice`, or `--ffmpeg` only when requested or required by the environment.

The default job directory is `output/learning-podcasts/<pdf-slug>/`. Re-run the identical command after an interruption or corrected transient problem. The manifest reuses every completed stage whose inputs and outputs still match.

## Success handoff

Confirm final validation passed, then return clickable paths to:

- `series-plan.json` and `series-plan.md`
- every episode MP3 and `transcript.md`
- every `source-check.json` and `audio-check.json`
- `summary.json` and `manifest.json`

Each MP3 and its opening dialogue must disclose AI generation and the PDF-only/no-update-check limitation. Each episode contains two or three retrieval questions followed by real five-second silence.

Read [artifact-schemas.md](references/artifact-schemas.md) only when inspecting resume state, validating delivery, or changing artifact contracts.

## Failure handoff

Preserve the job directory. Report the concise error, the last completed manifest stage, and the exact resume command emitted by the CLI. Never expose request headers, client objects, or credential values.
