from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
import faiss


# -----------------------------
# 1. Extract text from PDF
# -----------------------------
def extract_text_from_pdf(file_path):
    reader = PdfReader(file_path)

    text = ""

    for page in reader.pages:
        page_text = page.extract_text()

        if page_text:
            text += page_text + "\n"

    return text


# -----------------------------
# 2. Split text into chunks
# -----------------------------
def create_chunks(text, chunk_size=500):
    words = text.split()

    chunks = []

    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)

    return chunks


# -----------------------------
# 3. Read PDF
# -----------------------------
text = extract_text_from_pdf("documents/assignment.pdf")

print("Total characters:", len(text))


# -----------------------------
# 4. Create chunks
# -----------------------------
chunks = create_chunks(text)

print("Total chunks:", len(chunks))


# -----------------------------
# 5. Create embeddings
# -----------------------------
model = SentenceTransformer("all-MiniLM-L6-v2")

embeddings = model.encode(chunks)

print("Embeddings created!")


# -----------------------------
# 6. Create FAISS index
# -----------------------------
dimension = embeddings.shape[1]

index = faiss.IndexFlatL2(dimension)

index.add(embeddings)

print("FAISS index created!")
print("Total vectors:", index.ntotal)


# -----------------------------
# 7. Test a question
# -----------------------------
question = "What are the scalability characteristics of distributed-memory MIMD systems?"

question_embedding = model.encode([question])

distances, results = index.search(question_embedding, k=3)


# -----------------------------
# 8. Show relevant chunks
# -----------------------------
print("\nRelevant information:\n")

for i in results[0]:
    print("----- CHUNK -----")
    print(chunks[i])