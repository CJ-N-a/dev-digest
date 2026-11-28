/* SkillsLayout — /skills master-detail frame (mirrors /agents/[id]): app shell
   + breadcrumb, the skills list on the left, the given detail on the right.
   Provides the unsaved-changes guard to both sides. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { UnsavedChangesProvider } from "@/app/skills/_lib/unsaved-changes";
import { SkillsListView } from "../SkillsListView";
import { s } from "./styles";

export function SkillsLayout({
  activeId,
  tab,
  crumbLabel,
  children,
}: {
  activeId?: string;
  tab?: string;
  /** Third breadcrumb segment (the open skill's name). */
  crumbLabel?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("skills");
  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: "/skills" },
    ...(crumbLabel ? [{ label: crumbLabel }] : []),
  ];
  return (
    <AppShell crumb={crumb}>
      <UnsavedChangesProvider message={t("page.unsavedConfirm")}>
        <div style={s.frame}>
          <SkillsListView activeId={activeId} tab={tab} />
          <div style={s.detail}>{children}</div>
        </div>
      </UnsavedChangesProvider>
    </AppShell>
  );
}
