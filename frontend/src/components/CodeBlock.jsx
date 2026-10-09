
import { useState } from "react";
import { Check, Copy, Code2 } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);

  const language =
    className?.match(/language-([\w+-]+)/)?.[1] || "text";

  const code = String(children).replace(/\n$/, "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard unavailable
    }
  }

  return (
    <div className="code-wrap">
      <div className="code-head">
        <div className="code-language">
          <Code2 size={14} />
          <span>{language}</span>
        </div>

        <button
          type="button"
          className={`code-copy ${copied ? "is-copied" : ""}`}
          onClick={copy}
          title={copied ? "Copied to clipboard" : "Copy code"}
          aria-label={copied ? "Code copied" : "Copy code"}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "Copied" : "Copy code"}</span>
        </button>
      </div>

      <div className="code-content">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: "16px",
            background: "transparent",
            fontSize: "13px",
            lineHeight: 1.7,
            overflowX: "auto",
          }}
          codeTagProps={{
            style: {
              fontFamily: 'Consolas, "Courier New", monospace',
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
