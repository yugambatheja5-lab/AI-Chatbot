from pathlib import Path
from typing import List, Dict
import json
import pickle
import re

import faiss
import numpy as np

from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer, CrossEncoder


# =========================================================
# Configuration
# =========================================================

STORE_FOLDER = Path("rag_store")

FAISS_FILE = STORE_FOLDER / "index.faiss"
CHUNKS_FILE = STORE_FOLDER / "chunks.json"
BM25_FILE = STORE_FOLDER / "bm25.pkl"

EMBEDDING_MODEL = "multi-qa-MiniLM-L6-cos-v1"
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

# First-stage retrieval
DENSE_TOP_K = 30
BM25_TOP_K = 30

# Number of unique candidates sent to reranker
CANDIDATE_TOP_K = 30

# Final number of evidence chunks
FINAL_TOP_K = 6


_embedding_model = None
_reranker = None

_faiss_index = None
_bm25_index = None
_chunks = []


# =========================================================
# Models
# =========================================================

def get_embedding_model():
    global _embedding_model

    if _embedding_model is None:
        print(
            f"[RAG] Loading embedding model: "
            f"{EMBEDDING_MODEL}"
        )

        _embedding_model = SentenceTransformer(
            EMBEDDING_MODEL
        )

    return _embedding_model


def get_reranker():
    global _reranker

    if _reranker is None:
        print(
            f"[RAG] Loading reranker: "
            f"{RERANKER_MODEL}"
        )

        _reranker = CrossEncoder(
            RERANKER_MODEL,
            device="cpu"
        )

    return _reranker


# =========================================================
# Tokenization
# =========================================================

def tokenize(text: str) -> List[str]:
    """
    Simple tokenizer for BM25 and exact evidence matching.
    """

    text = text.lower()

    return re.findall(
        r"[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*",
        text
    )


# =========================================================
# Query understanding
# =========================================================

def normalize_query(query: str) -> str:
    """
    Normalize common ways users refer to academic information.
    """

    query = query.lower()

    replacements = {
        "10th standard": "class x",
        "10th class": "class x",
        "10th": "class x",
        "12th standard": "class xii",
        "12th class": "class xii",
        "12th": "class xii",

        "grade": "percentage",
        "grades": "percentage",

        "marks": "percentage",
        "score": "percentage",
        "scores": "percentage",

        "tenth": "class x",
        "twelfth": "class xii",
    }

    for old, new in replacements.items():
        query = query.replace(old, new)

    query = re.sub(
        r"\s+",
        " ",
        query
    ).strip()

    return query


def build_query_variants(query: str) -> List[str]:
    """
    Create a small number of deterministic query variants.

    We avoid generating many noisy variants.
    """

    original = query.strip()

    normalized = normalize_query(original)

    variants = []

    # Original query
    variants.append(original)

    # Normalized query
    if normalized.lower() != original.lower():
        variants.append(normalized)

    lowered = normalized.lower()

    # -----------------------------------------------------
    # Education queries
    # -----------------------------------------------------

    education_terms = [
        "class x",
        "class xii",
        "percentage",
        "marks",
        "cgpa",
        "school",
        "matriculation",
        "intermediate",
    ]

    if any(
        term in lowered
        for term in education_terms
    ):

        variants.append(
            normalized
            + " matriculation intermediate percentage"
        )

    # -----------------------------------------------------
    # Subject / student queries
    # -----------------------------------------------------

    if any(
        term in lowered
        for term in [
            "subject",
            "student",
            "student name",
            "uid",
            "course",
            "assignment",
        ]
    ):

        variants.append(
            normalized
            + " subject name subject code student name UID"
        )

    # -----------------------------------------------------
    # Conceptual queries
    # -----------------------------------------------------

    simplified = re.sub(
        r"\b(what is|what are|define|explain|tell me about)\b",
        "",
        lowered,
        flags=re.IGNORECASE
    ).strip()

    if simplified and simplified != lowered:
        variants.append(simplified)

    # Remove duplicates
    unique = []

    for variant in variants:

        variant = re.sub(
            r"\s+",
            " ",
            variant
        ).strip()

        if (
            variant
            and variant.lower()
            not in {
                item.lower()
                for item in unique
            }
        ):
            unique.append(variant)

    return unique


# =========================================================
# Load indexes
# =========================================================

