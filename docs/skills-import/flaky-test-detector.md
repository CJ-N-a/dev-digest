---
name: flaky-test-detector
description: When the diff adds or changes tests, flag tests whose result depends on time, randomness, order, shared state or the network, and name the deterministic fix.
type: rubric
---

A flaky test fails without a code change. It trains the team to re-run CI instead
of reading failures, so treat a test that is flaky by construction as a defect.

## Flag
- **Time:** `Date.now()`, `new Date()`, `performance.now()` or real timers in the
  code under test without `vi.useFakeTimers()` / `vi.setSystemTime()`; assertions
  on "today", durations or timeouts measured with the wall clock.
- **Sleeps:** `setTimeout` / `await sleep(…)` used to "wait until it's done"
  instead of awaiting the promise or using `vi.waitFor` / `findBy*` queries.
- **Randomness:** `Math.random()`, `crypto.randomUUID()` or faker without a fixed
  seed, where the assertion depends on the generated value.
- **Order and shared state:** a test that passes only after another one ran;
  module-level mutable state, DB rows or env vars not reset between tests;
  `it.only` / `describe.only` left in.
- **Unordered data:** comparing results of a query without `ORDER BY`, `Object.keys`,
  `Set` or `Promise.all` side effects as ordered arrays.
- **Network and environment:** real HTTP calls, DNS, ports, the local timezone or
  locale, absolute file paths.

## Report
- One finding per flaky test, category `test`, citing the line that introduces the
  non-determinism. Name the source and the fix, e.g. "uses real `Date.now()` near
  midnight; freeze time with `vi.setSystemTime('2026-01-01T12:00:00Z')`".
- WARNING for a test that is flaky by construction; SUGGESTION when the risk needs
  an unlikely environment to trigger. Never CRITICAL.

## Do not flag
- Integration tests that are explicitly meant to hit a real database or container
  (`*.it.test.ts`) for using that database.
- Timers that are already faked in a `beforeEach` of the same file.
