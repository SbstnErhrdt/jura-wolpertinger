# Artifact and resume contracts

## Delivery tree

```text
<job>/
├── manifest.json
├── series-plan.json
├── series-plan.md
├── summary.json
├── source/
│   ├── source.pdf
│   ├── inspection.json
│   └── chunks/*.pdf
├── analysis/
│   ├── source-map.json
│   └── concepts.json
└── episodes/<NN>-<slug>/
    ├── <NN>-<slug>.mp3
    ├── draft.json
    ├── source-check.json
    ├── transcript.md
    ├── audio-transcript.txt
    ├── audio-check.json
    └── work/*.wav
```

`summary.json` contains the episode count, total duration, target-range warnings, and absolute MP3 paths. `inspection.json` contains the PDF inspection and the original page range for every generated chunk.

## Structured models

- `SourceMap`: document title, source sections, concepts, pronunciation terms, and page anchors.
- `SeriesPlan`: contiguous numbered `EpisodePlan` entries that cover every concept exactly once.
- `EpisodeDraft`: sequential speech and pause segments. Speech records role, purpose, delivery, and source anchors.
- `GroundingReport`: `approved` is true exactly when `issues` is empty.
- `AudioCheck`: `passed` is true exactly when `issues` is empty; each issue names the affected segment.

The authoritative validation rules live in `scripts/models.py`, `scripts/pipeline.py`, and `scripts/validate_output.py`.

## Resume fingerprints

- `source`: source SHA-256 and PDF inspection version.
- `analysis`: source hash, text model, and analysis prompt version.
- `plan`: source lineage, source-map hash, text model, and planning prompt.
- `episode/<NN>/content`: source lineage, episode plan, source map, text model, and dialogue/grounding prompts.
- `episode/<NN>/tts/<segment-id>`: content lineage, speech or pause data, voice, TTS model, and delivery instructions.
- `episode/<NN>/render`: content lineage, ordered WAV hashes, audio settings, voices, and FFmpeg identity.
- `episode/<NN>/audio-qa`: content lineage, MP3 and draft hashes, configured models, and voices.
- `final`: plan, every source/audio check, every MP3 hash, and minimum-duration rule.

A stage is reusable only when its status is `completed`, its input fingerprint matches, and every recorded output exists with the recorded SHA-256. Stages are marked `running` before work, `completed` only after outputs validate, and `failed` with a redacted error otherwise. Writes of JSON and text artifacts are atomic.

## Completion rules

Final validation requires one exact episode directory and MP3 per plan entry; valid draft, grounding, and audio-check schemas; approved source checks; passed audio checks; mono approximately 128 kbit/s MP3s with AI metadata; at least eight minutes per episode; and non-empty written and audio transcripts. Ten to fifteen minutes is the target. Longer complete learning units are reported, not rejected.
