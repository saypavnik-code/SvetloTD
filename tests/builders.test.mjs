import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/config.ts', 'src/config/difficulty.ts', 'src/data/seats.ts', 'src/data/mapData.ts', 'src/data/pathData.ts',
  'src/data/towers.ts', 'src/data/builders.ts', 'src/systems/Seats.ts', 'src/systems/EconomyManager.ts',
  'src/systems/LumberManager.ts', 'src/systems/BuilderManager.ts', 'src/systems/BuildSystem.ts', 'src/systems/GameSpeed.ts',
  'src/entities/Enemy.ts', 'src/entities/Projectile.ts', 'src/entities/Tower.ts', 'src/utils/ObjectPool.ts', 'src/utils/EventBus.ts',
);
const { EventBus, GameEvents, GameConfig, BUILDERS, BUILDER_IDS, COMMON_TOWER_IDS, TOWER_DEFS, BUILDABLE_TOWER_IDS } = game;
const OPEN = BUILDER_IDS.filter((id) => BUILDERS[id].open);

function recorder(event) {
  const calls = [];
  const fn = (...args) => calls.push(args);
  EventBus.on(event, fn);
  return { calls, stop: () => EventBus.off(event, fn) };
}

// ── Data ────────────────────────────────────────────────────────────────────

test('every tower kind is reachable: through exactly one builder line, or as a common tower', () => {
  const owners = new Map();
  for (const id of BUILDER_IDS) {
    for (const root of BUILDERS[id].roots) {
      for (const tower of game.towerLine(root)) {
        assert(!owners.has(tower), `${tower} belongs to ${owners.get(tower)} and ${id}`);
        owners.set(tower, id);
      }
    }
  }
  for (const tower of COMMON_TOWER_IDS) assert(!owners.has(tower), `${tower} is common and in a line`);
  for (const id of Object.keys(TOWER_DEFS)) {
    assert(owners.has(id) || COMMON_TOWER_IDS.includes(id), `${id} cannot be reached through any builder`);
  }
  assert.deepEqual([...BUILDABLE_TOWER_IDS].sort(), [...OPEN.flatMap((id) => BUILDERS[id].roots), ...COMMON_TOWER_IDS].sort(),
    'the roots of the open builders plus the common towers are exactly the buildable list');
});

test('open builders have a roster and an ultimate that costs lumber; placeholders are closed and empty', () => {
  assert(OPEN.length >= 4, 'at least four core builders');
  for (const id of OPEN) {
    const builder = BUILDERS[id];
    assert(builder.roots.length > 0, `${id}: no roots`);
    const ultimate = TOWER_DEFS[builder.ultimate];
    assert(ultimate, `${id}: ultimate ${builder.ultimate} is undefined`);
    assert(ultimate.lumberCost > 0 && ultimate.cost > 0, `${id}: an ultimate costs gold and lumber`);
    const parents = Object.values(TOWER_DEFS).filter((tower) => tower.upgradeTo.includes(builder.ultimate));
    assert.equal(parents.length, 1, `${id}: the ultimate has one parent`);
    assert.equal(game.builderOfTower(parents[0].id), id, `${id}: the parent is in the same line`);
    assert(parents[0].upgradeTo.length === 1 && TOWER_DEFS[parents[0].id].lumberCost === 0, `${id}: the parent is a plain tier-2 tower`);
  }
  for (const id of BUILDER_IDS.filter((b) => !BUILDERS[b].open)) {
    assert.deepEqual([BUILDERS[id].roots.length, BUILDERS[id].ultimate], [0, null], `${id}: a placeholder has no roster`);
  }
  for (const tower of Object.values(TOWER_DEFS)) {
    if (!OPEN.some((id) => BUILDERS[id].ultimate === tower.id)) assert.equal(tower.lumberCost, 0, `${tower.id}: only ultimates cost lumber`);
  }
});

