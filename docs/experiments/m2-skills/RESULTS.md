# M2 control experiment — results

Setup: see `README.md`. Fill in one row per run; record every run, not the best one.

- Date:
- Demo repo: `<owner>/devdigest-skills-demo`
- Model (all runs):
- DevDigest commit:

## Test Quality Reviewer — PR #1 `feat/discounts`

Expected: bulk branch at `10_000` / `9_999`, `WELCOME10` + `1_000` cap, `subtotalCents <= 0`, clamp to subtotal.

| Run | Skills (name vK) | `+T tokens` | Findings (C/W/S) | Expected issues found | Notable misses / false positives | Verdict |
|---|---|---|---|---|---|---|
| A0-1 | none | — | | | | |
| A0-2 | none | — | | | | |
| A1-1 | | | | | | |
| A1-2 | | | | | | |

## API Contract Reviewer — PR #2 `feat/order-amount`

Expected: `/orders/1` → 400 (`ord_` format), `customerId` / `totalCents` removed, `order_not_found` → `not_found`.

| Run | Skills (name vK) | `+T tokens` | Findings (C/W/S) | Expected issues found | Notable misses / false positives | Verdict |
|---|---|---|---|---|---|---|
| B0-1 | none | — | | | | |
| B0-2 | none | — | | | | |
| B1-1 | | | | | | |
| B1-2 | | | | | | |

## Optional baseline — General Reviewer, no skills

| Run | PR | Findings (C/W/S) | Expected issues found | Notes |
|---|---|---|---|---|
| | | | | |

## Trace check
- [ ] With-skills run shows the Skills block, `name vK` list and `+T tokens`.
- [ ] Without-skills run has no Skills block; log says `skills: none`.
- [ ] A disabled skill (`phantom-api-gate`, or an unchecked link) does not appear.
- [ ] Skill Stats tab shows pull / accept / findings after the runs.

## Conclusion
<!-- Did skills change what the agent found? Coverage, precision, token cost. -->
