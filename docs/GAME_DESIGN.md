# Design rules and Burbenog research

## Verified original traits (version dependent)

Burbenog TD versions commonly feature four-player defense of a shared center,
40 waves, governor/race specialization, heroes, distinctive abilities,
and shared economy game modes. The 2.34m branch documents upgradeable towers.
Other versions emphasize combining elemental specialties instead of direct upgrades.
See the original map descriptions, not any one variant as universal truth:
- https://www.wc3maps.com/map/279529
- https://wc3maps.com/map/55
- https://www.hiveworkshop.com/threads/burbenog-td-idea-for-24-players.306393/

## Keep

- Symmetric defense and a shared, visible loss condition.
- Distinct tower choices with armor/air/slow/splash tradeoffs.
- Gold-vs-tower investment decisions, hero rescue skills, boss telegraphing.
- Team composition and communicating lane responsibilities (future co-op).

## Improve

- Scale lives, income and wave pressure by active players; allow rejoin in network play.
- Explain enemy armor and tower counters in tooltips; make losses understandable.
- Avoid one compulsory build order; tune choice diversity with simulation telemetry.
- Onboarding with optional hints, pause in solo, accessibility and reduced VFX.
- No pay-to-win for power-critical features; test monetization separately.

## Baseline today vs planned

Today: a solo, four-lane 40-wave prototype; the final 20 waves are provisional,
not a balanced campaign. Future: selectable tower schools, alternate paths,
cooperative authority model and player-count scaling after measured playtests.

## Implemented combat and economy rules (v0.3.0)

- Poison (Alchemist, `acid_t1`): 8 damage per second for 3 s, chaos type. The same source refreshes,
  different sources stack. Total damage per application is value x duration whatever the frame rate.
  Armor reduction scales each whole-point tick and is rounded per tick, so its effect on poison is approximate.
- Area slow (Ice Bastion, `slow_t2`): the target is slowed 55% for 2.5 s; every living enemy, air or
  ground, within 50 px of the target is slowed 35% for 1.5 s. Slows do not stack; the strongest applies.
- Sell refund: 100% during every countdown between waves, including the one before wave 1;
  70% while a wave is in progress.
- Terminal state: losing the final life is a defeat even when that enemy was the last of its wave
  (or of wave 40); no wave bonus or victory is awarded in that case.
- Wave completion is evaluated once per simulation tick after that tick's kill and leak events, so a
  clear can be recognised up to one tick after the last enemy dies.
