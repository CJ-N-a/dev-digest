/* PreviewTab — the body rendered as markdown, as the reviewing agent receives
   it. Shows the unsaved draft (labelled) when the Config form has edits. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import { SkillMarkdownPreview } from "@/app/skills/_components/SkillMarkdownPreview";
import { s } from "./styles";

export function PreviewTab({ body, unsaved }: { body: string; unsaved?: boolean }) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("preview.title")}</h2>
        {unsaved && (
          <Badge color="var(--warn)" bg="var(--warn-bg)">
            {t("preview.unsavedDraft")}
          </Badge>
        )}
      </div>
      <p style={s.subtitle}>{t("preview.subtitle")}</p>
      <SkillMarkdownPreview body={body} />
    </div>
  );
}
