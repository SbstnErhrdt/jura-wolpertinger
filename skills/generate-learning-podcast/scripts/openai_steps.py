from __future__ import annotations

import base64
import time
from pathlib import Path
from typing import Callable, TypeVar

from pydantic import BaseModel, ValidationError

from models import AudioCheck, EpisodeDraft


ResultT = TypeVar("ResultT", bound=BaseModel)

MODERATOR_DELIVERY = (
    "German, adult male-read law student; curious, natural, encouraging, concise; "
    "ask genuine follow-up questions; never perform a caricature."
)
WOLPI_DELIVERY = (
    "German, warm bright cute legal expert; calm, precise, gently playful, "
    "supportive; explain legal distinctions clearly without sounding childish."
)


class StructuredResponseError(ValueError):
    pass


def is_transient(error: Exception) -> bool:
    status = getattr(error, "status_code", None)
    return isinstance(error, (ConnectionError, TimeoutError)) or status in {408, 409, 429} or (
        isinstance(status, int) and status >= 500
    )


def response_refusal(response: object) -> str | None:
    for output in getattr(response, "output", []):
        for item in getattr(output, "content", []):
            refusal = getattr(item, "refusal", None)
            if refusal:
                return str(refusal)
    return None


class OpenAIGateway:
    def __init__(
        self,
        client,
        text_model: str,
        *,
        tts_model: str = "gpt-4o-mini-tts",
        transcribe_model: str = "gpt-4o-mini-transcribe",
        max_structured_attempts: int = 3,
        max_transient_attempts: int = 5,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.client = client
        self.text_model = text_model
        self.tts_model = tts_model
        self.transcribe_model = transcribe_model
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
        content: list[dict[str, object]] = [{"type": "input_text", "text": input_text}]
        if input_pdf is not None:
            encoded = base64.b64encode(input_pdf.read_bytes()).decode("ascii")
            content.append(
                {
                    "type": "input_file",
                    "filename": input_pdf.name,
                    "file_data": f"data:application/pdf;base64,{encoded}",
                    "detail": "low",
                }
            )

        last_error: Exception | None = None
        for _ in range(self.max_structured_attempts):
            response = self._with_transient_retry(
                lambda: self.client.responses.parse(
                    model=self.text_model,
                    instructions=instructions,
                    input=[{"role": "user", "content": content}],
                    text_format=result_type,
                    store=False,
                )
            )
            refusal = response_refusal(response)
            if refusal:
                raise StructuredResponseError(f"OpenAI refused the structured request: {refusal}")
            parsed = getattr(response, "output_parsed", None)
            if parsed is None:
                last_error = StructuredResponseError(
                    "OpenAI returned no parsed structured output"
                )
                continue
            if isinstance(parsed, result_type):
                return parsed
            try:
                return result_type.model_validate(parsed)
            except ValidationError as error:
                last_error = error
        if last_error is not None:
            raise last_error
        raise StructuredResponseError("structured output failed without an error")

    def synthesize(
        self,
        *,
        text: str,
        voice: str,
        instructions: str,
        output_path: Path,
    ) -> None:
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
                if not output_path.is_file() or output_path.stat().st_size <= 44:
                    raise ValueError("TTS returned an empty WAV")
                return
            except (OSError, ValueError) as error:
                last_error = error
                output_path.unlink(missing_ok=True)
        if last_error is not None:
            raise last_error
        raise RuntimeError("TTS failed without an error")

    def transcribe(self, audio_path: Path) -> str:
        def request():
            with audio_path.open("rb") as audio:
                return self.client.audio.transcriptions.create(
                    model=self.transcribe_model,
                    file=audio,
                    response_format="text",
                )

        response = self._with_transient_retry(request)
        transcript = response if isinstance(response, str) else response.text
        transcript = str(transcript).strip()
        if not transcript:
            raise ValueError("transcription returned no text")
        return transcript

    def compare_audio(self, draft: EpisodeDraft, transcript: str) -> AudioCheck:
        return self.generate_structured(
            result_type=AudioCheck,
            instructions=(
                "Compare expected dialogue with the transcription. Report only omissions, "
                "substitutions that change legal meaning, speaker-text loss, or "
                "unintelligible legal terms. Ignore punctuation and harmless wording "
                "normalization."
            ),
            input_text=(
                draft.model_dump_json(indent=2)
                + "\nTRANSCRIPTION\n"
                + transcript
            ),
        )
