import {
  ArrowUpRight,
  FileText,
  Search,
  Sparkles,
  WandSparkles,
} from "lucide-react";

const suggestions = [
  {
    icon: FileText,
    title: "Ask about my PDFs",
    text: "Explore topics covered in your uploaded documents.",
    prompt: "What topics are covered in my uploaded documents?",
  },
  {
    icon: Search,
    title: "Find an answer",
    text: "Search your knowledge base for a specific topic.",
    prompt: "Find information about a specific topic in my documents.",
  },
  {
    icon: Sparkles,
    title: "Explain simply",
    text: "Turn a difficult concept into an easy explanation.",
    prompt: "Explain a difficult computer science concept in simple words.",
  },
  {
    icon: WandSparkles,
    title: "Summarize documents",
    text: "Get the most important points at a glance.",
    prompt: "Summarize the most important points from my documents.",
  },
];

export default function EmptyState({ onSuggestion }) {
  return (
    <div className="empty-state">
      {/* Hero */}
      <div className="empty-hero">
        <div className="hero-mark">
          <Sparkles size={25} strokeWidth={1.8} />
        </div>

        <div className="eyebrow">
          <span className="eyebrow-dot" />
          PRIVATE AI • DOCUMENT GROUNDED
        </div>

        <h1>
          Ask your documents
          <span> anything.</span>
        </h1>

        <p>
          Search your uploaded PDFs, ask follow-up questions, and get
          answers grounded in your local knowledge base.
        </p>
      </div>

      {/* Suggestions */}
      <div className="suggestion-section">
        <div className="suggestion-heading">
          <span>Try asking</span>
          <span className="suggestion-line" />
        </div>

        <div className="suggestion-grid">
          {suggestions.map(
            ({ icon: Icon, title, text, prompt }) => (
              <button
                key={title}
                className="suggestion-card"
                onClick={() => onSuggestion(prompt)}
              >
                <span className="suggestion-icon">
                  <Icon size={19} strokeWidth={1.8} />
                </span>

                <span className="suggestion-content">
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>

                <span className="suggestion-arrow">
                  <ArrowUpRight size={16} />
                </span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="empty-hint">
        <Sparkles size={13} />
        <span>
          Your conversations stay in your local browser.
        </span>
      </div>
    </div>
  );
}