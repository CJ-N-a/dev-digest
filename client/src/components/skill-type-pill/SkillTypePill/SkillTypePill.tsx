/* SkillTypePill — coloured pill for a skill's type (rubric/convention/security/custom). */
import React from "react";
import { Badge } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPE_META } from "@/lib/skill-type";

export function SkillTypePill({ type }: { type: SkillType }) {
  const meta = SKILL_TYPE_META[type] ?? SKILL_TYPE_META.custom;
  return (
    <Badge color={meta.color} bg={meta.bg} mono>
      {type}
    </Badge>
  );
}
