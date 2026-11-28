/* VersionDiffModal — line diff of a version snapshot (vK) against the current
   skill: changed name/description/type, then the body. Computed client-side
   with jsdiff. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, ErrorState, Modal, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillVersion } from "@/lib/hooks/skills";
import { DIFF_MODAL_WIDTH, DIFF_SIGN, FIELD_LABEL_KEY } from "./constants";
import { fieldChanges, lineDiff, type DiffRow } from "./helpers";
import { s } from "./styles";

function DiffRows({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="mono" style={s.box}>
      {rows.map((r, i) => (
        <div key={i} style={s.row(r.kind)} data-kind={r.kind}>
          <span style={s.num}>{r.oldNo ?? ""}</span>
          <span style={s.num}>{r.newNo ?? ""}</span>
          <span style={s.sign(r.kind)}>{DIFF_SIGN[r.kind]}</span>
          <span style={s.text}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

export function VersionDiffModal({
  skill,
  version,
  onClose,
}: {
  skill: Skill;
  version: number;
  onClose: () => void;
}) {
  const t = useTranslations("skills");
  const { data: old, isLoading, isError, refetch } = useSkillVersion(skill.id, version);

  const fields = old ? fieldChanges(old, skill) : [];
  const bodyRows = old ? lineDiff(old.body, skill.body) : [];
  const bodyChanged = bodyRows.some((r) => r.kind !== "ctx");

  return (
    <Modal
      width={DIFF_MODAL_WIDTH}
      title={t("diff.title", { from: version, to: skill.version })}
      subtitle={t("diff.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("diff.close")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        {isLoading && <Skeleton height={160} />}
        {isError && <ErrorState body={t("diff.loadError")} onRetry={() => refetch()} />}
        {old && fields.length === 0 && !bodyChanged && <div style={s.muted}>{t("diff.noChanges")}</div>}
        {fields.map((f) => (
          <div key={f.field}>
            <div style={s.sectionLabel}>{t(FIELD_LABEL_KEY[f.field])}</div>
            <DiffRows
              rows={[
                { kind: "del", oldNo: null, newNo: null, text: f.from },
                { kind: "add", oldNo: null, newNo: null, text: f.to },
              ]}
            />
          </div>
        ))}
        {old && bodyChanged && (
          <div>
            <div style={s.sectionLabel}>{t("diff.fieldBody")}</div>
            <DiffRows rows={bodyRows} />
          </div>
        )}
      </div>
    </Modal>
  );
}
