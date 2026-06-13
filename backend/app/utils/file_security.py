import hashlib
import re
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings

settings = get_settings()

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".png", ".jpg", ".jpeg"}


def sanitize_filename(filename: str) -> str:
    raw_name = Path(filename).name
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", raw_name)
    safe_name = safe_name.strip("._")

    if not safe_name:
        safe_name = "uploaded_document"

    return safe_name[:150]


def validate_upload_metadata(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File name is missing.",
        )

    extension = Path(file.filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension: {extension}",
        )

    if file.content_type not in settings.allowed_file_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported content type: {file.content_type}",
        )


def validate_upload_size(content: bytes) -> None:
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum upload size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )


def calculate_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def assert_safe_storage_path(base_dir: Path, target_path: Path) -> None:
    base_dir_resolved = base_dir.resolve()
    target_path_resolved = target_path.resolve()

    if base_dir_resolved not in target_path_resolved.parents and target_path_resolved != base_dir_resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsafe storage path detected.",
        )
