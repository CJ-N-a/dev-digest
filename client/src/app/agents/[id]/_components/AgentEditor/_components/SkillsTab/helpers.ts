import type { AgentSkillItem, Skill } from "@devdigest/shared";

/** One row of the agent's Skills tab. */
export interface SkillRow {
  skill: Skill;
  linked: boolean;
  /** Per-agent switch (false for unlinked rows). */
  enabled: boolean;
}

/** Linked skills first (in prompt order), then the rest of the workspace by name. */
export function buildRows(linked: AgentSkillItem[], all: Skill[]): SkillRow[] {
  const ordered = [...linked].sort((a, b) => a.order - b.order);
  const linkedIds = new Set(ordered.map((it) => it.skill.id));
  const rest = all.filter((sk) => !linkedIds.has(sk.id)).sort((a, b) => a.name.localeCompare(b.name));
  return [
    ...ordered.map((it) => ({ skill: it.skill, linked: true, enabled: it.enabled })),
    ...rest.map((skill) => ({ skill, linked: false, enabled: false })),
  ];
}

/** Linked list sorted by order (the PUT body order). */
export function orderedLinks(linked: AgentSkillItem[]): AgentSkillItem[] {
  return [...linked].sort((a, b) => a.order - b.order);
}

/** Checkbox: an unlinked skill gets linked (enabled) at the end; a linked one flips `enabled` and keeps its place. */
export function toggleSkill(linked: AgentSkillItem[], skill: Skill): AgentSkillItem[] {
  const list = orderedLinks(linked);
  const idx = list.findIndex((it) => it.skill.id === skill.id);
  if (idx === -1) return [...list, { skill, enabled: true, order: list.length }];
  return list.map((it, i) => (i === idx ? { ...it, enabled: !it.enabled } : it));
}

/** Move a linked skill from its index to `toIndex` (clamped). */
export function moveTo(linked: AgentSkillItem[], skillId: string, toIndex: number): AgentSkillItem[] {
  const list = orderedLinks(linked);
  const from = list.findIndex((it) => it.skill.id === skillId);
  if (from === -1) return list;
  const to = Math.max(0, Math.min(list.length - 1, toIndex));
  if (to === from) return list;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item!);
  return list.map((it, order) => ({ ...it, order }));
}

/** Keyboard reorder: move by `delta` positions (-1 = up). */
export function moveBy(linked: AgentSkillItem[], skillId: string, delta: number): AgentSkillItem[] {
  const from = orderedLinks(linked).findIndex((it) => it.skill.id === skillId);
  return from === -1 ? orderedLinks(linked) : moveTo(linked, skillId, from + delta);
}

/** Drag-and-drop: drop `dragId` onto the row of `targetId`. */
export function dropOn(linked: AgentSkillItem[], dragId: string, targetId: string): AgentSkillItem[] {
  const to = orderedLinks(linked).findIndex((it) => it.skill.id === targetId);
  return to === -1 ? orderedLinks(linked) : moveTo(linked, dragId, to);
}

/** Case-insensitive filter over name + description. */
export function filterRows(rows: SkillRow[], query: string): SkillRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => `${r.skill.name} ${r.skill.description}`.toLowerCase().includes(q));
}
