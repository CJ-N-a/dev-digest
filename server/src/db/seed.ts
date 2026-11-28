import 'dotenv/config';
import { createDb, type Db } from './client.js';
import * as t from './schema.js';
import { eq, and } from 'drizzle-orm';
import {
  GENERAL_REVIEWER_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  PERFORMANCE_REVIEWER_PROMPT,
  TEST_QUALITY_REVIEWER_PROMPT,
  API_CONTRACT_REVIEWER_PROMPT,
  PR_QUALITY_RUBRIC_VERSIONS,
  SKILL_BODIES,
} from './seed-prompts.js';

/** Default provider/model for the built-in reviewer agents. */
const DEFAULT_PROVIDER = 'openrouter' as const;
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

/**
 * Seed the starter's demo data. Idempotent: re-running upserts the default
 * workspace/user and the demo fixtures.
 *
 * Seeds: default workspace + system user + membership, default settings,
 * demo repo (acme/payments-api), PR #482 with files/commits, a sample review
 * with a few findings, the five built-in agents (General, Security, Performance,
 * Test Quality, API Contract) on the default openrouter/deepseek-v4-flash
 * provider+model, and the M2 skills with their versions and agent links.
 *
 * Skills are looked up by (workspace, name) and links by (agent, skill), so a
 * re-run never duplicates rows or overwrites a user's edits. The seed creates no
 * runs, so skill Stats stay empty until the first real review.
 *
 * Later milestones populate the other tables (conventions, memory, eval, …) once
 * their features are built — they start empty here.
 */

export const DEFAULT_WORKSPACE_NAME = 'default';
export const SYSTEM_USER_EMAIL = 'you@local';

export async function seed(db: Db): Promise<{ workspaceId: string; userId: string }> {
  // ---- workspace + user (no-auth defaults) ----
  let [ws] = await db
    .select()
    .from(t.workspaces)
    .where(eq(t.workspaces.name, DEFAULT_WORKSPACE_NAME));
  if (!ws) {
    [ws] = await db
      .insert(t.workspaces)
      .values({ name: DEFAULT_WORKSPACE_NAME })
      .returning();
  }
  const workspaceId = ws!.id;

  let [user] = await db.select().from(t.users).where(eq(t.users.email, SYSTEM_USER_EMAIL));
  if (!user) {
    [user] = await db
      .insert(t.users)
      .values({ email: SYSTEM_USER_EMAIL, name: 'You' })
      .returning();
  }
  const userId = user!.id;

  await db
    .insert(t.workspaceMembers)
    .values({ workspaceId, userId, role: 'owner' })
    .onConflictDoNothing();

  // ---- default settings ----
  const defaultSettings: Record<string, unknown> = {
    polling_interval_min: 5,
    theme: 'dark',
    density: 'regular',
    sync_to_folder: true,
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db
      .insert(t.settings)
      .values({ workspaceId, userId, key, value })
      .onConflictDoNothing();
  }

  // ---- demo repo (acme/payments-api) ----
  let [repo] = await db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, 'acme/payments-api')));
  if (!repo) {
    [repo] = await db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name: 'payments-api',
        fullName: 'acme/payments-api',
        defaultBranch: 'main',
        clonePath: null,
        createdBy: userId,
      })
      .returning();
  }
  const repoId = repo!.id;

  // ---- PR #482 (rate limiting) ----
  let [pr] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 482)));
  if (!pr) {
    [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 482,
        title: 'Add rate limiting to public API endpoints',
        author: 'marisa.koch',
        branch: 'feat/rate-limit-public',
        base: 'main',
        headSha: 'a1b2c3d4e5f6',
        additions: 247,
        deletions: 38,
        filesCount: 9,
        status: 'needs_review',
        body: 'Add rate limiting to public API endpoints to prevent abuse from unauthenticated clients.',
      })
      .returning();

    // pr_files (subset)
    await db.insert(t.prFiles).values([
      { prId: pr!.id, path: 'src/middleware/ratelimit.ts', additions: 84, deletions: 0 },
      { prId: pr!.id, path: 'src/api/public/webhooks.ts', additions: 31, deletions: 6 },
      { prId: pr!.id, path: 'src/config.ts', additions: 4, deletions: 0 },
      { prId: pr!.id, path: 'src/api/users.ts', additions: 7, deletions: 2 },
    ]);

    // pr_commits
    await db.insert(t.prCommits).values({
      prId: pr!.id,
      sha: 'a1b2c3d4e5f6',
      message: 'Add token-bucket rate limiter',
      author: 'marisa.koch',
    });

    // a sample review + findings so the PR shows results before the first run
    const [review] = await db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        kind: 'review',
        verdict: 'request_changes',
        summary:
          'Solid middleware approach, but a Stripe secret key is committed in plaintext and the user-list endpoint introduces an N+1 query under the new limiter.',
        score: 61,
        model: 'seed',
      })
      .returning();

    await db.insert(t.findings).values([
      {
        reviewId: review!.id,
        file: 'src/config.ts',
        startLine: 12,
        endLine: 12,
        severity: 'CRITICAL',
        category: 'security',
        title: 'Hardcoded Stripe secret key in commit',
        rationale: 'Line 12 contains a literal `sk_live_` Stripe secret key.',
        suggestion: 'Move to env var and rotate the key immediately.',
        confidence: 0.98,
      },
      {
        reviewId: review!.id,
        file: 'src/api/users.ts',
        startLine: 45,
        endLine: 52,
        severity: 'WARNING',
        category: 'perf',
        title: 'N+1 query in user list endpoint',
        rationale: 'Loop issues one query per user → N+1.',
        suggestion: 'Use a single IN query and group in memory.',
        confidence: 0.86,
      },
    ]);
  }

  // ---- built-in agents (the three starter presets) ----
  // Prompt bodies live in ./seed-prompts.ts (mirrored in docs/agent-prompts/*.md).
  const seedAgents: Array<typeof t.agents.$inferInsert> = [
    {
      workspaceId,
      name: 'General Reviewer',
      description: 'Reviews a PR diff for bugs, correctness, and clarity.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: GENERAL_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Security Reviewer',
      description: 'Flags secrets, injection, SSRF and the lethal trifecta before merge.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: SECURITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Performance Reviewer',
      description: 'Catches N+1 queries, missing indexes, and hot-path allocations.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: PERFORMANCE_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Test Quality Reviewer',
      description: 'Flags uncovered branches, missing corner cases, over-mocking and flaky tests.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: TEST_QUALITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'API Contract Reviewer',
      description: 'Catches breaking changes in route signatures, schemas, status codes and response fields.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: API_CONTRACT_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
  ];
  for (const a of seedAgents) {
    const [existing] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, a.name)));
    if (!existing) await db.insert(t.agents).values(a);
  }

  await seedSkills(db, workspaceId);

  return { workspaceId, userId };
}

