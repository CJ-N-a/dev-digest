import type { SkillStats } from "@devdigest/shared";

/** Any run with this skill in the window (otherwise metrics show `—`). */
export function hasRuns(stats: SkillStats): boolean {
  return stats.pull_rate != null || stats.findings_30d > 0;
}
