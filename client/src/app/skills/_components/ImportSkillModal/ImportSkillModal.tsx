/* ImportSkillModal — upload a .md / .zip → server preview (writes nothing) →
   editable draft + rendered preview + ignored files + trust warning → Save
   (POST /skills/import) → open the new skill. Nothing from the archive runs. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, Icon, Modal, SelectInput, TextInput, Textarea } from "@devdigest/ui";
import type { ImportPreview, SkillType } from "@devdigest/shared";
import { useImportPreview, useImportSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SKILL_TYPES } from "@/lib/skill-type";
import { validateDraft, type DraftErrors, type SkillDraft } from "@/app/skills/_lib/skill-draft";
import { useUnsavedChanges } from "@/app/skills/_lib/unsaved-changes";
import { SkillMarkdownPreview } from "../SkillMarkdownPreview";
import { IMPORT_ACCEPT, IMPORT_MODAL_WIDTH } from "./constants";
import { s } from "./styles";

export function ImportSkillModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const { confirmLeave } = useUnsavedChanges();
  const previewReq = useImportPreview();
  const importReq = useImportSkill();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [draft, setDraft] = React.useState<SkillDraft | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [dragOver, setDragOver] = React.useState(false);
  const [errors, setErrors] = React.useState<DraftErrors>({});

  const pick = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    previewReq.mutate(file, {
      onSuccess: (p) => {
        setPreview(p);
        setDraft({ ...p.draft, enabled: p.draft.enabled ?? true });
        setErrors({});
      },
    });
  };

  const set = (patch: Partial<SkillDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = () => {
    if (!draft) return;
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    importReq.mutate({ draft, filename: fileName }, {
      onSuccess: (skill) => {
        toast.success(t("import.importedToast", { name: skill.name }));
        onClose();
        if (confirmLeave()) router.push(`/skills/${skill.id}?tab=config`);
      },
    });
  };

  const back = () => {
    setPreview(null);
    setDraft(null);
    previewReq.reset();
  };

  return (
    <Modal
      width={IMPORT_MODAL_WIDTH}
      title={t("import.title")}
      subtitle={t("import.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          {preview && (
            <Button kind="ghost" onClick={back}>
              {t("import.back")}
            </Button>
          )}
          <span style={s.spacer} />
          <Button kind="ghost" onClick={onClose}>
            {t("import.cancel")}
          </Button>
          {preview && (
            <Button kind="primary" icon="Check" onClick={save} disabled={importReq.isPending}>
              {importReq.isPending ? t("import.saving") : t("import.save")}
            </Button>
          )}
        </div>
      }
    >
      {!preview || !draft ? (
        <div style={s.body}>
          <div
            role="button"
            tabIndex={0}
            data-testid="import-dropzone"
            style={s.dropzone(dragOver)}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer?.files?.[0]);
            }}
          >
            <Icon.Upload size={22} style={s.dropIcon} />
            <div style={s.dropTitle}>
              {previewReq.isPending ? t("import.parsing", { file: fileName }) : t("import.dropTitle")}
            </div>
            <div style={s.dropBody}>{t("import.dropBody")}</div>
            {previewReq.isError && (
              <div role="alert" style={s.fieldError}>
                {previewReq.error.message}
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={IMPORT_ACCEPT}
              aria-label={t("import.choose")}
              style={s.hiddenInput}
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      ) : (
        <div style={s.body}>
          <div role="alert" style={s.warningBanner}>
            <Icon.AlertTriangle size={15} style={s.bannerIcon} />
            <span>{t("import.trustWarning")}</span>
          </div>
          {preview.name_conflict && (
            <div role="alert" style={s.errorBanner}>
              {t("import.nameConflict")}
            </div>
          )}
          {importReq.isError && (
            <div role="alert" style={s.errorBanner}>
              {importReq.error.message}
            </div>
          )}
          {preview.warnings.length > 0 && (
            <div>
              <div style={s.sectionLabel}>{t("import.warnings")}</div>
              <ul style={s.list}>
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={s.columns}>
            <div style={s.column}>
              <FormField label={t("config.name")} required>
                <TextInput value={draft.name} onChange={(name) => set({ name })} aria-label={t("config.name")} mono />
                {errors.name && <div style={s.fieldError}>{t("config.errors.name")}</div>}
              </FormField>
              <FormField label={t("config.description")} hint={t("config.descriptionHint")}>
                <TextInput
                  value={draft.description}
                  onChange={(description) => set({ description })}
                  aria-label={t("config.description")}
                />
                {errors.description && <div style={s.fieldError}>{t("config.errors.description")}</div>}
              </FormField>
              <FormField label={t("config.type")}>
                <SelectInput
                  value={draft.type}
                  onChange={(v) => set({ type: v as SkillType })}
                  options={SKILL_TYPES.map((v) => ({ value: v, label: v }))}
                />
              </FormField>
              <FormField label={t("config.body")} required>
                <Textarea value={draft.body} onChange={(body) => set({ body })} rows={12} mono />
                {errors.body && <div style={s.fieldError}>{t("config.errors.body")}</div>}
              </FormField>
            </div>
            <div style={s.column}>
              <div style={s.sectionLabel}>{t("import.previewTitle")}</div>
              <SkillMarkdownPreview body={draft.body} />
            </div>
          </div>

          {preview.ignored_files.length > 0 && (
            <div>
              <div style={s.sectionLabel}>{t("import.ignoredTitle")}</div>
              <ul style={s.fileList} data-testid="ignored-files">
                {preview.ignored_files.map((f) => (
                  <li key={f.path} style={s.fileRow}>
                    <span className="mono">{f.path}</span>
                    <span style={s.fileReason}>{f.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.source_files.length > 0 && (
            <div>
              <div style={s.sectionLabel}>{t("import.sourceFilesTitle")}</div>
              <ul style={s.fileList}>
                {preview.source_files.map((f) => (
                  <li key={f} style={s.fileRow}>
                    <span className="mono">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
