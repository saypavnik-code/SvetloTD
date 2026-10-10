# Architecture and invariants

## Canonical app

Root `src/main.ts` boots Phaser Scenes: Boot -> Menu -> Game -> GameOver.
`GameScene` orchestrates but must not own numerical game rules. Data lives in `src/data/`;
combat entities in `src/entities/`; services in `src/systems/`; HUD in `src/ui/`.
`EventBus` is an event contract, not a place to store mutable game state.

## Geometry (one source of truth)

- Map: 18x18, 40px per tile, 720x720 field and a separate 560px HUD panel.
- The 2x2 center is at tiles (8,8)-(9,9). Center pixel is (360,360).
- Roads occupy columns 8-9 and rows 8-9; paths enter from four sides.
- Routes are data-derived, end at the same mathematical center, and never traverse buildable cells.
- Path and map must remain invariant under horizontal/vertical reflection.

## Entity lifecycle

- Checkout from ObjectPool exactly once; release exactly once after finished state.
- Projectile impact and splash lifetime are distinct; do not release until effects finish.
- Enemy death emits a reward once; dying animation may continue without double rewards.
- Scene event handlers are registered during create and unregistered on shutdown.
- Speed scaling applies to simulation, not to ambient audio real time.

## Operations and deployment

- Vite builds client-only static assets; no secrets or server-only SDK in this bundle.
- `deploy/vibecode/server.mjs` is a standalone, minimal static HTTP server.
- Platform SDK APIs are added behind a boundary only after the exact target is selected.
- No second application tree; rejected legacy experiments are recoverable at Git `3c2983e`.

## Known risk

The legacy `src/types/phaser.d.ts` shim is incomplete by design and needs replacement
with the dependency-provided Phaser declarations after a full Node+browser audit.
Do not mistake a shim-only typecheck for runtime verification.

## v0.2.1 lifecycle and feature boundaries

- `GameScene.create()` resets reusable Scene state; terminal GAME_OVER freezes immediately.
- `BuildSystem` uses an interaction guard to reject building/upgrade/sell during modals.
- `AuraSystem` recalculates non-stacking watchtower effects, clearing absent emitters.
- `EconomyManager` and `LumberManager` reject negative and non-finite inputs.
- `InputCapabilities` is a pure browser boundary; existing Q/W slots are touch buttons on touch devices.
- VK reward ads, persistent meta bonuses and touch-only overlay are deferred by design.

## v0.3.0 simulation boundaries

- `WaveManager.update()` is the only place that completes a wave; `_onEnemyRemoved` only counts removals.
  Completion runs after the tick's enemy updates, so scene listeners such as the life loss run first,
  and a resulting GAME_OVER halts the manager (`_terminated`) before any wave transition.
- `WaveManager._beginCountdown()` is the single emitter of BUILD_PHASE_START (every countdown is a build
  phase); `_launchWave()` emits BUILD_PHASE_END.
- `systems/HitEffects.ts` is the single authority that turns `TowerSpecial` data into status effects,
  including the area slow. `Tower` only calls it.
- `StatusEffectSystem` carries fractional poison damage between frames. `EffectType` has no `aoe_slow`:
  the area slow is applied to each enemy as a plain `slow`.
- Tests load the real TypeScript through `tests/support/load-source.mjs` (one loader, Phaser stubbed).

## v0.4.0 tower timing model

- `Tower.update()` advances a game-time cooldown. A ready tower with a stale target re-acquires at once;
  firing adds the interval to the cooldown (the overshoot of the frame is carried), and an idle tower's
  cooldown is clamped at zero so shots cannot be banked.
- `Tower.setTargetPriority()` is the only way to change the rule; it resets the target. Upgrades copy the
  priority to the new tower in `BuildSystem.upgradeSelected()`.
- `tests/combat.test.mjs` drives entities with a chainable Phaser stand-in; it reads private state
  (`_target`, `_place`) only where the real path needs pointer input.
