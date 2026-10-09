from pathlib import Path
from typing import List, Dict
import hashlib
import re

import pymupdf


DOCUMENTS_FOLDER = Path("documents")

CHUNK_SIZE = 450
CHUNK_OVERLAP = 80
MIN_TEXT_LENGTH = 30


# =========================================================
# Text cleaning
# =========================================================

def clean_text(text: str) -> str:
    if not text:
        return ""

    text = text.replace("\u00a0", " ")
    text = text.replace("\r\n", "\n")
    text = text.replace("\r", "\n")

    # Clean spaces but preserve line structure
    text = re.sub(r"[ \t]+", " ", text)

    # Preserve paragraphs, remove excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# =========================================================
# Document hash
# =========================================================

def create_document_hash(text: str) -> str:
    normalized = re.sub(
        r"\s+",
        " ",
        text
    ).strip().lower()

    return hashlib.sha256(
        normalized.encode("utf-8")
    ).hexdigest()


# =========================================================
# Heading detection
# =========================================================

def looks_like_heading(line: str) -> bool:

    line = line.strip()

    if not line:
        return False

    if len(line) > 100:
        return False

    words = line.split()

    if len(words) > 12:
        return False

    lowered = line.lower()

    # Common section names
    common_headings = {
        "education",
        "experience",
        "work experience",
        "projects",
        "skills",
        "technical skills",
        "soft skills",
        "certifications",
        "achievements",
        "career objective",
        "objective",
        "summary",
        "introduction",
        "conclusion",
        "references",
        "learning outcomes",
    }

    if lowered in common_headings:
        return True

    # Numbered headings
    numbered_patterns = [
        r"^\d+[\.\)]\s+",
        r"^\d+\.\d+[\.\)]?\s+",
        r"^q\d+[\.\):]\s*",
    ]

    for pattern in numbered_patterns:
        if re.match(
            pattern,
            lowered
        ):
            return True

    # Chapter / section / unit / module
    if re.match(
        r"^(chapter|section|unit|module|part)\b",
        lowered
    ):
        return True

    # ALL CAPS headings
    letters = [
        c for c in line
        if c.isalpha()
    ]

    if letters:

        uppercase_ratio = (
            sum(
                c.isupper()
                for c in letters
            )
            / len(letters)
        )

        if (
            uppercase_ratio > 0.8
            and len(line) < 80
        ):
            return True

    return False


# =========================================================
# Extract structured blocks from a PDF page
# =========================================================

def extract_page_blocks(
    page,
    document_name: str,
    page_number: int,
) -> List[Dict]:

    raw_blocks = page.get_text(
        "blocks",
        sort=True
    )

    blocks = []

    current_section = "General"

    for block in raw_blocks:

        # PyMuPDF block format:
        # x0, y0, x1, y1, text, block_no, block_type

        if len(block) < 7:
            continue

        text = clean_text(
            block[4]
        )

        block_type = block[6]

        # 0 = text block
        if block_type != 0:
            continue

        if len(text) < MIN_TEXT_LENGTH:
            continue

        lines = [
            line.strip()
            for line in text.splitlines()
            if line.strip()
        ]

        if not lines:
            continue

        # -------------------------------------------------
        # Detect heading inside THIS block.
        # -------------------------------------------------

        detected_heading = None

        for line in lines[:3]:

            if looks_like_heading(line):

                detected_heading = line
                break

        if detected_heading:

            current_section = detected_heading

        blocks.append(
            {
                "document": document_name,
                "page": page_number,
                "section": current_section,
                "text": text,
            }
        )

    return blocks


# =========================================================
# Extract complete PDF
# =========================================================

def extract_pages(
    pdf_path: Path
) -> List[Dict]:

    document = pymupdf.open(
        pdf_path
    )

    all_blocks = []

    try:

        for page_number, page in enumerate(
            document,
            start=1
        ):

            page_blocks = extract_page_blocks(
                page,
                pdf_path.name,
                page_number
            )

            all_blocks.extend(
                page_blocks
            )

    finally:

        document.close()

    return all_blocks


# =========================================================
# Create logical text units
# =========================================================

