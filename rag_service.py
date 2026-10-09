from pathlib import Path

from rag.ingestion import load_all_documents
from rag.retrieval import (
    build_retrieval_index,
    retrieve,
    load_retrieval_index,
)


# =========================================================
# Build index
# =========================================================

def build_index():

    print("\n[RAG] Rebuilding knowledge base...")

    chunks = load_all_documents(
        Path("documents")
    )

    if not chunks:

        print(
            "[RAG] No readable PDF documents found."
        )

        return

    build_retrieval_index(
        chunks
    )

    print(
        "[RAG] Knowledge base ready."
    )


# =========================================================
# Retrieve chunks
# =========================================================

def retrieve_relevant_chunks(
    query: str,
    k: int = 6,
):

    return retrieve(
        query,
        k=k
    )


# =========================================================
# Load existing index when FastAPI starts
# =========================================================

if not load_retrieval_index():

    print(
        "[RAG] No existing index found."
    )

    try:
        build_index()

    except Exception as error:

        print(
            f"[RAG] Initial index build failed: "
            f"{error}"
        )