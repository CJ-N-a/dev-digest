/* CategoryDonut — SVG donut of findings per category + legend with counts.
   Plain SVG (no chart lib); colours from the @devdigest/ui category/severity tokens. */
import React from "react";
import { CAT, type Category } from "@devdigest/ui";
import { DONUT_SIZE, DONUT_STROKE, SEGMENT_GAP_PX } from "./constants";
import { toArcs } from "./helpers";
import { s } from "./styles";

export function CategoryDonut({
  items,
  ariaLabel,
}: {
  items: { category: string; count: number }[];
  ariaLabel?: string;
}) {
  const r = (DONUT_SIZE - DONUT_STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const arcs = toArcs(items, circ, SEGMENT_GAP_PX);
  const total = arcs.reduce((sum, a) => sum + a.count, 0);
  const label = (c: string) => CAT[c as Category]?.label ?? c;

  return (
    <div style={s.wrap}>
      <div style={s.chart}>
        <svg width={DONUT_SIZE} height={DONUT_SIZE} style={s.svg} role="img" aria-label={ariaLabel}>
          <circle cx={DONUT_SIZE / 2} cy={DONUT_SIZE / 2} r={r} fill="none" stroke="var(--bg-hover)" strokeWidth={DONUT_STROKE} />
          {arcs.map((a) => (
            <circle
              key={a.category}
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={DONUT_STROKE}
              strokeDasharray={`${a.length} ${circ - a.length}`}
              strokeDashoffset={-a.offset}
            >
              <title>{`${label(a.category)}: ${a.count}`}</title>
            </circle>
          ))}
        </svg>
        <div className="tnum" style={s.total}>
          {total}
        </div>
      </div>
      <ul style={s.legend}>
        {arcs.map((a) => (
          <li key={a.category} style={s.legendRow} data-testid="donut-legend-row">
            <span style={s.swatch(a.color)} />
            <span style={s.legendLabel}>{label(a.category)}</span>
            <span className="mono tnum" style={s.legendValue}>
              {a.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
