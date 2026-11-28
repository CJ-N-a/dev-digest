/* StatsTab — 30-day usage of a skill: used by · pull frequency · accept rate ·
   findings, the agents using it, and findings by category (attribution by
   presence). `—` / empty states before the first runs with skills. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { useSkillStats } from "@/lib/hooks/skills";
import { useUnsavedChanges } from "@/app/skills/_lib/unsaved-changes";
import { acceptColor, formatRate, NO_VALUE } from "@/app/skills/_lib/stats-format";
import { CategoryDonut } from "./_components/CategoryDonut";
import { StatCard } from "./_components/StatCard";
import { hasRuns } from "./helpers";
import { s } from "./styles";

export function StatsTab({ skillId }: { skillId: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const { confirmLeave } = useUnsavedChanges();
  const { data: stats, isLoading, isError, refetch } = useSkillStats(skillId);

  if (isLoading) {
    return (
      <div style={s.loading}>
        <Skeleton height={90} />
        <Skeleton height={160} />
      </div>
    );
  }
  if (isError || !stats) return <ErrorState body={t("stats.loadError")} onRetry={() => refetch()} />;

  const ran = hasRuns(stats);
  return (
    <div style={s.wrap}>
      <div style={s.cards}>
        <StatCard label={t("stats.usedBy")} value={t("stats.usedByValue", { count: stats.agents_count })} />
        <StatCard label={t("stats.pullFrequency")} value={formatRate(stats.pull_rate)} />
        <StatCard
          label={t("stats.acceptRate")}
          value={formatRate(stats.accept_rate)}
          ring={stats.accept_rate}
          ringColor={acceptColor(stats.accept_rate)}
        />
        <StatCard label={t("stats.findings30d")} value={ran ? stats.findings_30d : NO_VALUE} />
      </div>
      <p style={s.hint}>
        <Icon.Info size={13} style={s.hintIcon} />
        {t("stats.attributionHint")}
      </p>

      <section style={s.section}>
        <h3 style={s.h3}>{t("stats.agentsTitle")}</h3>
        {stats.agents.length === 0 ? (
          <div style={s.muted}>{t("stats.agentsEmpty")}</div>
        ) : (
          <ul style={s.agentList}>
            {stats.agents.map((a) => (
              <li key={a.id} style={s.agentRow}>
                <Icon.Cpu size={14} style={s.agentIcon} />
                <span style={s.agentName}>{a.name}</span>
                <Button
                  kind="ghost"
                  size="sm"
                  iconRight="ArrowRight"
                  onClick={() => {
                    if (confirmLeave()) router.push(`/agents/${a.id}?tab=skills`);
                  }}
                >
                  {t("stats.open")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={s.section}>
        <h3 style={s.h3}>{t("stats.byCategoryTitle")}</h3>
        {stats.by_category.some((c) => c.count > 0) ? (
          <div style={s.panel}>
            <CategoryDonut items={stats.by_category} ariaLabel={t("stats.byCategoryTitle")} />
          </div>
        ) : (
          <EmptyState icon="BarChart" title={t("stats.byCategoryEmpty")} />
        )}
      </section>
    </div>
  );
}
