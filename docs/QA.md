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
v0.5.0 and verified the same way; v0.7.0 was authored on the v0.6.0 tree, v0.8.0 on the v0.7.0 tree and v0.9.0 on the v0.8.0 tree, all verified the same way.

## v0.2.1 migration regression gates

`npm run test:unit` uses the built-in Node test runner and the installed TypeScript compiler (no Jest).
It covers map symmetry, 40 waves, watchtower non-stacking/expiry,
resource abuse, terminal event deduplication and object-pool double release.
Static validation alone is **not** an E2E/browser test.

Manual browser smoke (still pending): start -> first wave -> place & upgrade ->
pause and try building -> resume -> sell final watchtower -> lose all lives ->
retry -> inspect fresh Q/W HUD and restored economy -> menu -> play -> confirm
no duplicated dust, skills or listeners; finish wave 40 and retry after victory. After wave 1 the gold must grow by the
wave bonus once ("+N бонус" is the only bonus; 20 on normal), not twice. After restarting the scene twice a kill must still
pay its bounty once, a golem or boss kill must show its lumber, and a leaked enemy must cost its lives.
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

## v0.9.0 mid-game measurement

No game data changed; `tests/balance.test.mjs` grew. `taperWave` is a pure function and `WAVES` is `BASE_WAVES` tapered by it
(pinned wave by wave); `retaper(OPENING_TAPER)` is the identity on the data; `taperWave` keeps boss waves at one enemy, never makes a
wave harder than written for `end` <= 1 and honours `end`. Scenarios can override towers and difficulty presets; they are restored, leave
no marker fields behind, and reach the real systems (tower price, interest rate). The ledger invariants hold under a scenario that
changes gold, bounty, waves, tower prices and interest. Proposals D and E meet the mid-game bar (at least 3 lives when wave 21
starts) with an idle hero and with the scripted skills, F with the skills; the current data does not meet it.

Limits: the bars cover waves 1-20 on normal; the four catalogued builds do not plan for the fortified bosses; no human has played
any of this. The browser smoke was not run for v0.9.0.

## v0.10.0 wave bonus paid once

No game data changed. `tests/ui_wiring.test.mjs` plays wave 1 on every difficulty with the real `WaveInfo` wired to the `WaveManager`
and requires that all gold is explained by reported events (kill bounties, interest, the scaled wave bonus); it failed on v0.9.0
(393 gold instead of 373 on normal: the raw wave 1 bonus of 20 was credited by the UI on top of the scaled one). A guard test keeps
`src/ui/` from calling `addGold`, `spendGold`, `loseLife` or lumber mutators. A TODO test records that the start-now button prints an
early-start bonus that nothing pays (owner decision needed). `docs/ECONOMY_REPORT.md` and `docs/BALANCE_PROPOSALS.md` are unchanged:
the harness never had the UI payout, so the reports already described the single payment that the game now matches.

Limits: the Phaser scene lifecycle and rendering are still untested; no browser run. The browser smoke was not run for v0.10.0.

## v0.11.0 one owner for events and money

`Subscriptions` owns the EventBus listeners of `EconomyManager`, `InterestSystem`, `WaveManager`, `EnemyOutcomes` and `GameScene`.
`tests/ownership.test.mjs` checks that three create/destroy rounds leave the listener counts unchanged, that a second destroy is
harmless, that nothing under `src/` outside `utils/` calls `EventBus.on`, `once` or `off`, that scenes never change gold, lives or lumber,
and that `GameScene` creates `EnemyOutcomes` directly after `WaveManager`. The kill and leak rules moved from `GameScene` handlers into
`EnemyOutcomes`; both harnesses now run that system, which brought the golem and boss lumber into the simulation (186 lumber in a full
run instead of 8; the test failed on v0.10.0 with expected 186, actual 8). Gold and lives are unchanged: every gold figure in
`docs/ECONOMY_REPORT.md` and all of `docs/BALANCE_PROPOSALS.md` are identical, only the lumber line was regenerated.

Limits: `GameScene` itself is not instantiated by any test (its wiring is checked statically); no browser run. The browser smoke
was not run for v0.11.0.

## v0.12.0 art pass 1

Interface icons (heart, gold gem, log), six tower medallions for the build panel and seven seamless terrain tiles are generated by
`scripts/generate_ui_art.py` (Pillow, 4x supersampling, deterministic) and committed under `public/assets/`. `tests/assets.test.mjs`
checks that every texture `BootScene` loads exists, that each buildable tower has a 96 px medallion and that tiles are 80 px.
Layout fixes: speed buttons moved inside the field, hero skill slots no longer overlap the wave text and bars.

Browser check (headless Chromium under SwiftShader, 1280x720): menu, scene change, tutorial, three towers placed by hotkey and click,
wave 1 started and running; no console messages and no page errors. This is the first real browser run since v0.2.1 but not the
full smoke: waves 1-40, victory, defeat, pause and restart are still unplayed. The hard-coded "v0.1.0" label of the menu is stale.

## v0.13.0 mid-game decision (proposal D)

`WAVE_TAPER` (renamed from `OPENING_TAPER`) is `{ hp: 0.4, count: 0.8, until: 40, end: 0.3 }` and `WAVE_BONUS_FACTOR` is 2; the data is
`BASE_WAVES` shaped by both. `tests/balance.test.mjs` pins waves 1, 11, 21 and 40 and the doubled bonus of every wave, requires the
applied data to meet the mid-game bar (waves 1-20, at least 3 lives when wave 21 starts) with an idle and with a scripted hero, and
keeps E and F as measured alternatives (E meets the bar, F only with the skills). Measured on normal: best build `arrow`, 10 lives
at wave 21 in both hero modes, defeated in wave 28 with the skills and wave 25 idle. Both generated documents were rewritten;
`docs/ECONOMY_REPORT.md` now reports 98 lumber for a full run. Waves 21-40 are not under an acceptance bar yet, hard and insane are
measured for waves 1-11 only, and no human has played the new curve: it may be easy for someone who plans for the bosses.
The browser smoke was not run for v0.13.0.

