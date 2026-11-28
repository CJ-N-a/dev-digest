/* StatCard — uppercase label + big value, with an optional small progress ring (0..1). */
import React from "react";
import { RING_SIZE, RING_STROKE } from "./constants";
import { s } from "./styles";

export function StatCard({
  label,
  value,
  ring,
  ringColor = "var(--accent)",
}: {
  label: string;
  value: React.ReactNode;
  ring?: number | null;
  ringColor?: string;
}) {
  const r = (RING_SIZE - RING_STROKE) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={s.card} role="group" aria-label={label}>
      <div style={s.label}>{label}</div>
      <div style={s.valueRow}>
        <span className="tnum" style={s.value}>
          {value}
        </span>
        {ring != null && (
          <svg width={RING_SIZE} height={RING_SIZE} style={s.ring} aria-hidden>
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r} fill="none" stroke="var(--bg-hover)" strokeWidth={RING_STROKE} />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth={RING_STROKE}
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - Math.min(Math.max(ring, 0), 1))}
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