test('builder picks in the URL: names, all, junk and placeholders', () => {
  const parse = (query) => game.parseBuilderPicks(query);
  assert.equal(parse(''), null);
  assert.equal(parse('?seats=4'), null);
  assert.equal(parse('?builders=all'), 'all');
  assert.deepEqual(parse('?builders=fire,water'), ['fire', 'water']);
  assert.deepEqual(parse('?builders=nope,earth, nature '), ['earth', 'nature']);
  assert.equal(parse('?builders=light'), null, 'a placeholder cannot be picked');
  assert.equal(parse('?builders='), null);
  const { BuilderManager } = game;
  assert.equal(BuilderManager.startFor(1, null), 'all', 'a one-seat game owns every builder unless it asks otherwise');
  assert.deepEqual(BuilderManager.startFor(4, null), game.DEFAULT_PICKS);
  assert.deepEqual(BuilderManager.startFor(1, ['fire']), ['fire'], 'a pick makes even a one-seat game licensed');
});

// ── Licenses, mastery and the lumber ledger ─────────────────────────────────

function world(seatCount, start) {
  const lumber = new game.LumberManager(seatCount);
  return { lumber, builders: new game.BuilderManager(lumber, seatCount, start) };
}

test('every seat starts with one free builder; the all mode owns every open builder', () => {
  const four = world(4, game.DEFAULT_PICKS).builders;
  assert.deepEqual([0, 1, 2, 3].map((seat) => four.ownedBy(seat)), [['fire'], ['earth'], ['nature'], ['water']]);
  const picked = world(2, ['water']).builders;
  assert.deepEqual([picked.ownedBy(0), picked.ownedBy(1)], [['water'], ['earth']], 'a missing pick falls back to the default of that seat');
  const bad = world(1, ['light']).builders;
  assert.deepEqual(bad.ownedBy(0), ['fire'], 'a placeholder is never owned, not even as the free pick');
  const classic = world(1, 'all').builders;
  assert.deepEqual(classic.ownedBy(0), OPEN);
  assert.equal(classic.nextLicenseCost(0), null, 'nothing left to buy');
});

test('licenses cost lumber, rising with every builder owned; a refused purchase spends and announces nothing', () => {
  const { lumber, builders } = world(2, ['fire', 'fire']);
  const seen = recorder(GameEvents.BUILDERS_CHANGED);
  const lumberSeen = recorder(GameEvents.LUMBER_CHANGED);
  assert.equal(builders.nextLicenseCost(0), game.LICENSE_LUMBER[0]);
  assert.equal(builders.buyLicense(0, 'water'), false, 'no lumber yet');
  lumber.add(20, 0);
  lumberSeen.calls.length = 0;
  assert.equal(builders.buyLicense(0, 'water'), true);
  assert.equal(builders.nextLicenseCost(0), game.LICENSE_LUMBER[1], 'the third builder costs more');
  assert.equal(builders.buyLicense(0, 'earth'), true);
  assert.equal(builders.buyLicense(0, 'nature'), true);
  assert.equal(lumber.lumberOf(0), 20 - game.LICENSE_LUMBER.reduce((a, b) => a + b, 0), 'the ledger: lumber gone equals the prices');
  assert.equal(lumber.lumberOf(1), 0, 'the other seat paid nothing');
  assert.deepEqual(lumberSeen.calls.map((c) => c[1]), [0, 0, 0], 'only the buyer\'s wallet announced');
  const quiet = recorder(GameEvents.BUILDERS_CHANGED);
  for (const [seat, id] of [[0, 'water'], [0, 'light'], [0, 'shadow'], [0, 'nope'], [5, 'water'], [-1, 'water'], [1, 'light']]) {
    assert.equal(builders.buyLicense(seat, id), false, `${seat} ${id}`);
  }
  quiet.stop(); seen.stop(); lumberSeen.stop();
  assert.deepEqual(quiet.calls, [], 'a refused license announces nothing');
  assert.equal(lumber.lumberOf(0), 20 - game.LICENSE_LUMBER.reduce((a, b) => a + b, 0));
  assert.equal(seen.calls.length, 3, 'one announcement per bought license');
});

