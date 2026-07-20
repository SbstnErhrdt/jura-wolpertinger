from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


PIPELINE_VERSION = "learning-podcast-v1"


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def stable_hash(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sanitize_error(value: str) -> str:
    redacted = re.sub(r"sk-[A-Za-z0-9_-]{8,}", "[redacted]", value)
    return re.sub(
        r"(?i)(authorization|api[_-]?key)(\s*[:=]\s*)\S+",
        r"\1\2[redacted]",
        redacted,
    )[:500]


def atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False)
    temp_path = Path(handle.name)
    try:
        with handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


def atomic_write_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False)
    temp_path = Path(handle.name)
    try:
        with handle:
            handle.write(value)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


class ManifestStore:
    def __init__(self, path: Path) -> None:
        self.path = path.resolve()
        if self.path.exists():
            self.data = json.loads(self.path.read_text(encoding="utf-8"))
        else:
            self.data = {
                "pipeline_version": PIPELINE_VERSION,
                "stages": {},
                "created_at": now_iso(),
            }

    def should_run(self, stage: str, input_hash: str) -> bool:
        current = self.data["stages"].get(stage)
        if not current or current.get("status") != "completed" or current.get("input_hash") != input_hash:
            return True
        for output in current.get("outputs", []):
            path = self.path.parent / output["path"]
            if not path.is_file() or file_sha256(path) != output["sha256"]:
                return True
        return False

    def begin(self, stage: str, input_hash: str) -> None:
        self.data["stages"][stage] = {
            "status": "running",
            "input_hash": input_hash,
            "started_at": now_iso(),
            "outputs": [],
            "error": None,
        }
        self._save()

    def complete(self, stage: str, input_hash: str, outputs: list[Path]) -> None:
        records: list[dict[str, str]] = []
        root = self.path.parent.resolve()
        for path in outputs:
            resolved = path.resolve()
            if not resolved.is_file():
                raise FileNotFoundError(f"stage output does not exist: {resolved}")
            relative = resolved.relative_to(root)
            records.append({"path": str(relative), "sha256": file_sha256(resolved)})
        self.data["stages"][stage] = {
            "status": "completed",
            "input_hash": input_hash,
            "completed_at": now_iso(),
            "outputs": records,
            "error": None,
        }
        self._save()

    def fail(self, stage: str, input_hash: str, error: str) -> None:
        self.data["stages"][stage] = {
            "status": "failed",
            "input_hash": input_hash,
            "failed_at": now_iso(),
            "outputs": [],
            "error": sanitize_error(error),
        }
        self._save()

    def set_run_metadata(self, metadata: dict[str, Any]) -> None:
        self.data["run"] = metadata
        self._save()

    def _save(self) -> None:
        atomic_write_json(self.path, self.data)
