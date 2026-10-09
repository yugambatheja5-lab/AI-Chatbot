from rag_service import retrieve_relevant_chunks


question = "What are the grades of Yugam in 10th and 12th?"

print("=" * 70)
print("QUESTION:")
print(question)
print("=" * 70)

results = retrieve_relevant_chunks(
    question,
    k=5
)

for number, result in enumerate(results, start=1):

    print("\n" + "-" * 70)
    print(f"RESULT #{number}")

    print("Document:", result["document"])
    print("Page:", result["page"])
    print("Section:", result["section"])
    print("Rerank:", result.get("rerank_score"))

    print("\nTEXT:")
    print(result["text"])