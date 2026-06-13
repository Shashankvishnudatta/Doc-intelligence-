from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.document import Document
from app.schemas.document import BulkUploadResponse, UploadResult
from app.services.storage_service import save_upload_file
from app.utils.file_security import validate_upload_metadata

router = APIRouter(prefix="/uploads", tags=["Uploads"])


async def save_document_record(file: UploadFile, db: Session) -> UploadResult:
    validate_upload_metadata(file)

    content = await file.read()

    saved_file = save_upload_file(
        original_filename=file.filename or "uploaded_document",
        content=content,
    )

    document = Document(
        id=saved_file["document_id"],
        original_filename=saved_file["original_filename"],
        stored_filename=saved_file["stored_filename"],
        file_path=saved_file["file_path"],
        content_type=file.content_type or "application/octet-stream",
        size_bytes=saved_file["size_bytes"],
        sha256_hash=saved_file["sha256_hash"],
        status="uploaded",
        page_count=0,
    )

    db.add(document)
    db.commit()
    db.refresh(document)

    return UploadResult(
        filename=document.original_filename,
        document_id=document.id,
        status=document.status,
        detail="File uploaded and stored successfully.",
        size_bytes=document.size_bytes,
    )


@router.post("/bulk", response_model=BulkUploadResponse)
async def bulk_upload_documents(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    results: list[UploadResult] = []

    for file in files:
        try:
            result = await save_document_record(file=file, db=db)
            results.append(result)

        except HTTPException as exc:
            db.rollback()
            results.append(
                UploadResult(
                    filename=file.filename or "unknown_file",
                    document_id=None,
                    status="failed",
                    detail=str(exc.detail),
                    size_bytes=None,
                )
            )

        except Exception as exc:
            db.rollback()
            results.append(
                UploadResult(
                    filename=file.filename or "unknown_file",
                    document_id=None,
                    status="failed",
                    detail=f"Unexpected upload error: {str(exc)}",
                    size_bytes=None,
                )
            )

    successful = len([item for item in results if item.status != "failed"])
    failed = len(results) - successful

    return BulkUploadResponse(
        total_files=len(results),
        successful=successful,
        failed=failed,
        results=results,
    ) 
