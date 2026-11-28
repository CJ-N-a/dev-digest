# M2 — Skills

## Goal
A skill is a reusable block of review instructions: name, description, type and a markdown body. A user creates or imports a skill once and attaches it to any number of agents. An enabled skill attached to an agent goes into that agent's review prompt as its own block, in the order the user set. A skill is text config only: it cannot run code, call tools or read files.

## Scope
1. **Skills screen** (`/skills`, master-detail like Agents). On the left, a list of skill cards. On the right, the selected skill with the tabs **Config · Preview · Evals · Stats · Versions**.
2. **Editor (Config).** Name, description, type, markdown body with line numbers, an "unsaved" badge and a token count. The description is the skill's interface and is written as a directive; the field hint says so.
3. **Preview.** The body rendered as markdown, "as the reviewing agent receives it".
4. **Versions.** Every save is a snapshot with a short note. Diff of any version against the current one, and a non-destructive Restore.
5. **Stats.** Used by, pull frequency, accept rate, findings (30d), the agents using the skill, findings by category.
6. **Attach to an agent.** "Skills" tab in the agent editor: attach, enable/disable, drag to reorder. The order sets the order of the skill blocks in the prompt.
7. **Import.** Upload a `.md` file or a `.zip` archive. The server extracts the skill core, the user sees a preview and saves only after confirming. Executable parts of the archive are never run or stored.
8. **Prompt + trace.** Enabled skill bodies go to `reviewer-core`. The run records which skills (and versions) it used. The trace shows the skills block and how many tokens it added.
9. **New agents + seed.** Test Quality Reviewer and API Contract Reviewer, each with its own skills. At least one skill comes in through Import.
10. **`pr-self-review`.** A Claude Code skill with `disable-model-invocation: true` that loads the frontend and backend dev skills.

### Out of scope
- **Evals tab and the "Run on evals" button.** The server has no eval module yet (the `eval_cases` / `eval_runs` tables exist, but there are no routes or runner). In M2 the tab shows an empty state ("Evals arrive in M3") and the button is disabled with a tooltip.
- The Evals / Stats / CI tabs and the Run Review button in the **agent** editor.
- Community skills (`CommunitySkill`), importing from a URL, extracting skills from a repo (`source='extracted'`). These badges are only displayed for seeded data.
- Sanitizing or LLM-scanning imported skills (trust is handled with a UI warning, see Import).
- Markdown syntax highlighting in the body editor beyond the line-number gutter (nice-to-have, see UI).

## Data model
The tables `skills`, `skill_versions` and `agent_skills` already exist. One migration through `pnpm db:generate`:

| Table | Change | Why |
|---|---|---|
| `agent_skills` | `+ enabled boolean not null default true` | Disabling a skill for an agent keeps its link and its place in the order. |
| `skills` | unique index `(workspace_id, name)` | Names are referenced in import, export bundles and the UI. |
| `skill_versions` | `+ message text not null default ''`, `+ name text`, `+ description text`, `+ type text` (nullable for old rows) | Versions tab: the note ("Added Tests dimension") and a full snapshot for Restore. |
| **new** `agent_run_skills` | `run_id → agent_runs (cascade)`, `skill_id → skills (set null)`, `skill_name text`, `skill_version int`, `order int`, `tokens int`; PK `(run_id, order)`; index `(skill_id)` | Stats (pull frequency, accept rate, findings by category) and the reproducibility of a run against the exact skill text. |

Semantics:
- `skills.enabled` is a global switch. When it is `false`, the skill goes into no agent's prompt.
- `agent_skills.enabled` is the per-agent switch. A skill goes into the prompt only when **both** flags are true.
- **Save = new version.** When `name`, `description`, `type` or `body` changes: `version += 1` and a `skill_versions` row with the full snapshot and `message`, in **one transaction** (the first `db.transaction` on the server, see server INSIGHTS). Toggling `enabled` does not create a version.
- **Restore vK** creates a new version `v(N+1)` with the content of vK and the note `Restored from vK`. History is never rewritten.
- Create = v1 with the note `Initial version` (or `Imported from <file>`).
- Deleting a skill cascades its links and versions. `agent_run_skills.skill_id` becomes null; the name and version stay in the run history.

