import type { CSSProperties } from "react";
import { BODY_ROWS, LINE_HEIGHT_PX } from "./constants";

const PAD_Y = 10;

/** Co-located styles for SkillBodyEditor. */
export const s = {
  box: (invalid: boolean): CSSProperties => ({
    border: "1px solid " + (invalid ? "var(--crit)" : "var(--border-strong)"),
    borderRadius: 8,
    overflow: "hidden",
    background: "var(--bg-elevated)",
  }),
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  fileIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  fileName: { fontSize: 12.5, color: "var(--text-secondary)" } satisfies CSSProperties,
  tokens: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  editor: { display: "flex", alignItems: "stretch" } satisfies CSSProperties,
  gutter: {
    flexShrink: 0,
    width: 44,
    padding: `${PAD_Y}px 8px`,
    textAlign: "right",
    fontSize: 12,
    lineHeight: `${LINE_HEIGHT_PX}px`,
    color: "var(--text-muted)",
    borderRight: "1px solid var(--border)",
    background: "var(--bg-surface)",
    overflow: "hidden",
    height: BODY_ROWS * LINE_HEIGHT_PX + PAD_Y * 2,
    userSelect: "none",
  } satisfies CSSProperties,
  textarea: {
    flex: 1,
    minWidth: 0,
    resize: "none",
    border: "none",
    outline: "none",
    padding: `${PAD_Y}px 12px`,
    fontSize: 13,
    lineHeight: `${LINE_HEIGHT_PX}px`,
    height: BODY_ROWS * LINE_HEIGHT_PX + PAD_Y * 2,
    background: "transparent",
    color: "var(--text-primary)",
    whiteSpace: "pre",
    overflowWrap: "normal",
    overflow: "auto",
  } satisfies CSSProperties,
} as const;
