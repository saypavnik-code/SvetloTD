
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/config.ts',
  'src/entities/Enemy.ts',
  'src/data/mapData.ts',
  'src/data/pathData.ts',
  'src/data/waves.ts',
  'src/systems/EconomyManager.ts',
  'src/systems/LumberManager.ts',
  'src/systems/AuraSystem.ts',
  'src/utils/ObjectPool.ts',
  'src/utils/EventBus.ts',
);

test('square 18x18 board: rotation-symmetric, four equal spawn routes ending in the shared base', () => {
  const N = 18;
  assert.equal(game.MAP_DATA.length, N);
  for (let row = 0; row < N; row++) {
    assert.equal(game.MAP_DATA[row].length, N);
    for (let col = 0; col < N; col++) {
      // The seats are equal under a 90-degree turn (never mirrored): (row, col) -> (col, N-1-row).
      assert.equal(game.MAP_DATA[row][col], game.MAP_DATA[col][N - 1 - row], `cell ${row},${col}`);
    }
  }
  const count = (type) => game.MAP_DATA.flat().filter((cell) => cell === type).length;
  assert.equal(count('B'), 4);
  assert.equal(count('P'), 72, 'ring of 52 tiles plus four spurs of 5');
  assert.equal(game.ALL_PATHS.length, 4);
  assert(game.ALL_PATHS.every((path) => path.at(-1).x === 360 && path.at(-1).y === 360), 'all routes end at the exact base center');
  const length = (path) => path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0);
  const lengths = game.ALL_PATHS.map(length);
  assert(lengths.every((l) => Math.abs(l - lengths[0]) < 1e-6), `equal route lengths: ${lengths}`);
});

test('every route walks road tiles one step at a time and passes all four seat quadrants', () => {
  const { MAP_DATA, ALL_PATHS, TILE_SIZE } = game;
  const tile = (p) => ({ col: Math.floor(p.x / TILE_SIZE), row: Math.floor(p.y / TILE_SIZE) });
  for (const path of ALL_PATHS) {
    const tiles = path.slice(0, -1).map(tile);
    tiles.forEach((t, i) => {
      assert.equal(MAP_DATA[t.row][t.col], 'P', `route tile ${t.row},${t.col} is a road`);
      if (i > 0) assert.equal(Math.abs(t.row - tiles[i - 1].row) + Math.abs(t.col - tiles[i - 1].col), 1, 'orthogonal steps');
    });
    assert.equal(new Set(tiles.map((t) => `${t.row},${t.col}`)).size, tiles.length, 'a route never revisits a tile');
    const quadrants = new Set(tiles.map((t) => `${t.row < 9 ? 'N' : 'S'}${t.col < 9 ? 'W' : 'E'}`));
    assert.equal(quadrants.size, 4, 'every enemy crosses the zone of every seat');
  }
  const starts = new Set(game.SPAWN_POSITIONS.map((p) => `${p.x},${p.y}`));
  assert.equal(starts.size, 4, 'four distinct spawns');
});

test('distanceToBase follows the route, so "first" is right on the ring where the straight line is not', () => {
  const route = game.ALL_PATHS[0];
  const at = (index) => {
    const enemy = new game.Enemy();
    enemy.init('grunt', route);
    enemy.x = route[index].x; enemy.y = route[index].y; enemy._wpIndex = index;
    return enemy;
  };
  const walked = [0, 10, 25, 40, 50].map((i) => at(i).distanceToBase);
  assert(walked.every((d, i) => i === 0 || d < walked[i - 1]), 'strictly decreasing along the route');
  assert(Math.abs(at(0).distanceToBase - route.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - route[i].x, p.y - route[i].y), 0)) < 1e-6);
  const early = at(6);                      // north side, straight line to the base is about 7 tiles
  const late = at(26);                      // south-east corner, straight line is about 8.5 tiles
  const straight = (e) => Math.hypot(e.x - 360, e.y - 360);
  assert(straight(late) > straight(early), 'the late enemy is farther away in a straight line');
  assert(late.distanceToBase < early.distanceToBase, 'but it is much closer to the base by the road');
  const flyer = new game.Enemy();
  flyer.init('wyvern', route);
  assert(Math.abs(flyer.distanceToBase - Math.hypot(route[0].x - 360, route[0].y - 360)) < 1e-6, 'flyers fly straight');
});

test('40 ordered waves with positive spawn counts and intervals', () => {
  assert.equal(game.WAVES.length, 40);
  game.WAVES.forEach((wave, index) => {
    assert.equal(wave.wave, index + 1);
    assert(wave.count > 0 && wave.interval >= 0 && wave.hpMult > 0);
    // Existing boss waves intentionally use a zero-second one-enemy interval.
    assert(wave.interval > 0 || wave.count === 1);
  });
});

test('economy rejects negative and non-finite resources', () => {
  const economy = new game.EconomyManager();
  const initial = economy.gold;
  assert.equal(economy.spendGold(-10), false);
  assert.equal(economy.spendGold(NaN), false);
  economy.addGold(-25);
  economy.addGold(Infinity);
  assert.equal(economy.gold, initial);
  const lumber = new game.LumberManager();
  assert.equal(lumber.spend(-1), false);
  lumber.add(Infinity);
  assert.equal(lumber.lumber, 0);
  economy.destroy();
});

test('life reaches zero once and emits one terminal event', () => {
  const economy = new game.EconomyManager();
  let count = 0;
  const handler = () => count++;
  game.EventBus.on(game.GameEvents.GAME_OVER, handler);
  economy.loseLife(999);
  economy.loseLife(1);
  economy.loseLife(1);
  assert.equal(economy.lives, 0);
  assert.equal(count, 1);
  game.EventBus.off(game.GameEvents.GAME_OVER, handler);
  economy.destroy();
});

test('watchtower aura applies, does not stack, and expires on removal', () => {
  const makeTower = (x, y, radius, buff) => ({
    x, y, data: { auraRadius: radius, auraBuff: buff }, aura: 0,
    clearAuraBuff() { this.aura = 0; },
    applyAuraBuff(value) { this.aura = Math.max(this.aura, value); },
  });
  const target = makeTower(30, 0, 0, 0);
  const first = makeTower(0, 0, 110, .15);
  const second = makeTower(50, 0, 110, .15);
  const list = [target, first, second];
  const aura = new game.AuraSystem(() => list);
  aura.update(0);
  assert.equal(target.aura, .15);
  list.pop();
  aura.update(300);
  assert.equal(target.aura, .15);
  list.pop();
  aura.update(300);
  assert.equal(target.aura, 0);
});

test('object pool ignores repeated releases', () => {
  const pool = new game.ObjectPool(() => ({ reset() { this.wasReset = true; } }), 1);
  const item = pool.get();
  pool.release(item);
  pool.release(item);
  assert.equal(pool.activeCount, 0);
  assert.equal(pool.totalCreated, 1);
  const one = pool.get();
  const two = pool.get();
  assert.notEqual(one, two);
});

test('static scene guards and consolidated source stay in place', () => {
  const scene = readFileSync('src/scenes/GameScene.ts', 'utf8');
  assert(scene.includes('this._skillSlots = []'));
  assert(scene.includes('if (this._gameOver) return; // Reject duplicate terminal events.'));
  const policy = readFileSync('docs/PATCH_POLICY.md', 'utf8');
  assert(policy.includes('never repeat a file name'));
});
