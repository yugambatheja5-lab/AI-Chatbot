import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  PanelLeft,
  Database,
  Menu,
  Plus,
  Sparkles,
  X,
} from "lucide-react";

import EmptyState from "./EmptyState";
import Message from "./Message";
import MessageInput from "./MessageInput";

export default function ChatWindow({
  conversation,
  isGenerating,
  onSend,
  onStop,
  onRegenerate,
  onFeedback,
  onNewChat,
}) {
  const [draft, setDraft] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);

  const messages = conversation?.messages ?? [];

  const lastUser = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "user"),
    [messages]
  );

  /*
   * Keep the conversation near the bottom when a new
   * message arrives, but don't interrupt the user if
   * they are reading older messages.
   */
useEffect(() => {
  const element = scrollRef.current;
  if (!element) return;

  const frame = requestAnimationFrame(() => {
    element.scrollTop = element.scrollHeight;
    setShowBottom(false);
  });

  return () => cancelAnimationFrame(frame);
}, [
  conversation?.id,
  messages.length,
  messages.at(-1)?.content,
]);

  function handleScroll() {
    const element = scrollRef.current;

    if (!element) return;

    const distance =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;

    setShowBottom(distance > 300);
  }

  function send() {
    const text = draft.trim();

    if (!text || isGenerating) return;

    setDraft("");
    onSend(text);
  }

  function useSuggestion(text) {
    setDraft(text);

    requestAnimationFrame(() => {
      document
        .querySelector("textarea")
        ?.focus();
    });
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }

  return (
    <main className="chat-area">

      {/* =====================================================
          TOP BAR
      ===================================================== */}

      <header className="topbar">

        <div className="flex min-w-0 items-center gap-3">

          {/* Mobile sidebar */}

         <button
  className="icon-button sidebar-restore-button"
  onClick={() =>
    window.dispatchEvent(
      new CustomEvent("knowledge-ai:expand-sidebar")
    )
  }
  aria-label="Show sidebar"
  title="Show sidebar"
>
  <PanelLeft size={18} />
</button>


          {/* Brand on mobile */}

          <div className="hidden min-w-0 items-center gap-2 sm:flex md:hidden">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <Sparkles size={15} />
            </div>

            <span className="truncate text-sm font-semibold">
              Knowledge AI
            </span>

          </div>


          {/* =================================================
              MODEL STATUS
          ================================================= */}

          <div className="model-wrap">

            <button
              className="model-button"
              onClick={() =>
                setModelOpen((value) => !value)
              }
              aria-expanded={modelOpen}
              aria-label="View model status"
              title="View model status"
            >

              <span className="model-dot" />

              <span className="truncate">
                Qwen 3 4B
              </span>

              <ChevronDown
                size={15}
                className={
                  modelOpen
                    ? "rotate-180 transition-transform"
                    : "transition-transform"
                }
              />

            </button>


            {/* =================================================
                MODEL STATUS PANEL

                This is information, not a fake model
                selector.
            ================================================= */}

            {modelOpen && (
              <div className="model-menu w-72 p-2">

                <div className="mb-2 flex items-center justify-between px-3 py-2">

                  <div>
                    <p className="text-sm font-semibold">
                      Active model
                    </p>

                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      Local AI configuration
                    </p>
                  </div>

                  <button
                    className="icon-button-sm"
                    onClick={() =>
                      setModelOpen(false)
                    }
                    aria-label="Close model information"
                    title="Close"
                  >
                    <X size={14} />
                  </button>

                </div>


                <div className="space-y-1">

                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">

                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                      <Sparkles size={16} />
                    </div>

                    <div className="min-w-0 flex-1">

                      <p className="text-sm font-medium">
                        Qwen 3 4B
                      </p>

                      <p className="text-[11px] text-zinc-500">
                        Running through Ollama
                      </p>

                    </div>

                    <CheckCircle2
                      size={16}
                      className="text-emerald-500"
                    />

                  </div>


                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">

                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Database size={16} />
                    </div>

                    <div className="min-w-0">

                      <p className="text-sm font-medium">
                        RAG enabled
                      </p>

                      <p className="text-[11px] text-zinc-500">
                        Answers use your knowledge base
                      </p>

                    </div>

                  </div>

                </div>

              </div>
            )}

          </div>

        </div>


        {/* =================================================
            NEW CHAT
        ================================================= */}

        <button
          className="top-new-chat"
          onClick={onNewChat}
          title="Start a new conversation"
        >
          <Plus size={16} />

          <span className="hidden sm:inline">
            New chat
          </span>
        </button>

      </header>


      {/* =====================================================
          CHAT SCROLL AREA
      ===================================================== */}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="chat-scroll"
      >

        <div className="chat-content">

          {messages.length === 0 ? (

            <EmptyState
              onSuggestion={useSuggestion}
            />

          ) : (

            <div className="message-list">

              {messages.map(
                (message, index) => (
                  <Message
                    key={
                      message.id ??
                      `${message.role}-${index}`
                    }
                    message={message}

                    onRegenerate={() =>
                      lastUser &&
                      onRegenerate(
                        message.id
                      )
                    }

                    onFeedback={(value) =>
                      onFeedback(
                        message.id,
                        value
                      )
                    }
                  />
                )
              )}

              <div ref={bottomRef} />

            </div>

          )}

        </div>

      </div>


      {/* =====================================================
          SCROLL TO BOTTOM
      ===================================================== */}

      {showBottom && (
        <button
          className="scroll-bottom"
          onClick={scrollToBottom}
          aria-label="Scroll to latest message"
          title="Scroll to latest message"
        >
          <ArrowDown size={17} />
        </button>
      )}


      {/* =====================================================
          MESSAGE COMPOSER
      ===================================================== */}

      <div className="composer-dock">

        <MessageInput
          value={draft}
          onChange={setDraft}
          onSend={send}
          isGenerating={isGenerating}
          onStop={onStop}
        />

      </div>

    </main>
  );
}