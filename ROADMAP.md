# Development roadmap (2026-10 baseline)

Legend: [x] implementation in this patch; [ ] planned / not verified in a browser.

## Current state (v0.8.0)

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
- [ ] Mid game: measure and rebalance waves 11-40 and the hard and insane presets (both fail the opening bar). Start
  from `docs/BALANCE_PROPOSALS.md` ("Where the best build loses") and `docs/ECONOMY_REPORT.md`: interest is worth 56% of
  income when nothing is spent, bounties do not scale with wave HP, no tower uses the `normal` damage type, and a
  tier-2 upgrade gives less damage per gold than another tier-1 tower.
- [ ] Lumber sink (owner decision 2026-10-11: later): mercenaries and tier-3 towers as the `LumberManager` header
  describes; needs new content. A TODO test tracks it.
- [ ] Add structured save schema, migration, replay seeds, crash reporting (consent-aware).
- [x] Triage and remove `SvetloTD-live/`; implement safe aura and input capability boundary (`docs/MIGRATION.md`).
- [ ] Implement explicit ownership of EventBus subscriptions in every scene/UI component.
- [ ] Usability pass: gamefield vs 560px panel, pause, keyboard, mobile and safe areas.

## P2 - game design / visual production

- [ ] Tower schools and counters; at least three viable strategies for waves 10/20/30/40.
- [ ] Art bible: silhouette language, scale, palette, contrast and animations.
- [ ] Replace prototypes with authored 2D sprite atlases, 2-4 animation states each.
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

## Next sprint (recommended): v0.9.0 mid-game measurement and proposals

- Objective: the opening is fixed; the best catalogued build now loses in waves 11-14 (idle hero: wave 11). Measure the
  mid game and put proposals on the table; no data change without the owner's pick. Priority: P0.
- Scope: (1) raise the acceptance bar to waves 1-20 and add `CANDIDATES` in `scripts/balance_proposals.mjs` for the HP
  curve of waves 11-40, bounty scaling and the interest rate; (2) include hard and insane, which fail the opening bar
  today; (3) put the two design questions of the report to the owner with numbers: no tower uses the `normal` damage type,
  and tier-2 upgrades give less damage per gold than another tier-1 tower.
- Dependencies: `tests/support/simulate.mjs`, `scripts/balance_proposals.mjs`, `docs/BALANCE_PROPOSALS.md`.
- Acceptance: at least one proposal lets the best build hold waves 1-20 on normal with an idle and with a scripted
  hero; every proposal is measured in the generated document; the document-sync test passes.
- Owner action still pending: browser smoke run of 1-40, victory/defeat, pause/resume and restart (not executed
  since v0.2.1); record it in the `docs/QA.md` smoke log. Also play waves 1-3 once with hero skills and note the
  lives lost: the new opening may be easy for a human.
- Secondary candidates, in order: explicit EventBus subscription ownership in UI components; official Phaser type
  declarations in a dedicated patch; decide whether cannon splash may hit flying enemies (currently it does);
  structured save schema; `tsconfig.json` compatibility with TypeScript 6 (a 6.0.3 compiler reports TS5101 for
  the deprecated `baseUrl` and TS5011 for `rootDir`; the project pins ^5.7.2 and is unaffected today).