test('mastery: needs the builder, costs lumber once, unlocks the ultimate of that builder only', () => {
  const { lumber, builders } = world(2, ['fire', 'earth']);
  assert.equal(builders.canUpgrade(0, 'fire_ult'), false, 'no mastery yet');
  assert.equal(builders.research(0, 'fire'), false, 'no lumber');
  assert.equal(builders.research(0, 'earth'), false, 'seat 0 does not own earth');
  lumber.add(game.MASTERY_LUMBER + 1, 0);
  assert.equal(builders.research(0, 'fire'), true);
  assert.equal(lumber.lumberOf(0), 1);
  assert.equal(builders.research(0, 'fire'), false, 'researched once');
  assert.equal(builders.research(0, 'light'), false, 'a placeholder has no mastery');
  assert.equal(builders.canUpgrade(0, 'fire_ult'), true);
  assert.equal(builders.canUpgrade(1, 'fire_ult'), false, 'mastery belongs to the seat');
  assert.equal(builders.canUpgrade(0, 'earth_ult'), false, 'another builder\'s ultimate');
  assert.equal(builders.canUpgrade(0, 'magic_t2'), true, 'a plain tier-2 tower of an owned line');
  assert.equal(builders.canUpgrade(0, 'cannon_t2'), false, 'a line of a builder the seat does not own');
});

test('placement list: roots of the owned builders plus the common towers, in a stable order', () => {
  const { builders } = world(4, game.DEFAULT_PICKS);
  assert.deepEqual(builders.buildableFor(0), ['magic_t1', 'acid_t1', 'watchtower']);
  assert.deepEqual(builders.buildableFor(1), ['cannon_t1', 'watchtower']);
  assert.equal(builders.canPlace(0, 'arrow_t1'), false);
  assert.equal(builders.canPlace(0, 'magic_t2'), false, 'only tier-1 towers are placed');
  assert.equal(builders.canPlace(9, 'watchtower'), false);
  const all = world(1, 'all').builders;
  assert.deepEqual([...all.buildableFor(0)].sort(), [...BUILDABLE_TOWER_IDS].sort(), 'the classic game builds everything it always did');
});

// ── BuildSystem: the lumber sink in the real placement and upgrade path ─────

const chain = () => { const stub = new Proxy(function () {}, { get: (_, key) => (key === 'then' ? undefined : stub), apply: () => stub }); return stub; };

function buildWorld(seatCount, start) {
  GameConfig.setDifficulty('normal');
  game.GameSpeed.reset();
  const handlers = [];
  const scene = { add: { graphics: chain }, tweens: { add: chain },
    input: { on: (name, fn) => { if (name === 'pointerdown') handlers.push(fn); return chain(); }, setDefaultCursor: chain } };
  const click = (col, row) => handlers.forEach((fn) => fn({ x: col * 40 + 20, y: row * 40 + 20, button: 0 }));
  const seats = new game.Seats(seatCount);
  const economy = new game.EconomyManager(seatCount);
  const lumber = new game.LumberManager(seatCount);
  const builders = new game.BuilderManager(lumber, seatCount, start);
  const pool = new game.ObjectPool(() => new game.Projectile(), 8);
  const build = new game.BuildSystem(scene, economy, pool, () => [], () => true, seats, builders);
  const place = (col, row, id) => { build.selectTowerType(id); click(col, row); build.cancelPlacement(); };
  return { seats, economy, lumber, builders, build, click, place };
}

const CELL = { col: 3, row: 3 };   // a buildable cell in zone 0 (checked below), seat 0 of any seat count owns it

