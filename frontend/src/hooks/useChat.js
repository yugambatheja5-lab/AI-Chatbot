import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "knowledge-ai-conversations";
const API_URL = "http://127.0.0.1:8000";

const id = () =>
  crypto.randomUUID?.() ||
  `${Date.now()}-${Math.random()}`;

const conversation = () => ({
  id: id(),
  title: "New chat",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
});

const title = (t) => {
  const s = t.trim().replace(/\s+/g, " ");
  return s.length > 44
    ? s.slice(0, 44) + "…"
    : s || "New chat";
};

function seed() {
  const now = Date.now();

  return [
    {
      id: id(),
      title: "How does RAG work?",
      createdAt: now - 2 * 3600000,
      updatedAt: now - 2 * 3600000,

      messages: [
        {
          id: id(),
          role: "user",
          content: "Explain RAG in simple words.",
        },
        {
          id: id(),
          role: "assistant",
          content:
            "## RAG in simple words\n\n**RAG (Retrieval-Augmented Generation)** first searches your documents for relevant information, then gives those passages to the language model so it can answer using your own knowledge base.",
        },
      ],
    },
  ];
}

function load() {
  try {
    const x = localStorage.getItem(
      STORAGE_KEY
    );

    if (x) {
      return JSON.parse(x);
    }
  } catch {}

  return seed();
}

export function useChat() {
  const [conversations, setConversations] =
    useState(load);

  const [activeId, setActiveId] =
    useState(null);

  const [isGenerating, setGenerating] =
    useState(false);

  /*
   * Abort controller for the current request.
   */
  const controller = useRef(null);

  /*
   * Prevents duplicate sends before React has
   * finished updating isGenerating.
   *
   * This is important because two very fast
   * clicks/events can otherwise create two
   * assistant messages.
   */
  const sendLock = useRef(false);


  /* =====================================================
     ACTIVE CONVERSATION
  ===================================================== */

  useEffect(() => {
    if (!activeId) {
      setActiveId(
        conversations[0]?.id || null
      );
    }
  }, [
    conversations,
    activeId,
  ]);


  /* =====================================================
     SAVE CONVERSATIONS
  ===================================================== */

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations)
    );
  }, [conversations]);


  /* =====================================================
     CURRENT CONVERSATION
  ===================================================== */

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (c) => c.id === activeId
      ) || null,
    [conversations, activeId]
  );


  /* =====================================================
     NEW CHAT
  ===================================================== */

  const newChat = useCallback(() => {
    const c = conversation();

    setConversations((x) => [
      c,
      ...x,
    ]);

    setActiveId(c.id);

    return c.id;
  }, []);


  /* =====================================================
     SELECT CHAT
  ===================================================== */

  const selectConversation =
    useCallback((cid) => {
      setActiveId(cid);
    }, []);


  /* =====================================================
     RENAME CHAT
  ===================================================== */

  const renameConversation =
    useCallback(
      (cid, name) => {
        setConversations((xs) =>
          xs.map((c) =>
            c.id === cid
              ? {
                  ...c,
                  title: name
                    .trim()
                    .slice(0, 80),
                  updatedAt:
                    Date.now(),
                }
              : c
          )
        );
      },
      []
    );
