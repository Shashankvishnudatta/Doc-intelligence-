from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings
from app.utils.file_security import (
    assert_safe_storage_path,
    calculate_sha256,
    sanitize_filename,
    validate_upload_size,
)

settings = get_settings()


def save_upload_file(original_filename: str, content: bytes) -> dict:
    validate_upload_size(content)

    document_id = uuid4().hex
    safe_filename = sanitize_filename(original_filename)
    stored_filename = f"{document_id}_{safe_filename}"

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / stored_filename
    assert_safe_storage_path(upload_dir, file_path)

    file_path.write_bytes(content)

    return {
        "document_id": document_id,
        "original_filename": original_filename,
        "stored_filename": stored_filename,
        "file_path": file_path.as_posix(),
        "size_bytes": len(content),
        "sha256_hash": calculate_sha256(content),
    } 
