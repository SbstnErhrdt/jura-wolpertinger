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


def _split_oversized_part(part: str, max_chars: int) -> list[str]:
    words = part.split()
    chunks: list[str] = []
    current = ""
    for word in words:
        if len(word) > max_chars:
            raise ValueError("single word exceeds the TTS chunk limit")
        candidate = word if not current else current + " " + word
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = word
    if current:
        chunks.append(current)
    return chunks


def split_tts_text(text: str, max_chars: int = 6000) -> list[str]:
    normalized = " ".join(text.split())
    if not normalized:
        raise ValueError("TTS text must not be empty")
    sentences = re.split(r"(?<=[.!?])\s+", normalized)
    parts = [
        smaller
        for sentence in sentences
        for smaller in (
            [sentence]
            if len(sentence) <= max_chars
            else _split_oversized_part(sentence, max_chars)
        )
    ]
    chunks: list[str] = []
    current = ""
    for part in parts:
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


def create_silence_wav(
    path: Path,
    duration_ms: int,
    sample_rate: int = 24000,
) -> None:
    if duration_ms <= 0:
        raise ValueError("silence duration must be positive")
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
    missing = [str(path) for path in inputs if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"audio inputs do not exist: {missing}")
    output.parent.mkdir(parents=True, exist_ok=True)

    command = [str(ffmpeg_path), "-hide_banner", "-loglevel", "error", "-y"]
    for path in inputs:
        command.extend(["-i", str(path)])
    filter_steps = [
        (
            f"[{index}:a]aresample=24000,"
            f"aformat=sample_fmts=s16:channel_layouts=mono[a{index}]"
        )
        for index in range(len(inputs))
    ]
    concat_inputs = "".join(f"[a{index}]" for index in range(len(inputs)))
    filter_steps.append(
        f"{concat_inputs}concat=n={len(inputs)}:v=0:a=1,"
        "loudnorm=I=-19:TP=-1.5:LRA=7[out]"
    )
    command.extend(
        [
            "-filter_complex",
            ";".join(filter_steps),
            "-map",
            "[out]",
            "-ac",
            "1",
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "128k",
            "-id3v2_version",
            "3",
            "-metadata",
            f"title={title}",
            "-metadata",
            f"album={series}",
            "-metadata",
            "artist=Wolpi und Moderator",
            "-metadata",
            (
                "comment=AI-generated learning audio; "
                f"source: {source_name}; no update check"
            ),
            str(output),
        ]
    )
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"FFmpeg failed: {error.stderr.strip()}") from error


def validate_mp3(path: Path) -> Mp3Info:
    if not path.is_file() or path.stat().st_size == 0:
        raise ValueError(f"missing or empty MP3: {path}")
    audio = MP3(path)
    tags = audio.tags
    if tags is None:
        raise ValueError("MP3 has no ID3 metadata")
    title = str(tags.get("TIT2", ""))
    comments = tags.getall("COMM")
    if comments:
        comment = str(comments[0])
    else:
        custom_comment = tags.get("TXXX:comment")
        comment = str(custom_comment) if custom_comment is not None else ""
    if audio.info.channels != 1 or audio.info.bitrate < 120000:
        raise ValueError("MP3 must be mono at approximately 128 kbit/s")
    if "AI-generated" not in comment:
        raise ValueError("MP3 comment must disclose AI generation")
    return Mp3Info(
        duration_seconds=audio.info.length,
        channels=audio.info.channels,
        bitrate=audio.info.bitrate,
        title=title,
        comment=comment,
    )
