import type { CSSProperties } from "react";

/** Co-located styles for SkillMarkdownPreview. */
export const s = {
  card: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    padding: "18px 22px",
    fontSize: 14,
    color: "var(--text-secondary)",
    overflowWrap: "anywhere",
  } satisfies CSSProperties,
  empty: { color: "var(--text-muted)", fontStyle: "italic" } satisfies CSSProperties,
} as const;
