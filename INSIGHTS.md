# Insights — cross-package

Non-obvious findings for agents working in more than one package, written via the `engineering-insights` skill.
Entries are hints to verify, not rules: if the code disagrees, the code wins — add a `contradicted` comment.
Add only: new entries go last in their section; comments go as indented sub-bullets under the entry they refer to.
Format: `` - YYYY-MM-DD · <insight> — <why>. Evidence: `path` (`symbol`) `` — no line numbers.
Hygiene: monthly `/engineering-insights review` (logged under Review log); split into `INSIGHTS-<domain>.md` past ~100 entries.

## Patterns

## Mistakes
- 2026-11-23 · Drop `2>/dev/null` and other redirects from read-only Bash commands that mention an INSIGHTS file — protect-insights.py treats any `>` as a write and blocks the whole command; split the command instead. Evidence: `.claude/hooks/protect-insights.py` (Bash regex)
  - 2026-11-28 · extended: the hook also blocks heredocs / `>` that write OTHER files when the command text merely mentions INSIGHTS.md — write such files with Write/Edit or split the command. Evidence: `.claude/hooks/protect-insights.py`

## Decisions

## Context
- 2026-11-23 · Hooks added to `.claude/settings.json` mid-session take effect immediately in that session — protect-insights.py blocked an Edit right after the file was created, no restart needed. Evidence: `.claude/settings.json` (PreToolUse)
- 2026-11-28 · `e2e-web.yml` already runs `pnpm build` for the client on every `client/**` or `server/**` change, so `client.yml` (typecheck + test only) does not need its own build step. Evidence: `.github/workflows/e2e-web.yml` (Web build step), `.github/workflows/client.yml`
- 2026-11-28 · Skills plumbing half-exists before M2: tables `skills`/`skill_versions`/`agent_skills` and `/agents/:id/skills` endpoints exist, and reviewer-core `assemblePrompt` already puts `skills` into the USER message under `## Skills / rules` (not the system message) — but run-executor never passes `skills` to `reviewPullRequest` and `traceFromBuffer` writes `skills: null`; wire the existing path instead of building a new one. Evidence: `reviewer-core/src/prompt.ts` (`assemblePrompt`), `server/src/modules/reviews/run-executor.ts` (`reviewPullRequest` call), `server/src/modules/agents/repository.ts` (`setSkills`)

## Open Questions

## Review log
