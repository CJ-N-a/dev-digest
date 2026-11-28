/* SkillsTab — attach workspace skills to the agent, enable/disable them per
   agent and set their prompt order (drag, or ↑/↓ on a focused handle).
   Every change is an optimistic PUT /agents/:id/skills with rollback. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { AgentSkillItem, Skill } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills } from "@/lib/hooks/agents";
import { useSkills } from "@/lib/hooks/skills";
import { SkillTypePill } from "@/components/skill-type-pill";
import { REORDER_KEYS } from "./constants";
import { buildRows, dropOn, filterRows, moveBy, toggleSkill } from "./helpers";
import { s } from "./styles";

const EMPTY_LINKS: AgentSkillItem[] = [];

export function SkillsTab({ agentId }: { agentId: string }) {
  const t = useTranslations("agents");
  const router = useRouter();
  const skillsQ = useSkills();
  const linksQ = useAgentSkills(agentId);
  const setLinks = useSetAgentSkills(agentId);
  const [filter, setFilter] = React.useState("");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const handles = React.useRef(new Map<string, HTMLButtonElement>());

  // Keep keyboard focus on the moved handle after a reorder re-renders the list.
  React.useEffect(() => {
    if (focusId) handles.current.get(focusId)?.focus();
  }, [focusId, linksQ.data]);

  if (skillsQ.isLoading || linksQ.isLoading) {
    return (
      <div style={s.wrap}>
        <Skeleton height={24} width={200} />
        <Skeleton height={180} />
      </div>
    );
  }
  if (skillsQ.isError || linksQ.isError) {
    return (
      <ErrorState
        body={t("skillsTab.loadError")}
        onRetry={() => {
          skillsQ.refetch();
          linksQ.refetch();
        }}
      />
    );
  }

  const links = linksQ.data ?? EMPTY_LINKS;
  const all: Skill[] = skillsQ.data ?? [];
  const rows = filterRows(buildRows(links, all), filter);
  const enabledCount = links.filter((it) => it.enabled).length;
  const save = (next: AgentSkillItem[]) => setLinks.mutate(next);

  if (all.length === 0) {
    return (
      <EmptyState
        icon="Sparkles"
        title={t("skillsTab.emptyTitle")}
        body={t("skillsTab.emptyBody")}
        cta={t("skillsTab.emptyCta")}
        onCta={() => router.push("/skills/new")}
      />
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skillsTab.title")}</h2>
        <Badge color="var(--text-secondary)">
          {t("skillsTab.enabledCount", { enabled: enabledCount, total: all.length })}
        </Badge>
        <div style={s.filter}>
          <Icon.Search size={13} style={s.filterIcon} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("skillsTab.filterPlaceholder")}
            aria-label={t("skillsTab.filterPlaceholder")}
            style={s.filterInput}
          />
        </div>
      </div>
      <p style={s.hint}>{t("skillsTab.orderHint")}</p>

      <ul style={s.list} aria-label={t("skillsTab.title")}>
        {rows.map((row) => {
          const id = row.skill.id;
          return (
            <li
              key={id}
              data-testid="agent-skill-row"
              style={s.row(row.linked, dragId === id)}
              onDragOver={(e) => {
                if (dragId && row.linked) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && row.linked && dragId !== id) save(dropOn(links, dragId, id));
                setDragId(null);
              }}
            >
              <button
                type="button"
                ref={(el) => {
                  if (el) handles.current.set(id, el);
                  else handles.current.delete(id);
                }}
                draggable={row.linked}
                disabled={!row.linked}
                aria-label={t("skillsTab.reorder", { name: row.skill.name })}
                title={row.linked ? t("skillsTab.reorderHint") : undefined}
                style={s.handle(row.linked)}
                onDragStart={(e) => {
                  setDragId(id);
                  e.dataTransfer?.setData("text/plain", id);
                }}
                onDragEnd={() => setDragId(null)}
                onKeyDown={(e) => {
                  const delta = REORDER_KEYS[e.key];
                  if (delta == null || !row.linked) return;
                  e.preventDefault();
                  setFocusId(id);
                  save(moveBy(links, id, delta));
                }}
              >
                <Icon.Menu size={14} />
              </button>
              <Checkbox
                checked={row.linked && row.enabled}
                onChange={() => save(toggleSkill(links, row.skill))}
                label={
                  <span className="mono" style={s.name}>
                    {row.skill.name}
                  </span>
                }
              />
              <SkillTypePill type={row.skill.type} />
              {!row.skill.enabled && (
                <Badge color="var(--text-muted)" style={s.offBadge}>
                  {t("skillsTab.globallyOff")}
                </Badge>
              )}
              <span style={s.description}>{row.skill.description}</span>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <div style={s.muted}>{t("skillsTab.noMatch")}</div>}
    </div>
  );
}
