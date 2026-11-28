/* SkillHeader — ✦ name (mono), type pill, vN badge, delete, and the
   "Run on evals" button (disabled in M2: no eval module yet). */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon, IconBtn } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypePill } from "@/components/skill-type-pill";
import { useDeleteSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { s } from "./styles";

export function SkillHeader({ skill }: { skill?: Skill }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const del = useDeleteSkill();

  const onDelete = () => {
    if (!skill || !window.confirm(t("detail.deleteConfirm", { name: skill.name }))) return;
    del.mutate(skill.id, {
      onSuccess: () => {
        toast.success(t("detail.deletedToast", { name: skill.name }));
        router.push("/skills");
      },
    });
  };

  return (
    <div style={s.row}>
      <Icon.Sparkles size={18} style={s.icon} />
      <h1 className={skill ? "mono" : undefined} style={s.h1}>
        {skill ? skill.name : t("detail.newSkill")}
      </h1>
      {skill && (
        <>
          <SkillTypePill type={skill.type} />
          <Badge color="var(--text-secondary)" mono>
            {t("detail.version", { version: skill.version })}
          </Badge>
        </>
      )}
      <div style={s.actions}>
        {skill && <IconBtn icon="Trash" label={t("detail.delete")} onClick={onDelete} danger />}
        <span title={t("detail.runOnEvalsTooltip")}>
          <Button kind="secondary" size="sm" icon="Play" disabled>
            {t("detail.runOnEvals")}
          </Button>
        </span>
      </div>
    </div>
  );
}
