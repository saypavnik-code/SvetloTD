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
- `SvetloTD-live/` is an unmerged branch snapshot; preserve unique code until reviewed.

## Known risk

The legacy `src/types/phaser.d.ts` shim is incomplete by design and needs replacement
with the dependency-provided Phaser declarations after a full Node+browser audit.
Do not mistake a shim-only typecheck for runtime verification.
