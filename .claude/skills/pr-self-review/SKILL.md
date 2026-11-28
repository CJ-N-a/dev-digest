---
name: pr-self-review
description: Self-review the current branch before opening a PR — reads the diff against main, loads the frontend and/or backend dev skills for the packages it touches, and returns a checklist review. Run only when the user types /pr-self-review.
disable-model-invocation: true
argument-hint: "[base branch, default main]"
---

# PR self-review

Review the current branch the way a reviewer of this repo would, using the
project's own dev skills as the checklist. Read-only: do not edit, commit or push.

## 1. Get the diff
Base = the argument if given, otherwise `main`.

```sh
git fetch origin <base> --quiet || true          # ok to fail offline
git merge-base HEAD origin/<base> || git merge-base HEAD <base>
git diff --stat <merge-base>...HEAD
git diff <merge-base>...HEAD
git status --short                               # uncommitted work is reviewed too
```
Include uncommitted changes (`git diff HEAD`) and say so in the report. If the diff
is empty, say "nothing to review" and stop.

## 2. Detect changed packages
Group changed paths by their first segment:

| Path prefix | Package | Skill set |
|---|---|---|
| `client/` | web app | frontend |
| `server/` | API | backend |
| `reviewer-core/` | review engine | backend |
| `e2e/`, `docs/`, `specs/`, `.github/`, root files | other | none (review with general judgement) |

## 3. Load the skills
Invoke each skill with the Skill tool (do not paraphrase from memory):

- **frontend** (any `client/` change): `frontend-ui-architecture`,
  `react-best-practices`, `next-best-practices`, `react-testing-library`.
- **backend** (any `server/` or `reviewer-core/` change): `onion-architecture`,
  `fastify-best-practices`, `drizzle-orm-patterns`, `zod`.

Load both sets when both kinds of package changed. Also read the `AGENTS.md` and
the insights file of every changed package — their rules are part of the checklist.

**Start the report by stating what was loaded**, e.g.:
> Changed packages: client, server. Loaded skills: frontend-ui-architecture,
> react-best-practices, next-best-practices, react-testing-library,
> onion-architecture, fastify-best-practices, drizzle-orm-patterns, zod.

## 4. Review
Check every changed hunk against the loaded skills and the package rules. Cover at
least:

- **Correctness** — branches, null/empty inputs, awaited promises, error paths.
- **Structure** — the file is in the right place/ring; imports respect the rings
  and the cross-package alias rule (no `../` into another package).
- **Contracts** — a change in `server/src/vendor/shared` is mirrored into
  `client/src/vendor/shared` where the client uses it; nothing existing reshaped.
- **Data** — new migrations generated with `pnpm db:generate`, not hand-edited;
  multi-step writes in a transaction; queries scoped by `workspaceId`.
- **Tests** — new branches have tests; DB tests are `*.it.test.ts`.
- **Hygiene** — no secrets, no edited `.env`, no hand-edited lockfiles.

Report only issues in this diff. Do not invent problems to fill the list.

## 5. Output
```
## PR self-review — <branch> vs <base>
Changed packages: …   Loaded skills: …

### <package>
- [x] <check that passed> — short evidence
- [ ] <check that failed> — `path:line` — what is wrong → how to fix  (blocker | should-fix | nit)

### Commands to run before opening the PR
- `cd server && pnpm typecheck && pnpm exec vitest run --exclude '**/*.it.test.ts'`  (only for changed packages)
- …

Verdict: ready | fix blockers first
```
