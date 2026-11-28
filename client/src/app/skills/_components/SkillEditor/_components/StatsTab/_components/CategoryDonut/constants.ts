import type { FindingCategory } from "@devdigest/shared";

/** Fixed colour per finding category (colour follows the category, not its rank). */
export const CATEGORY_COLOR: Record<FindingCategory, string> = {
  bug: "var(--crit)",
  security: "var(--warn)",
  perf: "var(--sugg)",
  style: "var(--info)",
  test: "var(--accent)",
};
export const OTHER_COLOR = "var(--text-muted)";

export const DONUT_SIZE = 132;
export const DONUT_STROKE = 18;
/** Surface gap between segments, in px of arc length. */
export const SEGMENT_GAP_PX = 2;
