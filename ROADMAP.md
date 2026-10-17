# Development roadmap (2026-10 baseline)

Legend: [x] implementation in this patch; [ ] planned / not verified in a browser.

## Current state (v0.17.0)

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
- v0.14.0 art pass 2: authored, outlined sprites for the 10 tower kinds, the 5 enemies and the hero (`scripts/generate_sprite_art.py`),
  drawn by the new `ui/SpriteViews` (one Image per live entity); the entities keep pads, shadows, status overlays and health bars as
  vector drawing (`drawTo(g, false)`), logic and tests are unchanged. The base is still the vector hexagon.
- v0.15.0 handoff, documentation only: the tooling and verification section of `docs/PATCH_POLICY.md`, process lessons in `AGENTS.md`,
  the activation block and the owner checklist for v0.12.0-v0.15.0 in `docs/QA.md`.
- v0.16.0 direction change, documentation only (owner, 2026-10-16: the game does not resemble Burbenog TD). The original was researched
  again; the verified traits, the target design and the new milestone sequence are in `docs/GAME_DESIGN.md` and in the Burbenog track below.
  The plus-shaped four-lane map is replaced in v0.17.0; art pass 3 moves behind the square map and the seat UI.
- v0.17.0 square map (track step B1): a road ring two tiles inside the field edge, a spawn portal on each corner, four equal routes (one
  route turned by 90 degrees; 52 road tiles each) that leave the ring on their own spur into the shared base; 72 road tiles, 248 buildable.
  "First" and "last" tower priorities use `Enemy.distanceToBase` (walking distance). No wave, enemy, tower or economy number changed, but
  the geometry did: the best catalogued build is now defeated in wave 31 (was 28 with skills, 25 idle) and has 15 lives at wave 21 (was 10).
  The hero stays on the base, so its skills fire only on leaks. A headless Chromium run showed the ring, the four portals and the pinwheel
  spurs, with no console or page errors. Waves 21-40 and the hard and insane presets still have no acceptance bar (B6).
- Resume procedure for a new session: `AGENTS.md`, "Resuming in a new session".

## Product direction: Burbenog-style square, up to four seats (owner decision 2026-10-16)

The owner's verdict on v0.15.0: the game does not resemble Burbenog TD. In the original everything is built around a square and up to four
players take part. The original was researched again (`docs/GAME_DESIGN.md`, "Verified original traits"); the plus-shaped four-lane map with
one anonymous player is replaced step by step. Each step is one patch with its own gates; nothing is claimed as balanced before B6.

| Step | Version | What changes | Acceptance |
| --- | --- | --- | --- |
| B1 | v0.17.0 (done) | Square road ring, four corner spawns, equal rotated routes, spurs into the shared base, walking-distance targeting | Rotation-symmetry and route invariants, screenshot, reports regenerated |
| B2 | v0.18.0 | Four seats: one quadrant zone each, per-seat gold and lumber, tower owner and colour, shared lives, seat bar and hot-seat switch; one human owns all four seats | Per-seat ledger invariants, zone rule, a one-seat game equals today's economy |
| B3 | v0.19.0 | Give gold and lumber to a seat, cede a tower to another seat, optional shared-income mode | Conservation tests, refund goes to the current owner |
| B4 | v0.20.0 | Governors (element sets) over the 10 tower kinds, extra builder, hero, tech building and ultimate tower paid with lumber (this is the lumber sink) | The lumber TODO test turns green, every kind reachable |
| B5 | v0.21.0 | Lives and difficulty as in the original (50 / 25 / 1 / 1 with random waves, scaled by seat count) | Data tests, per-seat-count scaling table |
| B6 | v0.22.0 | Harness knows seats; re-measure and rebalance; late-game bar for waves 21-40; boss per seat | New acceptance bars, regenerated reports |
| B7 | later | Art pass 3 on the square map: village base, seat-coloured pads, spawn gates, panel frames | Screenshots of menu, empty, built and boss field |
| B8 | later | Real co-op over the network: authoritative simulation, reconnect, replays (P3 below) | Soak and desync tests |

