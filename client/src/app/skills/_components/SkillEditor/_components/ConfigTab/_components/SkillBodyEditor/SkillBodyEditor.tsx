/* SkillBodyEditor — markdown body editor: `<name>.md` header with an
   `unsaved` badge and a token estimate, line-number gutter + mono textarea. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import { approxTokens } from "@devdigest/shared";
import { lineNumbers } from "./helpers";
import { BODY_ROWS } from "./constants";
import { s } from "./styles";

export function SkillBodyEditor({
  name,
  value,
  onChange,
  dirty,
  invalid,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  dirty?: boolean;
  invalid?: boolean;
}) {
  const t = useTranslations("skills");
  const gutterRef = React.useRef<HTMLDivElement>(null);

  return (
    <div style={s.box(!!invalid)}>
      <div style={s.header}>
        <Icon.FileText size={13} style={s.fileIcon} />
        <span className="mono" style={s.fileName}>
          {`${name || "skill"}.md`}
        </span>
        {dirty && (
          <Badge color="var(--warn)" bg="var(--warn-bg)">
            {t("bodyEditor.unsaved")}
          </Badge>
        )}
        <span className="tnum" style={s.tokens} data-testid="body-tokens">
          {t("bodyEditor.tokens", { count: approxTokens(value) })}
        </span>
      </div>
      <div style={s.editor}>
        <div ref={gutterRef} className="mono" style={s.gutter} aria-hidden>
          {lineNumbers(value).map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        <textarea
          className="mono"
          aria-label={t("bodyEditor.ariaLabel")}
          value={value}
          rows={BODY_ROWS}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          style={s.textarea}
        />
      </div>
    </div>
  );
}
