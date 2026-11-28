import type { CSSProperties } from "react";

/** Co-located styles for StatsTab. */
export const s = {
  wrap: { maxWidth: 900 } satisfies CSSProperties,
  loading: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 } satisfies CSSProperties,
  cards: { display: "flex", gap: 12, flexWrap: "wrap" } satisfies CSSProperties,
  hint: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--text-muted)",
    margin: "10px 0 0",
  } satisfies CSSProperties,
  hintIcon: { flexShrink: 0 } satisfies CSSProperties,
  section: { marginTop: 28 } satisfies CSSProperties,
  h3: { fontSize: 14, fontWeight: 650, marginBottom: 12 } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  agentList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    border: "1px solid var(--border)",
    borderRadius: 8,
    overflow: "hidden",
  } satisfies CSSProperties,
  agentRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 13.5,
  } satisfies CSSProperties,
  agentIcon: { color: "var(--accent)" } satisfies CSSProperties,
  agentName: { flex: 1, fontWeight: 500 } satisfies CSSProperties,
  panel: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    padding: 20,
  } satisfies CSSProperties,
} as const;
