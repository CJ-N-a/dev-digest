/* SkillCard — left-column card on /skills: type icon, mono name, enabled
   toggle, one-line description, type pill + source badge, stats footer. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Toggle } from "@devdigest/ui";
import type { SkillListItem } from "@devdigest/shared";
import { SkillTypePill } from "@/components/skill-type-pill";
import { SKILL_TYPE_META } from "@/lib/skill-type";
import { acceptColor, formatRate } from "@/app/skills/_lib/stats-format";
import { SOURCE_ICON } from "./constants";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
}: {
  skill: SkillListItem;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  const meta = SKILL_TYPE_META[skill.type] ?? SKILL_TYPE_META.custom;
  const TypeIcon = Icon[meta.icon];
  const SourceIcon = Icon[SOURCE_ICON[skill.source] ?? "Edit"];
  const { agents_count, pull_rate, accept_rate } = skill.summary;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      data-testid="skill-card"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onClick?.();
      }}
      style={s.card(!!active, skill.enabled)}
    >
      <div style={s.headerRow}>
        <div style={s.iconBox(meta.color, meta.bg)}>
          <TypeIcon size={14} />
        </div>
        <span className="mono" style={s.name}>
          {skill.name}
        </span>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()} aria-label={t("card.toggleLabel", { name: skill.name })}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
      </div>
      <div style={s.description}>{skill.description || t("card.noDescription")}</div>
      <div style={s.metaRow}>
        <SkillTypePill type={skill.type} />
        <span style={s.sourceBadge}>
          <SourceIcon size={12} />
          {t(`source.${skill.source}`)}
        </span>
      </div>
      <div className="tnum" style={s.footer}>
        {t("card.agents", { count: agents_count })} · {t("card.pull", { value: formatRate(pull_rate) })} ·{" "}
        <span style={s.accept(acceptColor(accept_rate))}>{t("card.accept", { value: formatRate(accept_rate) })}</span>
      </div>
    </div>
  );
}
