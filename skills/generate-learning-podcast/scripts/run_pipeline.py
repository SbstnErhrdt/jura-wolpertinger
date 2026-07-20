from __future__ import annotations

import argparse
import json
import os
import shlex
import sys
from pathlib import Path

from config import PipelineConfig
from inspect_pdf import inspect_pdf
from manifest import sanitize_error
from openai_steps import OpenAIGateway
from pipeline import run_pipeline
from render_audio import resolve_ffmpeg


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Generate a source-grounded MP3 learning series from one legal PDF."
        )
    )
    parser.add_argument("pdf", type=Path)
    parser.add_argument(
        "--output-base",
        type=Path,
        default=Path("output/learning-podcasts"),
    )
    parser.add_argument("--text-model", default="gpt-5.6")
    parser.add_argument("--tts-model", default="gpt-4o-mini-tts")
    parser.add_argument(
        "--transcribe-model", default="gpt-4o-mini-transcribe"
    )
    parser.add_argument("--moderator-voice", default="cedar")
    parser.add_argument("--wolpi-voice", default="marin")
    parser.add_argument("--ffmpeg", type=Path)
    return parser


def _last_completed_stage(manifest_path: Path) -> str:
    if not manifest_path.is_file():
        return "none"
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return "none"
    completed = [
        (name, stage.get("completed_at", ""))
        for name, stage in data.get("stages", {}).items()
        if stage.get("status") == "completed"
    ]
    return max(completed, key=lambda item: item[1])[0] if completed else "none"


def main(argv: list[str] | None = None) -> int:
    raw_args = list(sys.argv[1:] if argv is None else argv)
    args = build_parser().parse_args(raw_args)
    try:
        inspect_pdf(args.pdf.resolve())
        ffmpeg_path = resolve_ffmpeg(args.ffmpeg)
    except Exception as error:
        print(f"Input preflight failed: {sanitize_error(str(error))}", file=sys.stderr)
        return 2

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY is required", file=sys.stderr)
        return 2

    config = PipelineConfig(
        input_pdf=args.pdf,
        output_base=args.output_base,
        text_model=args.text_model,
        tts_model=args.tts_model,
        transcribe_model=args.transcribe_model,
        moderator_voice=args.moderator_voice,
        wolpi_voice=args.wolpi_voice,
    )
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        gateway = OpenAIGateway(
            client=client,
            text_model=config.text_model,
            tts_model=config.tts_model,
            transcribe_model=config.transcribe_model,
            max_structured_attempts=config.max_structured_attempts,
            max_transient_attempts=config.max_transient_attempts,
        )
        job_dir = run_pipeline(config, gateway, ffmpeg_path)
        summary = json.loads(
            (job_dir / "summary.json").read_text(encoding="utf-8")
        )
    except Exception as error:
        print(f"Generation failed: {sanitize_error(str(error))}", file=sys.stderr)
        print(
            "Last completed stage: "
            + _last_completed_stage(config.job_dir / "manifest.json"),
            file=sys.stderr,
        )
        resume = shlex.join(
            [sys.executable, str(Path(__file__).resolve()), *raw_args]
        )
        print(f"Resume with: {resume}", file=sys.stderr)
        return 1

    print(str(job_dir))
    for mp3_path in summary["mp3_paths"]:
        print(mp3_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
