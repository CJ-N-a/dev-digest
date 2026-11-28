import { describe, expect, it } from 'vitest';
import {
  changedFields,
  changeMessage,
  contentFromSnapshot,
  type SkillContent,
} from '../src/modules/skills/domain-model/skill.js';
import { EMPTY_COUNTERS, ratio, summarize } from '../src/modules/skills/domain-model/skill-stats.js';

const current: SkillContent = { name: 'a', description: 'd', type: 'rubric', body: 'b' };

describe('skill versioning rules', () => {
  it('detects only fields that actually change', () => {
    expect(changedFields(current, { name: 'a', body: 'b' })).toEqual([]);
    expect(changedFields(current, { description: 'x', name: 'z', type: 'security', body: 'y' })).toEqual([
      'body',
      'name',
      'type',
      'description',
    ]);
  });

  it('auto message joins labels in fixed order; a note wins', () => {
    expect(changeMessage(['description', 'body'])).toBe('Edited body, Edited description');
    expect(changeMessage(['name', 'type'], '   ')).toBe('Renamed, Changed type');
    expect(changeMessage(['body'], ' Added Tests dimension ')).toBe('Added Tests dimension');
  });

  it('restore of a pre-M2 snapshot keeps the current name/description/type', () => {
    const snap = {
      skillId: 's',
      version: 1,
      message: '',
      name: null,
      description: null,
      type: null,
      body: 'old',
      createdAt: new Date(),
    };
    expect(contentFromSnapshot(snap, current)).toEqual({ ...current, body: 'old' });
  });
});

describe('skill stats formulas', () => {
  it('rates are null with zero denominators', () => {
    expect(ratio(0, 0)).toBeNull();
    expect(summarize(EMPTY_COUNTERS)).toEqual({ agentsCount: 0, pullRate: null, acceptRate: null });
  });

  it('computes pull and accept rates', () => {
    expect(
      summarize({ agentsCount: 2, runsWithSkill: 5, linkedAgentRuns: 7, accepted: 3, dismissed: 1 }),
    ).toEqual({ agentsCount: 2, pullRate: 5 / 7, acceptRate: 0.75 });
  });

  it('accept rate is 0 (not null) when everything was dismissed', () => {
    expect(summarize({ ...EMPTY_COUNTERS, dismissed: 2 }).acceptRate).toBe(0);
  });
});