test('placement is refused outside the seat\'s builders and costs nothing', () => {
  const { economy, build, place } = buildWorld(4, game.DEFAULT_PICKS);
  const gold = economy.goldOf(0);
  place(CELL.col, CELL.row, 'arrow_t1');     // nature line: seat 0 has fire
  assert.equal(build.towers.length, 0, 'no tower of a foreign builder');
  assert.equal(economy.goldOf(0), gold, 'no gold taken');
  place(CELL.col, CELL.row, 'magic_t1');
  assert.equal(build.towers.length, 1, 'its own builder works');
  assert.equal(economy.goldOf(0), gold - TOWER_DEFS.magic_t1.cost);
  build.selectTowerType('arrow_t1');
  assert.equal(build.isPlacing, false, 'selecting a foreign tower kind is refused too');
  build.selectTowerType('watchtower');
  assert.equal(build.isPlacing, true, 'a common tower is open to every seat');
});

function seatWithMasteredLine(extraGold = 0) {
  const w = buildWorld(2, ['fire', 'earth']);
  w.economy.addGold(2000 + extraGold, 0);
  w.lumber.add(10, 0);
  w.place(CELL.col, CELL.row, 'magic_t1');
  return w;
}

test('an ultimate needs mastery, gold and lumber; a refused upgrade takes neither and keeps the tower', () => {
  const w = seatWithMasteredLine();
  const tower = () => w.build.towers[0];
  w.click(CELL.col, CELL.row);                                   // select
  w.build.upgradeSelected('magic_t2');
  assert.equal(tower().towerId, 'magic_t2', 'the plain tier-2 upgrade needs no lumber');
  const gold = w.economy.goldOf(0), lumber = w.lumber.lumberOf(0);
  w.build.upgradeSelected('fire_ult');
  assert.equal(tower().towerId, 'magic_t2', 'no mastery: refused');
  assert.deepEqual([w.economy.goldOf(0), w.lumber.lumberOf(0)], [gold, lumber], 'nothing taken');
  assert.equal(w.builders.research(0, 'fire'), true);
  const afterResearch = w.lumber.lumberOf(0);
  assert.equal(afterResearch, lumber - game.MASTERY_LUMBER);
  w.build.upgradeSelected('fire_ult');
  assert.equal(tower().towerId, 'fire_ult');
  assert.equal(w.economy.goldOf(0), gold - TOWER_DEFS.fire_ult.cost);
  assert.equal(w.lumber.lumberOf(0), afterResearch - TOWER_DEFS.fire_ult.lumberCost);
});

test('an ultimate with too little lumber is refused and the gold stays (atomic: both purses are checked first)', () => {
  const w = buildWorld(1, ['fire']);
  w.economy.addGold(2000, 0);
  w.lumber.add(game.MASTERY_LUMBER + TOWER_DEFS.fire_ult.lumberCost - 1, 0);   // one lumber short
  w.place(CELL.col, CELL.row, 'magic_t1');
  w.click(CELL.col, CELL.row);
  w.build.upgradeSelected('magic_t2');
  assert.equal(w.builders.research(0, 'fire'), true);
  const gold = w.economy.goldOf(0), lumber = w.lumber.lumberOf(0);
  w.build.upgradeSelected('fire_ult');
  assert.equal(w.build.towers[0].towerId, 'magic_t2');
  assert.deepEqual([w.economy.goldOf(0), w.lumber.lumberOf(0)], [gold, lumber], 'no gold lost for a refused ultimate');
  w.lumber.add(1, 0);
  w.build.upgradeSelected('fire_ult');
  assert.equal(w.build.towers[0].towerId, 'fire_ult', 'one more lumber and it goes through');
  const poor = buildWorld(1, ['fire']);
  poor.lumber.add(20, 0);
  poor.place(CELL.col, CELL.row, 'magic_t1');
  poor.click(CELL.col, CELL.row);
  const lumberBefore = poor.lumber.lumberOf(0);
  poor.build.upgradeSelected('fire_ult');
  assert.equal(poor.lumber.lumberOf(0), lumberBefore, 'a refused upgrade never touches lumber');
});

