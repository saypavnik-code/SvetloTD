# Svetlogorsk TD

A Burbenog-inspired, original 2D tower defense prototype built with TypeScript, Phaser 3, and Vite.
The canonical playable application lives at the repository root (`src/`). The separate
`SvetloTD-live/` snapshot is **legacy reference only**; do not deploy or delete it
until its mobile and meta-progression features have been compared and migrated.

## Current baseline

- Four identical-length routes toward a symmetrical 2x2 central citadel.
- Build, upgrade and sell towers; ground and air enemies; hero skills; gold/lumber.
- 40 wave definitions: 1-20 authored, 21-40 provisional and **not yet balanced**.
- Deterministic 40px terrain textures and 12 prototype tower/creature sprites generated with Python standard library.
- Keyboard/mouse first; mobile and network co-op are roadmap work, not shipped features.

## Quality gates

```sh
python3 scripts/generate_art.py
python3 scripts/validate_game.py
npm install
npm run typecheck
npm run build
python3 scripts/check_bundle.py
```

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
