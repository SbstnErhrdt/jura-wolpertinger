from __future__ import annotations

import base64
import time
from pathlib import Path
from typing import Callable, TypeVar

from pydantic import BaseModel, ValidationError


ResultT = TypeVar("ResultT", bound=BaseModel)


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
