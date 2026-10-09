import { useState } from "react";
import {
  Check,
  Copy,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

export default function Message({
  message,
  onRegenerate,
  onFeedback,
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        message.content
      );

      setCopied(true);

      setTimeout(
        () => setCopied(false),
        1200
      );
    } catch {
      // Clipboard unavailable
    }
  }

  /* =====================================================
     USER MESSAGE
     ===================================================== */

  if (message.role === "user") {
    return (
      <div className="message-row user-row">

        <div className="user-message-wrap">

          <div className="user-bubble">
            {message.content}
          </div>

        </div>

      </div>
    );
  }

  /* =====================================================
     ASSISTANT MESSAGE
     ===================================================== */

  return (
    <div className="message-row assistant-row">

      {/* AI avatar */}

      <div className="assistant-avatar">
        <Sparkles size={17} />
      </div>


      {/* Response */}

      <div className="assistant-body">

        {/* AI response */}

        {message.content ? (

          <div className="markdown">

            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{

                /* -------------------------------
                   Inline / block code
                -------------------------------- */

                code({
                  inline,
                  className,
                  children,
                  ...props
                }) {
                  return inline ? (
                    <code
                      className="inline-code"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <CodeBlock
                      className={className}
                    >
                      {children}
                    </CodeBlock>
                  );
                },


                /* -------------------------------
                   Links
                -------------------------------- */

                a({
                  children,
                  ...props
                }) {
                  return (
                    <a
                      {...props}
                      target="_blank"
                      rel="noreferrer"
                      className="markdown-link"
                    >
                      {children}
                    </a>
                  );
                },


                /* -------------------------------
                   Blockquotes
                -------------------------------- */

                blockquote({
                  children
                }) {
                  return (
                    <blockquote className="markdown-quote">
                      {children}
                    </blockquote>
                  );
                },


                /* -------------------------------
                   Tables
                -------------------------------- */

                table({
                  children
                }) {
                  return (
                    <div className="table-wrap">
                      <table>
                        {children}
                      </table>
                    </div>
                  );
                },

                th({ children }) {
                  return (
                    <th>{children}</th>
                  );
                },

                td({ children }) {
                  return (
                    <td>{children}</td>
                  );
                },

              }}
            >
              {message.content}
            </ReactMarkdown>


            {/* Streaming cursor */}

            {message.streaming && (
              <span className="typing-cursor" />
            )}

          </div>

        ) : (

          /* Thinking */

          <div className="thinking">

            <span />
            <span />
            <span />

            <em>
              Thinking...
            </em>

          </div>
        )}


        {/* =================================================
            MESSAGE ACTIONS
        ================================================= */}

        {!message.streaming &&
          message.content && (

            <div className="message-actions">

              {/* Copy */}

              <button
                className={
                  copied
                    ? "action active"
                    : "action"
                }
                onClick={copy}
                title={
                  copied
                    ? "Copied"
                    : "Copy response"
                }
                aria-label={
                  copied
                    ? "Copied"
                    : "Copy response"
                }
              >
                {copied ? (
                  <Check size={16} />
                ) : (
                  <Copy size={16} />
                )}
              </button>


              {/* Regenerate */}

              <button
                className="action"
                onClick={() =>
                  onRegenerate?.()
                }
                title="Regenerate response"
                aria-label="Regenerate response"
              >
                <RefreshCw size={16} />
              </button>


              {/* Positive feedback */}

              <button
                className={
                  message.feedback === "up"
                    ? "action active"
                    : "action"
                }
                onClick={() =>
                  onFeedback?.(
                    message.feedback ===
                      "up"
                      ? null
                      : "up"
                  )
                }
                title="Good response"
                aria-label="Good response"
              >
                <ThumbsUp size={16} />
              </button>


              {/* Negative feedback */}

              <button
                className={
                  message.feedback === "down"
                    ? "action active danger"
                    : "action"
                }
                onClick={() =>
                  onFeedback?.(
                    message.feedback ===
                      "down"
                      ? null
                      : "down"
                  )
                }
                title="Poor response"
                aria-label="Poor response"
              >
                <ThumbsDown size={16} />
              </button>

            </div>
          )}

      </div>

    </div>
  );
}