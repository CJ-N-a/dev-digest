import type { CSSProperties } from "react";

/** Co-located styles for SkillHeader. */
export const s = {
  row: { display: "flex", alignItems: "center", gap: 12, padding: "16px 28px 0", flexShrink: 0 } satisfies CSSProperties,
  icon: { color: "var(--accent)" } satisfies CSSProperties,
  h1: {
    fontSize: 18,
    fontWeight: 700,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  actions: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
} as const;
