import type { CSSProperties } from "react";

/** Styles for the /skills/:id route frame. */
export const s = {
  loading: { flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
} as const;