def load_retrieval_index() -> bool:

    global _faiss_index
    global _bm25_index
    global _chunks

    if not (
        FAISS_FILE.exists()
        and CHUNKS_FILE.exists()
        and BM25_FILE.exists()
    ):
        return False

    try:

        print(
            "[RAG] Loading existing retrieval indexes..."
        )

        _faiss_index = faiss.read_index(
            str(FAISS_FILE)
        )

        with open(
            CHUNKS_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            _chunks = json.load(file)

        with open(
            BM25_FILE,
            "rb"
        ) as file:

            _bm25_index = pickle.load(
                file
            )

        print(
            f"[RAG] Loaded {len(_chunks)} chunks."
        )

        return True

    except Exception as error:

        print(
            f"[RAG] Could not load indexes: {error}"
        )

        _faiss_index = None
        _bm25_index = None
        _chunks = []

        return False


# =========================================================
# Build indexes
# =========================================================

def build_retrieval_index(
    chunks: List[Dict]
):

    global _faiss_index
    global _bm25_index
    global _chunks

    STORE_FOLDER.mkdir(
        parents=True,
        exist_ok=True
    )

    if not chunks:
        raise ValueError(
            "No chunks available."
        )

    print(
        f"[RAG] Building indexes for "
        f"{len(chunks)} chunks..."
    )

    _chunks = chunks

    embedding_model = get_embedding_model()

    texts = [
        chunk["search_text"]
        for chunk in chunks
    ]

    embeddings = embedding_model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=True,
    ).astype(
        np.float32
    )

    dimension = embeddings.shape[1]

    _faiss_index = faiss.IndexFlatIP(
        dimension
    )

    _faiss_index.add(
        embeddings
    )

    # BM25
    tokenized_documents = [
        tokenize(
            chunk["search_text"]
        )
        for chunk in chunks
    ]

    _bm25_index = BM25Okapi(
        tokenized_documents
    )

    # Save FAISS
    faiss.write_index(
        _faiss_index,
        str(FAISS_FILE)
    )

    # Save chunks
    with open(
        CHUNKS_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            _chunks,
            file,
            ensure_ascii=False,
            indent=2
        )

    # Save BM25
    with open(
        BM25_FILE,
        "wb"
    ) as file:

        pickle.dump(
            _bm25_index,
            file
        )

    print(
        "[RAG] Retrieval indexes built successfully."
    )


# =========================================================
# Dense search
# =========================================================

def dense_search(
    query: str,
    top_k: int = DENSE_TOP_K,
):

    if _faiss_index is None:
        return []

    model = get_embedding_model()

    embedding = model.encode(
        [query],
        convert_to_numpy=True,
        normalize_embeddings=True,
    ).astype(
        np.float32
    )

    scores, indices = _faiss_index.search(
        embedding,
        min(
            top_k,
            len(_chunks)
        )
    )

    results = []

    for score, index in zip(
        scores[0],
        indices[0]
    ):

        if index < 0:
            continue

        results.append(
            {
                "index": int(index),
                "dense_score": float(score),
            }
        )

    return results


# =========================================================
# BM25 search
# =========================================================

def bm25_search(
    query: str,
    top_k: int = BM25_TOP_K,
):

    if _bm25_index is None:
        return []

    tokens = tokenize(
        query
    )

    if not tokens:
        return []

    scores = _bm25_index.get_scores(
        tokens
    )

    ranked = np.argsort(
        scores
    )[::-1]

    results = []

    for index in ranked[
        :min(
            top_k,
            len(_chunks)
        )
    ]:

        results.append(
            {
                "index": int(index),
                "bm25_score": float(
                    scores[index]
                ),
            }
        )

    return results


# =========================================================
# Candidate generation
# =========================================================

