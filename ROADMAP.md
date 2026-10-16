# Development roadmap (2026-10 baseline)

Legend: [x] implementation in this patch; [ ] planned / not verified in a browser.

## Current state (v0.13.0)

- Gates run by every patch: unit tests, typecheck, game/data validation, production build, bundle budget.
- Never executed: a browser smoke run, a real-device touch test, a platform deployment. Every item that needs
  a browser is still open, including the two P0 items below.
- v0.3.0 and v0.4.0 fixed the confirmed defects listed in the P0 section; the defect classes are catalogued in
  `AGENTS.md` so they are checked in future changes.
- v0.6.0 added a deterministic headless economy and wave-pressure simulation and the generated
  `docs/ECONOMY_REPORT.md`. Its findings are measurements, not fixes: no balance data changed. The two open
  findings that need an owner decision are tracked as TODO tests in `tests/economy.test.mjs`.
- v0.7.0 added scripted hero skills and temporary balance scenarios to the harness and the generated
  `docs/BALANCE_PROPOSALS.md` (three measured opening candidates).
- v0.8.0 wrote the owner's decisions of 2026-10-11 into the data: opening candidate C (starting gold 300 / 260 / 200,
  bounties x1.5, `OPENING_TAPER` for waves 1-29) and the wave bonus `round(bonusGold x waveBonusMult)` with 1.0 / 0.8 /
  0.6. Lumber stays unspent until a sink is added. Waves 11-40 are not rebalanced.
- v0.9.0 measured the mid game and put three proposals (D, E, F) and two design what-ifs in `docs/BALANCE_PROPOSALS.md`;
  no game data changed. On the current data the best catalogued build still loses in waves 11-14; D and E hold waves 1-20.
- v0.10.0 fixed a double payment found by wiring the real `WaveInfo` into a test: the UI callback credited the raw `bonusGold`
  on top of the scaled `InterestSystem` payout, so the 1.0 / 0.8 / 0.6 multipliers were never in effect in the game and income
  was above everything the reports measured (the harness has no UI). The UI no longer touches the economy; no data changed.
- v0.11.0 gave events and money one owner: `Subscriptions` registers and removes a component's EventBus listeners, and the new
  `EnemyOutcomes` system pays kill bounty and lumber and takes the lives of leaks (these rules lived in `GameScene` handlers and
  were copied by hand into the harnesses, where golem and boss lumber was missing: a full run earns 186 lumber, not the 8 the
  report claimed). Gold is unchanged; only the lumber line of `docs/ECONOMY_REPORT.md` moved.
