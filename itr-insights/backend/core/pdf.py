"""PDF → text. In-memory only. No persistence per D10."""

from __future__ import annotations

import io

from pypdf import PdfReader


class PDFTooLarge(ValueError):
    pass


class PDFUnreadable(ValueError):
    pass


MAX_PDF_BYTES = 15 * 1024 * 1024  # 15 MB hard cap for MVP1.


def pdf_bytes_to_text(data: bytes) -> str:
    if len(data) > MAX_PDF_BYTES:
        raise PDFTooLarge(f"PDF exceeds {MAX_PDF_BYTES} bytes")
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:  # pypdf raises a variety of errors
        raise PDFUnreadable(str(exc)) from exc
    pages: list[str] = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    text = "\n".join(pages)
    if not text.strip():
        raise PDFUnreadable("No extractable text in PDF")
    return text
