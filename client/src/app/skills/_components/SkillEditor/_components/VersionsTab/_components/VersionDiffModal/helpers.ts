import { diffLines } from "diff";
import type { Skill, SkillVersionFull } from "@devdigest/shared";

export interface DiffRow {
  kind: "add" | "del" | "ctx";
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

/** Line diff old → new as numbered rows (unified-diff style). */
export function lineDiff(oldText: string, newText: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldNo = 1;
  let newNo = 1;
  for (const part of diffLines(oldText, newText)) {
    const lines = part.value.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    for (const text of lines) {
      if (part.added) rows.push({ kind: "add", oldNo: null, newNo: newNo++, text });
      else if (part.removed) rows.push({ kind: "del", oldNo: oldNo++, newNo: null, text });
      else rows.push({ kind: "ctx", oldNo: oldNo++, newNo: newNo++, text });
    }
  }
  return rows;
}

export type MetaField = "name" | "description" | "type";
export interface FieldChange {
  field: MetaField;
  from: string;
  to: string;
}

/** name/description/type that differ (skipped when the old snapshot lacks them). */
export function fieldChanges(old: SkillVersionFull, current: Skill): FieldChange[] {
  const fields: MetaField[] = ["name", "description", "type"];
  const out: FieldChange[] = [];
  for (const field of fields) {
    const from = old[field];
    if (from != null && from !== current[field]) out.push({ field, from, to: current[field] });
  }
  return out;
}
