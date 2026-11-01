# Changelog

<!-- [3b:touch-controls] -->
### Touch controls
- Placement on a finger: a tap previews the cell, 48 px confirm and cancel buttons build or cancel, dragging moves the preview; the mouse path is unchanged.
- A tap on bare ground sends the hero there (touch has no right button); the tutorial text follows the input device.
- Hit zones: hero skills 48 px, upgrade buttons, priority arrows and the sell button 44 px.

### HD Graphics, Combat VFX & Mobile Touch Polish
- Upgraded procedural sprite, medallion, icon, and seamless tile generators with PBR-style shading, contact shadows, and supersampled Lanczos downsampling.
- Added projectile halos, white-hot cores, comet streaks, dual shockwave rings, radial sparks, framed/sheened enemy health bars, boss golden bezels, status aura rings, tower pads/tier pips, and hero command auras.
- Fixed HUD lives shake drift, GameOverScene card shadow, TowerPanel/GameScene tween overlaps, and live upgrade button refresh in `TowerPanel.update()`.
- Added high-DPI canvas filtering, `>= 44px` touch hit zones, and touch-friendly placement/hero controls.