## Stats definitions (all over the last 30 days, workspace-scoped)
- **Used by:** number of agents with an enabled link to the skill.
- **Pull frequency:** runs that included the skill ÷ all `done` runs of the agents currently linked to it. On cards: `71% pull`.
- **Accept rate:** `accepted ÷ (accepted + dismissed)` over the findings of runs that included the skill. `—` when there were no decisions.
- **Findings (30d):** number of findings from runs that included the skill.
- **Findings by category:** count per `findings.category` (donut + legend). Counts, not the `$` amounts from the design (see Decisions 3).
- This is attribution by presence: a finding counts for every skill that was in the prompt of its run. The Stats tab says so in a hint.
- Before the first runs with skills, all metrics are `—` and the donut is replaced by an empty state.

## Contract (`@devdigest/shared`: server copy first, then mirror to the client)
New file `contracts/skills.ts`. The existing `Skill`, `SkillType` and `SkillSource` are reused, not changed.

```ts
SkillInput        = { name: string(1..64, /^[a-z0-9][a-z0-9-]*$/), description: string(1..500),
                      type: SkillType, body: string(1..20_000), enabled?: boolean }
SkillPatch        = SkillInput.partial() & { change_note?: string(0..120) }
SkillSummary      = { agents_count: int, pull_rate: number|null, accept_rate: number|null }
SkillListItem     = Skill & { summary: SkillSummary }                    // left list cards
SkillStats        = SkillSummary & { findings_30d: int,
                      agents: { id, name }[], by_category: { category, count }[] }
SkillVersion      = { version: int, message: string, created_at: string, current: boolean }
SkillVersionFull  = SkillVersion & { name, description, type, body }      // nullable for old rows
AgentSkillItem    = { skill: Skill, order: int, enabled: boolean }        // agent Skills tab
SetAgentSkills    = { items: { skill_id: uuid, enabled: boolean }[] }     // index = order
ImportPreview     = { draft: SkillInput, source_files: string[], ignored_files: { path, reason }[],
                      warnings: string[], name_conflict: boolean }
```
Additive change in `contracts/trace.ts`: `PromptAssembly.skills_tokens: z.number().int().nullish()` and `skills_used: { name, version, tokens }[]` (nullish; old traces stay valid).

## API (server module `server/src/modules/skills/`: routes → service → repository, workspace-scoped)
| Method | Path | What it does |
|---|---|---|
| GET | `/skills` | `SkillListItem[]` (`?q=` filter by name/description) |
| GET | `/skills/:id` | `Skill` |
| POST | `/skills` | Create (`source='manual'`, v1) → 201; name taken → 409 `skill_name_taken` |
| PATCH | `/skills/:id` | `SkillPatch`; new version when the content changes |
| DELETE | `/skills/:id` | Delete → 204 |
| GET | `/skills/:id/stats` | `SkillStats` |
| GET | `/skills/:id/versions` | `SkillVersion[]`, newest first |
| GET | `/skills/:id/versions/:v` | `SkillVersionFull` (for Diff) |
| POST | `/skills/:id/versions/:v/restore` | Creates v(N+1) from vK → `Skill` |
| POST | `/skills/import/preview` | multipart `file` (.md / .zip) → `ImportPreview`; **writes nothing** |
| POST | `/skills/import` | `SkillInput` (the confirmed or edited draft) → created skill, `source='imported_url'` |

Agents module (extends what exists; the old `POST /agents/:id/skills` body stays compatible):
- `GET /agents/:id/skills` returns `AgentSkillItem[]`.
- `PUT /agents/:id/skills` takes `SetAgentSkills` and replaces the ordered set in one transaction.
- `GET /agents` adds `skills_count` (enabled links) for the label "N skills".

## Import
- Limits: file ≤ 1 MB, zip ≤ 5 MB packed, ≤ 200 entries, ≤ 10 MB unpacked (zip-bomb guard). Path traversal (`..`, absolute paths) rejects the whole archive.
- `.md`: optional YAML frontmatter (`name`, `description`, `type`) + body. Missing name → from the file name (kebab-case). Missing description → first paragraph + a warning.
- `.zip`: find `SKILL.md` (root or a single top folder). Its frontmatter and body become the draft. Other `.md` files are listed in `source_files` and **not** merged. Everything else (`scripts/`, `*.sh|py|js|ts`, binaries, `allowed-tools` in frontmatter) goes into `ignored_files` with a reason. Nothing from the archive is executed or written to disk; parsing is in memory.
- Library: `fflate` (pure JS). This is a new server dependency, added through pnpm.
- UI: `ImportSkillModal`. A drop zone, then a preview: an editable draft, a rendered Preview (same component as the Preview tab), the list of ignored files, and the warning: *"An imported skill is someone else's instructions inside your agent's prompt. Read the body before saving."* Save → `POST /skills/import` → opens the new skill.

