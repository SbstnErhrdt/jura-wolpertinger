from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


if os.environ.get("RUN_OPENAI_LIVE_SMOKE") != "1":
    print("SKIP: set RUN_OPENAI_LIVE_SMOKE=1 to enable API smoke test")
    raise SystemExit(0)

if not os.environ.get("OPENAI_API_KEY"):
    print("OPENAI_API_KEY is required", file=sys.stderr)
    raise SystemExit(2)

from reportlab.pdfgen import canvas


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_ROOT = SKILL_ROOT / "scripts"
OUTPUT_BASE = Path("/tmp/jura-wolpi-learning-podcast-live-smoke")
SOURCE_PATH = OUTPUT_BASE / "live-smoke-source.pdf"


def create_source() -> None:
    OUTPUT_BASE.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(SOURCE_PATH), invariant=1)
    pdf.setTitle("Deterministisches Lernpodcast-Testskript")
    pdf.drawString(72, 760, "Definition")
    pdf.drawString(
        72,
        730,
        "Ein Verwaltungsakt ist nach diesem Testskript eine hoheitliche Maßnahme.",
    )
    pdf.drawString(72, 700, "Die Bekanntgabe ist für seine Wirksamkeit maßgeblich.")
    pdf.showPage()
    pdf.drawString(72, 760, "Unterscheidung")
    pdf.drawString(
        72,
        730,
        "Wirksamkeit und Rechtmäßigkeit sind nach diesem Testskript zu trennen.",
    )
    pdf.drawString(
        72,
        700,
        "Beispiel: Ein bekannt gegebener Verwaltungsakt kann trotzdem fehlerhaft sein.",
    )
    pdf.showPage()
    pdf.save()


def main() -> int:
    create_source()
    print(f"Live smoke input: {SOURCE_PATH}")
    print(f"Live smoke output base: {OUTPUT_BASE}")
    print("API work: one two-page source, one planned learning unit, TTS, and audio QA")
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT_ROOT / "run_pipeline.py"),
            str(SOURCE_PATH),
            "--output-base",
            str(OUTPUT_BASE),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(result.stderr.rstrip(), file=sys.stderr)
        return result.returncode

    job_dir = OUTPUT_BASE / "live-smoke-source"
    sys.path.insert(0, str(SCRIPT_ROOT))
    from validate_output import validate_job

    summary = validate_job(job_dir)
    print(f"Validated job: {job_dir}")
    for mp3_path in summary["mp3_paths"]:
        print(f"MP3: {mp3_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