## v0.14.0 art pass 2 (sprites)

`scripts/generate_sprite_art.py` (Pillow, 4x supersampling, outline, deterministic) writes 16 sprites of 128 px to `public/assets/art/`: arrow,
cannon, magic and slow towers in tiers 1-2, the alchemist and the watchtower, five enemies and the hero. `ui/SpriteViews` owns one Image per live
entity: towers are swapped on upgrade and pulse when built, ground enemies are mirrored by walking direction and wobble, flyers rotate to
their heading, hits flash white, dying enemies fade, pooled enemies get a fresh image. `tests/sprites.test.mjs` checks the files, the image
lifecycle (create, flip, flash, fade, upgrade, sell, kill, pooled reuse, destroy), the bodiless `Enemy.drawTo` and the `GameScene` wiring.
Browser check (headless Chromium, 1280x720): four towers placed by hotkey, wave 1 running, the hero on the base, no console messages or page
errors. Not covered: boss and flying enemies on screen, upgrade and sell flows, restart, long sessions. The base is still a vector hexagon.
The browser smoke was not run for v0.14.0.

## v0.15.0 handoff: activation block and owner checklist

Activation (repository root `/workspaces/SvetloTD`, patch files in the root, clean tree on `main`; applied patches are skipped):

```bash
cd /workspaces/SvetloTD && set -e
for P in $(ls patch_svetlogorsk_td_v0_*.py | sort -V); do
  V=$(echo "$P" | sed -E 's/patch_svetlogorsk_td_v([0-9]+)_([0-9]+)_([0-9]+)_.*/\1.\2.\3/')
  if grep -q "| v$V |" docs/PATCH_HISTORY.md; then echo "skip v$V (already applied)"; continue; fi
  python "$P" --dry-run
  python "$P" --commit --push --self-delete
done
git log --oneline -8 && npm run test:unit 2>&1 | grep -E "^# (tests|pass|fail|todo)"
```

Expected after v0.15.0: 83 unit tests, 82 pass, 1 TODO (lumber sink), 0 fail; `git log` shows one commit per version.

Browser checklist (`npm run dev`, then record the result in the smoke log): menu to game; tutorial; hotkeys 1-6 build every tower kind and each
shows its own sprite on a stone pad; start wave 1 (6 goblins at 40% HP, wave bonus 40 gold on normal, paid once); enemies are mirrored by
walking direction and flash on a hit; right click moves the hero, Q and W work; upgrade with U swaps the sprite; sell refunds in full during
the countdown and 70% in combat; speed buttons x1-x3 and pause; the wyvern waves and the wave 10 boss look right; defeat, victory and
restart leave no duplicated rewards or sprites. Note anything that looks wrong or unreadable: it becomes the v0.16.0 art pass.

## v0.16.0-v0.17.0 handoff: activation block and owner checklist

v0.16.0 is documentation only (the Burbenog direction and the new roadmap); v0.17.0 is the square map. Activation (repository root
`/workspaces/SvetloTD`, both patch files in the root, clean tree on `main`; applied patches are skipped):

```bash
cd /workspaces/SvetloTD && set -e
for P in $(ls patch_svetlogorsk_td_v0_*.py | sort -V); do
  V=$(echo "$P" | sed -E 's/patch_svetlogorsk_td_v([0-9]+)_([0-9]+)_([0-9]+)_.*/\1.\2.\3/')
  if grep -q "| v$V |" docs/PATCH_HISTORY.md; then echo "skip v$V (already applied)"; continue; fi
  python "$P" --dry-run
  python "$P" --commit --push --self-delete
done
git log --oneline -8 && npm run test:unit 2>&1 | grep -E "^# (tests|pass|fail|todo)"
```

Expected after v0.17.0: 85 unit tests, 84 pass, 1 TODO (lumber sink), 0 fail; `git log` shows one commit per version.

Browser checklist for the square map (`npm run dev`): the field shows a stone ring with a portal on each corner and four one-tile spurs
turning into the base in a pinwheel; towers can be placed inside, outside and beside the ring; wave 1 enemies appear on all four portals, run
clockwise around the whole ring and then up their spur; a leak costs lives; "first" targeting shoots the enemy that is closest to the base by
the road; flyers cross the field in a straight line; the hero sits on the base. Note anything that looks wrong or differs from the real
Burbenog map: it becomes the next track step. The browser smoke for 1-40 was not run for v0.17.0.

## v0.18.0 handoff: activation block and owner checklist

Activation: the block of the v0.15.0 handoff above (it skips applied patches); v0.18.0 follows v0.17.0.

Expected after v0.18.0: 97 unit tests, 96 pass, 1 TODO (lumber sink), 0 fail; `git log` shows one commit per version.

Browser checklist (`npm run dev`): the normal game (no parameter) behaves as in v0.17.0, one wallet, towers anywhere. Then open the game with
`?seats=4`: the HUD gold shows a quarter of the start gold; the right panel shows four seat chips (I-IV) with gold and lumber; the field is
tinted in four colours; seat I builds in the north-west zone only (a tile in another zone shows the red ghost and refuses); click chip II (or
press X), build in the north-east zone; each tower carries a dot in its owner's colour; seat II cannot sell or upgrade seat I's tower; kills
pay the seat whose tower made them; after wave 5 every seat has 1 lumber; `?seats=2` gives each seat two zones. The browser smoke for 1-40
was not run for v0.18.0.
