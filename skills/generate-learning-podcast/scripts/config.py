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
    transcribe_model: str = "gpt-4o-transcribe"
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
    max_audio_repairs: int = 2

    @property
    def job_dir(self) -> Path:
        return self.output_base.resolve() / slugify(self.input_pdf.stem)

    def semantic_values(self) -> dict[str, object]:
        values = asdict(self)
        values["input_pdf"] = str(self.input_pdf.resolve())
        values["output_base"] = str(self.output_base.resolve())
        return values
