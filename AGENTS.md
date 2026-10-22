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
- Real rendering can be checked headlessly in the assistant's sandbox: `@sparticuz/chromium` + `puppeteer-core` (not project
  dependencies) run the built game under SwiftShader; serve `dist/`, click through the menu, take screenshots, collect console errors.
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
10. A rule that measures a straight line to the base (v0.17.0: "first" targeting) is wrong on any route that is not straight.
    On the square map the enemy farthest along the ring can be the one farthest from the base in a straight line. Use the
    walking distance (`Enemy.distanceToBase`) and test with an enemy that is far along the road but far from the base.
11. A one-wallet shortcut in a many-wallet game (v0.18.0): `economy.gold` and `lumber.lumber` mean seat 0 and are for one-seat tests only;
    code that acts for a seat uses `goldOf(seat)` / `lumberOf(seat)` and names the seat on every payment (guard in `tests/seats.test.mjs`).
    Credit a kill before the damage is dealt: the kill event fires inside `takeDamage`, so a seat written afterwards is always late.

12. A bar drawn over the playfield (v0.20.0): the top bar, the wave bar and the skill slots lay on the first and last tile rows from the start and
    nobody could see it in a headless test. Interface geometry comes from `src/ui/layout.ts`; `tests/layout.test.mjs` records what the real
    classes draw and fails when anything leaves the side column.
13. A purchase with two purses (v0.20.0: gold and lumber for an ultimate): take the first and the second refuses, and the player has paid for a
    refusal. Check every purse, then charge; a refused action takes nothing (test in `tests/builders.test.mjs`). Lumber is spent only by the
    builder rules (`BuilderManager`), never by a UI class.
14. A number copied into a test (v0.21.0: "20 lives" in six tests; the lives became 25 and eight tests failed for the wrong reason). Tests read
    presets and data (`DIFFICULTY_PRESETS`, `GameConfig`), never a copy of the value. A rule that depends on a mode (the lives, the opening
    bar) is parameterised by the mode in the tests and in the generated reports.

## Resuming in a new session

Read `README.md`, `ARCHITECTURE.md`, `DESIGN.md`, `ROADMAP.md`, `docs/GAME_DESIGN.md`, `docs/QA.md`,
`docs/PATCH_POLICY.md` and `docs/PATCH_HISTORY.md`. Take the baseline from the last history row and `git log`,
not from an old chat or snapshot, and start from the "Next sprint" section of `ROADMAP.md`.

Process lessons (v0.10.0 to v0.15.0):
- Reasoning and code in English (owner request, saves tokens); replies to the owner in Russian. The owner delegated game-mechanics
  decisions to the assistant on 2026-10-14: decide, measure, and write the reasoning into `docs/BALANCE_PROPOSALS.md` and `ROADMAP.md`.
- One sandbox command is limited to 300 s: run patch chains in the background (`setsid nohup ... &`) and poll the log.
- Headless browser checks: the static server started in an earlier command is gone, start it in the same command as the screenshot;
  the scene needs 9-13 s to load under SwiftShader and the tutorial needs 3-4 clicks before towers can be placed.
- Art lives in two generator scripts (`scripts/generate_ui_art.py`: HUD, tower, builder, damage and armor icons; `scripts/generate_sprite_art.py`: sprites,
  citadel, spawn portal); edit the script, regenerate, look at a contact sheet and a game screenshot, commit the PNGs. Never hand-edit a PNG.
  Sizes and silhouettes are pinned by `tests/art.test.mjs`; the footprint of a map object follows the 2x2 base and the single spawn tile (`docs/ART.md`).
