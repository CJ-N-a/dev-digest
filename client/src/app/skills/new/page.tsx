/* /skills/new — create a skill: the Config tab with an empty form; the other
   tabs stay disabled until the first save (which navigates to /skills/:id). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SkillsLayout } from "@/app/skills/_components/SkillsLayout";
import { SkillEditor } from "@/app/skills/_components/SkillEditor";

export default function NewSkillPage() {
  const t = useTranslations("skills");
  return (
    <SkillsLayout crumbLabel={t("detail.newSkill")}>
      <SkillEditor tab="config" />
    </SkillsLayout>
  );
}
