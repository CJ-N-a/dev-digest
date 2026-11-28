import type { IconName } from "@devdigest/ui";

export type SkillTab = "config" | "preview" | "evals" | "stats" | "versions";

/** Editor tabs; `labelKey` resolves under the `skills` namespace. */
export const SKILL_TABS: readonly { key: SkillTab; labelKey: string; icon: IconName }[] = [
  { key: "config", labelKey: "detail.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "detail.tabs.preview", icon: "Eye" },
  { key: "evals", labelKey: "detail.tabs.evals", icon: "FlaskConical" },
  { key: "stats", labelKey: "detail.tabs.stats", icon: "BarChart" },
  { key: "versions", labelKey: "detail.tabs.versions", icon: "History" },
];

export const SKILL_TAB_KEYS: readonly SkillTab[] = SKILL_TABS.map((tb) => tb.key);
