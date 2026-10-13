# QA and release checklist

1. Regenerate textures; compare output deterministically to committed assets.
2. Run `npm run test:unit`, `python3 scripts/validate_game.py` (`python` on Windows) and `npm run typecheck`.
3. Run `npm run build`, `python3 scripts/check_bundle.py`; inspect output changes.
4. Manually play: choose each tower, upgrade, sell in/out of combat, hero Q/W,
   flying/ground enemies, splash, leaks, boss, win, lose, restart.
5. Test at 1x/2x/3x; confirm no projectile pool growth after stable waves.
6. Run desktop Chrome/Firefox, Safari, touchscreen; check safe-area clipping.
7. Inspect console errors, mute/unmute, tab hide/return, event listener growth.
8. Test embed on target platform separately. Record exact SDK/version/date.
9. Never approve a release solely on static assertions or a successful build.

Audit status: v0.3.0 to v0.5.0 were authored from a Repomix snapshot of v0.2.1 and verified headlessly
(unit tests, typecheck, game validation, production build, bundle budget). No browser run has been recorded
since v0.2.1; add one to the smoke log below when it happens. v0.6.0 was authored from a Repomix snapshot of
v0.5.0 and verified the same way; v0.7.0 was authored on the v0.6.0 tree and v0.8.0 on the v0.7.0 tree, both verified the same way.

## v0.2.1 migration regression gates

`npm run test:unit` uses the built-in Node test runner and the installed TypeScript compiler (no Jest).
It covers map symmetry, 40 waves, watchtower non-stacking/expiry,
resource abuse, terminal event deduplication and object-pool double release.
Static validation alone is **not** an E2E/browser test.

Manual browser smoke (still pending): start -> first wave -> place & upgrade ->
pause and try building -> resume -> sell final watchtower -> lose all lives ->
retry -> inspect fresh Q/W HUD and restored economy -> menu -> play -> confirm
no duplicated dust, skills or listeners; finish wave 40 and retry after victory.
Repeat on desktop Chrome/Firefox and mobile touch devices (including tap-to-cast Q/W).

## Browser smoke log

| Date | Commit | Browser / device | Scenarios | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| none recorded | | | | | |

## v0.3.0 simulation gates

`npm run test:unit` also runs `tests/simulation.test.mjs` and `tests/data.test.mjs`
(shared loader: `tests/support/load-source.mjs`). They cover:

- poison damage equals value x duration at 144/60/30/20/10 fps; stacking and refresh rules;
- an enemy killed by poison dies once and no longer heals or moves;
- Ice Bastion area slow: radius, boundary, dead enemies, expiry, primary slow not overwritten;
- headless 40-wave run: each wave cleared once, one bonus per wave, one victory, enemies returned
  to the pool between waves, same outcome at 0.1 s and 0.3 s steps;
- defeat: one terminal event and the wave manager stops; defeat wins over a same-tick wave clear
  and over a final-boss victory;
- sell refund 100% in every countdown (including before wave 1), 70% in combat;
- consistency of wave, enemy, tower and damage-matrix data.

Limits: logic tests on the real TypeScript sources with Phaser stubbed. They do not execute
rendering, input, tweens, audio or the Phaser scene lifecycle. Combat coverage added in v0.4.0 is
listed below. The browser smoke above was not run for v0.3.0.

## v0.4.0 combat gates

`tests/combat.test.mjs` runs entities and the build system against a chainable stand-in for the Phaser
scene (no rendering). It covers:

- tower fire rate equals attackSpeed at 4-100 ms frames and at x3 game speed; idle towers cannot bank shots;
- a target dying between target ticks does not waste the shot;
- target priority rules (first, last, strongest, weakest, nearest), immediate re-targeting on change,
  sticky targets, range boundary, air/ground capabilities;
- projectile hit exactly once at any step size, target lost in flight, splash radius and ring lifetime,
  reset leaks nothing, flight time scales with game speed once;
