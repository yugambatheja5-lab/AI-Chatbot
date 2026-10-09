import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  FileText,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Pin,
  PinOff,
  Search,
  Settings,
  Trash2,
  UserCircle,
  X,
  RefreshCw,
  FolderOpen,
} from "lucide-react";

import ThemeToggle from "./ThemeToggle";

const API_URL = "http://127.0.0.1:8000";

function groupConversations(conversations) {
  const now = new Date();

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const seven = new Date(today);
  seven.setDate(seven.getDate() - 7);

  return {
    Today: conversations.filter(
      (c) => c.updatedAt >= today.getTime()
    ),

    Yesterday: conversations.filter(
      (c) =>
        c.updatedAt >= yesterday.getTime() &&
        c.updatedAt < today.getTime()
    ),

    "Previous 7 days": conversations.filter(
      (c) =>
        c.updatedAt >= seven.getTime() &&
        c.updatedAt < yesterday.getTime()
    ),
  };
}


/* =========================================================
   Conversation item
   ========================================================= */

function ConversationItem({
  conversation,
  active,
  onSelect,
  onRename,
  onDelete,
  onPin,
  collapsed,
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conversation.title);

  const save = () => {
    if (draft.trim()) {
      onRename(conversation.id, draft.trim());
    }

    setEditing(false);
    setMenu(false);
  };

  if (collapsed) {
    return (
      <button
        className={`sidebar-icon-row ${
          active ? "sidebar-active" : ""
        }`}
        title={conversation.title}
        onClick={() => onSelect(conversation.id)}
      >
        <MessageSquare size={17} />
      </button>
    );
  }

  return (
    <div
      className={`conversation-row group ${
        active ? "sidebar-active" : ""
      }`}
    >
      {editing ? (
        <div className="flex w-full items-center gap-1 p-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();

              if (e.key === "Escape") {
                setDraft(conversation.title);
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded-lg border border-indigo-400 bg-white px-2 py-2 text-sm outline-none dark:bg-zinc-900"
          />

          <button
            className="icon-button-sm text-emerald-600"
            onClick={save}
            title="Save name"
          >
            <Check size={15} />
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => onSelect(conversation.id)}
            className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left"
          >
            <MessageSquare
              size={16}
              className={
                active
                  ? "shrink-0 text-indigo-400"
                  : "shrink-0 text-zinc-500"
              }
            />

            <span className="truncate text-[14px]">
              {conversation.title}
            </span>
          </button>

          <button
            onClick={() => setMenu((v) => !v)}
            className="icon-button-sm mr-1 opacity-0 transition group-hover:opacity-100"
            aria-label="Conversation actions"
            title="Conversation actions"
          >
            <Ellipsis size={17} />
          </button>

          {menu && (
            <div className="conversation-menu">
              <button
                onClick={() => {
                  setEditing(true);
                  setMenu(false);
                }}
              >
                <Pencil size={14} />
                Rename
              </button>
<button
  onClick={() => {
    onPin(conversation.id);
    setMenu(false);
  }}
>
  {conversation.isPinned ? (
    <PinOff size={14} />
  ) : (
    <Pin size={14} />
  )}
  {conversation.isPinned ? "Unpin" : "Pin"}
</button>
              <button
                className="text-red-600 dark:text-red-400"
                onClick={() => {
                  setMenu(false);
                  onDelete(conversation.id);
                }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


/* =========================================================
   Documents
   ========================================================= */

function DocumentsSection({ collapsed }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDocuments = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(false);

      const response = await fetch(
        `${API_URL}/documents`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load documents"
        );
      }

      const data = await response.json();

      setDocuments(
        Array.isArray(data.documents)
          ? data.documents
          : []
      );
    } catch (err) {
      console.error(
        "Could not load documents:",
        err
      );

      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDocuments();

    const interval = setInterval(
      () => loadDocuments(),
      5000
    );

    return () => clearInterval(interval);
  }, []);

  const deleteDocument = async (filename) => {
    const confirmed = window.confirm(
      `Delete "${filename}"? This will remove it from the knowledge base.`
    );

    if (!confirmed) return;

    try {
      setDeleting(filename);

      const response = await fetch(
        `${API_URL}/documents/${encodeURIComponent(
          filename
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to delete document."
        );
      }

      setDocuments((current) =>
        current.filter(
          (document) =>
            document.name !== filename
        )
      );
    } catch (err) {
      console.error(
        "Could not delete document:",
        err
      );

      window.alert(
        "Could not delete the document."
      );
    } finally {
      setDeleting(null);
    }
  };

  if (collapsed) {
    return (
      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-100 hover:text-indigo-500 dark:hover:bg-zinc-800"
          title={`${documents.length} documents indexed`}
        >
          <FileText size={18} />
        </button>
      </div>
    );
  }

  return (
    <section className="mt-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">

      {/* Header */}

      <div className="mb-3 flex items-center justify-between px-2">

        <div className="flex items-center gap-2">
          <FolderOpen
            size={14}
            className="text-indigo-400"
          />

          <h2 className="section-label !mb-0">
            Knowledge Base
          </h2>

          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
            {documents.length}
          </span>
        </div>

        <button
          onClick={() => loadDocuments(true)}
          disabled={refreshing}
          className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-indigo-500 disabled:opacity-50 dark:hover:bg-zinc-800"
          title="Refresh documents"
          aria-label="Refresh documents"
        >
          <RefreshCw
            size={14}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />
        </button>

      </div>


      {/* Loading */}

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl bg-zinc-100/60 px-3 py-3 text-xs text-zinc-500 dark:bg-zinc-900/50">
          <Loader2
            size={15}
            className="animate-spin text-indigo-400"
          />
          Loading documents...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/10 bg-red-500/5 px-3 py-3 text-xs text-red-400">
          Could not load documents.
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-3 py-4 text-center dark:border-zinc-700">
          <FileText
            size={22}
            className="mx-auto mb-2 text-zinc-500"
          />

          <p className="text-xs font-medium text-zinc-500">
            No documents yet
          </p>

          <p className="mt-1 text-[11px] text-zinc-600">
            Upload a PDF to build your knowledge base.
          </p>
        </div>
      ) : (
        <div className="space-y-2">

          {documents.map((document) => (
            <div
              key={document.name}
              className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-3 transition hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/5"
              title={document.name}
            >

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <FileText size={17} />
              </div>

              <div className="min-w-0 flex-1">

                <p className="truncate text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">
                  {document.name}
                </p>

                <div className="mt-1 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                  <span className="text-[10px] font-medium text-emerald-500">
                    Indexed
                  </span>
                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  deleteDocument(
                    document.name
                  )
                }
                disabled={
                  deleting === document.name
                }
                className="shrink-0 rounded-lg p-2 text-zinc-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                title="Delete document"
                aria-label={`Delete ${document.name}`}
              >
                {deleting ===
                document.name ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2 size={15} />
                )}
              </button>

            </div>
          ))}

        </div>
      )}
    </section>
  );
}


/* =========================================================
   Sidebar
   ========================================================= */

export default function Sidebar({
  open,
  onClose,
  conversations,
  activeId,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
  onPin,
  theme,
  onToggleTheme,
  collapsed,
  onToggleCollapse,
  onSettings,
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = q
      ? conversations.filter((c) =>
          c.title
            .toLowerCase()
            .includes(q)
        )
      : conversations;

    return groupConversations(
  filtered.filter((c) => !c.isPinned)
);
  }, [conversations, query]);
  const pinnedConversations = useMemo(() => {
  const q = query.trim().toLowerCase();

  return conversations
    .filter(
      (c) =>
        c.isPinned &&
        (!q || c.title.toLowerCase().includes(q))
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}, [conversations, query]);

  return (
    <>
      {open && (
        <button
          className="mobile-overlay"
          aria-label="Close sidebar"
          onClick={onClose}
        />
      )}

      <aside
        className={`sidebar ${
          collapsed
            ? "sidebar-collapsed"
            : ""
        } ${
          open ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-inner">

          {/* =================================================
              BRAND
          ================================================= */}

          <div className="sidebar-brand">

            <div className="brand-mark">
              ✦
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <div className="brand-name">
                  Knowledge AI
                </div>

                <div className="brand-subtitle">
                  Your local document assistant
                </div>
              </div>
            )}

            <button
              className="icon-button ml-auto md:hidden"
              onClick={onClose}
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <X size={18} />
            </button>

            <button
              className="icon-button hidden md:flex"
              onClick={onToggleCollapse}
              title={
                collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
              aria-label={
                collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
            >
              {collapsed ? (
                <ChevronRight size={17} />
              ) : (
                <ChevronLeft size={17} />
              )}
            </button>

          </div>


          {/* =================================================
              NEW CHAT
          ================================================= */}

          <button
            className="new-chat-button"
            onClick={onNewChat}
            title="Start a new conversation"
          >
            <Plus size={18} />

            {!collapsed && (
              <>
                <span className="font-semibold">
                  New chat
                </span>

                <kbd>
                  Ctrl K
                </kbd>
              </>
            )}
          </button>


          {/* =================================================
              SEARCH
          ================================================= */}

          {!collapsed && (
            <div className="search-box">

              <Search size={16} />

              <input
                value={query}
                onChange={(e) =>
                  setQuery(
                    e.target.value
                  )
                }
                placeholder="Search conversations..."
                aria-label="Search conversations"
              />

              {query && (
                <button
                  onClick={() =>
                    setQuery("")
                  }
                  aria-label="Clear search"
                  title="Clear search"
                  className="text-zinc-500 hover:text-zinc-200"
                >
                  <X size={14} />
                </button>
              )}

            </div>
          )}


          {/* =================================================
              MAIN SCROLL AREA
          ================================================= */}

          <div className="conversation-scroll">

            <DocumentsSection
              collapsed={collapsed}
            />

{pinnedConversations.length > 0 && (
  <section className="mb-5 mt-5">
    {!collapsed && (
      <div className="mb-2 flex items-center gap-2 px-2">
        <Pin size={13} className="text-indigo-400" />

        <h2 className="section-label !mb-0">
          Pinned
        </h2>

        <span className="text-[10px] text-zinc-500">
          {pinnedConversations.length}
        </span>
      </div>
    )}

    <div className="space-y-1">
      {pinnedConversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          active={conversation.id === activeId}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
          onPin={onPin}
          collapsed={collapsed}
        />
      ))}
    </div>
  </section>
)}
            {/* =================================================
                CONVERSATIONS
            ================================================= */}

            <div className="mt-6">

              {Object.entries(
                groups
              ).map(
                ([label, items]) =>
                  items.length > 0 && (
                    <section
                      key={label}
                      className="mb-5"
                    >

                      {!collapsed && (
                        <div className="flex items-center justify-between px-2">
                          <h2 className="section-label">
                            {label}
                          </h2>

                          <span className="text-[10px] text-zinc-600">
                            {items.length}
                          </span>
                        </div>
                      )}

                      <div className="space-y-1">

                        {items.map(
                          (conversation) => (
                            <ConversationItem
                              key={
                                conversation.id
                              }
                              conversation={
                                conversation
                              }
                              onPin={onPin}
                              active={
                                conversation.id ===
                                activeId
                              }
                              onSelect={
                                onSelect
                              }
                              onRename={
                                onRename
                              }
                              onDelete={
                                onDelete
                              }
                              collapsed={
                                collapsed
                              }
                            />
                          )
                        )}

                      </div>

                    </section>
                  )
              )}


              {Object.values(
                groups
              ).every(
                (group) =>
                  !group.length
              ) &&
                !collapsed && (
                  <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center dark:border-zinc-800">

                    <MessageSquare
                      size={20}
                      className="mx-auto mb-2 text-zinc-500"
                    />

                    <p className="text-xs font-medium text-zinc-500">
                      No conversations found
                    </p>

                    {query && (
                      <p className="mt-1 text-[11px] text-zinc-600">
                        Try another search.
                      </p>
                    )}

                  </div>
                )}

            </div>

          </div>


          {/* =================================================
              FOOTER
          ================================================= */}

          <div className="sidebar-footer">

            {!collapsed && (
              <div className="profile-card">

                <div className="profile-avatar">
                  <UserCircle size={21} />
                </div>

                <div className="min-w-0">

                  <p className="truncate text-sm font-semibold">
                   Local Workspace
                     </p>

                  <p className="text-[11px] text-zinc-500">
                    Personal workspace
                  </p>

                </div>

              </div>
            )}


            <div
              className={`footer-actions ${
                collapsed
                  ? "justify-center"
                  : ""
              }`}
            >

              <ThemeToggle
                theme={theme}
                onToggle={
                  onToggleTheme
                }
              />

              <button
                className="icon-button"
                onClick={onSettings}
                title="Open settings"
                aria-label="Open settings"
              >
                <Settings size={18} />
              </button>

            </div>

          </div>

        </div>
      </aside>
    </>
  );
}