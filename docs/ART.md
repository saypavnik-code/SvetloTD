# Art pipeline

All art is drawn by two deterministic scripts (Pillow, 4x supersampling, ink outline `#1A120C`); never edit a PNG by hand. Regenerate with
`python3 scripts/generate_art.py && python3 scripts/generate_sprite_art.py && python3 scripts/generate_ui_art.py` (in this order: the first one writes the plain terrain).
`tests/art.test.mjs` pins sizes, silhouettes and symmetry; `scripts/validate_game.py` checks the sizes without Node.

## What is drawn where

| Asset | Script | Size on disk | Drawn at | Texture key | Used by |
| --- | --- | --- | --- | --- | --- |
| `art/citadel.png` | `generate_sprite_art.py` | 160 | 80 (the 2x2 base) | `spr_citadel` | `GameScene._buildBase` |
| `art/spawn_portal.png` | `generate_sprite_art.py` | 112 | 56 (turns once per 24 s) | `spr_spawn_portal` | `GameScene._drawSpawnPortals` |
| `ui/builder_<id>.png` (6) | `generate_ui_art.py` | 96 | 20 | `builder_<id>` | `BuilderPanel` rows |
| `ui/dmg_<id>.png` (5) | `generate_ui_art.py` | 64 | 16 | `dmg_<id>` | `TowerPanel` tooltip |
| `ui/armor_<id>.png` (6) | `generate_ui_art.py` | 64 | 14 | `armor_<id>` | `WaveInfo` countdown hint |

The ids are read from the data (`BUILDER_IDS`, `DAMAGE_MATRIX`) by `BootScene`, so a new builder, damage type or armor class fails the tests until its icon exists.
Armor classes are told apart by shape (rag, round buckler, kite shield, tall shield, crenellated wall, winged crest), not only by colour; the test requires
that no two silhouettes overlap by 85% or more. The palette is `COLORS` in `src/config.ts` and the element colours of `src/data/builders.ts`; there is no second palette file.

## The art brief (`ART_BRIEF.md` from the owner): what was adopted

- Adopted: builder emblems, damage and armor icons, the base and the spawn gate, the "grim-tactile" look (stone, walnut, amber, ink outline).
- Changed on purpose: the citadel is 2x2 (80 px), not 3x3 (120 px): the shared base is the 2x2 centre of the 18x18 square, and a 3x3 sprite centred on a tile cannot be
  centred on the map, which breaks the four-fold symmetry every route and fairness test relies on. The portal is drawn over its one spawn tile (56 px) instead of 2x2,
  because three of the four cells of a 2x2 portal are buildable cells.
- Not adopted: a `TactileEntityView`, a `graphicsConfig.ts` and a `src/world/` folder. `ui/SpriteViews` already flips by heading, breathes and lifts flyers; a second
  per-entity container would double the work and the leaks the pooled views were written to avoid.
- Names: the brief lost its underscores and backticks in markdown (`builderfire`, `_chaos`); the files follow the repository convention `builder_fire`, `dmg_chaos`, `armor_heavy`.

## Open

Projectiles and hit effects, road-edge tiles, nine-slice panel and button frames, seat-coloured pads, lighting (Light2D), vignette, bloom and screen shake
(the last four need a browser check and a separate UI camera), walk-cycle frames. Known flaw of older sprites (watchtower, ultimate towers): the soft glow is cut by the canvas
edge and shows as a faint rectangle; fixing it changes existing PNGs, so it belongs to its own patch.
