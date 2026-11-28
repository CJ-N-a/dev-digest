/* SkillEditor — right side of /skills: header + Config · Preview · Evals ·
   Stats · Versions. Holds the Config draft so Preview can render unsaved
   edits; key it by `${id}:${version}` so a save/restore resets the draft.
   Without a skill it is the create form (/skills/new): Config only. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useReportDirty } from "@/app/skills/_lib/unsaved-changes";
import { SkillHeader } from "./_components/SkillHeader";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { EvalsTab } from "./_components/EvalsTab";
import { StatsTab } from "./_components/StatsTab";
import { VersionsTab } from "./_components/VersionsTab";
import { SKILL_TABS, type SkillTab } from "./constants";
import { useSkillForm } from "./useSkillForm";
import { s } from "./styles";

export function SkillEditor({
  skill,
  tab,
  onTab,
}: {
  skill?: Skill;
  tab: SkillTab;
  onTab?: (tab: SkillTab) => void;
}) {
  const t = useTranslations("skills");
  const form = useSkillForm(skill);
  useReportDirty(form.dirty);

  const isNew = !skill;
  const active: SkillTab = isNew ? "config" : tab;
  const tabs = SKILL_TABS.map((tb) => ({
    key: tb.key,
    label: t(tb.labelKey),
    icon: tb.icon,
    disabled: isNew && tb.key !== "config",
  }));

  return (
    <div style={s.wrap}>
      <SkillHeader skill={skill} />
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={active} onChange={(k) => onTab?.(k as SkillTab)} pad="0 24px" />
      </div>
      <div style={s.body}>
        {active === "config" && <ConfigTab skill={skill} form={form} />}
        {skill && active === "preview" && (
          <PreviewTab body={form.values.body} unsaved={form.values.body !== form.base.body} />
        )}
        {skill && active === "evals" && <EvalsTab />}
        {skill && active === "stats" && <StatsTab skillId={skill.id} />}
        {skill && active === "versions" && <VersionsTab skill={skill} />}
      </div>
    </div>
  );
}
