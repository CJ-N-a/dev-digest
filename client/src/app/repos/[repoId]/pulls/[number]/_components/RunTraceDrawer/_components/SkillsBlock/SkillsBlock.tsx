/* SkillsBlock — the prompt's Skills segment (M2): the assembled block, a
   `+T tokens` badge and the `name vK` list of skills that went into the prompt.
   Renders nothing when the run had no skills. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { PromptAssembly } from "@devdigest/shared";
import { PROMPT_COLORS } from "../../constants";
import { s } from "../../styles";
import { PromptBlock } from "../PromptBlock";

export function SkillsBlock({ assembly }: { assembly: PromptAssembly }) {
  const t = useTranslations("runs");
  if (assembly.skills == null) return null;
  const used = assembly.skills_used ?? [];
  const tokens = assembly.skills_tokens;
  return (
    <PromptBlock
      label={t("trace.prompt.skills")}
      text={assembly.skills}
      color={PROMPT_COLORS.skills}
      badge={
        tokens != null ? (
          <Badge color="var(--accent)">{t("trace.prompt.skillsTokens", { count: tokens })}</Badge>
        ) : undefined
      }
    >
      {used.length > 0 && (
        <ul style={s.skillsList} aria-label={t("trace.prompt.skillsUsed")}>
          {used.map((sk, i) => (
            <li key={`${sk.name}-${i}`} className="mono" style={s.skillChip}>
              {t("trace.prompt.skillVersion", { name: sk.name, version: sk.version })}
            </li>
          ))}
        </ul>
      )}
    </PromptBlock>
  );
}
