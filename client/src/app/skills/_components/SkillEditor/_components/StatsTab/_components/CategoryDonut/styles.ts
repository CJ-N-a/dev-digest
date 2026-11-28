import type { CSSProperties } from "react";
import { DONUT_SIZE } from "./constants";

/** Co-located styles for CategoryDonut. */
export const s = {
  wrap: { display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" } satisfies CSSProperties,
  chart: { position: "relative", width: DONUT_SIZE, height: DONUT_SIZE, flexShrink: 0 } satisfies CSSProperties,
  svg: { transform: "rotate(-90deg)" } satisfies CSSProperties,
  total: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    fontSize: 22,
    fontWeight: 700,
  } satisfies CSSProperties,
  legend: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8, minWidth: 180 } satisfies CSSProperties,
  legendRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 13 } satisfies CSSProperties,
  swatch: (color: string): CSSProperties => ({ width: 9, height: 9, borderRadius: 2, background: color, flexShrink: 0 }),
  legendLabel: { color: "var(--text-secondary)", flex: 1 } satisfies CSSProperties,
  legendValue: { color: "var(--text-primary)", fontWeight: 600 } satisfies CSSProperties,
} as const;
