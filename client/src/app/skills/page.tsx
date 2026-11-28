/* /skills — Skills master-detail with nothing selected: opens the first skill,
   or shows the empty state when the workspace has none. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@devdigest/ui";
import { useSkills } from "@/lib/hooks/skills";
import { SkillsLayout } from "@/app/skills/_components/SkillsLayout";

export default function SkillsPage() {
  const t = useTranslations("skills");
  const router = useRouter();
  const { data: skills, isSuccess } = useSkills();
  const firstId = skills?.[0]?.id;

  React.useEffect(() => {
    if (firstId) router.replace(`/skills/${firstId}?tab=config`);
  }, [firstId, router]);

  return (
    <SkillsLayout>
      {isSuccess && skills.length === 0 ? (
        <EmptyState
          icon="Sparkles"
          title={t("page.empty.title")}
          body={t("page.empty.body")}
          cta={t("page.empty.cta")}
          onCta={() => router.push("/skills/new")}
        />
      ) : (
        <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />
      )}
    </SkillsLayout>
  );
}
