# Development roadmap (2026-10 baseline)

Legend: [x] implementation in this patch; [ ] planned / not verified in a browser.

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
- [ ] Remaining unit/integration tests: hero skill cooldowns, tower targeting and priority, build/upgrade/sell flows, projectile lifecycle (wave completion and no double reward: v0.3.0).
- [ ] Playtest and numerically rebalance levels 21-40 and all difficulty presets.
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
- [ ] Add benchmark and economy-simulation tests before rebalancing 21-40.

## Next sprint (recommended): v0.4.0 combat and economy simulation harness

- Objective: measure, do not guess, before any rebalancing. Priority: P0/P1.
- Scope: deterministic headless simulation of tower targeting, projectile flight, damage and gold income over waves 1-40 for a few representative builds; hero skill cooldown and build/upgrade/sell tests.
- Dependencies: v0.3.0 shared test loader and wave simulation helpers (`tests/support/load-source.mjs`, `tests/simulation.test.mjs`).
- Acceptance: reproducible report of leaks and gold per wave for each build; failing tests for every defect found; no balance changes in the same patch.
- Owner action still pending: browser smoke run of 1-40, victory/defeat, pause/resume and restart (not executed in v0.3.0).
