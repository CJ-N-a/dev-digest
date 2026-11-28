import { describe, it, expect, vi } from 'vitest';
import type { RunTrace } from '@devdigest/shared';
import { MockLLMProvider, MockGitClient } from '../src/adapters/mocks.js';
import { runBus } from '../src/platform/sse.js';
import { ReviewRunExecutor } from '../src/modules/reviews/run-executor.js';
import {
  formatSkillBlock,
  runSkillRows,
  skillsLogLine,
  toPromptSkills,
} from '../src/modules/reviews/helpers.js';
import type {
  AgentPromptSkill,
  ReviewRepository,
  RunSkillRow,
} from '../src/modules/reviews/repository.js';
import type { Container } from '../src/platform/container.js';
import type { AgentRow, PullRow } from '../src/db/rows.js';

const SKILLS: AgentPromptSkill[] = [
  {
    id: 's1',
    name: 'no-secrets',
    description: 'Flag committed credentials.',
    type: 'security',
    body: 'Any sk_live_* key is CRITICAL.',
    version: 3,
    order: 0,
  },
  {
    id: 's2',
    name: 'naming',
    description: 'Naming conventions.',
    type: 'convention',
    body: 'camelCase for vars.',
    version: 1,
    order: 1,
  },
];

describe('skills prompt helpers (M2)', () => {
  it('formats a skill block per the spec', () => {
    expect(formatSkillBlock(SKILLS[0]!)).toBe(
      '### Skill: no-secrets (security)\nFlag committed credentials.\n\nAny sk_live_* key is CRITICAL.',
    );
  });

  it('builds run rows with prompt position + ceil(chars/4) tokens', () => {
    const rows = runSkillRows(SKILLS);
    expect(rows.map((r) => [r.skillName, r.skillVersion, r.order])).toEqual([
      ['no-secrets', 3, 0],
      ['naming', 1, 1],
    ]);
    expect(rows[0]!.tokens).toBe(Math.ceil(formatSkillBlock(SKILLS[0]!).length / 4));
  });

  it('log line: loaded N (name@vK, …) · ~T tokens, or none', () => {
    const prompt = toPromptSkills(SKILLS);
    const total = Math.ceil(prompt.map((p) => p.text).join('\n\n').length / 4);
    expect(skillsLogLine(prompt)).toBe(`skills: loaded 2 (no-secrets@v3, naming@v1) · ~${total} tokens`);
    expect(skillsLogLine([])).toBe('skills: none');
  });
});

describe('ReviewRunExecutor — skills in the prompt (M2)', () => {
  const agent = {
    id: 'agent-1',
    name: 'security',
    provider: 'openai',
    model: 'gpt-4.1',
    systemPrompt: 'security reviewer',
    version: 1,
    repoIntel: false,
    strategy: 'single-pass',
    ciFailOn: 'CRITICAL',
  } as unknown as AgentRow;
  const pull = { id: 'pr-1', number: 7, title: 'Add config', body: null, headSha: 'abc', base: 'main', repoId: 'r1' } as unknown as PullRow;
  const repoRow = { id: 'r1', owner: 'acme', name: 'web' } as never;

  function setup(skills: AgentPromptSkill[], llmFails = false) {
    const llm = new MockLLMProvider('openai', {
      structured: { verdict: 'approve', summary: 'ok', score: 100, findings: [] },
    });
    if (llmFails) llm.completeStructured = async () => { throw new Error('boom'); };
    const inserted: { runId: string; rows: RunSkillRow[] }[] = [];
    const traces: RunTrace[] = [];
    const statuses: string[] = [];
    const repo = {
      listPromptSkillsForAgent: vi.fn(async () => skills),
      insertRunSkills: vi.fn(async (runId: string, rows: RunSkillRow[]) => {
        inserted.push({ runId, rows });
      }),
      insertReviewWithFindings: vi.fn(async () => ({ review: { id: 'rev-1' }, findings: [] })),
      markReviewed: vi.fn(async () => undefined),
      completeAgentRun: vi.fn(async (_id: string, v: { status: string }) => {
        statuses.push(v.status);
      }),
      saveRunTrace: vi.fn(async (_id: string, t: RunTrace) => {
        traces.push(t);
      }),
      getPrFiles: vi.fn(async () => []),
    } as unknown as ReviewRepository;
    const container = {
      runBus,
      git: new MockGitClient(),
      llm: async () => llm,
    } as unknown as Container;
    const exec = new ReviewRunExecutor(container, repo, {} as Container['agentsRepo']);
    return { exec, llm, repo, inserted, traces, statuses };
  }

  it('passes formatted skills to the engine, records run skills + trace fields', async () => {
    const { exec, llm, inserted, traces, statuses, repo } = setup(SKILLS);
    await exec.executeRuns('ws-1', pull, repoRow, [{ agent, runId: 'run-ok' }]);

    expect(repo.listPromptSkillsForAgent).toHaveBeenCalledWith('ws-1', 'agent-1');
    expect(statuses).toEqual(['done']);
    const call = llm.calls.find((c) => c.method === 'completeStructured');
    const user = (call!.req as { messages: { role: string; content: string }[] }).messages[1]!.content;
    expect(user).toContain(`## Skills / rules\n${formatSkillBlock(SKILLS[0]!)}\n\n${formatSkillBlock(SKILLS[1]!)}`);

    expect(inserted).toEqual([{ runId: 'run-ok', rows: runSkillRows(SKILLS) }]);
    const trace = traces[0]!;
    expect(trace.prompt_assembly.skills_used?.map((s) => `${s.name} v${s.version}`)).toEqual([
      'no-secrets v3',
      'naming v1',
    ]);
    expect(trace.prompt_assembly.skills_tokens).toBeGreaterThan(0);
    expect(trace.log.some((l) => l.msg.startsWith('skills: loaded 2 (no-secrets@v3, naming@v1)'))).toBe(true);
  });

  it('failed run still records the loaded skills; trace keeps skills null', async () => {
    const { exec, inserted, traces, statuses } = setup(SKILLS, true);
    await exec.executeRuns('ws-1', pull, repoRow, [{ agent, runId: 'run-fail' }]);
    expect(statuses).toEqual(['failed']);
    expect(inserted).toEqual([{ runId: 'run-fail', rows: runSkillRows(SKILLS) }]);
    expect(traces[0]!.prompt_assembly.skills).toBeNull();
  });

  it('no skills → no skills section, no rows, log says none', async () => {
    const { exec, llm, inserted, traces } = setup([]);
    await exec.executeRuns('ws-1', pull, repoRow, [{ agent, runId: 'run-none' }]);
    const call = llm.calls.find((c) => c.method === 'completeStructured');
    const user = (call!.req as { messages: { content: string }[] }).messages[1]!.content;
    expect(user).not.toContain('## Skills / rules');
    expect(inserted).toEqual([]);
    expect(traces[0]!.prompt_assembly.skills_used ?? null).toBeNull();
    expect(traces[0]!.log.some((l) => l.msg === 'skills: none')).toBe(true);
  });
});
