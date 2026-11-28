# M2 control experiment — do skills change what an agent finds?

Two small PRs against a tiny "orders" service, each reviewed by the matching agent
twice: once **without** its skills and once **with** them. See
`specs/M2-skills.md`, "Control experiment" and Decisions 12.

| PR | Patch | Agent | What a good review flags |
|---|---|---|---|
| 1 | `01-happy-path-only.patch` | Test Quality Reviewer | `discountCents` has 5 branches + a `>=` boundary; the only test is gold tier at 5 000. Uncovered: the bulk branch at exactly `10_000` (and `9_999`), the `WELCOME10` coupon and its `1_000` cap, the `subtotalCents <= 0` early return, the `Math.min(discount, subtotal)` clamp. |
| 2 | `02-route-signature-change.patch` | API Contract Reviewer | `GET /orders/1` now returns 400 (`:orderId` must match `ord_[0-9]+`); `customerId` and `totalCents` removed from the response (moved into `customer` / `amount`); 404 `error.code` changed `order_not_found` → `not_found`. The tests were updated, so they pass and hide the break. |

## Files
```
demo/                          base project (Fastify 5 + vitest, no DB)
01-happy-path-only.patch       branch feat/discounts
02-route-signature-change.patch branch feat/order-amount
RESULTS.md                     fill in after the runs
```
Both patches are made against `demo/` as is and apply independently
(`git apply --check` verified).

## 1. Create the demo repo on GitHub
Needs `git` and the GitHub CLI (`gh auth login`), or create the repo in the web UI.

```sh
cp -R docs/experiments/m2-skills/demo ~/devdigest-skills-demo
cd ~/devdigest-skills-demo
git init -b main
npm install && npm test          # 2 tests pass on base (optional check)
git add -A && git commit -m "Orders service base"
gh repo create devdigest-skills-demo --public --source . --push
#   or: create an empty repo on github.com, then
#   git remote add origin git@github.com:<you>/devdigest-skills-demo.git && git push -u origin main
```
`package-lock.json` is created by `npm install`; committing it is fine. A private
repo works too if the DevDigest `GITHUB_TOKEN` can read it.

## 2. Create the two branches and open the PRs
Run from the demo repo; `$DD` is the path to the DevDigest checkout.

```sh
DD=~/path/to/dev-digest/docs/experiments/m2-skills

git checkout -b feat/discounts main
git apply "$DD/01-happy-path-only.patch"
npm test                                  # 3 tests pass — the gap is not visible to CI
git add -A && git commit -m "feat: tiered, bulk and coupon discounts"
git push -u origin feat/discounts
gh pr create --base main --title "Add tiered, bulk and coupon discounts" \
  --body "Gold customers get 10% off, bulk orders 5% more, WELCOME10 coupon. Tested."

git checkout -b feat/order-amount main
git apply "$DD/02-route-signature-change.patch"
npm test                                  # 2 tests pass — the test was updated with the break
git add -A && git commit -m "feat: group order amount and customer in the response"
git push -u origin feat/order-amount
gh pr create --base main --title "Group order amount and customer in the order response" \
  --body "Cleaner response shape: amount and customer are now nested objects."
```
Keep the PR descriptions neutral — do not mention coverage or breaking changes, or
the description itself tells the agent what to find.

## 3. Import into DevDigest
1. `./scripts/dev.sh` (seed included). The seed creates **Test Quality Reviewer**
   and **API Contract Reviewer** with their skills linked. A real run needs
   `OPENROUTER_API_KEY` (seeded agents use `openrouter / deepseek/deepseek-v4-flash`).
2. Optional but part of the demo: `/skills` → **Add Skill ▾ → Import** →
   `docs/skills-import/flaky-test-detector.md` (attach to Test Quality) and
   `docs/skills-import/openapi-breaking-change.zip` (attach to API Contract). See
   `docs/skills-import/README.md`.
3. Add the repo: onboarding / **Add repository** → `<you>/devdigest-skills-demo`.
   Wait for the PRs to sync (or refresh the PR list).

## 4. Run each agent without and with skills
Use the same model for every run and change nothing but the skill links.

**Without skills** — `/agents` → the agent → **Skills** tab → uncheck every skill
(the links and order stay). Open the PR → **Run Review** with that agent only.

**With skills** — re-check the skills (same tab) → run the same agent on the same
PR again.

| Run | PR | Agent | Skills |
|---|---|---|---|
| A0 | #1 discounts | Test Quality Reviewer | none |
| A1 | #1 discounts | Test Quality Reviewer | branch-coverage-gate, corner-case-checklist, mocking-discipline, test-coverage-nudge (+ flaky-test-detector if imported) |
| B0 | #2 order-amount | API Contract Reviewer | none |
| B1 | #2 order-amount | API Contract Reviewer | route-signature-diff, schema-compat-rules, pr-quality-rubric (+ openapi-breaking-change if imported) |

LLM output varies: run each configuration 2–3 times and record every run, not the
best one. Both agents' system prompts are deliberately slim (role, scope and
output rules only); every checklist lives in their skills, so the without-skills
run is a clean baseline. Look at coverage and precision as well as "found / not
found": the exact boundary value, the coupon cap, the error-code change, the 400
for old ids. Optionally also run **General Reviewer** (no skills) on each PR.

## 5. What to look for in the trace
Open the run → **Open run trace & logs**.

- **Live log:** `skills: loaded N (name@vK, …) · ~T tokens` for a with-skills run,
  `skills: none` without.
- **Prompt assembly → Skills (dynamic):** the with-skills run shows one
  `### Skill: <name> (<type>)` block per enabled skill, in the Skills-tab order,
  with `+T tokens` and the list `name vK` (`pr-quality-rubric v5`). The run
  without skills has no Skills section. A skill unchecked for the agent, or
  globally disabled (`phantom-api-gate`), never appears.
- **Findings:** do they cite the production line of the uncovered branch
  (`src/discounts.ts`) / the changed schema line (`src/app.ts`)? Grounding drops
  findings whose lines are outside the diff, so compare the count before and after
  grounding if the log shows it.
- Afterwards, **`/skills` → a linked skill → Stats**: pull frequency, accept rate and
  findings (30d) are no longer `—`. Accept / dismiss a few findings first so accept
  rate has decisions to count.

Write everything into `RESULTS.md`.
