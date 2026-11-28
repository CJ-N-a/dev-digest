/* SkillMarkdownPreview — a skill body rendered as markdown in a bordered card.
   Shared by the Preview tab and the Import modal ("as the agent receives it"). */
import React from "react";
import { useTranslations } from "next-intl";
import { Markdown } from "@devdigest/ui";
import { s } from "./styles";

export function SkillMarkdownPreview({ body }: { body: string }) {
  const t = useTranslations("skills");
  return (
    <div style={s.card} data-testid="skill-markdown-preview">
      {body.trim() ? <Markdown variant="document">{body}</Markdown> : <span style={s.empty}>{t("preview.empty")}</span>}
    </div>
  );
}
