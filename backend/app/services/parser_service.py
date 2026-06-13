import textwrap
from pathlib import Path
from typing import Any

import pdfplumber
import pytesseract
from app.services.ocr_service import extract_best_text_from_image
from pdf2image import convert_from_path
from PIL import Image, ImageDraw, ImageFont

from app.core.config import get_settings

settings = get_settings()


def get_document_page_dir(document_id: str) -> Path:
    page_dir = Path(settings.PAGE_IMAGE_DIR) / document_id
    page_dir.mkdir(parents=True, exist_ok=True)
    return page_dir


def clean_text(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.splitlines()).strip()


def normalize_tables(tables: list[Any]) -> list[list[list[str]]]:
    normalized_tables: list[list[list[str]]] = []

    for table in tables:
        normalized_table: list[list[str]] = []

        for row in table:
            normalized_row = [
                "" if cell is None else str(cell).strip()
                for cell in row
            ]
            normalized_table.append(normalized_row)

        if normalized_table:
            normalized_tables.append(normalized_table)

    return normalized_tables


def tables_to_text(tables: list[list[list[str]]]) -> str:
    table_blocks: list[str] = []

    for table_index, table in enumerate(tables, start=1):
        rows = [" | ".join(row) for row in table]
        table_blocks.append(f"Table {table_index}:\n" + "\n".join(rows))

    return "\n\n".join(table_blocks)


def parse_pdf(file_path: Path, document_id: str) -> list[dict]:
    page_dir = get_document_page_dir(document_id)

    rendered_images = convert_from_path(
        file_path.as_posix(),
        dpi=200,
    )

    parsed_pages: list[dict] = []

    with pdfplumber.open(file_path.as_posix()) as pdf:
        total_pages = max(len(pdf.pages), len(rendered_images))

        for page_index in range(total_pages):
            page_number = page_index + 1
            image_path = page_dir / f"page_{page_number:03d}.png"

            if page_index < len(rendered_images):
                page_image = rendered_images[page_index].convert("RGB")
            else:
                page_image = Image.new("RGB", (1240, 1754), "white")

            page_image.save(image_path)

            extracted_text = ""
            normalized_tables: list[list[list[str]]] = []

            if page_index < len(pdf.pages):
                page = pdf.pages[page_index]

                extracted_text = page.extract_text(
                    x_tolerance=1,
                    y_tolerance=3,
                ) or ""

                raw_tables = page.extract_tables() or []
                normalized_tables = normalize_tables(raw_tables)

            ocr_text = ""

            if len(extracted_text.strip()) < 80:
                ocr_text = pytesseract.image_to_string(page_image) or ""

            final_text_parts: list[str] = []

            if extracted_text.strip():
                final_text_parts.append(clean_text(extracted_text))

            if ocr_text.strip():
                final_text_parts.append("[OCR TEXT]\n" + clean_text(ocr_text))

            if normalized_tables:
                final_text_parts.append("[EXTRACTED TABLES]\n" + tables_to_text(normalized_tables))

            final_text = "\n\n".join(final_text_parts).strip()

            parsed_pages.append(
                {
                    "page_number": page_number,
                    "extracted_text": final_text,
                    "image_path": image_path.as_posix(),
                    "tables": normalized_tables,
                }
            )

    return parsed_pages


def split_text_into_visual_pages(text: str) -> list[str]:
    wrapped_lines: list[str] = []

    for paragraph in text.splitlines():
        if paragraph.strip() == "":
            wrapped_lines.append("")
            continue

        wrapped = textwrap.wrap(
            paragraph,
            width=95,
            replace_whitespace=False,
            drop_whitespace=True,
        )

        wrapped_lines.extend(wrapped if wrapped else [""])

    lines_per_page = 55
    pages: list[str] = []

    for start in range(0, len(wrapped_lines), lines_per_page):
        page_text = "\n".join(wrapped_lines[start:start + lines_per_page]).strip()
        if page_text:
            pages.append(page_text)

    return pages or [""]


def render_text_to_image(text: str, image_path: Path, title: str) -> None:
    width = 1240
    height = 1754
    margin = 90
    line_height = 24

    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)

    try:
        title_font = ImageFont.truetype("arial.ttf", 30)
        body_font = ImageFont.truetype("arial.ttf", 22)
    except Exception:
        title_font = ImageFont.load_default()
        body_font = ImageFont.load_default()

    y = margin

    draw.text((margin, y), title[:80], fill="black", font=title_font)
    y += 55

    for line in text.splitlines():
        if y > height - margin:
            break

        draw.text((margin, y), line, fill="black", font=body_font)
        y += line_height

    image.save(image_path)


def parse_text_file(file_path: Path, document_id: str) -> list[dict]:
    page_dir = get_document_page_dir(document_id)

    try:
        raw_text = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raw_text = file_path.read_text(encoding="latin-1")

    visual_pages = split_text_into_visual_pages(raw_text)

    parsed_pages: list[dict] = []

    for page_index, page_text in enumerate(visual_pages):
        page_number = page_index + 1
        image_path = page_dir / f"page_{page_number:03d}.png"

        render_text_to_image(
            text=page_text,
            image_path=image_path,
            title=file_path.name,
        )

        parsed_pages.append(
            {
                "page_number": page_number,
                "extracted_text": clean_text(page_text),
                "image_path": image_path.as_posix(),
                "tables": [],
            }
        )

    return parsed_pages


def parse_image_file(file_path: Path, document_id: str) -> list[dict]:
    page_dir = get_document_page_dir(document_id)
    image_path = page_dir / "page_001.png"

    with Image.open(file_path.as_posix()) as image:
        page_image = image.convert("RGB")
        page_image.save(image_path)

        ocr_result = extract_best_text_from_image(
            image=page_image,
            stored_image_path=image_path,
        )

    extracted_text = clean_text(ocr_result["text"])

    if ocr_result.get("engine"):
        extracted_text = (
            f"[OCR ENGINE: {ocr_result['engine']}]\n"
            f"[OCR QUALITY SCORE: {ocr_result['quality_score']:.2f}]\n\n"
            f"{extracted_text}"
        ).strip()

    if ocr_result.get("gemini_error"):
        extracted_text += f"\n\n[GEMINI OCR ERROR]\n{ocr_result['gemini_error']}"

    return [
        {
            "page_number": 1,
            "extracted_text": extracted_text,
            "image_path": image_path.as_posix(),
            "tables": [],
        }
    ]


def parse_document_file(file_path: str, document_id: str, content_type: str) -> list[dict]:
    path = Path(file_path)
    extension = path.suffix.lower()

    if extension == ".pdf" or content_type == "application/pdf":
        return parse_pdf(path, document_id)

    if extension == ".txt" or content_type == "text/plain":
        return parse_text_file(path, document_id)

    if extension in {".png", ".jpg", ".jpeg"} or content_type in {"image/png", "image/jpeg"}:
        return parse_image_file(path, document_id)

    raise ValueError(f"Unsupported document type for parsing: {extension}") 
