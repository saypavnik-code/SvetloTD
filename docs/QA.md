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

## v0.2.1 migration regression gates

`npm run test:unit` uses the built-in Node test runner and the installed TypeScript compiler (no Jest).
It covers map symmetry, 40 waves, watchtower non-stacking/expiry,
resource abuse, terminal event deduplication and object-pool double release.
Static validation alone is **not** an E2E/browser test.

Manual browser smoke (still pending): start -> first wave -> place & upgrade ->
pause and try building -> resume -> sell final watchtower -> lose all lives ->
retry -> inspect fresh Q/W HUD and restored economy -> menu -> play -> confirm
no duplicated dust, skills or listeners; finish wave 40 and retry after victory.
Repeat on desktop Chrome/Firefox and mobile touch devices (including tap-to-cast Q/W).

## v0.3.0 simulation gates

`npm run test:unit` also runs `tests/simulation.test.mjs` and `tests/data.test.mjs`
(shared loader: `tests/support/load-source.mjs`). They cover:

- poison damage equals value x duration at 144/60/30/20/10 fps; stacking and refresh rules;
- an enemy killed by poison dies once and no longer heals or moves;
- Ice Bastion area slow: radius, boundary, dead enemies, expiry, primary slow not overwritten;
- headless 40-wave run: each wave cleared once, one bonus per wave, one victory, enemies returned
  to the pool between waves, same outcome at 0.1 s and 0.3 s steps;
- defeat: one terminal event and the wave manager stops; defeat wins over a same-tick wave clear
  and over a final-boss victory;
- sell refund 100% in every countdown (including before wave 1), 70% in combat;
- consistency of wave, enemy, tower and damage-matrix data.

Limits: logic tests on the real TypeScript sources with Phaser stubbed. They do not execute
rendering, input, tweens, audio or the Phaser scene lifecycle. Tower targeting, projectile flight,
hero skills, build/upgrade/sell and the HUD are not covered yet. The browser smoke above was not
run for v0.3.0.
