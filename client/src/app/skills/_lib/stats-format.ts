/* stats-format.ts — formatting of skill stats (0..1 rates) shared by the
   SkillCard footer and the Stats tab. */

export const NO_VALUE = "—";

/** 0.714 → "71%"; null → "—". */
export function formatRate(rate: number | null | undefined): string {
  return rate == null ? NO_VALUE : `${Math.round(rate * 100)}%`;
}

/** Accept-rate colour: green ≥ 70%, amber ≥ 50%, otherwise red (muted when unknown). */
export function acceptColor(rate: number | null | undefined): string {
  if (rate == null) return "var(--text-muted)";
  if (rate >= 0.7) return "var(--ok)";
  if (rate >= 0.5) return "var(--warn)";
  return "var(--crit)";
}