## Prompt assembly + trace
- `run-executor.ts`: load the agent's skills with both flags on, ordered by `agent_skills.order`. Format each one:
  ```
  ### Skill: <name> (<type>)
  <description>

  <body>
  ```
  Pass them as `skills: string[]` to `reviewPullRequest`. After the run, write `agent_run_skills` rows (name, version, order, tokens), also for failed runs, so the history shows what was in the prompt.
- `reviewer-core` already puts the skills in the user message under `## Skills / rules`. The only core change is `skills_tokens` in the assembly (same estimator as the token count in the editor, `ceil(chars/4)`, shared from a single helper). Map-reduce: the skills go into every per-file call.
- Run log: `skills: loaded N (name@vK, …) · ~T tokens`, or `skills: none`.
- Trace drawer: the Skills section (already in `RunTraceDrawer/constants.ts`) shows the block, `+T tokens`, and the list `name vK`. A disabled skill does not appear at all.

## UI (client)

### `/skills` layout (mirrors `/agents/[id]`)
```
┌ Skills ─────── [+ Add Skill ▾] ┐┌ ✦ pr-quality-rubric [rubric] [v5]        [▷ Run on evals]┐
│ [Search skills…]               ││  Config  Preview  Evals  Stats  Versions                  │
│ ┌────────────────────────────┐ │├───────────────────────────────────────────────────────────┤
│ │✦ pr-quality-rubric     [●] │ ││ (tab content)                                             │
│ │Rubric for evaluating…      │ ││                                                           │
│ │[rubric] ✎ Manual           │ ││                                                           │
│ │3 agents · 71% pull · 74% ac│ ││                                                           │
│ └────────────────────────────┘ ││                                                           │
│ …                              ││                                                           │
└────────────────────────────────┘└───────────────────────────────────────────────────────────┘
```
- Routes: `src/app/skills/page.tsx` (list + empty state "Select a skill" or redirect to the first one) and `src/app/skills/[id]/page.tsx` with `?tab=config|preview|evals|stats|versions`. Breadcrumb: Skills Lab › Skills. The nav already handles `/skills`.
- **SkillCard**: type icon, mono name, `enabled` toggle (PATCH, optimistic), description (1 line, ellipsis), type pill + source badge (Manual / Extracted / Community / Imported), footer `N agents · X% pull · Y% accept` (accept in green ≥ 70%, amber ≥ 50%, otherwise red, like AgentCard). A disabled skill is dimmed.
- **Add Skill ▾**: *Create* → `/skills/new` (the Config tab with an empty form; the other tabs are disabled until the first save). *Import* → `ImportSkillModal`.
- **Header**: name (mono), type pill, `vN` badge, "Run on evals" (disabled in M2).

### Tabs
- **Config** (`ConfigTab`): "Configuration" + `vN` badge, Enabled toggle; Name*, Description (hint: "Write it as a directive: when it applies and what the agent must do"), Type (select), Skill body*. The editor is `SkillBodyEditor`: header `<name>.md` · `unsaved` badge (dirty state) · `N tokens`, line-number gutter, mono textarea. Below: optional "Change note" + **Save skill** / Cancel. Leaving with unsaved changes asks for confirmation.
- **Preview** (`PreviewTab`): "Rendered as the reviewing agent receives it." Shows the body through `Markdown` from `@devdigest/ui`. It previews the saved version; with unsaved changes it shows the draft and an "unsaved draft" label.
- **Evals** (`EvalsTab`): empty state, out of scope.
- **Stats** (`StatsTab`): 4 stat cards (Used by · Pull frequency · Accept rate with a ring · Findings 30d), "Agents using this skill" (row + "Open" → `/agents/:id?tab=skills`), "Findings by category" (donut + legend with counts; colors from the severity/category tokens of `@devdigest/ui`, built with SVG, no chart library).
- **Versions** (`VersionsTab`): "Version history" + "N versions" badge, subtitle "Every save snapshots the body so eval runs stay reproducible against the exact text they scored." Rows: `vK` badge, message, date; the current one has a "Current" badge, the others have **Diff** and **Restore** (confirm). Diff opens `VersionDiffModal`: line diff of vK → current (body, plus name/description/type when they differ) computed in the client with `diff` (jsdiff, new client dependency) and rendered in the style of the existing diff-viewer.

