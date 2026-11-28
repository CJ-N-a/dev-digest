/* /skills/:id — Skill editor (M2). Left skills list + header + Config ·
   Preview · Evals · Stats · Versions. Tab state lives in ?tab=. */
"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ErrorState, Skeleton } from "@devdigest/ui";
import { useSkill } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { SkillsLayout } from "@/app/skills/_components/SkillsLayout";
import { SkillEditor, parseSkillTab, type SkillTab } from "@/app/skills/_components/SkillEditor";
import { s } from "./styles";

export default function SkillPage() {
  const t = useTranslations("skills");
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { data: skill, isLoading, isError, error, refetch } = useSkill(id);
  const tab = parseSkillTab(search.get("tab"));

  const setTab = (next: SkillTab) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`/skills/${id}?${sp.toString()}`);
  };

  let detail: React.ReactNode;
  if (isError || (!isLoading && !skill)) {
    detail = (
      <ErrorState
        title={t("detail.loadErrorTitle")}
        body={error instanceof ApiError ? error.message : t("detail.loadErrorBody")}
        onRetry={() => refetch()}
      />
    );
  } else if (isLoading || !skill) {
    detail = (
      <div style={s.loading}>
        <Skeleton height={24} width={240} />
        <Skeleton height={200} />
      </div>
    );
  } else {
    // Keyed by version: a save or restore resets the Config draft.
    detail = <SkillEditor key={`${skill.id}:${skill.version}`} skill={skill} tab={tab} onTab={setTab} />;
  }

  return (
    <SkillsLayout activeId={id} tab={tab} crumbLabel={skill?.name ?? t("detail.crumbSkill")}>
      {detail}
    </SkillsLayout>
  );
}
