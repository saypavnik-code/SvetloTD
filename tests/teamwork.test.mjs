import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/config.ts', 'src/config/difficulty.ts', 'src/data/seats.ts', 'src/data/mapData.ts', 'src/data/pathData.ts',
  'src/data/towers.ts', 'src/systems/Seats.ts', 'src/systems/EconomyManager.ts', 'src/systems/LumberManager.ts',
  'src/systems/EnemyOutcomes.ts', 'src/systems/BuildSystem.ts', 'src/systems/GameSpeed.ts', 'src/entities/Enemy.ts',
  'src/entities/Projectile.ts', 'src/entities/Tower.ts', 'src/utils/ObjectPool.ts', 'src/utils/EventBus.ts',
);
const { EventBus, GameEvents, GameConfig } = game;

function recorder(event) {
  const calls = [];
  const fn = (...args) => calls.push(args);
  EventBus.on(event, fn);
  return { calls, stop: () => EventBus.off(event, fn) };
}

test('give gold: moves coins between two seats, nothing created or lost, bad requests move nothing', () => {
  GameConfig.setDifficulty('normal');
  const economy = new game.EconomyManager(4);
  const before = [0, 1, 2, 3].map((s) => economy.goldOf(s));
  const total = economy.totalGold;
  const seen = recorder(GameEvents.GOLD_CHANGED);
  assert.equal(economy.transferGold(20, 0, 3), true);
  seen.stop();
  assert.deepEqual(seen.calls, [[before[0] - 20, 0], [before[3] + 20, 3]], 'both wallets announce the change');
  assert.equal(economy.totalGold, total);
  const after = [0, 1, 2, 3].map((s) => economy.goldOf(s));
  const quiet = recorder(GameEvents.GOLD_CHANGED);
  for (const [amount, from, to] of [[1, 2, 2], [0, 0, 1], [-5, 0, 1], [1.5, 0, 1], [NaN, 0, 1], [1e9, 0, 1], [1, 0, 4], [1, -1, 0], [1, 7, 0]]) {
    assert.equal(economy.transferGold(amount, from, to), false, `${amount} ${from}->${to}`);
  }
  quiet.stop();
  assert.deepEqual(quiet.calls, [], 'a refused gift announces nothing');
  assert.deepEqual([0, 1, 2, 3].map((s) => economy.goldOf(s)), after);
  assert.equal(new game.EconomyManager(1).transferGold(1, 0, 0), false, 'a one-seat game has nobody to give to');
  economy.destroy();
});

test('give lumber: the same rules', () => {
  const lumber = new game.LumberManager(2);
  lumber.add(3, 0);
  const seen = recorder(GameEvents.LUMBER_CHANGED);
  assert.equal(lumber.transfer(2, 0, 1), true);
  assert.equal(lumber.transfer(2, 0, 1), false, 'only one left');
  assert.equal(lumber.transfer(1, 1, 1), false);
  assert.equal(lumber.transfer(0, 1, 0), false);
  seen.stop();
  assert.deepEqual([lumber.lumberOf(0), lumber.lumberOf(1)], [1, 2]);
  assert.deepEqual(seen.calls, [[1, 0], [2, 1]]);
});

const chain = () => { const stub = new Proxy(function () {}, { get: (_, key) => (key === 'then' ? undefined : stub), apply: () => stub }); return stub; };

function buildWorld(seatCount, enemies = []) {
  GameConfig.setDifficulty('normal');
  game.GameSpeed.reset();
  const handlers = [];
  const scene = { add: { graphics: chain }, tweens: { add: chain },
    input: { on: (name, fn) => { if (name === 'pointerdown') handlers.push(fn); return chain(); }, setDefaultCursor: chain } };
  const click = (col, row) => handlers.forEach((fn) => fn({ x: col * 40 + 20, y: row * 40 + 20, button: 0 }));
  const seats = new game.Seats(seatCount);
  const economy = new game.EconomyManager(seatCount);
  const pool = new game.ObjectPool(() => new game.Projectile(), 8);
  const build = new game.BuildSystem(scene, economy, pool, () => enemies, () => true, seats);
  const place = (col, row, id = 'arrow_t1') => { build.selectTowerType(id); click(col, row); build.cancelPlacement(); };
  return { seats, economy, build, click, place, pool };
}

test('cede: only the owner, only to another real seat; the tower keeps cell, level and investment', () => {
  const { seats, economy, build, place, click } = buildWorld(4);
  economy.addGold(500, 0);
  place(5, 5);
  click(5, 5);
  build.upgradeSelected('arrow_t2');
  const tower = build.towers[0];
  const invested = tower.totalInvested;
  const ceded = recorder(GameEvents.TOWER_CEDED);
  for (const bad of [0, 4, -1, 1.5, NaN]) assert.equal(build.cedeSelected(bad), false, `to ${bad}`);
  seats.setActive(2);
  assert.equal(build.cedeSelected(3), false, 'seat 2 does not own it');
  seats.setActive(0);
  assert.equal(build.cedeSelected(1), true);
  ceded.stop();
  assert.equal(ceded.calls.length, 1);
  assert.deepEqual([ceded.calls[0][0].from, ceded.calls[0][0].to, ceded.calls[0][0].tower === tower], [0, 1, true]);
  assert.equal(tower.ownerSeat, 1);
  assert.equal(build.towers.length, 1);
  assert.equal(tower.towerId, 'arrow_t2');
  assert.equal(tower.totalInvested, invested);
  assert.deepEqual([tower.gridCol, tower.gridRow], [5, 5], 'it stays in its cell, in the old owner\'s zone');
  assert.equal(build.selectedTower, null, 'the old owner\'s selection is dropped');
});

