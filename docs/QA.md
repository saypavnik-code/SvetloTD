# QA and release checklist

1. Regenerate textures; compare output deterministically to committed assets.
2. Run `python3 scripts/validate_game.py` and `npm run typecheck`.
3. Run `npm run build`, `python3 scripts/check_bundle.py`; inspect output changes.
4. Manually play: choose each tower, upgrade, sell in/out of combat, hero Q/W,
   flying/ground enemies, splash, leaks, boss, win, lose, restart.
5. Test at 1x/2x/3x; confirm no projectile pool growth after stable waves.
6. Run desktop Chrome/Firefox, Safari, touchscreen; check safe-area clipping.
7. Inspect console errors, mute/unmute, tab hide/return, event listener growth.
8. Test embed on target platform separately. Record exact SDK/version/date.
9. Never approve a release solely on static assertions or a successful build.

Current audit: source-only Repomix review. The canonical Git repository and browser
were not available; integration/runtime results must be recorded after applying.