const pinConversation = useCallback((cid) => {
  setConversations((xs) =>
    xs.map((c) =>
      c.id === cid
        ? { ...c, isPinned: !c.isPinned }
        : c
    )
  );
}, []);

  /* =====================================================
     DELETE CHAT
  ===================================================== */

  const deleteConversation =
    useCallback(
      (cid) => {
        setConversations((xs) => {
          const remaining =
            xs.filter(
              (c) => c.id !== cid
            );

          if (activeId === cid) {
            setActiveId(
              remaining[0]?.id || null
            );
          }

          return remaining.length
            ? remaining
            : [conversation()];
        });
      },
      [activeId]
    );


  /* =====================================================
     SEND MESSAGE
  ===================================================== */

  const send = useCallback(
    async (text) => {
      const clean = text.trim();

      /*
       * IMPORTANT:
       *
       * sendLock prevents duplicate requests
       * before React updates isGenerating.
       */
      if (
        !clean ||
        isGenerating ||
        sendLock.current
      ) {
        return;
      }

      /*
       * Lock immediately.
       */
      sendLock.current = true;

      let cid = activeId;

      /*
       * Create a conversation if needed.
       */
      if (!cid) {
        cid = newChat();
      }

      const userMessage = {
        id: id(),
        role: "user",
        content: clean,
      };

      const assistantMessage = {
        id: id(),
        role: "assistant",
        content: "",
        streaming: true,
        sources: [],
      };


      /* =================================================
         ADD USER + ASSISTANT MESSAGE
      ================================================= */

      setConversations((xs) =>
        xs.map((c) =>
          c.id === cid
            ? {
                ...c,

                title:
                  c.messages.length > 0
                    ? c.title
                    : title(clean),

                updatedAt: Date.now(),

                messages: [
                  ...c.messages,
                  userMessage,
                  assistantMessage,
                ],
              }
            : c
        )
      );


      /* =================================================
         CREATE REQUEST CONTROLLER
      ================================================= */

      const ac =
        new AbortController();

      controller.current = ac;

      setGenerating(true);


      try {
        /* ===============================================
           REAL FASTAPI REQUEST
        =============================================== */

        const response = await fetch(
          `${API_URL}/chat`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              message: clean,
            }),

            signal: ac.signal,
          }
        );


        if (!response.ok) {
          throw new Error(
            `API request failed: ${response.status}`
          );
        }


        const data =
          await response.json();


        const answer =
          data.reply ||
          "I could not generate a response.";


        const sources =
          Array.isArray(data.sources)
            ? data.sources
            : [];


        /* ===============================================
           SIMULATED STREAMING
        =============================================== */

        let visible = "";

        for (
          const token of answer.split(
            /(\s+)/
          )
        ) {
          if (ac.signal.aborted) {
            throw new DOMException(
              "Aborted",
              "AbortError"
            );
          }

          visible += token;


          setConversations((xs) =>
            xs.map((c) =>
              c.id === cid
                ? {
                    ...c,

                    updatedAt:
                      Date.now(),

                    messages:
                      c.messages.map(
                        (m) =>
                          m.id ===
                          assistantMessage.id
                            ? {
                                ...m,
                                content:
                                  visible,
                                sources,
                              }
                            : m
                      ),
                  }
                : c
            )
          );


          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                8
              )
          );
        }


        /* ===============================================
           FINAL RESPONSE
        =============================================== */

        setConversations((xs) =>
          xs.map((c) =>
            c.id === cid
              ? {
                  ...c,

                  updatedAt:
                    Date.now(),

                  messages:
                    c.messages.map(
                      (m) =>
                        m.id ===
                        assistantMessage.id
                          ? {
                              ...m,

                              content:
                                answer,

                              sources,

                              streaming:
                                false,
                            }
                          : m
                    ),
                }
              : c
          )
        );

      } catch (error) {

        /* ===============================================
           USER STOPPED GENERATION
        =============================================== */

        if (
          error.name ===
          "AbortError"
        ) {
          setConversations((xs) =>
            xs.map((c) =>
              c.id === cid
                ? {
                    ...c,

                    messages:
                      c.messages.map(
                        (m) =>
                          m.id ===
                          assistantMessage.id
                            ? {
                                ...m,
                                streaming:
                                  false,
                              }
                            : m
                      ),
                  }
                : c
            )
          );

          return;
        }


        /* ===============================================
           BACKEND ERROR
        =============================================== */

        console.error(
          "Chat API error:",
          error
        );

        setConversations((xs) =>
          xs.map((c) =>
            c.id === cid
              ? {
                  ...c,

                  messages:
                    c.messages.map(
                      (m) =>
                        m.id ===
                        assistantMessage.id
                          ? {
                              ...m,

                              streaming:
                                false,

                              content:
                                "⚠️ Unable to connect to the AI backend. Please make sure FastAPI and Ollama are running.",
                            }
                          : m
                    ),
                }
              : c
          )
        );

      } finally {

        /*
         * Clear the current request.
         */
        controller.current =
          null;

        setGenerating(false);

        /*
         * IMPORTANT:
         *
         * Release the send lock so the user
         * can send another message.
         */
        sendLock.current =
          false;
      }
    },

    [
      activeId,
      isGenerating,
      newChat,
    ]
  );


  /* =====================================================
     STOP GENERATION
  ===================================================== */

  const stop = useCallback(() => {
    controller.current?.abort();

    controller.current = null;

    setGenerating(false);

    /*
     * Also release the lock immediately
     * when the user manually stops generation.
     */
    sendLock.current = false;
  }, []);


  /* =====================================================
     FEEDBACK
  ===================================================== */

  const setFeedback =
    useCallback(
      (messageId, value) => {
        setConversations((xs) =>
          xs.map((c) => ({
            ...c,

            messages:
              c.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      feedback: value,
                    }
                  : m
              ),
          }))
        );
      },
      []
    );


  /* =====================================================
     REGENERATE
  ===================================================== */

  const regenerate =
    useCallback(
      async (messageId) => {
        if (
          isGenerating ||
          sendLock.current
        ) {
          return;
        }

        const c =
          conversations.find(
            (x) => x.id === activeId
          );

        if (!c) return;


        const index =
          c.messages.findIndex(
            (m) =>
              m.id === messageId
          );

        if (index < 0) return;


        const previousUserMessage =
          [
            ...c.messages.slice(
              0,
              index
            ),
          ]
            .reverse()
            .find(
              (m) =>
                m.role === "user"
            );

        if (
          !previousUserMessage
        ) {
          return;
        }


        /* ===============================================
           REMOVE OLD ASSISTANT RESPONSE
        =============================================== */

        setConversations((xs) =>
          xs.map((x) =>
            x.id === activeId
              ? {
                  ...x,

                  messages:
                    x.messages.slice(
                      0,
                      index
                    ),
                }
              : x
          )
        );


        /* ===============================================
           GENERATE AGAIN
        =============================================== */

        await send(
          previousUserMessage.content
        );
      },

      [
        conversations,
        activeId,
        isGenerating,
        send,
      ]
    );


  /* =====================================================
     RETURN
  ===================================================== */

  return {
    conversations,
    activeConversation,
    activeId,
    isGenerating,

    newChat,
    selectConversation,
    renameConversation,
    deleteConversation,
    pinConversation,

    send,
    stop,
    regenerate,
    setFeedback,
  };
}