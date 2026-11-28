import React from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

const SAFE_PROTOCOLS = /^(https?:|mailto:)/i;

/**
 * Only absolute http(s)/mailto links, or relative/anchor ones, survive.
 * `defaultUrlTransform` already drops `javascript:`; this also drops `data:`,
 * `vbscript:`, `file:` and anything else unexpected.
 */
export function safeUrlTransform(url: string): string {
  const cleaned = defaultUrlTransform(url);
  if (!cleaned) return "";
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(cleaned);
  return !hasScheme || SAFE_PROTOCOLS.test(cleaned) ? cleaned : "";
}

/**
 * Markdown renderer (replaces prototype mdLite). Inline + GFM.
 *
 * Renders UNTRUSTED text — LLM rationale (which can be steered by prompt
 * injection in a PR diff), PR comments, repository docs. S4
 * (security hardening): an `<img>` would make the browser fetch an
 * attacker-chosen URL the moment the text is shown, and a URL can carry
 * whatever context the model was tricked into writing into it. Images are
 * therefore rendered as inert text with their URL visible, never loaded.
 */
/** Block elements for `variant="document"` (full markdown files such as skill
    bodies). The default inline variant keeps the compact look used in
    finding rationales and comments. */
const DOCUMENT_COMPONENTS = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 650, color: "var(--text-primary)" }}>{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 style={{ margin: "18px 0 8px", fontSize: 16, fontWeight: 650, color: "var(--text-primary)" }}>{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 style={{ margin: "14px 0 6px", fontSize: 14, fontWeight: 650, color: "var(--text-primary)" }}>{children}</h3>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul style={{ margin: "0 0 10px", paddingLeft: 22, listStyle: "disc" }}>{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol style={{ margin: "0 0 10px", paddingLeft: 22, listStyle: "decimal" }}>{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li style={{ margin: "2px 0" }}>{children}</li>,
};

export function Markdown({
  children,
  variant = "inline",
}: {
  children?: string | null;
  /** "document" also styles headings and lists (skill bodies, docs). */
  variant?: "inline" | "document";
}) {
  if (!children) return null;
  return (
    <div className="dd-md" style={{ fontSize: "inherit", lineHeight: 1.55 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrlTransform}
        components={{
          ...(variant === "document" ? DOCUMENT_COMPONENTS : {}),
          img: ({ alt, src }) => (
            <span className="mono" data-testid="md-image-placeholder" style={{ color: "var(--text-secondary)" }}>
              [image{alt ? `: ${alt}` : ""}]{typeof src === "string" && src ? ` (${src})` : ""}
            </span>
          ),
          p: ({ children }) => <p style={{ margin: "0 0 10px" }}>{children}</p>,
          strong: ({ children }) => (
            <strong style={{ fontWeight: 650, color: "var(--text-primary)" }}>{children}</strong>
          ),
          code: ({ children }) => (
            <code
              className="mono"
              style={{
                fontSize: "0.92em",
                padding: "1px 6px",
                borderRadius: 4,
                background: "var(--bg-hover)",
                color: "var(--accent-text)",
              }}
            >
              {children}
            </code>
          ),
          a: ({ children, href }) => (
            <a
              href={href || undefined}
              target="_blank"
              rel="noopener noreferrer nofollow"
              style={{ color: "var(--accent-text)", textDecoration: "underline" }}
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
