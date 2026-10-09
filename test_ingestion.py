from pathlib import Path

from rag.ingestion import load_all_documents


chunks = load_all_documents(
    Path("documents")
)

print("\n" + "=" * 60)
print("INGESTION TEST")
print("=" * 60)

print(f"Total chunks: {len(chunks)}")

print("\nFirst 5 chunks:\n")

for chunk in chunks[:5]:

    print("-" * 60)

    print("Chunk ID:", chunk["chunk_id"])
    print("Document:", chunk["document"])
    print("Page:", chunk["page"])
    print("Section:", chunk["section"])
    print("Parent:", chunk["parent_id"])

    print("\nSEARCH TEXT:")
    print(chunk["search_text"][:500])

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)