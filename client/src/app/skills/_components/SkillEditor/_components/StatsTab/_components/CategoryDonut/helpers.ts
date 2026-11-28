import { CATEGORY_COLOR, OTHER_COLOR } from "./constants";

export interface DonutArc {
  category: string;
  count: number;
  color: string;
  /** Arc length and start offset along the circumference (px). */
  length: number;
  offset: number;
}

/** Lay out categories as arcs (largest first) along a circle of `circumference`. */
export function toArcs(items: { category: string; count: number }[], circumference: number, gap: number): DonutArc[] {
  const positive = items.filter((it) => it.count > 0).sort((a, b) => b.count - a.count);
  const total = positive.reduce((sum, it) => sum + it.count, 0);
  if (total === 0) return [];
  const gapPx = positive.length > 1 ? gap : 0;
  let offset = 0;
  return positive.map((it) => {
    const full = (it.count / total) * circumference;
    const arc: DonutArc = {
      category: it.category,
      count: it.count,
      color: (CATEGORY_COLOR as Record<string, string>)[it.category] ?? OTHER_COLOR,
      length: Math.max(full - gapPx, 0.5),
      offset,
    };
    offset += full;
    return arc;
  });
}