def create_text_units(
    blocks: List[Dict]
) -> List[Dict]:

    units = []

    for block in blocks:

        text = block["text"]

        # Split large blocks into paragraphs.
        paragraphs = re.split(
            r"\n\s*\n",
            text
        )

        for paragraph in paragraphs:

            paragraph = clean_text(
                paragraph
            )

            if len(paragraph) < MIN_TEXT_LENGTH:
                continue

            units.append(
                {
                    "document": block[
                        "document"
                    ],
                    "page": block[
                        "page"
                    ],
                    "section": block[
                        "section"
                    ],
                    "text": paragraph,
                }
            )

    return units


# =========================================================
# Chunk text
# =========================================================

def split_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> List[str]:

    words = text.split()

    if not words:
        return []

    chunks = []

    start = 0

    while start < len(words):

        end = min(
            start + chunk_size,
            len(words)
        )

        chunk = " ".join(
            words[start:end]
        ).strip()

        if chunk:
            chunks.append(
                chunk
            )

        if end >= len(words):
            break

        next_start = end - overlap

        if next_start <= start:
            next_start = end

        start = next_start

    return chunks


# =========================================================
# Contextual text
# =========================================================

def create_contextual_text(
    document: str,
    page: int,
    section: str,
    chunk_text: str,
) -> str:

    return (
        f"Document: {document}\n"
        f"Page: {page}\n"
        f"Section: {section}\n\n"
        f"{chunk_text}"
    )


# =========================================================
# Process one PDF
# =========================================================

def process_pdf(
    pdf_path: Path
) -> List[Dict]:

    blocks = extract_pages(
        pdf_path
    )

    if not blocks:
        return []

    units = create_text_units(
        blocks
    )

    complete_text = "\n".join(
        unit["text"]
        for unit in units
    )

    document_hash = create_document_hash(
        complete_text
    )

    chunks = []

    chunk_counter = 0

    for unit in units:

        text_chunks = split_text(
            unit["text"]
        )

        for child_index, chunk_text in enumerate(
            text_chunks
        ):

            chunk_counter += 1

            chunk_id = (
                f"{document_hash[:12]}_"
                f"p{unit['page']}_"
                f"c{chunk_counter}"
            )

            parent_id = (
                f"{document_hash[:12]}_"
                f"p{unit['page']}"
            )

            contextual_text = (
                create_contextual_text(
                    document=unit[
                        "document"
                    ],
                    page=unit[
                        "page"
                    ],
                    section=unit[
                        "section"
                    ],
                    chunk_text=chunk_text,
                )
            )

            chunks.append(
                {
                    "chunk_id": chunk_id,
                    "parent_id": parent_id,

                    "document": unit[
                        "document"
                    ],

                    "source": unit[
                        "document"
                    ],

                    "page": unit[
                        "page"
                    ],

                    "section": unit[
                        "section"
                    ],

                    "document_hash": document_hash,

                    # Text shown to the LLM
                    "text": chunk_text,

                    # Text used by retrieval
                    "search_text": contextual_text,

                    "chunk_index": chunk_counter,

                    "child_index": child_index,
                }
            )

    return chunks


# =========================================================
# Load every PDF
# =========================================================

def load_all_documents(
    documents_folder: Path = DOCUMENTS_FOLDER,
) -> List[Dict]:

    documents_folder.mkdir(
        parents=True,
        exist_ok=True
    )

    all_chunks = []

    seen_document_hashes = set()

    pdf_files = sorted(
        documents_folder.glob("*.pdf")
    )

    for pdf_path in pdf_files:

        try:

            chunks = process_pdf(
                pdf_path
            )

            if not chunks:

                print(
                    f"[RAG] No extractable text: "
                    f"{pdf_path.name}"
                )

                continue

            document_hash = chunks[0][
                "document_hash"
            ]

            # Prevent duplicate documents
            if document_hash in seen_document_hashes:

                print(
                    f"[RAG] Skipping duplicate: "
                    f"{pdf_path.name}"
                )

                continue

            seen_document_hashes.add(
                document_hash
            )

            all_chunks.extend(
                chunks
            )

            print(
                f"[RAG] Processed "
                f"{pdf_path.name}: "
                f"{len(chunks)} chunks"
            )

        except Exception as error:

            print(
                f"[RAG] Failed to process "
                f"{pdf_path.name}: {error}"
            )

    print(
        f"[RAG] Total chunks: "
        f"{len(all_chunks)}"
    )

    return all_chunks