# Agent contract (mandatory)

1. Read `README.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `ROADMAP.md` before edits.
2. Apply **KISS** (simplest correct behavior), **YAGNI** (no speculative systems),
   **DRY** (single authoritative rules/data), and **SOLID** where it improves change safety.
3. Keep edits surgical. Preserve existing working gameplay, names, UX, and save formats.
4. Write code, tests, identifiers, commit messages, and code comments in **English**.
5. One change at a time: plan -> inspect references -> patch -> test -> review diff.
6. Prefer pure, deterministic functions for combat, economy, routing and simulations.
7. Maintain invariant tests for symmetry, route completion, resource conservation,
   scene shutdown, object-pool release and 40-wave progression.
8. Never invent SDK contracts, platform limits, performance measurements, or test results.
9. Do not expose API keys or tokens to `src/` or `dist/`; treat client code as public.
10. Revisit docs and acceptance criteria in the same patch as behavioral changes.
11. One canonical `src/` only; do not create shadow app trees or copy vendor SDKs.
12. Ship only when static tests, TypeScript, production build, smoke gameplay and review pass.
13. Keep dist/, node_modules/, Repomix exports, and release archives out of Git.
    Untrack generated content with git rm --cached; never delete local originals blindly.

## Agent handoff

Every task: explain scope; show files changed; identify risks; report actual tests,
including failures and untested browser scenarios; update ROADMAP.md as needed.
No unrequested refactors, unverified fixes, or mass dependency upgrades.

## Immutable patch and migration rules

- Every patch has a new SemVer version, unique descriptive filename, and history entry.
- Before edits: assert branch, remote, a clean Git tree (other pending patch files excepted), the previous
  version row in `docs/PATCH_HISTORY.md` and exact source anchors. The actual base commit is recorded in the
  new history row, because chained patches cannot know it in advance.
- Never recycle patch files or use `git reset --hard`, `git clean -fd`, `git push --force`.
- Commit only explicit touched paths; test before commit; push only if explicitly asked.
- Preserve history of removed components and list deliberate deferrals in MIGRATION.md.
- Run clean installs, automated unit tests, typecheck, asset validation and production build.
- No deceptive emulator mocks or free ad rewards in production platform adapters.
- Every P0 change needs a regression test and documented manual browser checklist.
- After failures: leave the checkout recoverable, never conceal a failed gate.

## Test harness conventions (since v0.3.0)

- `npm run test:unit` runs `node --test tests/*.test.mjs`. Every file loads the real TypeScript through
  `tests/support/load-source.mjs` (one loader; Phaser is stubbed; imports outside the repository are rejected).
- Entities that only create graphics, tweens or input hooks run against a chainable stand-in for the scene
  (see `tests/combat.test.mjs`). Rendering, input events and the Phaser scene lifecycle stay untested until
  a browser run is recorded in `docs/QA.md`.
- Drive time with explicit steps and compare several frame lengths (4-100 ms, and x3 game speed). Simulate
  waves headlessly through `WaveManager.update(dt)` as in `tests/simulation.test.mjs`.
- Economy and balance work starts from `docs/ECONOMY_REPORT.md`. `tests/support/simulate.mjs` runs all 40 waves
  headlessly; regenerate the report with `npm run report:economy -- --write` whenever wave, enemy, tower,
  difficulty or economy data changes (a test compares it). A finding that needs an owner decision is a TODO test.
- Kill bounty, lumber yield and leak lives are paid by the real `EnemyOutcomes`: a harness builds it right after
  `WaveManager` and registers only its own bookkeeping after that, instead of copying the scene's handlers.
- A balance proposal is a scenario (`withScenario`), never an edit of the data files, until the owner picks one;
  `npm run report:balance -- --write` regenerates `docs/BALANCE_PROPOSALS.md` and a test compares it.
- Do not hardcode balance numbers (counts, gold, bounties) in unrelated tests: read them from the data, so a rebalance
  only touches the tests that pin the decision (`tests/balance.test.mjs`).
- Scenarios can override waves, enemies, towers and difficulty presets (`waveTweak`, `enemyTweak`, `towerTweak`,
  `presetTweak`). Wave-shape proposals go through `retaper` and `taperWave`, never through a copy of the taper rule.
- Read private state only where the real path needs pointer input, and say so in a comment.
- A regression test must fail on the unfixed code; confirm that before calling a defect fixed.

## Review checklist: defect classes already found here

1. Frame-length dependence (towers v0.4.0, hero auto-attack v0.6.0): a per-frame `floor`, a cooldown reset that
   drops the overshoot, or a state
   machine advanced inside an event handler. Test at several step sizes.
2. Event ordering: listeners run in registration order. One subscriber must not finish a state machine
   before another has reacted to the same event (defeat vs wave clear).
3. Data-only mechanics: a field in `src/data/` that no system reads (the Ice Bastion area slow).
   `tests/data.test.mjs` checks shape; behavior needs a system test.
4. Stale references: a target, tower or projectile used after it died, was sold or was recycled.
5. Floating point in money: `Math.floor(170 * 0.7)` is 118, not 119. Use an epsilon or integers.
6. A method interpolated into a string prints its source (`${tower.sellValue}`); a static guard in
   `tests/combat.test.mjs` scans `src/`.
7. State changed by assigning a field from the UI skips the owner's logic (target priority). Change state
   through the entity's method.
8. Money changed outside its owning system (v0.10.0): `WaveInfo` credited the raw wave bonus next to the scaled
   `InterestSystem` payout. A harness that leaves the UI out cannot see this: wire the real UI class into the test
   (`tests/ui_wiring.test.mjs`) and assert that every unit of gold is explained by an event.
9. A rule inside a scene handler gets copied by hand into harnesses and drifts (v0.11.0: golem and boss lumber was missing
   from the simulation, the report said 8 where the data gives 186). Keep rules in a system and build that system in the
   test. Components register EventBus listeners only through `Subscriptions` (guard: `tests/ownership.test.mjs`).

## Resuming in a new session

Read `README.md`, `ARCHITECTURE.md`, `DESIGN.md`, `ROADMAP.md`, `docs/GAME_DESIGN.md`, `docs/QA.md`,
`docs/PATCH_POLICY.md` and `docs/PATCH_HISTORY.md`. Take the baseline from the last history row and `git log`,
not from an old chat or snapshot, and start from the "Next sprint" section of `ROADMAP.md`.
