import logging
import time
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import ollama

import config
from rag_service import retrieve_relevant_chunks, build_index

# Setup logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)
logger = logging.getLogger("knowledge_ai")

app = FastAPI(title="Knowledge AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Request & Response Schemas
# =========================================================

class MessageItem(BaseModel):
    role: str = Field(..., description="Role of the sender: 'user' or 'assistant'")
    content: str = Field(..., description="Message text content")

class ChatRequest(BaseModel):
    message: str = Field(..., description="The user's latest query message")
    history: Optional[List[MessageItem]] = Field(default=[], description="Previous conversation turn history")

class ChatResponse(BaseModel):
    user_message: str
    reply: str
    sources: List[str]


# =========================================================
# Helper Functions
# =========================================================

def build_retrieval_query(message: str, history: List[MessageItem]) -> str:
    """
    Build a context-enhanced query string for document retrieval
    so follow-up questions find relevant chunks even with ambiguous phrasing.
    """
    clean_msg = message.strip()
    if not history:
        return clean_msg

    past_user_messages = [
        m.content.strip()
        for m in history
        if m.role == "user" and m.content.strip()
    ]

    if not past_user_messages:
        return clean_msg

    # Combine recent user context with current query
    recent_context = past_user_messages[-1]
    return f"{recent_context} {clean_msg}"


# =========================================================
# Routes
# =========================================================

@app.get("/")
def home():
    return {
        "status": "online",
        "message": "AI Knowledge Assistant API is running!",
        "model": config.MODEL_NAME
    }


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    start_time = time.time()

    # 1. Input Validation
    user_text = request.message.strip()
    if not user_text:
        logger.warning("Received empty message in /chat endpoint")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty or blank."
        )

    history = request.history or []
    logger.info(f"Incoming Chat Request | Query: '{user_text[:60]}...' | History Turns: {len(history)}")

    # 2. RAG Retrieval with Context Query Expansion
    retrieval_query = build_retrieval_query(user_text, history)
    logger.info(f"RAG Retrieval Query: '{retrieval_query[:80]}...'")

    relevant_chunks = []
    try:
        relevant_chunks = retrieve_relevant_chunks(retrieval_query, k=4)
    except Exception as err:
        logger.error(f"Error during RAG retrieval: {err}", exc_info=True)

    sources = []
    context_parts = []

    if relevant_chunks:
        for chunk in relevant_chunks:
            source = chunk.get("source", "Document")
            if source not in sources:
                sources.append(source)

            context_parts.append(
                f"[Document: {source} | Page {chunk.get('page', 1)} | Section: {chunk.get('section', 'General')}]\n"
                f"{chunk.get('text', '').strip()}"
            )
        logger.info(f"Retrieved {len(relevant_chunks)} chunks from {len(sources)} source files: {sources}")
    else:
        logger.info("No relevant document chunks retrieved.")

    # 3. Construct Ollama Prompt Messages (System + History + User)
    formatted_messages = []

    # System Message
    system_content = config.SYSTEM_PROMPT
    if context_parts:
        system_content += "\n\n=== RELEVANT DOCUMENT EXCERPTS ===\n" + "\n\n".join(context_parts)
        system_content += "\n===================================\n"

    formatted_messages.append({"role": "system", "content": system_content})

    # Historical Messages (Truncate to MAX_HISTORY_TURNS to prevent context window overflow)
    bounded_history = history[-config.MAX_HISTORY_TURNS:]
    for msg in bounded_history:
        r = msg.role.lower()
        if r in ["user", "assistant"]:
            formatted_messages.append({"role": r, "content": msg.content})

    # Latest User Message
    formatted_messages.append({"role": "user", "content": user_text})

    logger.info(f"Payload prepared for Ollama: {len(formatted_messages)} total messages sent.")

    # 4. Call Ollama API
    try:
        response = ollama.chat(
            model=config.MODEL_NAME,
            messages=formatted_messages,
            options={
                "temperature": config.TEMPERATURE,
                "top_p": config.TOP_P,
                "num_ctx": config.NUM_CTX,
                "num_predict": config.NUM_PREDICT,
            },
            keep_alive="10m"
        )
    except Exception as err:
        logger.error(f"Ollama API invocation error: {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI model service failure: {str(err)}. Ensure Ollama is running and model '{config.MODEL_NAME}' is loaded."
        )

    reply_content = response.get("message", {}).get("content", "").strip()

    if not reply_content:
        reply_content = "I'm sorry, I couldn't generate a response. Please try rephrasing your question."

    elapsed_ms = round((time.time() - start_time) * 1000, 2)
    logger.info(f"Chat Response completed in {elapsed_ms}ms | Reply length: {len(reply_content)} chars")

    return ChatResponse(
        user_message=user_text,
        reply=reply_content,
        sources=sources
    )


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported."
        )

    safe_filename = Path(file.filename).name
    file_path = config.DOCUMENTS_FOLDER / safe_filename

    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        logger.info(f"Document uploaded: {safe_filename}. Rebuilding RAG index...")
        build_index()

        return {
            "message": "Document uploaded successfully!",
            "filename": safe_filename
        }
    except Exception as error:
        logger.error(f"Failed to process upload: {error}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not upload or index document: {str(error)}"
        )


@app.get("/documents")
def list_documents():
    documents = []
    for pdf_file in config.DOCUMENTS_FOLDER.glob("*.pdf"):
        documents.append({
            "name": pdf_file.name,
            "size": pdf_file.stat().st_size
        })
    return {"documents": documents}


@app.delete("/documents/{filename}")
def delete_document(filename: str):
    safe_filename = Path(filename).name
    file_path = config.DOCUMENTS_FOLDER / safe_filename

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    try:
        file_path.unlink()
        logger.info(f"Document deleted: {safe_filename}. Rebuilding RAG index...")
        build_index()

        return {
            "message": "Document deleted successfully.",
            "filename": safe_filename
        }
    except Exception as error:
        logger.error(f"Failed to delete document: {error}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not delete document: {str(error)}"
        )