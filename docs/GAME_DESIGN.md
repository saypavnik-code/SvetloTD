# Design rules and Burbenog research

## Verified original traits (version dependent)

Read on 2026-10-16 (the original is a Warcraft III map with many versions; nothing below is true of every version):

- Four players, co-operative, one team: the goal is to keep the monsters from reaching the centre (the village) for 40 levels; some versions
  also run 2 players, 8 players, a 54-level blitz or 20 lives and 32 waves (wc3maps.com/map/8825, /map/360935, Softpedia review of v2.32).
- Equal seats: "all player spots are 100% fair"; every player gets the same creeps and the same starting point; leaks run on into the
  next player's area (Ralle's tower defence guide, Hive Workshop).
- The monsters start from the corners and pass through all four players' areas before they head for the middle of the map (Softpedia).
  No source gives the exact road layout.
- Governors: 10 in v2.32, 12-15 later, each with a different element set and four builder types; the main builder is free, every further
  builder costs 1 lumber; 1 lumber arrives after every 5th level; lumber also buys the hero, a tech building and the ultimate tower
  (Softpedia, wc3maps). 80-120 towers across the governors.
- The hero catches leaks and has special abilities.
- Lives are shared: easy 50, normal 25, hard 1, expert 1 with random waves (v2.32).
- Team play: towers can be ceded to another player (it changes colour), gold and lumber can be given; later versions add shared income, blitz
  and endless-spawn modes and commands to list waves and armour types.

Earlier references (not re-checked in v0.16.0):
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

Today (v0.16.0): a solo prototype on a plus-shaped four-lane map, 40 waves; the final 20 waves are provisional,
not a balanced campaign. Planned: the square map with four seats (next section), governors, a lumber sink,
cooperative authority model and player-count scaling after measured playtests.

## Target design: square map, four seats (owner decision 2026-10-16)

The owner's reading of the original: everything is built around a square, and up to four players take part. The adaptation keeps that and
stays inside the 18x18 board and the existing combat rules. Milestones: the Burbenog track in `ROADMAP.md`.

- Map (B1, v0.17.0): a square road ring two tiles inside the field edge with a spawn portal on each corner and the shared 2x2 base in the
  middle. Every enemy runs clockwise around the whole ring from its own corner, passes the zones of all four seats, leaves the ring on its
  own one-tile spur and enters the base. The four routes are one route turned by 90 degrees: equal length, rotation symmetry, never a mirror.
  Flyers fly straight from their corner to the base. "First" and "last" targeting use the walking distance left.
