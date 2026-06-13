import json
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.document import Document, DocumentPage
from app.services.parser_service import parse_document_file


def parse_and_store_document(document: Document, db: Session) -> Document:
    document.status = "parsing"
    document.error_message = None
    db.commit()

    try:
        db.query(DocumentPage).filter(
            DocumentPage.document_id == document.id
        ).delete()
        db.commit()

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
