import shutil
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.document import Document
from app.services.vector_service import delete_document_vectors
from app.utils.file_security import assert_safe_storage_path

settings = get_settings()


def safe_delete_file(file_path: str) -> bool:
    target_path = Path(file_path)
    upload_dir = Path(settings.UPLOAD_DIR)

    if not target_path.exists():
        return False

    assert_safe_storage_path(upload_dir, target_path)
    target_path.unlink()

    return True


def safe_delete_page_directory(document_id: str) -> bool:
    page_base_dir = Path(settings.PAGE_IMAGE_DIR)
    page_dir = page_base_dir / document_id

    if not page_dir.exists():
        return False

    assert_safe_storage_path(page_base_dir, page_dir)
    shutil.rmtree(page_dir)

    return True


def delete_document_completely(document_id: str, db: Session) -> dict:
    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        return {
            "deleted": False,
            "document_id": document_id,
            "detail": "Document not found.",
        }

    original_filename = document.original_filename
    file_path = document.file_path

    file_deleted = False
    page_images_deleted = False
    vectors_deleted = False

    try:
        delete_document_vectors(document_id=document_id)
        vectors_deleted = True
    except Exception:
        vectors_deleted = False

    try:
        file_deleted = safe_delete_file(file_path)
    except Exception:
        file_deleted = False

    try:
        page_images_deleted = safe_delete_page_directory(document_id)
    except Exception:
        page_images_deleted = False

    db.delete(document)
    db.commit()

    return {
        "deleted": True,
        "document_id": document_id,
        "filename": original_filename,
        "file_deleted": file_deleted,
        "page_images_deleted": page_images_deleted,
        "vectors_deleted": vectors_deleted,
        "detail": "Document deleted successfully.",
    } 
