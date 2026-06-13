import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models.document import Document, DocumentChunk, DocumentPage
from app.schemas.document import (
    DeleteDocumentResponse,
    DocumentDetail,
    DocumentListItem,
    IndexResponse,
    PageTextUpdateRequest,
    PageTextUpdateResponse,
)
from app.services.classification_service import classify_and_store_document
from app.services.document_processing_service import parse_and_store_document
from app.services.indexing_service import index_and_store_document
from app.services.vector_service import delete_document_vectors

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("", response_model=list[DocumentListItem])
def list_documents(db: Session = Depends(get_db)):
    documents = (
        db.query(Document)
        .order_by(Document.created_at.desc())
        .all()
    )

    return documents


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(document_id: str, db: Session = Depends(get_db)):
    document = (
        db.query(Document)
        .options(selectinload(Document.pages))
        .filter(Document.id == document_id)
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    return document


@router.post("/{document_id}/parse", response_model=DocumentDetail)
def parse_document(document_id: str, db: Session = Depends(get_db)):
    document = (
        db.query(Document)
        .filter(Document.id == document_id)
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    parse_and_store_document(document=document, db=db)

    parsed_document = (
        db.query(Document)
        .options(selectinload(Document.pages))
        .filter(Document.id == document_id)
        .first()
    )

    return parsed_document


@router.post("/{document_id}/classify", response_model=DocumentDetail)
def classify_document(document_id: str, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    if document.page_count <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document must have parsed pages before classification.",
        )

    classify_and_store_document(
        document_id=document_id,
        db=db,
    )

    classified_document = (
        db.query(Document)
        .options(selectinload(Document.pages))
        .filter(Document.id == document_id)
        .first()
    )

    return classified_document


@router.post("/{document_id}/index", response_model=IndexResponse)
def index_document(document_id: str, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    if document.page_count <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document must be parsed before indexing.",
        )

    indexed_document = index_and_store_document(
        document_id=document_id,
        db=db,
    )

    chunk_count = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == document_id)
        .count()
    )

    return IndexResponse(
        document_id=indexed_document.id,
        status=indexed_document.status,
        page_count=indexed_document.page_count,
        chunk_count=chunk_count,
        detail="Document indexed successfully."
        if indexed_document.status == "indexed"
        else indexed_document.error_message or "Indexing failed.",
    )


@router.put(
    "/{document_id}/pages/{page_number}/text",
    response_model=PageTextUpdateResponse,
)
def update_page_text(
    document_id: str,
    page_number: int,
    request: PageTextUpdateRequest,
    db: Session = Depends(get_db),
):
    document = (
        db.query(Document)
        .options(selectinload(Document.pages))
        .filter(Document.id == document_id)
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    page = (
        db.query(DocumentPage)
        .filter(
            DocumentPage.document_id == document_id,
            DocumentPage.page_number == page_number,
        )
        .first()
    )

    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document page not found.",
        )

    cleaned_text = request.extracted_text.strip()

    if not cleaned_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrected OCR text cannot be empty.",
        )

    page.extracted_text = cleaned_text
    document.status = "parsed"
    document.error_message = None

    db.commit()
    db.refresh(document)

    if request.reclassify:
        document = classify_and_store_document(
            document_id=document_id,
            db=db,
        )

    if request.reindex:
        document = index_and_store_document(
            document_id=document_id,
            db=db,
        )

    return PageTextUpdateResponse(
        document_id=document_id,
        page_number=page_number,
        status=document.status,
        detail="Page text updated, classified, and reindexed successfully.",
        extracted_text=cleaned_text,
    )


@router.get("/{document_id}/pages/{page_number}/image")
def get_page_image(
    document_id: str,
    page_number: int,
    db: Session = Depends(get_db),
):
    page = (
        db.query(DocumentPage)
        .filter(
            DocumentPage.document_id == document_id,
            DocumentPage.page_number == page_number,
        )
        .first()
    )

    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Page image not found.",
        )

    image_path = Path(page.image_path)

    if not image_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored page image file is missing.",
        )

    return FileResponse(
        path=image_path.as_posix(),
        media_type="image/png",
        filename=f"{document_id}_page_{page_number}.png",
    )


@router.delete("/{document_id}", response_model=DeleteDocumentResponse)
def delete_document(document_id: str, db: Session = Depends(get_db)):
    document = (
        db.query(Document)
        .options(selectinload(Document.pages))
        .filter(Document.id == document_id)
        .first()
    )

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    original_file_path = Path(document.file_path)
    page_dir = None

    if document.pages:
        first_page_image = Path(document.pages[0].image_path)
        page_dir = first_page_image.parent

    try:
        # 1. Remove vectors first, but use lightweight Chroma deletion.
        delete_document_vectors(document_id=document_id)

        # 2. Remove uploaded file.
        if original_file_path.exists() and original_file_path.is_file():
            original_file_path.unlink()

        # 3. Remove rendered page images folder.
        if page_dir and page_dir.exists() and page_dir.is_dir():
            shutil.rmtree(page_dir, ignore_errors=True)

        # 4. Remove database record.
        db.delete(document)
        db.commit()

        return DeleteDocumentResponse(
            document_id=document_id,
            status="deleted",
            detail="Document deleted successfully.",
        )

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(exc)}",
        )