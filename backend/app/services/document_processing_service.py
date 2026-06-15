import json
import shutil
from pathlib import Path
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.document import Document, DocumentPage
from app.services.parser_service import parse_document_file

settings = get_settings()


def clear_document_page_image_directory(document_id: str) -> None:
    base_dir = Path(settings.PAGE_IMAGE_DIR).resolve()
    page_dir = (base_dir / document_id).resolve()

    try:
        page_dir.relative_to(base_dir)
    except ValueError:
        print(
            f"[Parser WARNING] skipped_page_image_cleanup unsafe_path={page_dir}"
        )
        return

    if page_dir.exists() and page_dir.is_dir():
        shutil.rmtree(page_dir)
        print(f"[Parser] cleared_page_image_dir={page_dir}")


def parse_and_store_document(document: Document, db: Session) -> Document:
    document.status = "parsing"
    document.error_message = None
    db.commit()

    try:
        db.query(DocumentPage).filter(
            DocumentPage.document_id == document.id
        ).delete()
        db.commit()

        clear_document_page_image_directory(document.id)

        parsed_pages = parse_document_file(
            file_path=document.file_path,
            document_id=document.id,
            content_type=document.content_type,
        )

        if not parsed_pages:
            raise ValueError("No pages were extracted from the document.")

        for page_data in parsed_pages:
            page = DocumentPage(
                id=uuid4().hex,
                document_id=document.id,
                page_number=page_data["page_number"],
                extracted_text=page_data["extracted_text"],
                image_path=page_data["image_path"],
                tables_json=json.dumps(
                    page_data.get("tables", []),
                    ensure_ascii=False,
                ),
            )

            db.add(page)

        document.page_count = len(parsed_pages)
        document.status = "parsed"
        document.error_message = None

        db.commit()
        db.refresh(document)

        return document

    except Exception as exc:
        db.rollback()

        document.status = "failed"
        document.error_message = f"Parsing failed: {str(exc)}"

        db.commit()
        db.refresh(document)

        return document 