- hero Shockwave (radius, damage, slow, cooldown) and Amber Shield (radius, +25%, 6 s, no stacking);
- placing, upgrading (validation, price, kept priority, accumulated investment) and selling
  (floor(invested x phase rate), once, cell freed);
- static guards: no method interpolated into a template string; priority only changed via the setter.

Limits: input handlers, rendering, HUD/panel layout, pause/resume and the scene lifecycle are not
executed; `_place`, `_selectTower` and `_target` are read or driven directly where the real input path
needs a browser. The browser smoke was not run for v0.4.0.

## v0.6.0 economy gates

`tests/economy.test.mjs` runs the real wave, economy, tower, projectile, hero and build code for all 40 waves
(`tests/support/simulate.mjs`, 30 Hz, no randomness). It covers:

- a run is reproducible bit for bit; the oracle run clears 40 waves with no leaks; oracle income is identical at
  20, 60 and 144 fps;
- ledger invariants for every catalogued build, baseline and difficulty (42 runs): gold before a wave equals gold
  after the previous award minus purchases, lives carry over, kills plus leaks equal the wave count,
  interest is `floor(gold x rate)`, the bonus is `max(formula, bonusGold)`;
- `docs/ECONOMY_REPORT.md` equals the generator output (`npm run report:economy -- --write` after any change to
  wave, enemy, tower, difficulty or economy data);
- `tests/combat.test.mjs`: hero auto-attack rate at 4-100 ms frames and no banked attacks;
- two TODO tests record findings that need an owner decision (dead difficulty bonus parameters, lumber without a
  sink). A TODO test is reported but does not fail the suite.

Limits: hero skills, hero movement, the watchtower aura and selling are not simulated; towers are bought only
during countdowns on fixed cells. The report states what a parked-hero, tower-only player achieves, not what a
human achieves. The browser smoke was not run for v0.6.0.

## v0.7.0 balance gates

`tests/balance.test.mjs` covers the scenario and skill layer of the harness and the generated proposals:

- `withScenario` replaces wave, enemy and starting-gold data for one run and restores it, also after an exception;
  the levers reach the real systems (starting gold, bounty, wave size); `taper` keeps single-enemy waves at one enemy and
  never makes a wave harder than today; the ledger invariants of v0.6.0 hold under every candidate;
- the scripted hero rule: Q only with two or more enemies in the blast (a skipped Q must not start its cooldown), W only with a
  tower in reach and an enemy alive, both respect their cooldowns, skills are off by default and runs stay deterministic;
- every candidate meets the acceptance bar (at least 3 lives when wave 11 starts) with the scripted skills and candidate C also
  with an idle hero; current data does not meet it;
- `docs/BALANCE_PROPOSALS.md` equals the generator output (`npm run report:balance -- --write` after any data change).

Limits: the skill rule is fixed, the hero never moves, the result depends on the four build rule lists, and the acceptance bar
covers waves 1-10 only. No game data changed in v0.7.0. The browser smoke was not run for v0.7.0.

## v0.8.0 owner decisions

The first patch that changes balance data. `tests/balance.test.mjs` pins the decisions: starting gold 300 / 260 / 200,
bounties 6 / 5 / 21 / 11 / 90, `OPENING_TAPER` and the resulting wave 1 (6 enemies at 40% HP), boss waves keep one enemy, waves
from 30 on are untouched; the applied opening meets the acceptance bar with an idle hero and with the scripted skills.
`tests/economy.test.mjs` pins the difficulty bonus (`round(bonusGold x waveBonusMult)`, 1.0 / 0.8 / 0.6, dead fields gone) and checks that
the real `InterestSystem` pays what the table says on insane. `docs/ECONOMY_REPORT.md` and `docs/BALANCE_PROPOSALS.md` were
regenerated. One test from v0.3.0 (defeat precedence on the last enemy of wave 1) hardcoded wave 1's size and now reads it from the
data. The lumber TODO test stays: the sink is postponed by the owner.

Limits: the acceptance bar covers waves 1-10 on normal; hard and insane fail it and are reported as information; hero movement is
not simulated and no human has played the new opening. The browser smoke was not run for v0.8.0.