- Seats (B2): the four quadrants are the zones of seats 1-4 (north-west, north-east, south-east, south-west); a seat builds only in its
  own zone. Gold and lumber are per seat, lives are shared, a lone player owns all four seats and one wallet (today's economy).
- Teamwork (B3): give gold or lumber to a seat; cede a tower (its refund then goes to the new owner); optional shared income.
- Governors (B4): a governor is an element set over the 10 tower kinds. The first builder is free; an extra builder, the hero, a tech building
  and the ultimate tower cost lumber (1 lumber per 5 waves, as now). This replaces the unfinished mercenary idea of the `LumberManager` header.
- Lives and difficulty (B5): 50 / 25 / 1 / 1 with random waves, scaled by the number of seats; the current 20 lives are a placeholder.
- Balance (B6): the first measurement on the square map (v0.17.0) is in `docs/ECONOMY_REPORT.md`; nothing is called balanced before B6.

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

## Tower targeting and fire rate (v0.4.0)

- A tower keeps its current target until it dies or leaves range (sticky targets); a new target is
  chosen by the tower's priority: first (closest to the base), last, strongest, weakest, nearest.
- Changing the priority re-targets on the next update; upgrading a tower keeps the chosen priority.
- A tower whose target dies between target ticks (every 200 ms of game time) re-acquires at once; the
  shot is not lost.
- Fire rate equals attackSpeed shots per second of game time regardless of frame length. Game speed
  scales time once. An idle tower cannot bank shots.
- Amber Shield: +25% attack speed for 6 s to towers within 130 px of the hero; refreshing does not stack.
  The Watchtower aura multiplies with it.
- The tower panel sell button shows the refund for the current phase (100% between waves, 70% in combat).
- Open design question (not changed): cannon splash also damages flying enemies caught in the blast.

## Economy and opening (v0.8.0)

- Starting gold: 300 normal, 260 hard, 200 insane (twice the earlier values; owner decision, candidate C of the v0.7.0
  proposals).
- Wave bonus: `round(bonusGold x waveBonusMult)` with 1.0 / 0.8 / 0.6. Interest: `floor(unspent gold x interestRate)`, 5% / 3% / 1%,
  paid first when a wave is cleared.
- Bounties: grunt 6, runner 5, golem 21, wyvern 11, Goliath 90.
- Wave taper (proposal D): HP and count start at 40% / 80% at wave 1 (6 goblins at 40% HP) and move linearly to 30% at wave 40;
  single-enemy waves keep their count of 1. The wave bonus pays 2x the written `bonusGold` (before the difficulty multiplier).
  Constants: `WAVE_TAPER` and `WAVE_BONUS_FACTOR` in `src/data/waves.ts`.
- Lumber is earned every 5 waves and from golems and bosses; nothing spends it yet (a sink is planned).
- Measured status: `docs/ECONOMY_REPORT.md` and `docs/BALANCE_PROPOSALS.md`. Waves 11-40 and the hard and insane presets are
  not rebalanced.

## Square map rules (v0.17.0)

- Geometry: 18x18 tiles of 40 px. The road ring runs on tiles 2 and 15 (rows and columns), 52 tiles; each spawn adds a spur of 5 tiles
  on its own base row or column (rows/columns 3-7 or 10-14), so there are 72 road tiles, 4 base tiles and 248 buildable tiles. Towers fit
  inside the ring, outside it and beside the spurs.
- Routes: spawn 0 starts on the north-west ring corner, runs clockwise over the whole north, east and south sides and up the west side to
  the base row, then along the spur into the base; spawns 1-3 are the same route turned by 90, 180 and 270 degrees. Every route is 52 tiles
  long and ends at the exact centre of the base; every enemy crosses all four quadrants.
- Targeting: "first" and "last" use `Enemy.distanceToBase` (the walking distance left; the straight distance for flyers). Sticky targets,
  priorities and fire rates are unchanged.
- Waves: `wave.paths` keeps its meaning (-1 spreads a wave over all four spawns in turn, 0-3 uses one spawn); the wave 10 and 15 bosses
  still use spawns 0 and 1 (open question: a boss per seat).
- Hero: starts on the base and auto-attacks there; skills are about leaks (the ring is 260 px from the base).
- Measured effect (normal, `docs/ECONOMY_REPORT.md`): the best catalogued build is defeated in wave 31 (the cross map: 28 with skills, 25 idle),
  15 lives at wave 21 (10). A wave takes much longer to finish (route 2080 px; a grunt needs 35 s). Values are measurements, not balance.

## Seat rules (v0.18.0)

- Zones: the quadrants, numbered clockwise from the north-west (0 NW, 1 NE, 2 SE, 3 SW); every zone has 62 building tiles. A quarter turn
  moves each zone on by one, like the spawns.
- Owners: one seat owns all four zones; two seats own two neighbouring zones each (0-1 and 2-3); four seats own one zone each. A seat builds
  only in its own zones; a tile in a foreign zone is refused like an occupied one.
- Money: gold and lumber are per seat. The start gold and each wave bonus are split between the seats without losing a coin (the first seats
  get the remainder); interest is paid on each seat's own gold; every seat gets the lumber of a 5th wave; lives are one pool for the team.
- Kills: a projectile credits its tower's seat before the damage, so the bounty and the lumber of the kill go to the seat whose tower hit
  last (poison ticks keep crediting the last hit; the hero adds no credit, so a kill by the hero alone pays seat 0).
- Ownership of a tower: only its owner upgrades or sells it; the upgrade keeps the owner and the refund goes to the owner's wallet at the
  usual rate (full in a countdown, 70% in combat). Give and cede come with B3.
- Shared screen: `?seats=2` or `?seats=4` in the page address. The HUD shows the active seat, the right panel has one chip per seat with its
  gold and lumber (click it, or press Z X C V, to take that seat; the half-made placement and the selection are dropped), each zone has a
  tint in its seat colour and every tower an owner dot. A menu choice is still to do.
- Measured: with one seat the economy and the reports are identical to v0.17.0 (the report tests did not change); the multi-seat balance is
  not measured before B6.