### Agent editor → Skills tab (earlier design)
Add `{ key: "skills" }` to `AgentEditor/constants.ts` and `VALID_TABS` in `agents/[id]/page.tsx`. `SkillsTab`: "N of M enabled" badge, filter, a row per workspace skill (drag handle, checkbox, mono name, type pill). Reorder by drag (pointer and keyboard ↑/↓). Unlinked skills are listed after the linked ones. Saves through `PUT /agents/:id/skills`, optimistically, with rollback.

### Files
```
src/app/skills/page.tsx, [id]/page.tsx, new/page.tsx
src/app/skills/_components/  SkillsListView, SkillCard, ImportSkillModal
src/app/skills/[id]/_components/SkillEditor/
  _components/ ConfigTab (+ SkillBodyEditor), PreviewTab, EvalsTab, StatsTab (+ CategoryDonut),
               VersionsTab (+ VersionDiffModal)
src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab
src/lib/hooks/skills.ts   useSkills, useSkill, useCreateSkill, useUpdateSkill, useDeleteSkill,
                          useSkillStats, useSkillVersions, useSkillVersion, useRestoreSkillVersion,
                          useImportPreview, useImportSkill
src/lib/hooks/agents.ts   + useAgentSkills, useSetAgentSkills
messages/en/skills.json   + agents.json (editor.tabs.skills, skillsTab.*)
```
Invalidate on save/restore: `skills`, `skill`, `skill-versions`. When links change: `agents`, `skills`.

## Seed (`server/src/db/seed.ts`, idempotent)
- Agents: **Test Quality Reviewer** (uncovered branches, missing corner cases, over-mocking, flaky tests) and **API Contract Reviewer** (breaking changes in route signatures and schemas, status codes, removed fields). Prompts in `seed-prompts.ts` + `docs/agent-prompts/*.md`, following `docs/agent-prompts/README.md`.
- Skills from the design: `pr-quality-rubric` (5 versions with notes, like the Versions mock), `no-then-chains` (extracted), `secret-leakage-gate`, `lethal-trifecta` (community), `phantom-api-gate` (imported, disabled), `test-coverage-nudge`. Plus `branch-coverage-gate`, `corner-case-checklist`, `mocking-discipline` → Test Quality; `route-signature-diff`, `schema-compat-rules` → API Contract.
- One skill per new agent is **not** seeded: it is a file in `docs/skills-import/` (`.md` + `.zip` with a `scripts/` folder to show it is ignored) and goes through Import by hand.
- The seed creates no runs, so Stats are empty after the seed (see server INSIGHTS). Real numbers appear after the control experiment.

## `pr-self-review` (dev tooling, not a product skill)
`.claude/skills/pr-self-review/SKILL.md` with frontmatter `disable-model-invocation: true`. When invoked as `/pr-self-review`, it reads the branch diff and loads the frontend skills (`frontend-ui-architecture`, `react-best-practices`, `next-best-practices`, `react-testing-library`) and the backend ones (`onion-architecture`, `fastify-best-practices`, `drizzle-orm-patterns`, `zod`) depending on which packages changed, and gives a checklist review. Register it in `.claude/skills/README.md`.

## Control experiment (manual, recorded for the video)
1. **Test Quality:** a PR with a branching function and a test only for the happy path. Without skills → the gap is missed. With skills → the uncovered branch and the boundary case are flagged.
2. **API Contract:** a PR that changes a route's params or response. Without skills → missed. With skills → breaking change.
3. In the trace → prompt assembly, the with-skills run shows the skills block, `name vK` and `+T tokens`; the run without has none. Then the skill's Stats tab shows non-empty pull/accept numbers.
The PRs live in a separate demo repo on GitHub, with sources and patches in `docs/experiments/m2-skills/` (Decisions 12). The results are written in `docs/experiments/m2-skills/RESULTS.md`.

