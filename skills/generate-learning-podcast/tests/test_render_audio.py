from __future__ import annotations

import math
import struct
import sys
import tempfile
import unittest
import wave
from pathlib import Path


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from render_audio import (
    create_silence_wav,
    render_mp3,
    resolve_ffmpeg,
    split_tts_text,
    validate_mp3,
)


def create_tone_wav(path: Path, duration_ms: int, frequency: float) -> None:
    sample_rate = 24000
    frame_count = round(sample_rate * duration_ms / 1000)
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        frames = b"".join(
            struct.pack(
                "<h",
                round(4000 * math.sin(2 * math.pi * frequency * frame / sample_rate)),
            )
            for frame in range(frame_count)
        )
        audio.writeframes(frames)


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
                self.assertAlmostEqual(
                    audio.getnframes() / audio.getframerate(),
                    5.0,
                    places=2,
                )

    def test_rendered_mp3_has_duration_audio_shape_and_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            first = root / "first.wav"
            second = root / "second.wav"
            create_tone_wav(first, duration_ms=600, frequency=440)
            create_tone_wav(second, duration_ms=600, frequency=554.37)
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
