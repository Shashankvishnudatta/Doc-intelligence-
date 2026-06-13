from uuid import uuid4

from sqlalchemy.orm import Session, selectinload

from app.models.document import Document, DocumentChunk
from app.services.chunking_service import build_page_chunks
from app.services.vector_service import add_chunks_to_vector_store, delete_document_vectors


def index_and_store_document(document_id: str, db: Session) -> Document:
    document = (
        db.query(Document)
        .options(selectinload(Document.pages))
        .filter(Document.id == document_id)
        .first()
    )

    if not document:
        raise ValueError("Document not found.")

    if document.page_count <= 0 or not document.pages:
        raise ValueError("Document must be parsed before indexing.")

    document.status = "indexing"
    document.error_message = None
    db.commit()

    try:
        db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document.id
        ).delete()
        db.commit()

        delete_document_vectors(document_id=document.id)

        chroma_ids: list[str] = []
        chunk_texts: list[str] = []
        metadatas: list[dict] = []

        sorted_pages = sorted(document.pages, key=lambda page: page.page_number)

        for page in sorted_pages:
            page_chunks = build_page_chunks(page)

            for chunk_index, chunk_text in enumerate(page_chunks):
                chunk_id = uuid4().hex
                chroma_id = f"{document.id}_p{page.page_number}_c{chunk_index}_{chunk_id[:8]}"

                chunk = DocumentChunk(
                    id=chunk_id,
                    document_id=document.id,
                    page_id=page.id,
                    page_number=page.page_number,
                    chunk_index=chunk_index,
                    text=chunk_text,
                    chroma_id=chroma_id,
                )

                db.add(chunk)

                chroma_ids.append(chroma_id)
                chunk_texts.append(chunk_text)
                metadatas.append(
                    {
                        "document_id": document.id,
                        "document_name": document.original_filename,
                        "page_id": page.id,
                        "page_number": page.page_number,
                        "chunk_index": chunk_index,
                        "source": f"{document.original_filename} · page {page.page_number}",
                    }
                )

        if not chroma_ids:
            raise ValueError("No text chunks were created for indexing.")

        db.commit()

        add_chunks_to_vector_store(
            ids=chroma_ids,
            texts=chunk_texts,
            metadatas=metadatas,
        )

        document.status = "indexed"
        document.error_message = None

        db.commit()
        db.refresh(document)

        return document

    except Exception as exc:
        db.rollback()

        document = db.query(Document).filter(Document.id == document_id).first()
        document.status = "failed"
        document.error_message = f"Indexing failed: {str(exc)}"

        db.commit()
        db.refresh(document)

        return document 
