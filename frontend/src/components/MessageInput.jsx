import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  CheckCircle2,
  Mic,
  Paperclip,
  Square,
  X,
  Loader2,
} from "lucide-react";

export default function MessageInput({
  value,
  onChange,
  onSend,
  onStop,
  isGenerating,
}) {
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const recognitionRef = useRef(null);

  const [fileName, setFileName] = useState("");
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    const el = textareaRef.current;

    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${Math.min(
      el.scrollHeight,
      156
    )}px`;
  }, [value]);

  function keyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (
        value.trim() &&
        !isGenerating &&
        !uploading
      ) {
        onSend();
      }
    }
  }

  async function chooseFile(e) {
    const file = e.target.files?.[0];

    e.target.value = "";

    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadStatus(
        "Please upload a PDF file."
      );
      return;
    }

    setFileName(file.name);
    setUploading(true);
    setUploadStatus("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "http://127.0.0.1:8000/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();

      setUploadStatus(
        data.message ||
          "Document uploaded successfully!"
      );
    } catch (error) {
      console.error(
        "Upload error:",
        error
      );

      setUploadStatus(
        "Unable to upload document. Make sure FastAPI is running."
      );
    } finally {
      setUploading(false);
    }
  }

  function removeFile() {
    setFileName("");
    setUploadStatus("");
  }

  function toggleMic() {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice input is not supported in this browser."
      );
      return;
    }

    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (e) => {
      const text = Array.from(
        e.results
      )
        .map(
          (result) =>
            result[0].transcript
        )
        .join("");

      onChange(text);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognitionRef.current =
      recognition;

    recognition.start();

    setRecording(true);
  }

  const hasText = value.trim().length > 0;

  return (
    <div className="composer-wrap">

      {/* ==================================================
          ATTACHMENT STATUS
      ================================================== */}

      {(fileName || uploadStatus) && (
        <div className="composer-status-area">

          {fileName && (
            <div className="attachment-chip">

              <div className="attachment-icon">
                {uploading ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <CheckCircle2
                    size={14}
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">

                <p className="attachment-name">
                  {fileName}
                </p>

                <p className="attachment-state">
                  {uploading
                    ? "Uploading and indexing..."
                    : "Added to knowledge base"}
                </p>

              </div>

              <button
                type="button"
                onClick={removeFile}
                disabled={uploading}
                title="Remove attachment"
                aria-label="Remove attachment"
                className="attachment-remove"
              >
                <X size={15} />
              </button>

            </div>
          )}

          {uploadStatus && (
            <div
              className={`upload-message ${
                uploadStatus
                  .toLowerCase()
                  .includes("success") ||
                uploadStatus
                  .toLowerCase()
                  .includes("uploaded")
                  ? "success"
                  : "error"
              }`}
            >
              {uploadStatus}
            </div>
          )}

        </div>
      )}


      {/* ==================================================
          MAIN COMPOSER
      ================================================== */}

      <div
        className={`composer ${
          recording ? "composer-recording" : ""
        } ${
          isGenerating
            ? "composer-generating"
            : ""
        }`}
      >

        {/* Hidden file input */}

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={chooseFile}
        />


        {/* Attachment */}

        <button
          type="button"
          className="composer-icon"
          onClick={() =>
            fileRef.current?.click()
          }
          disabled={uploading}
          title="Upload PDF to knowledge base"
          aria-label="Upload PDF to knowledge base"
        >
          {uploading ? (
            <Loader2
              size={19}
              className="animate-spin"
            />
          ) : (
            <Paperclip size={19} />
          )}
        </button>


        {/* Text area */}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) =>
            onChange(e.target.value)
          }
          onKeyDown={keyDown}
          rows={1}
          placeholder={
            uploading
              ? "Uploading document..."
              : isGenerating
              ? "AI is generating a response..."
              : "Ask anything about your documents..."
          }
          aria-label="Message"
          disabled={uploading}
        />


        {/* Voice input */}

        <button
          type="button"
          className={`composer-icon ${
            recording
              ? "recording"
              : ""
          }`}
          onClick={toggleMic}
          title={
            recording
              ? "Stop voice input"
              : "Voice input"
          }
          aria-label={
            recording
              ? "Stop voice input"
              : "Voice input"
          }
        >
          <Mic size={19} />

          {recording && (
            <span className="recording-dot" />
          )}
        </button>


        {/* Send / Stop */}

        <button
          type="button"
          className={`send-button ${
            isGenerating
              ? "stop"
              : hasText
              ? "ready"
              : "disabled"
          }`}
          onClick={
            isGenerating
              ? onStop
              : onSend
          }
          disabled={
            !isGenerating &&
            (!hasText || uploading)
          }
          aria-label={
            isGenerating
              ? "Stop generating"
              : "Send message"
          }
          title={
            isGenerating
              ? "Stop generating"
              : hasText
              ? "Send message"
              : "Type a message"
          }
        >
          {isGenerating ? (
            <Square
              size={13}
              fill="currentColor"
            />
          ) : (
            <ArrowUp size={19} />
          )}
        </button>

      </div>


      {/* ==================================================
          FOOTER HINT
      ================================================== */}

      <div className="composer-hint">

        <div className="composer-shortcuts">

          <span>
            <kbd>Enter</kbd> to send
          </span>

          <span>
            <kbd>Shift</kbd> +
            <kbd>Enter</kbd> new line
          </span>

        </div>

        <span className="composer-disclaimer">
          Powered by local Qwen + RAG
        </span>

      </div>

    </div>
  );
}