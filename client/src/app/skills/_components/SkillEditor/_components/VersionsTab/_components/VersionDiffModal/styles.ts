import type { CSSProperties } from "react";
import type { DiffRow } from "./helpers";

/** Co-located styles for VersionDiffModal (row tints follow the diff-viewer tokens). */
export const s = {
  body: { padding: "18px 24px", display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
  } satisfies CSSProperties,
  box: { border: "1px solid var(--border)", borderRadius: 7, overflow: "auto" } satisfies CSSProperties,
  row: (kind: DiffRow["kind"]): CSSProperties => ({
    display: "flex",
    alignItems: "stretch",
    fontSize: 12.5,
    lineHeight: "20px",
    background: kind === "add" ? "var(--code-add)" : kind === "del" ? "var(--code-del)" : "transparent",
  }),
  num: {
    width: 40,
    flexShrink: 0,
    textAlign: "right",
    paddingRight: 8,
    color: "var(--text-muted)",
    userSelect: "none",
  } satisfies CSSProperties,
  sign: (kind: DiffRow["kind"]): CSSProperties => ({
    width: 16,
    flexShrink: 0,
    textAlign: "center",
    color: kind === "add" ? "var(--code-add-text)" : kind === "del" ? "var(--code-del-text)" : "var(--text-muted)",
  }),
  text: { whiteSpace: "pre-wrap", wordBreak: "break-word", paddingRight: 12, flex: 1 } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  footer: { display: "flex", justifyContent: "flex-end" } satisfies CSSProperties,
} as const;
