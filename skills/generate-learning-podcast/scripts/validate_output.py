from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from models import AudioCheck, EpisodeDraft, GroundingReport, SeriesPlan
from pipeline import validate_episode
from render_audio import validate_mp3


class OutputValidationError(ValueError):
    pass


def _read_json(path: Path) -> Any:
    if not path.is_file():
        raise OutputValidationError(f"missing artifact: {path.name}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise OutputValidationError(f"invalid JSON artifact {path.name}: {error}") from error


def _require_nonempty(path: Path, label: str) -> None:
    if not path.is_file() or not path.read_text(encoding="utf-8").strip():
        raise OutputValidationError(f"missing or empty {label}: {path}")


def validate_job(
    job_dir: Path,
    *,
    minimum_duration_seconds: float = 480.0,
) -> dict[str, object]:
    job_dir = job_dir.resolve()
    try:
        plan = SeriesPlan.model_validate(_read_json(job_dir / "series-plan.json"))
    except ValidationError as error:
        raise OutputValidationError(f"invalid series plan: {error}") from error

    episodes_root = job_dir / "episodes"
    expected_dirs = {
        f"{episode.number:02d}-{episode.slug}" for episode in plan.episodes
    }
    actual_dirs = (
        {path.name for path in episodes_root.iterdir() if path.is_dir()}
        if episodes_root.is_dir()
        else set()
    )
    if actual_dirs != expected_dirs:
        missing = sorted(expected_dirs - actual_dirs)
        extra = sorted(actual_dirs - expected_dirs)
        raise OutputValidationError(
            f"episode directory set does not match plan; missing={missing}, extra={extra}"
        )

    mp3_paths: list[str] = []
    durations: list[float] = []
    warnings: list[str] = []
    for episode in plan.episodes:
        episode_dir = episodes_root / f"{episode.number:02d}-{episode.slug}"
        mp3_path = episode_dir / f"{episode.number:02d}-{episode.slug}.mp3"
        if not mp3_path.is_file():
            raise OutputValidationError(f"missing MP3 for episode {episode.number}")

        try:
            draft = EpisodeDraft.model_validate(_read_json(episode_dir / "draft.json"))
            source_check = GroundingReport.model_validate(
                _read_json(episode_dir / "source-check.json")
            )
            audio_check = AudioCheck.model_validate(
                _read_json(episode_dir / "audio-check.json")
            )
        except ValidationError as error:
            raise OutputValidationError(
                f"invalid episode artifacts for episode {episode.number}: {error}"
            ) from error

        if not source_check.approved:
            raise OutputValidationError(
                f"source grounding failed for episode {episode.number}"
            )
        if not audio_check.passed:
            raise OutputValidationError(
                f"audio comparison failed for episode {episode.number}"
            )
        try:
            validate_episode(episode, draft)
        except ValueError as error:
            raise OutputValidationError(
                f"episode content invalid for episode {episode.number}: {error}"
            ) from error
        try:
            info = validate_mp3(mp3_path)
        except ValueError as error:
            label = (
                "AI disclosure metadata"
                if "disclose AI generation" in str(error)
                else "invalid MP3"
            )
            raise OutputValidationError(f"{label}: {error}") from error
        if info.duration_seconds < minimum_duration_seconds:
            raise OutputValidationError(
                f"episode {episode.number} is shorter than the minimum duration: "
                f"{info.duration_seconds:.1f}s"
            )
        if not 600.0 <= info.duration_seconds <= 900.0:
            warnings.append(
                f"Episode {episode.number} is {info.duration_seconds / 60:.1f} minutes; "
                "target is 10-15 minutes."
            )

        _require_nonempty(episode_dir / "transcript.md", "transcript")
        _require_nonempty(
            episode_dir / "audio-transcript.txt", "audio transcription"
        )
        mp3_paths.append(str(mp3_path.resolve()))
        durations.append(info.duration_seconds)

    return {
        "episode_count": len(plan.episodes),
        "total_duration_seconds": round(sum(durations), 3),
        "target_range_warnings": warnings,
        "mp3_paths": mp3_paths,
    }