// ---- skills (M2) ----

type SkillRow = typeof t.skills.$inferInsert;
type SeedSkill = Omit<SkillRow, 'workspaceId' | 'version'> & {
  /** Snapshots oldest first; the last one is the current body. Default: one "Initial version". */
  versions?: Array<{ body: string; message: string; description?: string }>;
};

const RUBRIC_MESSAGES = [
  'Initial rubric',
  'Added Security dimension',
  'Reworded Correctness checks',
  'Added Tests dimension',
  'Tightened scope rule; cap at 5 high-signal findings',
] as const;
const RUBRIC_DESCRIPTION =
  'Apply to every PR review: report a finding only when the change fails a Correctness, Security, Tests or Scope check, and keep the review to the few issues a senior reviewer would raise.';
// v1 had only Correctness + Scope; the description grew with the rubric.
const RUBRIC_DESCRIPTIONS = [
  'Apply to every PR review: report a finding only when the change fails a Correctness or Scope check.',
  'Apply to every PR review: report a finding only when the change fails a Correctness, Security or Scope check.',
  'Apply to every PR review: report a finding only when the change fails a Correctness, Security or Scope check.',
  RUBRIC_DESCRIPTION,
  RUBRIC_DESCRIPTION,
] as const;

const SEED_SKILLS: SeedSkill[] = [
  {
    name: 'pr-quality-rubric',
    description: RUBRIC_DESCRIPTION,
    type: 'rubric',
    source: 'manual',
    body: PR_QUALITY_RUBRIC_VERSIONS[PR_QUALITY_RUBRIC_VERSIONS.length - 1]!,
    versions: PR_QUALITY_RUBRIC_VERSIONS.map((body, i) => ({
      body,
      message: RUBRIC_MESSAGES[i]!,
      description: RUBRIC_DESCRIPTIONS[i]!,
    })),
  },
  {
    name: 'no-then-chains',
    description:
      'When the diff adds asynchronous code, flag new .then()/.catch() promise chains and require async/await with try/catch instead.',
    type: 'convention',
    source: 'extracted',
    body: SKILL_BODIES['no-then-chains'],
    evidenceFiles: ['src/api/public/webhooks.ts', 'src/services/refunds.ts', 'src/jobs/payout-sync.ts'],
  },
  {
    name: 'secret-leakage-gate',
    description:
      'When the diff adds literals, config, logging or fixtures, block any real credential committed to code and flag secrets written to logs, errors or responses.',
    type: 'security',
    source: 'community',
    body: SKILL_BODIES['secret-leakage-gate'],
  },
  {
    name: 'lethal-trifecta',
    description:
      'When the diff touches an LLM or agent flow, report a lethal trifecta only if untrusted input, private-data access and an exfiltration path meet in one flow, each with a file:line.',
    type: 'security',
    source: 'community',
    body: SKILL_BODIES['lethal-trifecta'],
  },
  {
    name: 'phantom-api-gate',
    description:
      'When the diff adds imports or third-party calls, flag packages, methods or endpoints that do not exist according to the dependencies and code shown.',
    type: 'security',
    source: 'imported_url',
    enabled: false,
    body: SKILL_BODIES['phantom-api-gate'],
  },
  {
    name: 'test-coverage-nudge',
    description:
      'When the diff adds branching behaviour without a test, leave one SUGGESTION per untested unit naming the test to write; never block on it.',
    type: 'custom',
    source: 'manual',
    body: SKILL_BODIES['test-coverage-nudge'],
  },
  {
    name: 'branch-coverage-gate',
    description:
      'When the diff changes logic, list every new branch and report each one that no test executes and asserts, citing the branch line and an input that reaches it.',
    type: 'rubric',
    source: 'manual',
    body: SKILL_BODIES['branch-coverage-gate'],
  },
  {
    name: 'corner-case-checklist',
    description:
      'When the diff adds a comparison or reads an input, check boundaries, empty values, size and time edges, and report each case neither handled nor tested.',
    type: 'rubric',
    source: 'manual',
    body: SKILL_BODIES['corner-case-checklist'],
  },
  {
    name: 'mocking-discipline',
    description:
      'When the diff adds or changes tests, flag mocks of the unit under test, assertions only on mocks, mocked DB/HTTP in contract tests and mocks that leak between tests.',
    type: 'convention',
    source: 'manual',
    body: SKILL_BODIES['mocking-discipline'],
  },
  {
    name: 'route-signature-diff',
    description:
      'When the diff touches an HTTP route, compare method, path, params, body, response and status codes before and after, and report each element an existing client can no longer use.',
    type: 'rubric',
    source: 'manual',
    body: SKILL_BODIES['route-signature-diff'],
  },
  {
    name: 'schema-compat-rules',
    description:
      'When the diff changes a Zod contract or route schema, classify each change as compatible or breaking for input and output, and report the breaking ones.',
    type: 'convention',
    source: 'manual',
    body: SKILL_BODIES['schema-compat-rules'],
  },
];