def build_candidate_pool(
    query: str
):

    variants = build_query_variants(
        query
    )

    print(
        f"[RAG] Query variants: {variants}"
    )

    candidate_scores = {}

    # -----------------------------------------------------
    # Run both retrievers
    # -----------------------------------------------------

    for variant in variants:

        dense_results = dense_search(
            variant,
            DENSE_TOP_K
        )

        bm25_results = bm25_search(
            variant,
            BM25_TOP_K
        )

        # Dense candidates
        for rank, result in enumerate(
            dense_results,
            start=1
        ):

            index = result["index"]

            candidate = candidate_scores.setdefault(
                index,
                {
                    "index": index,
                    "dense_hits": 0,
                    "bm25_hits": 0,
                    "best_dense_rank": 999,
                    "best_bm25_rank": 999,
                    "dense_score": -999,
                    "bm25_score": 0,
                }
            )

            candidate["dense_hits"] += 1

            candidate["best_dense_rank"] = min(
                candidate["best_dense_rank"],
                rank
            )

            candidate["dense_score"] = max(
                candidate["dense_score"],
                result["dense_score"]
            )

        # BM25 candidates
        for rank, result in enumerate(
            bm25_results,
            start=1
        ):

            index = result["index"]

            candidate = candidate_scores.setdefault(
                index,
                {
                    "index": index,
                    "dense_hits": 0,
                    "bm25_hits": 0,
                    "best_dense_rank": 999,
                    "best_bm25_rank": 999,
                    "dense_score": -999,
                    "bm25_score": 0,
                }
            )

            candidate["bm25_hits"] += 1

            candidate["best_bm25_rank"] = min(
                candidate["best_bm25_rank"],
                rank
            )

            candidate["bm25_score"] = max(
                candidate["bm25_score"],
                result["bm25_score"]
            )

    # -----------------------------------------------------
    # Candidate ordering
    #
    # We prioritize:
    # 1. BM25 exact evidence
    # 2. agreement between retrievers
    # 3. dense similarity
    #
    # This is candidate generation only.
    # CrossEncoder makes the final ranking.
    # -----------------------------------------------------

    def candidate_priority(item):

        return (
            item["bm25_hits"],
            item["dense_hits"],
            -item["best_bm25_rank"],
            -item["best_dense_rank"],
            item["dense_score"],
        )

    candidates = sorted(
        candidate_scores.values(),
        key=candidate_priority,
        reverse=True
    )

    return candidates[
        :CANDIDATE_TOP_K
    ]


# =========================================================
# Evidence detection
# =========================================================

def extract_query_entities(query: str):

    tokens = tokenize(query)

    stop_words = {
        "what",
        "is",
        "are",
        "the",
        "of",
        "in",
        "on",
        "for",
        "to",
        "and",
        "a",
        "an",
        "me",
        "tell",
        "about",
        "does",
        "do",
        "how",
        "which",
        "where",
        "who",
        "was",
        "were",
        "with",
        "from",
    }

    return {
        token
        for token in tokens
        if token not in stop_words
        and len(token) > 1
    }


def evidence_score(
    query: str,
    chunk: Dict
):

    query_tokens = extract_query_entities(
        query
    )

    text_tokens = set(
        tokenize(
            chunk["search_text"]
        )
    )

    if not query_tokens:
        return 0.0

    overlap = (
        query_tokens
        & text_tokens
    )

    return (
        len(overlap)
        / len(query_tokens)
    )


# =========================================================
# CrossEncoder reranking
# =========================================================

def rerank_candidates(
    query: str,
    candidates: List[Dict]
):

    if not candidates:
        return []

    reranker = get_reranker()

    pairs = []

    for candidate in candidates:

        chunk = _chunks[
            candidate["index"]
        ]

        pairs.append(
            (
                query,
                chunk["search_text"]
            )
        )

    scores = reranker.predict(
        pairs,
        show_progress_bar=False
    )

    results = []

    for candidate, score in zip(
        candidates,
        scores
    ):

        chunk = _chunks[
            candidate["index"]
        ]

        evidence = evidence_score(
            query,
            chunk
        )

        # CrossEncoder is the primary ranking signal.
        #
        # Evidence is only a small tie-breaking signal,
        # rather than a collection of arbitrary weights.
        final_score = (
            float(score)
            + (0.75 * evidence)
        )

        result = {
            **chunk,

            "index": candidate["index"],

            "rerank_score": float(
                score
            ),

            "evidence_score": float(
                evidence
            ),

            "final_score": float(
                final_score
            ),

            "dense_score": candidate.get(
                "dense_score",
                0.0
            ),

            "bm25_score": candidate.get(
                "bm25_score",
                0.0
            ),

            "dense_hits": candidate.get(
                "dense_hits",
                0
            ),

            "bm25_hits": candidate.get(
                "bm25_hits",
                0
            ),
        }

        results.append(
            result
        )

    results.sort(
        key=lambda item: item["final_score"],
        reverse=True
    )

    return results


# =========================================================
# Context expansion
# =========================================================

