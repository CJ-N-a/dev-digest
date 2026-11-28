/* SkillsListView — left column of /skills: title, "Add Skill ▾" (Create /
   Import), search and the SkillCards. Navigation asks the unsaved-changes
   guard first. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { useUnsavedChanges } from "@/app/skills/_lib/unsaved-changes";
import { SkillCard } from "../SkillCard";
import { ImportSkillModal } from "../ImportSkillModal";
import { filterSkills } from "./helpers";
import { s } from "./styles";

export function SkillsListView({ activeId, tab }: { activeId?: string; tab?: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const { confirmLeave } = useUnsavedChanges();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [search, setSearch] = React.useState("");
  const [importing, setImporting] = React.useState(false);

  const list = filterSkills(skills ?? [], search);
  const go = (href: string) => {
    if (confirmLeave()) router.push(href);
  };

  return (
    <div style={s.column}>
      {importing && <ImportSkillModal onClose={() => setImporting(false)} />}
      <div style={s.top}>
        <div style={s.headerRow}>
          <h1 style={s.h1}>{t("page.heading")}</h1>
          <Dropdown
            width={190}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                {t("page.addSkill")}
              </Button>
            }
            items={[
              { label: t("page.create"), icon: "Edit", onClick: () => go("/skills/new") },
              { label: t("page.import"), icon: "Upload", onClick: () => setImporting(true) },
            ]}
          />
        </div>
        <div style={s.search}>
          <Icon.Search size={13} style={s.searchIcon} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("page.searchPlaceholder")}
            aria-label={t("page.searchPlaceholder")}
            style={s.searchInput}
          />
        </div>
      </div>
      <div style={s.list}>
        {isLoading && (
          <div style={s.skeletons}>
            <Skeleton height={110} />
            <Skeleton height={110} />
          </div>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && skills && skills.length > 0 && list.length === 0 && (
          <div style={s.noMatch}>{t("page.noMatch", { query: search })}</div>
        )}
        {list.map((sk) => (
          <SkillCard
            key={sk.id}
            skill={sk}
            active={sk.id === activeId}
            onClick={() => go(`/skills/${sk.id}?tab=${tab ?? "config"}`)}
            onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
          />
        ))}
      </div>
    </div>
  );
}