/** Ordered skill links per agent; `enabled: false` keeps the link but off. */
const SEED_AGENT_SKILLS: Record<string, Array<{ skill: string; enabled?: boolean }>> = {
  'Security Reviewer': [
    { skill: 'pr-quality-rubric' },
    { skill: 'secret-leakage-gate' },
    { skill: 'lethal-trifecta' },
    { skill: 'phantom-api-gate', enabled: false },
  ],
  'Performance Reviewer': [{ skill: 'pr-quality-rubric' }, { skill: 'no-then-chains' }],
  'Test Quality Reviewer': [
    { skill: 'branch-coverage-gate' },
    { skill: 'corner-case-checklist' },
    { skill: 'mocking-discipline' },
    { skill: 'test-coverage-nudge' },
  ],
  'API Contract Reviewer': [
    { skill: 'route-signature-diff' },
    { skill: 'schema-compat-rules' },
    { skill: 'pr-quality-rubric' },
  ],
};

async function seedSkills(db: Db, workspaceId: string): Promise<void> {
  const skillIds = new Map<string, string>();

  for (const { versions: history, ...s } of SEED_SKILLS) {
    const versions = history ?? [{ body: s.body, message: 'Initial version' }];
    // Insert-if-missing, then look up: never overwrites a skill the user edited.
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(t.skills)
        .values({ ...s, workspaceId, version: versions.length })
        .onConflictDoNothing({ target: [t.skills.workspaceId, t.skills.name] })
        .returning({ id: t.skills.id });
      if (!created) return;
      await tx.insert(t.skillVersions).values(
        versions.map((v, i) => ({
          skillId: created.id,
          version: i + 1,
          body: v.body,
          message: v.message,
          name: s.name,
          description: v.description ?? s.description,
          type: s.type,
        })),
      );
    });
    const [row] = await db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, s.name)));
    skillIds.set(s.name, row!.id);
  }

  for (const [agentName, links] of Object.entries(SEED_AGENT_SKILLS)) {
    const [agent] = await db
      .select({ id: t.agents.id })
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, agentName)));
    if (!agent) continue;
    await db
      .insert(t.agentSkills)
      .values(
        links.map((l, order) => ({
          agentId: agent.id,
          skillId: skillIds.get(l.skill)!,
          order,
          enabled: l.enabled ?? true,
        })),
      )
      .onConflictDoNothing();
  }
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const handle = createDb(url);
  seed(handle.db)
    .then(async (r) => {
      console.log('✓ seeded', r);
      await handle.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('✗ seed failed:', err);
      await handle.close();
      process.exit(1);
    });
}
