/* ConfigTab — skill form: enabled, name, description (a directive), type,
   markdown body, optional change note → Save (PATCH, or POST for /skills/new). */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, SelectInput, TextInput, Toggle } from "@devdigest/ui";
import { SKILL_LIMITS, type Skill, type SkillType } from "@devdigest/shared";
import { useCreateSkill, useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SKILL_TYPES } from "@/lib/skill-type";
import { buildPatch, validateDraft, type DraftErrors } from "@/app/skills/_lib/skill-draft";
import type { SkillForm } from "@/app/skills/_components/SkillEditor/useSkillForm";
import { SkillBodyEditor } from "./_components/SkillBodyEditor";
import { isNameTaken } from "./helpers";
import { s } from "./styles";

export function ConfigTab({ skill, form }: { skill?: Skill; form: SkillForm }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const create = useCreateSkill();
  const update = useUpdateSkill();
  const [changeNote, setChangeNote] = React.useState("");
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const [nameTaken, setNameTaken] = React.useState(false);
  const { values, set } = form;
  const saving = create.isPending || update.isPending;

  // mutateAsync, not mutate callbacks: a successful save bumps the version,
  // which remounts the editor (keyed by version) before per-call callbacks run.
  const onSave = async () => {
    const found = validateDraft(values);
    setErrors(found);
    setNameTaken(false);
    if (Object.keys(found).length > 0) return;
    try {
      if (!skill) {
        const created = await create.mutateAsync(values);
        toast.success(t("config.createdToast", { name: created.name }));
        router.replace(`/skills/${created.id}?tab=config`);
        return;
      }
      const saved = await update.mutateAsync({ id: skill.id, patch: buildPatch(form.base, values, changeNote) });
      toast.success(t("config.savedToast", { version: saved.version }));
    } catch (e) {
      // Other failures are toasted by the global mutation error handler.
      setNameTaken(isNameTaken(e));
    }
  };

  const onCancel = () => {
    if (!skill) router.push("/skills");
    else {
      form.reset();
      setChangeNote("");
      setErrors({});
      setNameTaken(false);
    }
  };

  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: v }));

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("config.title")}</h2>
        {skill && (
          <Badge color="var(--text-secondary)" mono>
            {t("detail.version", { version: skill.version })}
          </Badge>
        )}
        <label style={s.enabledLabel}>
          {t("config.enabled")}
          <Toggle on={values.enabled} onChange={(enabled) => set({ enabled })} size={16} />
        </label>
      </div>

      <FormField label={t("config.name")} required>
        <TextInput
          value={values.name}
          onChange={(name) => set({ name })}
          placeholder={t("config.namePlaceholder")}
          aria-label={t("config.name")}
          aria-invalid={errors.name || nameTaken}
          maxLength={SKILL_LIMITS.name}
          mono
        />
        {(errors.name || nameTaken) && (
          <div role="alert" style={s.error}>
            {nameTaken ? t("config.errors.nameTaken") : t("config.errors.name")}
          </div>
        )}
      </FormField>

      <FormField label={t("config.description")} hint={t("config.descriptionHint")}>
        <TextInput
          value={values.description}
          onChange={(description) => set({ description })}
          placeholder={t("config.descriptionPlaceholder")}
          aria-label={t("config.description")}
          aria-invalid={errors.description}
          maxLength={SKILL_LIMITS.description}
        />
        {errors.description && (
          <div role="alert" style={s.error}>
            {t("config.errors.description")}
          </div>
        )}
      </FormField>

      <FormField label={t("config.type")}>
        <SelectInput value={values.type} onChange={(v) => set({ type: v as SkillType })} options={typeOptions} />
      </FormField>

      <FormField label={t("config.body")} required>
        <SkillBodyEditor
          name={values.name}
          value={values.body}
          onChange={(body) => set({ body })}
          dirty={form.contentDirty}
          invalid={errors.body}
        />
        {errors.body && (
          <div role="alert" style={s.error}>
            {t("config.errors.body")}
          </div>
        )}
      </FormField>

      {skill && (
        <FormField label={t("config.changeNote")} hint={t("config.changeNoteHint")}>
          <TextInput
            value={changeNote}
            onChange={setChangeNote}
            placeholder={t("config.changeNotePlaceholder")}
            aria-label={t("config.changeNote")}
            maxLength={SKILL_LIMITS.changeNote}
          />
        </FormField>
      )}

      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={onSave} disabled={saving || (!!skill && !form.dirty)}>
          {saving ? t("config.saving") : t("config.save")}
        </Button>
        <Button kind="ghost" onClick={onCancel} disabled={saving || (!!skill && !form.dirty)}>
          {t("config.cancel")}
        </Button>
      </div>
    </div>
  );
}