def expand_context(
    ranked_results: List[Dict],
    final_k: int = FINAL_TOP_K,
):

    if not ranked_results:
        return []

    # Start with the strongest ranked chunks.
    selected = []

    for result in ranked_results:

        index = result["index"]

        if index not in selected:
            selected.append(index)

        if len(selected) >= final_k:
            break

    expanded_indices = []

    # -----------------------------------------------------
    # Add selected chunks
    # -----------------------------------------------------

    for index in selected:

        if index not in expanded_indices:
            expanded_indices.append(index)

    # -----------------------------------------------------
    # Add neighboring chunks only when they belong to the
    # same parent.
    # -----------------------------------------------------

    for index in selected:

        chunk = _chunks[index]

        parent_id = chunk.get(
            "parent_id"
        )

        child_index = chunk.get(
            "child_index"
        )

        if parent_id is None:
            continue

        if child_index is None:
            continue

        for other_index, other in enumerate(
            _chunks
        ):

            if other.get(
                "parent_id"
            ) != parent_id:

                continue

            other_child_index = other.get(
                "child_index"
            )

            if other_child_index is None:
                continue

            if abs(
                other_child_index
                - child_index
            ) <= 1:

                if other_index not in expanded_indices:
                    expanded_indices.append(
                        other_index
                    )

    # -----------------------------------------------------
    # Build final context
    # -----------------------------------------------------

    final = []

    for index in expanded_indices:

        chunk = dict(
            _chunks[index]
        )

        matching = next(
            (
                result
                for result in ranked_results
                if result["index"] == index
            ),
            None
        )

        if matching:

            chunk.update(
                {
                    "rerank_score":
                        matching.get(
                            "rerank_score"
                        ),

                    "final_score":
                        matching.get(
                            "final_score"
                        ),

                    "evidence_score":
                        matching.get(
                            "evidence_score"
                        ),

                    "dense_score":
                        matching.get(
                            "dense_score"
                        ),

                    "bm25_score":
                        matching.get(
                            "bm25_score"
                        ),

                    "dense_hits":
                        matching.get(
                            "dense_hits"
                        ),

                    "bm25_hits":
                        matching.get(
                            "bm25_hits"
                        ),
                }
            )

        final.append(
            chunk
        )

    return final


# =========================================================
# Main retrieval
# =========================================================

def retrieve(
    query: str,
    k: int = FINAL_TOP_K,
):

    if not _chunks:

        if not load_retrieval_index():
            return []

    # -----------------------------------------------------
    # 1. Candidate generation
    # -----------------------------------------------------

    candidates = build_candidate_pool(
        query
    )

    if not candidates:
        return []

    print(
        f"[RAG] Candidate pool: "
        f"{len(candidates)}"
    )

    # -----------------------------------------------------
    # 2. CrossEncoder reranking
    # -----------------------------------------------------

    ranked_results = rerank_candidates(
        query,
        candidates
    )

    if not ranked_results:
        return []

    # -----------------------------------------------------
    # 3. Context expansion
    # -----------------------------------------------------

    final_results = expand_context(
        ranked_results,
        final_k=k
    )

    return final_results


# =========================================================
# Debugging
# =========================================================

def debug_retrieval(
    query: str,
    k: int = FINAL_TOP_K,
):

    results = retrieve(
        query,
        k
    )

    print("\n")
    print("=" * 80)
    print("RAG RETRIEVAL DEBUG")
    print("=" * 80)

    print(
        "\nQUERY:"
    )

    print(query)

    print(
        f"\nRESULTS: {len(results)}"
    )

    for number, result in enumerate(
        results,
        start=1
    ):

        print(
            "\n"
            + "-" * 80
        )

        print(
            f"#{number}"
        )

        print(
            "Document:",
            result.get(
                "document"
            )
        )

        print(
            "Page:",
            result.get(
                "page"
            )
        )

        print(
            "Section:",
            result.get(
                "section"
            )
        )

        print(
            "Final score:",
            result.get(
                "final_score"
            )
        )

        print(
            "Rerank:",
            result.get(
                "rerank_score"
            )
        )

        print(
            "Evidence:",
            result.get(
                "evidence_score"
            )
        )

        print(
            "BM25 hits:",
            result.get(
                "bm25_hits"
            )
        )

        print(
            "Dense hits:",
            result.get(
                "dense_hits"
            )
        )

        print(
            "\nTEXT:"
        )

        print(
            result.get(
                "text",
                ""
            )[:1000]
        )

    print(
        "\n"
        + "=" * 80
    )

    return results