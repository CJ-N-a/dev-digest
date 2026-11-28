import type { CSSProperties } from "react";

/** Co-located styles for StatCard. */
export const s = {
  card: {
    flex: 1,
    minWidth: 150,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    padding: 16,
  } satisfies CSSProperties,
  label: {
    fontSize: 11.5,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  } satisfies CSSProperties,
  valueRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 } satisfies CSSProperties,
  value: { fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" } satisfies CSSProperties,
  ring: { transform: "rotate(-90deg)", flexShrink: 0 } satisfies CSSProperties,
} as const;