test('cede: the new owner upgrades and sells it, the old owner no longer can, the refund goes to the new owner', () => {
  const { seats, economy, build, place, click } = buildWorld(4);
  place(5, 5);
  const tower = build.towers[0];
  click(5, 5);
  build.cedeSelected(2);
  economy.addGold(1000, 0); economy.addGold(1000, 2);
  seats.setActive(0);
  click(5, 5);
  const before = [0, 1, 2, 3].map((s) => economy.goldOf(s));
  build.sellSelected(); build.upgradeSelected('arrow_t2');
  assert.equal(build.towers.length, 1, 'seat 0 lost its rights');
  assert.deepEqual([0, 1, 2, 3].map((s) => economy.goldOf(s)), before);
  seats.setActive(2);
  click(5, 5);
  build.upgradeSelected('arrow_t2');
  assert.equal(build.towers[0].towerId, 'arrow_t2');
  assert.equal(build.towers[0].ownerSeat, 2, 'the upgrade keeps the new owner');
  assert.equal(economy.goldOf(2), before[2] - game.TOWER_DEFS.arrow_t2.cost);
  const gold2 = economy.goldOf(2);
  build.sellSelected();
  assert(economy.goldOf(2) > gold2, 'the refund went to seat 2');
  assert.equal(economy.goldOf(0), before[0]);
  assert.equal(tower.ownerSeat, 2);
});

test('cede: the kills of a ceded tower pay the new owner', () => {
  const enemies = [];
  const { build, place, click, pool } = buildWorld(4, enemies);
  place(5, 5);
  const tower = build.towers[0];
  click(5, 5);
  build.cedeSelected(3);
  const enemy = new game.Enemy();
  enemy.init('golem', game.PATH_TOP);
  enemy.x = tower.x + 60; enemy.y = tower.y; enemy.hp = 1e9;
  enemies.push(enemy);
  for (let i = 0; i < 40 && pool.activeItems.length === 0; i++) tower.update(100);
  assert.equal(pool.activeItems.length > 0, true, 'the tower fired');
  assert.equal(pool.activeItems[0].ownerSeat, 3, 'its shot carries the new owner');
});

test('shared income: a kill pays all seats the same, the odd coins rotate, lumber still goes to the killer', () => {
  GameConfig.setDifficulty('normal');
  const economy = new game.EconomyManager(4);
  const lumber = new game.LumberManager(4);
  const outcomes = new game.EnemyOutcomes(economy, lumber, true);
  const start = [0, 1, 2, 3].map((s) => economy.goldOf(s));
  const kill = (id, seat) => {
    const enemy = new game.Enemy();
    enemy.init(id, game.ALL_PATHS[0]);
    enemy.creditSeat = seat;
    EventBus.emit(GameEvents.ENEMY_KILLED, { enemy, goldReward: enemy.def.bounty });
    return enemy;
  };
  const grunt = kill('grunt', 1);                                 // bounty 6 over four seats: 2, 2, 1, 1
  assert.deepEqual([0, 1, 2, 3].map((s) => economy.goldOf(s) - start[s]), [2, 2, 1, 1]);
  kill('grunt', 1);                                               // the odd coins move on: 1, 2, 2, 1... in total 6 again
  const gained = [0, 1, 2, 3].map((s) => economy.goldOf(s) - start[s]);
  assert.equal(gained.reduce((a, b) => a + b, 0), 2 * grunt.def.bounty, 'nothing lost');
  assert(Math.max(...gained) - Math.min(...gained) <= 2, 'nobody is favoured');
  assert.notDeepEqual(gained, [4, 4, 2, 2], 'the remainder rotated');
  const golem = kill('golem', 3);
  assert.equal(lumber.lumberOf(3), golem.def.lumberYield, 'lumber stays with the killer');
  assert.equal(lumber.lumberOf(0), 0);
  outcomes.destroy(); economy.destroy();
  const off = new game.EnemyOutcomes(new game.EconomyManager(4), new game.LumberManager(4));
  off.destroy();
  assert.equal(game.parseSharedIncome('?seats=4&income=shared'), true);
  for (const no of ['', '?income=split', '?seats=4']) assert.equal(game.parseSharedIncome(no), false);
  assert.equal(new game.Seats(4).sharedIncome, false);
  assert.equal(new game.Seats(4, true).sharedIncome, true);
});

test('guard: the seat UI never changes money or towers by itself; it calls the actions it is given', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!path.endsWith('.ts')) continue;
      if (/\b(addGold|spendGold|transferGold|loseLife|\.transfer\(|transferTo|cedeSelected)\b/.test(readFileSync(path, 'utf8').replace(/\/\/.*$/gm, ''))) offenders.push(path);
    }
  };
  walk('src/ui');
  assert.deepEqual(offenders, []);
});