test('selling an ultimate returns gold only: lumber is never refunded', () => {
  const w = buildWorld(1, ['fire']);
  w.economy.addGold(2000, 0);
  w.lumber.add(20, 0);
  w.place(CELL.col, CELL.row, 'magic_t1');
  w.click(CELL.col, CELL.row);
  w.build.upgradeSelected('magic_t2');
  w.builders.research(0, 'fire');
  w.build.upgradeSelected('fire_ult');
  const lumber = w.lumber.lumberOf(0), gold = w.economy.goldOf(0);
  w.build.sellSelected();
  assert.equal(w.build.towers.length, 0);
  assert.equal(w.lumber.lumberOf(0), lumber, 'the sale returned no lumber');
  assert(w.economy.goldOf(0) > gold, 'it returned gold');
});

test('a tower ceded to a seat without that builder can be sold but not upgraded', () => {
  const w = buildWorld(2, ['fire', 'earth']);
  w.economy.addGold(2000, 0);
  w.economy.addGold(2000, 1);
  w.place(CELL.col, CELL.row, 'magic_t1');
  w.click(CELL.col, CELL.row);
  assert.equal(w.build.cedeSelected(1), true);
  w.seats.setActive(1);
  w.click(CELL.col, CELL.row);
  const gold = w.economy.goldOf(1);
  w.build.upgradeSelected('magic_t2');
  assert.equal(w.build.towers[0].towerId, 'magic_t1', 'seat 1 has no fire builder');
  assert.equal(w.economy.goldOf(1), gold);
  w.build.sellSelected();
  assert.equal(w.build.towers.length, 0, 'selling needs no builder');
});

test('the default BuildSystem (no builders passed) keeps the classic game: every root, tier-2 upgrades, no lumber', () => {
  GameConfig.setDifficulty('normal');
  game.GameSpeed.reset();
  const handlers = [];
  const scene = { add: { graphics: chain }, tweens: { add: chain }, input: { on: (n, fn) => { if (n === 'pointerdown') handlers.push(fn); return chain(); }, setDefaultCursor: chain } };
  const economy = new game.EconomyManager(1);
  economy.addGold(5000, 0);
  const build = new game.BuildSystem(scene, economy, new game.ObjectPool(() => new game.Projectile(), 4), () => [], () => true);
  BUILDABLE_TOWER_IDS.forEach((id, i) => {
    build.selectTowerType(id);
    handlers.forEach((fn) => fn({ x: (3 + i) * 40 + 20, y: 3 * 40 + 20, button: 0 }));
    build.cancelPlacement();
  });
  assert.equal(build.towers.length, BUILDABLE_TOWER_IDS.length);
  handlers.forEach((fn) => fn({ x: 3 * 40 + 20, y: 3 * 40 + 20, button: 0 }));   // select the first one placed (arrow_t1)
  assert.equal(build.selectedTower.towerId, 'arrow_t1');
  build.upgradeSelected('arrow_t2');
  assert.equal(build.towers.find((t) => t.gridCol === 3).towerId, 'arrow_t2', 'a tier-2 upgrade needs no lumber and no research in the classic game');
});

// ── Ownership guards ────────────────────────────────────────────────────────

function sources(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, out);
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

test('lumber is spent by the builder rules only: no other system or UI calls LumberManager.spend or add', () => {
  const offenders = [];
  for (const path of sources('src')) {
    const text = readFileSync(path, 'utf8');
    const normalized = path.split('\\').join('/');
    if (/\blumber\w*\.(spend)\(/i.test(text) && !/(LumberManager|BuilderManager)\.ts$/.test(normalized)) offenders.push(`${normalized}: spends lumber`);
    if (/\/ui\//.test(normalized) && /\blumber\w*\.(spend|add|transfer)\(|\bbuilders\.(chargeLumber)\(/i.test(text)) offenders.push(`${normalized}: a UI component moves lumber`);
  }
  assert.deepEqual(offenders, []);
});
