from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas


SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from inspect_pdf import PdfInputError, copy_source_pdf, inspect_pdf, write_page_chunks


def create_text_pdf(path: Path, page_count: int) -> None:
    pdf = canvas.Canvas(str(path))
    for page in range(1, page_count + 1):
        pdf.drawString(72, 760, f"Kapitel {page}: Verwaltungsakt")
        pdf.drawString(72, 730, "Ein Verwaltungsakt wird anhand der Merkmale des Skripts geprüft.")
        pdf.showPage()
    pdf.save()


class PdfInspectionTests(unittest.TestCase):
    def test_inspects_text_and_copies_source_atomically(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source.pdf"
            copied = root / "job" / "source" / "source.pdf"
            create_text_pdf(source, 3)

            copy_source_pdf(source, copied)
            result = inspect_pdf(copied)

            self.assertEqual(result.page_count, 3)
            self.assertEqual(result.text_page_count, 3)
            self.assertEqual(len(result.sha256), 64)
            self.assertEqual(result.pages[0].page, 1)
            self.assertIn("Verwaltungsakt", result.pages[0].text)
            self.assertEqual(source.read_bytes(), copied.read_bytes())

    def test_splits_pdf_into_original_page_ranges(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source.pdf"
            create_text_pdf(source, 5)

            chunks = write_page_chunks(source, root / "chunks", pages_per_chunk=2)

            self.assertEqual(
                [(chunk.page_start, chunk.page_end) for chunk in chunks],
                [(1, 2), (3, 4), (5, 5)],
            )
            self.assertEqual(
                [len(PdfReader(str(chunk.path)).pages) for chunk in chunks],
                [2, 2, 1],
            )

    def test_rejects_encrypted_and_contentless_pdf(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            encrypted = root / "encrypted.pdf"
            writer = PdfWriter()
            writer.add_blank_page(width=595, height=842)
            writer.encrypt("secret")
            with encrypted.open("wb") as handle:
                writer.write(handle)

            with self.assertRaisesRegex(PdfInputError, "encrypted"):
                inspect_pdf(encrypted)

            empty = root / "empty.pdf"
            writer = PdfWriter()
            writer.add_blank_page(width=595, height=842)
            with empty.open("wb") as handle:
                writer.write(handle)

            with self.assertRaisesRegex(PdfInputError, "readable text or page images"):
                inspect_pdf(empty)


if __name__ == "__main__":
    unittest.main()
