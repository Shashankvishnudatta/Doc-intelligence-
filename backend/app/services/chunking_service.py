import re
from pathlib import Path

from app.models.document import Document, DocumentPage


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def strip_ocr_internal_markers(text: str) -> str:
    if not text:
        return ""

    diagnostic_patterns = [
        r"\[?\s*OCR\s+ENGINE\s*:[^\]\n]*\]?",
        r"\[?\s*OCR\s+QUALITY\s+SCORE\s*:[^\]\n]*\]?",
        r"\[?\s*OCR\s+VARIANT\s*:[^\]\n]*\]?",
        r"\[?\s*GEMINI\s+OCR\s+ERROR\s*\]?",
        r"\[[^\]\n]*(?:OCR|TESSERACT|GEMINI)[^\]\n]*\]",
        r"\b(?:tesseract_preprocessed|tesseract_raw|tesseract_clean|tesseract_default|tesseract|gemini_vision|gemini vision)\b",
    ]

    cleaned_lines: list[str] = []

    for raw_line in text.splitlines():
        line = raw_line

        for pattern in diagnostic_patterns:
            line = re.sub(pattern, " ", line, flags=re.IGNORECASE)

        line = re.sub(r"[ \t]+", " ", line).strip()

        if line:
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()


def clean_text_for_indexing(text: str) -> str:
    """
    Remove internal OCR diagnostics before text is stored in chunks/vectors.

    This keeps useful extracted content while preventing implementation details
    such as OCR engines, variants, and quality scores from being embedded.
    """
    cleaned = strip_ocr_internal_markers(text)
    cleaned_lines: list[str] = []

    for raw_line in cleaned.splitlines():
        line = re.sub(r"[ \t]+", " ", raw_line).strip()

        if not line:
            continue

        lower_line = line.lower()

        if any(
            marker in lower_line
            for marker in [
                "ocr engine",
                "ocr quality score",
                "ocr variant",
                "gemini ocr error",
            ]
        ):
            continue

        alpha_count = len(re.findall(r"[A-Za-z]", line))
        symbol_count = len(re.findall(r"[^A-Za-z0-9\s.,:;!?()'\"/\-]", line))

        if len(line) >= 8 and alpha_count == 0:
            continue

        if symbol_count / max(len(line), 1) > 0.35:
            continue

        cleaned_lines.append(line)

    return re.sub(r"\n{3,}", "\n\n", "\n".join(cleaned_lines)).strip()


def is_image_document(document: Document) -> bool:
    suffix = Path(document.original_filename).suffix.lower()
    content_type = (document.content_type or "").lower()

    return content_type.startswith("image/") or suffix in IMAGE_EXTENSIONS


def build_image_page_index_text(
    page: DocumentPage,
    document: Document,
    cleaned_text: str,
) -> str:
    synthetic_prefix = (
        "Image document page available for visual analysis. "
        f"File: {document.original_filename}. "
        f"Page {page.page_number}. "
        "This page should be interpreted using the page image and Gemini Vision "
        "when the user asks what is in the image, what the image says, or what "
        "the handwritten page contains."
    )

    if cleaned_text:
        return (
            f"{synthetic_prefix}\n\n"
            "OCR text, may contain errors:\n"
            f"{cleaned_text}"
        )

    return synthetic_prefix


def split_text_into_chunks(
    text: str,
    max_chars: int = 900,
    overlap_chars: int = 150,
) -> list[str]:
    cleaned_text = clean_text_for_indexing(text).strip()

    if not cleaned_text:
        return []

    paragraphs = [paragraph.strip() for paragraph in cleaned_text.split("\n\n") if paragraph.strip()]

    chunks: list[str] = []
    current_chunk = ""

    for paragraph in paragraphs:
        if len(current_chunk) + len(paragraph) + 2 <= max_chars:
            current_chunk = f"{current_chunk}\n\n{paragraph}".strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)

            if len(paragraph) <= max_chars:
                current_chunk = paragraph
            else:
                start = 0

                while start < len(paragraph):
                    end = start + max_chars
                    chunk = paragraph[start:end].strip()

                    if chunk:
                        chunks.append(chunk)

                    start = end - overlap_chars

                current_chunk = ""

    if current_chunk:
        chunks.append(current_chunk)

    deduped_chunks: list[str] = []
    seen = set()

    for chunk in chunks:
        normalized = " ".join(chunk.split())

        if normalized and normalized not in seen:
            seen.add(normalized)
            deduped_chunks.append(chunk)

    return deduped_chunks


def build_page_chunks(page: DocumentPage, document: Document | None = None) -> list[str]:
    page_text = clean_text_for_indexing(page.extracted_text or "")

    if document and is_image_document(document):
        page_text = build_image_page_index_text(
            page=page,
            document=document,
            cleaned_text=page_text,
        )

    chunks = split_text_into_chunks(
        text=page_text,
        max_chars=900,
        overlap_chars=150,
    )

    return chunks
