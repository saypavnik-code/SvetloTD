# Svetlogorsk TD

A Burbenog-inspired, original 2D tower defense prototype built with TypeScript, Phaser 3, and Vite.
The only application source tree is the root `src/`. The former `SvetloTD-live/`
snapshot was triaged and removed in v0.2.1; its files remain recoverable from
Git commit `3c2983e`. See `docs/MIGRATION.md`.

## Current baseline

- Four identical-length routes toward a symmetrical 2x2 central citadel.
- Build, upgrade and sell towers; ground and air enemies; hero skills; gold/lumber.
- 40 wave definitions: 1-20 authored, 21-40 provisional and **not yet balanced**.
- Deterministic 40px terrain textures and 12 prototype tower/creature sprites generated with Python standard library.
- Keyboard/mouse first; mobile and network co-op are roadmap work, not shipped features.
- Headless regression tests cover the wave lifecycle, combat primitives and the build/sell economy.
  Browser gameplay has not been smoke-tested since v0.2.1; see `docs/QA.md`.

## Quality gates

```sh
python3 scripts/generate_art.py
python3 scripts/validate_game.py
npm run test:unit
npm install
npm run typecheck
npm run build
python3 scripts/check_bundle.py
```

`npm run test:unit` runs the headless suites in `tests/` (runtime invariants, data, wave simulation, combat);
`docs/QA.md` lists what they cover and what they do not.
`npm install` should create a `package-lock.json` if one does not already exist.
Commit the lockfile for reproducibility; then prefer `npm ci` in CI.
The old Phaser type shim is an acknowledged migration item; passing typecheck
against the shim is not equivalent to a browser gameplay test.

## Controls

`1-5` choose a tower; left click place/select; right click move hero;
`Q/W` hero skills; `U` upgrade; `Delete` sell; `Tab` tower ranges;
`Space` skip countdown; `Esc` pause/cancel; `M` main menu.

## Project documents

- `AGENTS.md`: mandatory AI-assisted coding contract.
- `ARCHITECTURE.md`: systems, invariants, integration boundaries.
- `DESIGN.md`: visual language and UI guidance.
- `docs/GAME_DESIGN.md`: mechanics and Burbenog lessons.
- `ROADMAP.md`: prioritized build plan, acceptance criteria.
- `docs/DEPLOYMENT.md`: GitHub Pages, VK Play, Bitrix24 Vibe.
- `docs/QA.md`: verification and release workflow.

This is an independent homage. Do not redistribute Warcraft III maps or copyrighted art/sounds.

## Patch lifecycle

One-time scripts use unique names: `patch_svetlogorsk_td_vMAJOR_MINOR_PATCH_topic.py`.
Read `docs/PATCH_POLICY.md` before any change. Never reuse a filename or patch
version. No patch may commit or push if verification fails. Apply pending patches in version order, each
after its own `--dry-run`.
