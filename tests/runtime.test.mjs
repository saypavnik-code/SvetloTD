
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/data/mapData.ts',
  'src/data/pathData.ts',
  'src/data/waves.ts',
  'src/systems/EconomyManager.ts',
  'src/systems/LumberManager.ts',
  'src/systems/AuraSystem.ts',
  'src/utils/ObjectPool.ts',
  'src/utils/EventBus.ts',
);

test('four lanes and a symmetric 18x18 board', () => {
  assert.equal(game.MAP_DATA.length, 18);
  for (let row = 0; row < 18; row++) {
    assert.equal(game.MAP_DATA[row].length, 18);
    for (let col = 0; col < 18; col++) {
      assert.equal(game.MAP_DATA[row][col], game.MAP_DATA[row][17 - col]);
      assert.equal(game.MAP_DATA[row][col], game.MAP_DATA[17 - row][col]);
    }
  }
  assert.equal(game.ALL_PATHS.length, 4);
  assert(game.ALL_PATHS.every(path => {
    const end = path.at(-1);
    return end.x === 360 && end.y === 360;
  }));
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