## Tests
- Server unit: import parser (md frontmatter, zip with `SKILL.md`, scripts ignored, traversal/zip-bomb rejected), skill formatting, filtering by the two flags, stats formulas (pull/accept with zero denominators).
- Server `*.it.test.ts`: CRUD + workspace scoping; save → version + snapshot in a transaction; `enabled` toggle without a version; restore → v(N+1); `PUT /agents/:id/skills`; delete cascade with `agent_run_skills` kept; `/stats` on fixture runs.
- reviewer-core: `skills_tokens` filled when there are skills and absent when there are none; order kept.
- Client (vitest + RTL): SkillCard (toggle, stats line, dimmed state), ConfigTab (dirty → `unsaved`, token count, validation, change note in the PATCH), PreviewTab, VersionsTab (Current badge, Restore confirm → request), VersionDiffModal, StatsTab empty and filled, ImportSkillModal, agent SkillsTab (toggle and reorder → correct `PUT` payload).

## Acceptance criteria
1. On `/skills`, a skill can be created, edited, disabled and deleted. Every content save adds a version with a note.
2. Preview renders the body. Versions shows the history; Diff shows the changes; Restore creates a new version and does not remove history.
3. Stats shows used by / pull / accept / findings / agents / categories from real runs, and `—` / an empty state without data.
4. The import of `.md` and `.zip` shows a preview and the ignored files. Nothing is saved without "Save". No file from the archive is executed.
5. The agent's Skills tab attaches, enables/disables and reorders skills; the state survives a reload.
6. A skill enabled at both levels appears in the run's prompt as its own block, in order. A disabled one does not appear. The trace shows the block, the versions and `skills_tokens`.
7. Test Quality Reviewer and API Contract Reviewer exist with linked skills; at least one of them came in through Import.
8. The control experiment reproduces on both agents.
9. `/pr-self-review` is not auto-invoked; invoked by hand, it loads both frontend and backend skills.
10. typecheck + tests pass in server, reviewer-core and client; `pnpm arch:check` is green.

## Implementation order
1. Shared contracts (server) → typecheck server + reviewer-core → mirror to the client.
2. Migration → `skills` module: CRUD + versions + restore → agents endpoints `GET`/`PUT` skills, `skills_count`.
3. Run executor: skills in the prompt + `agent_run_skills` + `skills_tokens` in reviewer-core → `/skills/:id/stats`.
4. Import (parser + preview/import routes).
5. Client: hooks → `/skills` layout + SkillCard → Config → Preview → Versions/Diff → Stats → Import modal → agent SkillsTab → trace badge.
6. Seed: skills, versions, new agents, import fixtures. Then `pr-self-review`.
7. Demo repo sources + patches in `docs/experiments/m2-skills/` → (user) push to GitHub, open 2 PRs → control experiment → `RESULTS.md`.

## Decisions (closed questions)
1. **Checkbox in the agent's Skills tab** = a separate `agent_skills.enabled` flag (migration), so a disabled skill keeps its place in the order.
2. **Global `skills.enabled`** turns the skill off for every agent.
3. **Findings by category** shows **counts**. The `$` in the design is a mock artifact: findings have no cost, and per-run cost is not stored (server INSIGHTS, migration 0009).
4. **Pull frequency** = the share of the linked agents' `done` runs that included the skill. There is no selection of skills by description in M2: every enabled link always goes into the prompt, and the description is shown to the model as the first line of the block.
5. **Evals tab / Run on evals**: empty state + disabled button. The server has no eval module (server INSIGHTS).
6. **Change note**: an optional field next to Save. When it is empty, it is generated from what changed (`Edited body`, `Renamed`, `Changed type`, …).
7. **Restore** brings back the full snapshot (name, description, type, body). If the old name is taken by another skill → 409 and the restore is refused.
8. **Version history UI**: yes (Versions tab, as in the design).
9. **Zip import**: only `SKILL.md` becomes the body. Other `.md` files are only listed, so the body stays self-contained and its size is predictable.
10. **Source of imported skills**: the existing `imported_url` value, shown as "Imported". The shared enum is not reshaped (AGENTS.md rule).
11. **Token count**: estimated with `ceil(chars/4)` from one shared helper, used both in the editor and in `skills_tokens`. No tokenizer dependency.
12. **Experiment PRs**: DevDigest imports only GitHub repos (`POST /repos` → clone `owner/name`), so the PRs live in a **separate small demo repo on GitHub**. Its sources and the two patches (happy-path-only test; route signature change) are kept in `docs/experiments/m2-skills/` with a README that says how to push them and open the PRs. Creating the GitHub repo and pushing is done by the user.
13. **Body format in the prompt**: the `### Skill: <name> (<type>)` block in the user message under `## Skills / rules` (the existing reviewer-core path). The design caption "Skills are appended below it" (the system prompt) is a simplification and the prompt is not moved.
