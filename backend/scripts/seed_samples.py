import mimetypes
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
SAMPLES_DIR = PROJECT_ROOT / "samples"

sys.path.insert(0, BACKEND_DIR.as_posix())

from app.core.database import SessionLocal, init_db
from app.models.document import Document
from app.services.classification_service import classify_and_store_document
from app.services.document_processing_service import parse_and_store_document
from app.services.indexing_service import index_and_store_document
from app.services.storage_service import save_upload_file
from app.utils.file_security import calculate_sha256


def guess_content_type(file_path: Path) -> str:
    content_type, _ = mimetypes.guess_type(file_path.as_posix())

    if content_type:
        return content_type

    if file_path.suffix.lower() == ".txt":
        return "text/plain"

    if file_path.suffix.lower() == ".pdf":
        return "application/pdf"

    if file_path.suffix.lower() == ".png":
        return "image/png"

    if file_path.suffix.lower() in {".jpg", ".jpeg"}:
        return "image/jpeg"

    return "application/octet-stream"


def seed_one_sample(file_path: Path) -> None:
    content = file_path.read_bytes()
    sha256_hash = calculate_sha256(content)
    content_type = guess_content_type(file_path)

    db = SessionLocal()

    try:
        existing_document = (
            db.query(Document)
            .filter(Document.sha256_hash == sha256_hash)
            .first()
        )

        if existing_document:
            print(f"[SKIP] {file_path.name} already exists as {existing_document.id}")

            if existing_document.status != "indexed":
                print(f"[PIPELINE] Existing document is {existing_document.status}. Re-processing...")
                parse_and_store_document(existing_document, db)
                classify_and_store_document(existing_document.id, db)
                index_and_store_document(existing_document.id, db)

            return

        saved_file = save_upload_file(
            original_filename=file_path.name,
            content=content,
        )

        document = Document(
            id=saved_file["document_id"],
            original_filename=saved_file["original_filename"],
            stored_filename=saved_file["stored_filename"],
            file_path=saved_file["file_path"],
            content_type=content_type,
            size_bytes=saved_file["size_bytes"],
            sha256_hash=saved_file["sha256_hash"],
            status="uploaded",
            page_count=0,
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        print(f"[UPLOAD] {file_path.name} -> {document.id}")

        parsed_document = parse_and_store_document(document, db)
        print(f"[PARSE] {file_path.name} -> {parsed_document.status}, pages={parsed_document.page_count}")

        classified_document = classify_and_store_document(document.id, db)
        print(f"[CLASSIFY] {file_path.name} -> {classified_document.status}")

        indexed_document = index_and_store_document(document.id, db)
        print(f"[INDEX] {file_path.name} -> {indexed_document.status}")

    except Exception as exc:
        db.rollback()
        print(f"[ERROR] {file_path.name}: {exc}")

    finally:
        db.close()


def main() -> None:
    init_db()

    if not SAMPLES_DIR.exists():
        raise RuntimeError(f"Samples directory not found: {SAMPLES_DIR}")

    sample_files = sorted(
        [
            file_path
            for file_path in SAMPLES_DIR.iterdir()
            if file_path.suffix.lower() in {".txt", ".pdf", ".png", ".jpg", ".jpeg"}
        ]
    )

    if not sample_files:
        raise RuntimeError("No supported sample files found.")

    print(f"Found {len(sample_files)} sample files.")
    print("Starting sample ingestion pipeline...\n")

    for file_path in sample_files:
        seed_one_sample(file_path)
        print("-" * 80)

    print("\nSample seeding completed.")
    print("Open http://localhost:3000/chat and ask questions about the indexed sample documents.")


if __name__ == "__main__":
    main() 