- v0.12.0 art pass 1 (owner: the graphics were old and poor): generated HUD icons, tower medallions in the build panel, terrain
  (4 grass and 3 cobble variants, seamless 2x textures), stone pads under towers, enemy ground shadows; the speed buttons moved
  into the field (the side panel covered them) and the hero skill slots no longer sit on the wave text. The start-now button no
  longer advertises an early-start bonus nobody paid (decided by the assistant under the owner's delegation of mechanics decisions).
  First real browser run (headless Chromium): menu to wave 1 with towers placed, no console or page errors.
- v0.13.0 wrote the mid-game decision into the data (proposal D, chosen by the assistant under the owner's delegation): `WAVE_TAPER`
  (`OPENING_TAPER` renamed) is 40% HP / 80% count at wave 1 moving linearly to 30% at wave 40, and `WAVE_BONUS_FACTOR` doubles the
  written `bonusGold`. On normal the best catalogued build holds waves 1-20 with 10 lives at wave 21 in both hero modes and is
  defeated in wave 28 (skills) / 25 (idle): waves 21-40 still have no acceptance bar. Reports regenerated.
- Resume procedure for a new session: `AGENTS.md`, "Resuming in a new session".

## P0 - correctness / playable baseline

- [x] v0.2.1 restart state reset, terminal event deduplication and pause/tutorial input guard.
- [x] v0.2.1 watchtower aura and stale-buff cleanup.
- [x] v0.2.1 negative-resource-spend and duplicate GAME_OVER guards.
- [x] v0.2.1 one source tree and automated Node runtime regression gate.
- [x] v0.3.0 acid-tower poison is frame-rate independent (it previously never dealt damage).
- [x] v0.3.0 Ice Bastion area slow is implemented in `src/systems/HitEffects.ts` (it was data-only before).
- [x] v0.3.0 the countdown before wave 1 is a build phase with a 100% sell refund, like every other countdown.
- [x] v0.3.0 defeat takes precedence over a same-tick wave clear or victory (last life lost to the last enemy).
- [x] v0.3.0 headless wave-lifecycle simulation (40-wave victory, defeat, precedence) and data-consistency tests.
- [x] v0.3.0 an enemy killed by poison no longer heals or moves for the rest of that tick.
- [x] v0.4.0 tower fire rate no longer depends on frame length or game speed (up to 11% fewer shots before).
- [x] v0.4.0 a tower whose target dies between target ticks re-acquires at once instead of losing its whole cooldown.
- [x] v0.4.0 changing the target priority re-targets immediately; upgrading keeps the chosen priority.
- [x] v0.4.0 the sell button shows the real refund for the current phase (it printed the method's source code).
- [x] v0.4.0 selling at 70% no longer loses a gold to floating-point rounding (an upgraded Wachturm refunded 118 instead of 119).
- [x] v0.4.0 regression tests for towers, projectiles, hero skills and build/upgrade/sell economy.
- [x] v0.6.0 hero auto-attack rate no longer depends on frame length (it dropped the frame overshoot on every
  attack: 67 instead of 72 attacks per minute at 100 ms frames).
- [x] v0.6.0 deterministic headless economy and wave-pressure simulation (`tests/support/simulate.mjs`), generated
  report (`npm run report:economy`), ledger invariants over every build and difficulty, report-sync test.
- [x] Opening balance (v0.8.0): the owner picked candidate C of `docs/BALANCE_PROPOSALS.md` and it is in the data.
  The best catalogued build now holds waves 1-10 with 10 lives left (idle hero) or 12 (scripted skills); the bar is 3.
  Hard and insane still fail the bar (informational, see the report).
- [x] v0.7.0 scripted hero skills (Q when two or more enemies are in the blast, W with a tower in reach) and
  scenario overrides (`withScenario`) in the headless harness; candidates A/B/C measured against an acceptance bar
  (best build holds waves 1-10 with at least 3 lives); generated `docs/BALANCE_PROPOSALS.md` and `tests/balance.test.mjs`.
- [x] v0.8.0 difficulty bonus is `round(bonusGold x waveBonusMult)` (1.0 / 0.8 / 0.6, as `DESIGN.md` section 6 always
  said); the dead `waveBonusBase/Scale` fields and the unused `STARTING_GOLD` constant are gone. A test that hardcoded
  wave 1's size now reads it from the data.
- [x] v0.9.0 mid-game measurement: `BASE_WAVES` and the pure `taperWave` are exported from `src/data/waves.ts` (data
  unchanged), scenarios can also override towers and difficulty presets, a mid-game bar (waves 1-20), proposals D/E/F.
- [x] v0.10.0 the wave bonus was credited twice (raw `bonusGold` by `WaveInfo`, scaled by `InterestSystem`: up to 11460 instead of
  5730 gold over 40 waves on normal, and the hard/insane multipliers were void). It is paid once by `InterestSystem`;
  `onWaveComplete` carries no gold amount; a test wires the real `WaveInfo`; a guard keeps `src/ui/` away from gold, lives and lumber.
- [x] v0.11.0 kill bounty, lumber yield and leak lives were paid only inside `GameScene` handlers and mirrored by hand in two harnesses
  (lumber from golems and bosses missing: 8 reported, 186 real). `EnemyOutcomes` owns them; both harnesses build the real system.

- [x] Symmetric 18x18 four-lane map and routes ending at exact shared center.
- [x] Projectile release, visible splash lifetime and pool double-release guard.
- [x] Correct high-speed travel across multiple enemy waypoints.
- [x] Scene shutdown hook and scoped event cleanup.
- [x] Difficulty multipliers wired into enemy HP and speed.
- [x] 40-wave data declarations with provisional acts 5-8.
- [x] Runtime-loadable deterministic terrain textures and 12 optional prototype sprite PNGs.
- [ ] Browser smoke run: 1-40, victory/defeat, pause/resume, restart, targeting.
- [ ] Record baseline bugs and fix after first game session.

## P1 - product/quality gate

- [ ] Replace legacy Phaser type shim with official package declarations.
- [ ] Remaining tests: HUD/panel/scene flows, pause/resume and restart lifecycle, audio, persistence (covered so far: waves v0.3.0; towers, projectiles, hero skills, build/upgrade/sell v0.4.0; economy ledger and wave pressure v0.6.0).
- [x] v0.13.0 mid game: proposal D is in the data (see the current state). Still open: hard and insane were measured for waves
  1-11 only and failed that bar before D; waves 21-40 have no acceptance bar (best build defeated in wave 28); none of the four
  catalogued builds kills the fortified wave bosses; interest is worth 56% of income when nothing is spent (measured before D)
  and bounties do not scale with wave HP. The what-ifs (cheaper upgrades, `normal`-damage arrows) remain design questions.
- [x] v0.12.0 early-start bonus: the label no longer promises it; a test keeps `WaveInfo` from advertising gold no system pays.
  A real early bonus may return as a designed, measured feature.
- [ ] Lumber sink (owner decision 2026-10-11: later): mercenaries and tier-3 towers as the `LumberManager` header
  describes; needs new content. A TODO test tracks it.
- [ ] Add structured save schema, migration, replay seeds, crash reporting (consent-aware).
- [x] Triage and remove `SvetloTD-live/`; implement safe aura and input capability boundary (`docs/MIGRATION.md`).
- [x] Explicit ownership of EventBus subscriptions (v0.11.0): `Subscriptions` in every system and in `GameScene`; guard tests.
- [ ] Usability pass: gamefield vs 560px panel, pause, keyboard, mobile and safe areas.

## P2 - game design / visual production

- [ ] Tower schools and counters; at least three viable strategies for waves 10/20/30/40.
- [ ] Art bible: silhouette language, scale, palette, contrast and animations.
- [ ] Replace prototypes with authored 2D sprite atlases, 2-4 animation states each.
- [ ] Art pass 2: towers, enemies, hero and the base are still vector shapes (v0.12.0 did icons, terrain and layout);
  next: authored sprites, panel and button frames, menu background, projectile and hit effects. Regenerate with
  `python3 scripts/generate_ui_art.py` (the PNGs are committed).
- [ ] SFX mixing/ducking, captions, color-blind modes, reduced-motion option.
- [ ] Hero depth and active abilities; wave modifiers with comprehensible telegraphs.

## P3 - multiplayer and release

- [ ] Design authoritative server simulation, reconnect and deterministic replays.
- [ ] Coop 2-4 players with lane roles and fair player-count scaling.
- [ ] Platform adapter only after target-specific VK SDK agreement.
- [ ] GitHub Pages beta, then validated VK Play HTML5 onboarding.
- [ ] Vibe deploy after owner verifies account entitlement and authenticated /v1/me.
- [ ] FPS/memory/network/load tests and 40-wave completion telemetry.

## Release gate

No public '40 levels balanced', '4-player multiplayer', or 'VK published' claims
until the corresponding tasks are tested and accepted.

## After v0.2.1 migration

- [ ] Browser E2E: defeat/retry, victory/retry, modal interactions and 40-wave run.
- [ ] Responsive, accessible touch UX (not merely user-agent detection).
- [ ] Verify VK Play SDK contract before implementing ads, save data or leaderboards.
- [ ] Decide whether opt-in persistent meta bonuses belong in balanced multiplayer.
- [ ] Replace hand-written Phaser shim with official type definitions in a dedicated patch.
- [ ] Validate GitHub Pages and Vibe deploy smoke tests in the target environment.
- [x] Economy-simulation tests before rebalancing 21-40 (v0.6.0); benchmark tests remain open.

## Next sprint (recommended): v0.14.0 art pass 2
- Objective: the owner asked for good graphics. Replace the vector shapes of towers (6 kinds x tiers), enemies (5), the hero and
  the base with authored sprites; panel and button frames (nine-slice), a menu background, projectile and hit effects. Verify every
  step with headless-browser screenshots (see `AGENTS.md`). Priority: P1.
- Scope: extend `scripts/generate_ui_art.py` (or a sibling), load the textures in `BootScene`, draw sprites from `Tower`/`Enemy`
  views while keeping the logic classes unchanged and the tests green; no balance data change.
- Acceptance: all gates; screenshots of the menu, an empty field, a built field and a boss wave look consistent; the stale
  "v0.1.0" label of the menu shows the real version.
- Owner action still pending: browser smoke run of 1-40, victory/defeat, pause/resume and restart (not executed
  since v0.2.1); record it in the `docs/QA.md` smoke log. Also play waves 1-3 once with hero skills and the wave 10 boss
  once, noting the lives lost: the new opening may be easy for a human, and no catalogued build plans for the bosses.
- Secondary candidates, in order: late-game acceptance bar for waves 21-40 (the best build is defeated in wave 28 today);
  official Phaser type declarations in a dedicated patch; decide whether cannon splash may hit flying enemies (currently it does);
  structured save schema; `tsconfig.json` compatibility with TypeScript 6 (a 6.0.3 compiler reports TS5101 for
  the deprecated `baseUrl` and TS5011 for `rootDir`; the project pins ^5.7.2 and is unaffected today).