Open design questions (the assistant proposes, the owner decides): the exact road layout of the original (a screenshot would settle it);
whether a lone player owns all four seats (proposed) or one; how many bosses a boss wave sends (today one, on one spawn).

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

- [x] Symmetric 18x18 four-lane map and routes ending at exact shared center (replaced by the square map in v0.17.0, step B1).
- [x] v0.17.0 square map with four equal rotated routes ending at the exact shared center; walking-distance targeting; spawn portals.
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
- [ ] Lumber sink (owner decision 2026-10-11: later): scheduled as step B4 of the Burbenog track (extra builders, hero, tech building and
  ultimate tower cost lumber, as in the original). A TODO test tracks it.
- [ ] Add structured save schema, migration, replay seeds, crash reporting (consent-aware).
- [x] Triage and remove `SvetloTD-live/`; implement safe aura and input capability boundary (`docs/MIGRATION.md`).
- [x] Explicit ownership of EventBus subscriptions (v0.11.0): `Subscriptions` in every system and in `GameScene`; guard tests.
- [ ] Usability pass: gamefield vs 560px panel, pause, keyboard, mobile and safe areas.

## P2 - game design / visual production

- [ ] Tower schools and counters; at least three viable strategies for waves 10/20/30/40.
- [ ] Art bible: silhouette language, scale, palette, contrast and animations.
- [ ] Replace prototypes with authored 2D sprite atlases, 2-4 animation states each.
- [x] v0.14.0 art pass 2: sprites for the 10 tower kinds, 5 enemies and the hero, drawn by `ui/SpriteViews`.
- [ ] Art pass 3 (deferred behind B1-B3: terrain, base and pads depend on the square map and on seat colours): the base, panel and button
  frames (nine-slice), menu background, projectiles and hit effects, walk-cycle frames.
  Regenerate with `python3 scripts/generate_ui_art.py` and `python3 scripts/generate_sprite_art.py` (the PNGs are committed).
- [ ] SFX mixing/ducking, captions, color-blind modes, reduced-motion option.
- [ ] Hero depth and active abilities; wave modifiers with comprehensible telegraphs.

## P3 - multiplayer and release

- [ ] Design authoritative server simulation, reconnect and deterministic replays.
- [ ] Co-op 2-4 players, one seat per player on the square map, with fair player-count scaling (track steps B2, B3, B5, B8).
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

## Next sprint (recommended): v0.18.0 four seats (Burbenog track, step B2)
- Objective: the four players of the original. A seat is a quadrant zone with its own gold, lumber, tower colour and builder; lives stay
  shared. A lone human owns all four seats and one wallet, so a one-seat game keeps today's economy. Priority: P0 (owner decision 2026-10-16).
- Scope: `SeatId` and a pure zone lookup in `data/mapData`; per-seat wallets in `EconomyManager` and `LumberManager` (one owner of money,
  see `AGENTS.md` classes 8-9); the tower records its owner and `BuildSystem` enforces the zone rule; kill bounty goes to the owner of the
  killing tower; a seat bar in the HUD and a hot-seat switch (keys F1-F4). The HUD never touches money (guard test).
- Acceptance: all gates; ledger invariants per seat and in total; a one-seat run reproduces the v0.17.0 report; zone and owner tests.
- Then B3 (give and cede), B4 (governors and the lumber sink), B5 (lives and difficulty), B6 (re-measure and rebalance).
- Owner action still pending: browser smoke run of 1-40, victory/defeat, pause/resume and restart (not executed since v0.2.1); record it in
  the `docs/QA.md` smoke log. Also compare the new field with the real Burbenog map and say what differs (a screenshot of the original
  settles the road layout); play waves 1-3 and the wave 10 boss once and note the lives lost.
- Secondary candidates: late-game acceptance bar for waves 21-40; official Phaser type declarations in a dedicated patch; decide whether
  cannon splash may hit flying enemies (currently it does); structured save schema; the menu still prints a hard-coded "v0.1.0";
  `tsconfig.json` compatibility with TypeScript 6 (a 6.0.3 compiler reports TS5101 for `baseUrl` and TS5011 for `rootDir`; ^5.7.2 is pinned).
