from typing import Any

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from app.core.config import get_settings

settings = get_settings()


def get_chroma_path() -> str:
    return str(
        getattr(
            settings,
            "CHROMA_PATH",
            getattr(settings, "CHROMA_PERSIST_DIR", "data/chroma"),
        )
    )


def get_collection_name() -> str:
    return str(
        getattr(
            settings,
            "CHROMA_COLLECTION_NAME",
            "document_chunks",
        )
    )


def get_embedding_model_name() -> str:
    return str(
        getattr(
            settings,
            "EMBEDDING_MODEL_NAME",
            getattr(settings, "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
        )
    )


def get_chroma_client() -> chromadb.PersistentClient:
    return chromadb.PersistentClient(
        path=get_chroma_path(),
    )


def get_embedding_function() -> SentenceTransformerEmbeddingFunction:
    return SentenceTransformerEmbeddingFunction(
        model_name=get_embedding_model_name(),
    )


def get_or_create_collection():
    client = get_chroma_client()

    return client.get_or_create_collection(
        name=get_collection_name(),
        embedding_function=get_embedding_function(),
        metadata={
            "hnsw:space": "cosine",
        },
    )


def add_chunks_to_vector_store(chunks: list[dict[str, Any]]) -> None:
    if not chunks:
        return

    collection = get_or_create_collection()

    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, Any]] = []

    for chunk in chunks:
        chunk_id = str(chunk.get("id") or chunk.get("chunk_id"))
        text = str(chunk.get("text") or chunk.get("chunk_text") or "")
        metadata = dict(chunk.get("metadata") or {})

        if not chunk_id or not text.strip():
            continue

        ids.append(chunk_id)
        documents.append(text)
        metadatas.append(metadata)

    if not ids:
        return

    collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
    )


def query_vector_store(
    query: str,
    top_k: int = 5,
    document_id: str | None = None,
) -> dict[str, Any]:
    collection = get_or_create_collection()

    query_kwargs: dict[str, Any] = {
        "query_texts": [query],
        "n_results": top_k,
        "include": ["documents", "metadatas", "distances"],
    }

    if document_id:
        query_kwargs["where"] = {
            "document_id": document_id,
        }

    return collection.query(**query_kwargs)


def delete_document_vectors(document_id: str) -> None:
    """
    Delete vectors for a document without loading the embedding model.

    Deleting vectors does not require SentenceTransformer embeddings.
    This keeps document deletion faster.
    """
    client = get_chroma_client()

    try:
        collection = client.get_collection(
            name=get_collection_name(),
            embedding_function=None,
        )
    except Exception:
        return

    try:
        collection.delete(
            where={
                "document_id": document_id,
            }
        )
    except Exception:
        return