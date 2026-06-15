from typing import Any

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from app.core.config import get_settings

settings = get_settings()

_CHROMA_CLIENT = None
_EMBEDDING_FUNCTION = None
_COLLECTION = None


def sanitize_metadata(metadata: dict[str, Any]) -> dict[str, str | int | float | bool]:
    sanitized: dict[str, str | int | float | bool] = {}

    for key, value in metadata.items():
        if value is None:
            sanitized[str(key)] = ""
        elif isinstance(value, (str, int, float, bool)):
            sanitized[str(key)] = value
        else:
            sanitized[str(key)] = str(value)

    return sanitized


def get_chroma_path():
    return str(
        getattr(
            settings,
            "CHROMA_PATH",
            getattr(settings, "CHROMA_PERSIST_DIR", "data/chroma"),
        )
    )


def get_collection_name():
    return str(
        getattr(
            settings,
            "CHROMA_COLLECTION_NAME",
            "document_chunks",
        )
    )


def get_embedding_model_name():
    return str(
        getattr(
            settings,
            "EMBEDDING_MODEL_NAME",
            getattr(
                settings,
                "EMBEDDING_MODEL",
                "sentence-transformers/all-MiniLM-L6-v2",
            ),
        )
    )


def get_chroma_client():
    global _CHROMA_CLIENT

    if _CHROMA_CLIENT is None:
        _CHROMA_CLIENT = chromadb.PersistentClient(
            path=get_chroma_path(),
        )

    return _CHROMA_CLIENT


def get_embedding_function():
    global _EMBEDDING_FUNCTION

    if _EMBEDDING_FUNCTION is None:
        _EMBEDDING_FUNCTION = SentenceTransformerEmbeddingFunction(
            model_name=get_embedding_model_name(),
        )

    return _EMBEDDING_FUNCTION


def get_or_create_collection():
    global _COLLECTION

    if _COLLECTION is not None:
        return _COLLECTION

    client = get_chroma_client()

    _COLLECTION = client.get_or_create_collection(
        name=get_collection_name(),
        embedding_function=get_embedding_function(),
        metadata={"hnsw:space": "cosine"},
    )

    return _COLLECTION

def add_chunks_to_vector_store(
    chunks=None,
    ids=None,
    documents=None,
    texts=None,
    metadatas=None,
    metadata=None,
    **kwargs,
):
    """
    Add chunks to Chroma.

    This function intentionally supports multiple call styles because
    indexing_service.py may call it with texts=..., while other services
    may call it with documents=... or chunks=[...].

    Supported styles:
    1. add_chunks_to_vector_store(chunks=[...])
    2. add_chunks_to_vector_store(ids=[...], documents=[...], metadatas=[...])
    3. add_chunks_to_vector_store(ids=[...], texts=[...], metadatas=[...])
    """
    collection = get_or_create_collection()

    # Accept both names:
    # Chroma calls them "documents", but some project code may call them "texts".
    final_documents = documents if documents is not None else texts
    final_metadatas = metadatas if metadatas is not None else metadata

    # Case 1: indexing service passes ids + texts/documents.
    if ids is not None and final_documents is not None:
        clean_ids = []
        clean_documents = []
        clean_metadatas = []

        for index, chunk_id in enumerate(ids):
            text = final_documents[index] if index < len(final_documents) else ""

            item_metadata = (
                final_metadatas[index]
                if final_metadatas is not None and index < len(final_metadatas)
                else {}
            )

            if not str(chunk_id).strip() or not str(text).strip():
                continue

            clean_ids.append(str(chunk_id))
            clean_documents.append(str(text))
            clean_metadatas.append(sanitize_metadata(dict(item_metadata)))

        if not clean_ids:
            print("[VECTOR UPSERT] skipped empty batch")
            return

        print(f"[VECTOR UPSERT] count={len(clean_ids)}")

        collection.upsert(
            ids=clean_ids,
            documents=clean_documents,
            metadatas=clean_metadatas,
        )

        return

    # Case 2: service passes chunk dictionaries.
    if not chunks:
        return

    clean_ids = []
    clean_documents = []
    clean_metadatas = []

    for chunk in chunks:
        chunk_id = str(
            chunk.get("id")
            or chunk.get("chunk_id")
            or chunk.get("uuid")
            or ""
        )

        text = str(
            chunk.get("text")
            or chunk.get("chunk_text")
            or chunk.get("content")
            or ""
        )

        item_metadata = dict(
            chunk.get("metadata")
            or chunk.get("metadatas")
            or {}
        )

        if not chunk_id.strip() or not text.strip():
            continue

        clean_ids.append(chunk_id)
        clean_documents.append(text)
        clean_metadatas.append(sanitize_metadata(item_metadata))

    if not clean_ids:
        print("[VECTOR UPSERT] skipped empty chunk batch")
        return

    print(f"[VECTOR UPSERT] count={len(clean_ids)}")

    collection.upsert(
        ids=clean_ids,
        documents=clean_documents,
        metadatas=clean_metadatas,
    )


def query_vector_store(query, top_k=5, document_id=None):
    collection = get_or_create_collection()

    query_kwargs = {
        "query_texts": [query],
        "n_results": top_k,
        "include": ["documents", "metadatas", "distances"],
    }

    if document_id:
        query_kwargs["where"] = {"document_id": document_id}

    return collection.query(**query_kwargs)


def delete_document_vectors(document_id):
    global _COLLECTION

    client = get_chroma_client()

    print(f"[VECTOR DELETE] document_id={document_id}")

    try:
        collection = client.get_collection(
            name=get_collection_name(),
            embedding_function=None,
        )
    except Exception as exc:
        print(
            f"[VECTOR DELETE] collection_missing document_id={document_id} "
            f"error={exc}"
        )
        return

    try:
        collection.delete(where={"document_id": document_id})
        _COLLECTION = None
        print(f"[VECTOR DELETE] completed document_id={document_id}")
    except Exception as exc:
        print(f"[VECTOR DELETE ERROR] document_id={document_id} error={exc}")
        return
