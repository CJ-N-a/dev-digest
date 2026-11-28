/* VersionsTab — version history (newest first). The current version is
   badged; older ones offer Diff (vs current) and a non-destructive Restore. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useRestoreSkillVersion, useSkillVersions } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { VersionDiffModal } from "./_components/VersionDiffModal";
import { formatVersionDate } from "./helpers";
import { s } from "./styles";

export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data: versions, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const restore = useRestoreSkillVersion();
  const [diffVersion, setDiffVersion] = React.useState<number | null>(null);

  // mutateAsync: the restore bumps the version, which remounts the editor.
  const onRestore = async (version: number) => {
    if (!window.confirm(t("versions.restoreConfirm", { version }))) return;
    try {
      const saved = await restore.mutateAsync({ id: skill.id, version });
      toast.success(t("versions.restoredToast", { from: version, to: saved.version }));
    } catch {
      /* toasted by the global mutation error handler */
    }
  };

  return (
    <div style={s.wrap}>
      {diffVersion != null && (
        <VersionDiffModal skill={skill} version={diffVersion} onClose={() => setDiffVersion(null)} />
      )}
      <div style={s.header}>
        <h2 style={s.h2}>{t("versions.title")}</h2>
        {versions && <Badge color="var(--text-secondary)">{t("versions.count", { count: versions.length })}</Badge>}
      </div>
      <p style={s.subtitle}>{t("versions.subtitle")}</p>

      {isLoading && <Skeleton height={140} />}
      {isError && <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />}
      {versions && versions.length === 0 && <div style={s.muted}>{t("versions.empty")}</div>}
      {versions && versions.length > 0 && (
        <ul style={s.list}>
          {versions.map((v) => (
            <li key={v.version} style={s.row} data-testid="version-row">
              <Badge color="var(--accent-text)" bg="var(--accent-bg)" mono>
                {t("detail.version", { version: v.version })}
              </Badge>
              <span style={s.message}>{v.message}</span>
              <span className="tnum" style={s.date}>
                {formatVersionDate(v.created_at)}
              </span>
              <div style={s.actions}>
                {v.current ? (
                  <Badge color="var(--ok)" bg="var(--ok-bg)" icon="Check">
                    {t("versions.current")}
                  </Badge>
                ) : (
                  <>
                    <Button kind="ghost" size="sm" icon="Code" onClick={() => setDiffVersion(v.version)}>
                      {t("versions.diff")}
                    </Button>
                    <Button
                      kind="secondary"
                      size="sm"
                      icon="RefreshCw"
                      onClick={() => onRestore(v.version)}
                      disabled={restore.isPending}
                    >
                      {t("versions.restore")}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
