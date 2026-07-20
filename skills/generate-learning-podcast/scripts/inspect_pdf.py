from __future__ import annotations

import os
import shutil
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from manifest import file_sha256


class PdfInputError(ValueError):
    pass


@dataclass(frozen=True)
class PageInspection:
    page: int
    text: str
    has_images: bool


@dataclass(frozen=True)
class PdfInspection:
    filename: str
    sha256: str
    size_bytes: int
    page_count: int
    text_page_count: int
    image_page_count: int
    pages: list[PageInspection]

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class PdfChunk:
    index: int
    page_start: int
    page_end: int
    path: Path

    def to_dict(self) -> dict[str, object]:
        values = asdict(self)
        values["path"] = str(self.path)
        return values


def copy_source_pdf(source: Path, destination: Path) -> None:
    if source.suffix.lower() != ".pdf" or not source.is_file():
        raise PdfInputError(f"Input must be an existing PDF: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile("wb", dir=destination.parent, delete=False)
    temp_path = Path(handle.name)
    try:
        with source.open("rb") as input_handle, handle:
            shutil.copyfileobj(input_handle, handle)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, destination)
    finally:
        temp_path.unlink(missing_ok=True)


def inspect_pdf(path: Path) -> PdfInspection:
    if path.suffix.lower() != ".pdf" or not path.is_file():
        raise PdfInputError(f"Input must be an existing PDF: {path}")
    try:
        reader = PdfReader(str(path))
    except Exception as error:
        raise PdfInputError(f"Cannot open PDF: {error}") from error
    if reader.is_encrypted:
        raise PdfInputError("PDF is encrypted and cannot be processed")
    if not reader.pages:
        raise PdfInputError("PDF has no pages")

    pages: list[PageInspection] = []
    for index, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        try:
            has_images = len(page.images) > 0
        except Exception:
            resources = page.get("/Resources")
            if hasattr(resources, "get_object"):
                resources = resources.get_object()
            has_images = isinstance(resources, dict) and "/XObject" in resources
        pages.append(PageInspection(page=index, text=text, has_images=has_images))

    text_page_count = sum(bool(page.text) for page in pages)
    image_page_count = sum(page.has_images for page in pages)
    if text_page_count == 0 and image_page_count == 0:
        raise PdfInputError("PDF has no readable text or page images")
    return PdfInspection(
        filename=path.name,
        sha256=file_sha256(path),
        size_bytes=path.stat().st_size,
        page_count=len(pages),
        text_page_count=text_page_count,
        image_page_count=image_page_count,
        pages=pages,
    )


def write_page_chunks(path: Path, output_dir: Path, pages_per_chunk: int = 20) -> list[PdfChunk]:
    if pages_per_chunk < 1:
        raise ValueError("pages_per_chunk must be positive")
    reader = PdfReader(str(path))
    output_dir.mkdir(parents=True, exist_ok=True)
    chunks: list[PdfChunk] = []
    for start in range(0, len(reader.pages), pages_per_chunk):
        writer = PdfWriter()
        end = min(start + pages_per_chunk, len(reader.pages))
        for page in reader.pages[start:end]:
            writer.add_page(page)
        chunk_path = output_dir / (
            f"chunk-{len(chunks) + 1:03d}-pages-{start + 1:04d}-{end:04d}.pdf"
        )
        with chunk_path.open("wb") as handle:
            writer.write(handle)
        chunks.append(
            PdfChunk(
                index=len(chunks) + 1,
                page_start=start + 1,
                page_end=end,
                path=chunk_path,
            )
        )
    return chunks
