import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/config.ts', 'src/config/difficulty.ts', 'src/data/seats.ts', 'src/data/waves.ts', 'src/data/enemies.ts', 'src/data/pathData.ts',
  'src/systems/EconomyManager.ts', 'src/systems/WaveManager.ts', 'src/systems/LumberManager.ts', 'src/entities/Enemy.ts',
  'src/utils/ObjectPool.ts', 'src/utils/EventBus.ts',
);
const { DIFFICULTY_PRESETS, DIFFICULTY_IDS, GameConfig, WAVES, BASE_WAVES } = game;

// ── Lives of the original, one pool for any number of seats ──────────────────

test('the four difficulties carry the lives of the original: 50, 25, 1, and 1 with random waves', () => {
  assert.deepEqual([...DIFFICULTY_IDS], ['easy', 'normal', 'hard', 'insane']);
  assert.deepEqual(DIFFICULTY_IDS.map((id) => DIFFICULTY_PRESETS[id].startingLives), [50, 25, 1, 1]);
  assert.deepEqual(DIFFICULTY_IDS.map((id) => DIFFICULTY_PRESETS[id].randomWaves), [false, false, false, true]);
  for (const id of DIFFICULTY_IDS) {
    const preset = DIFFICULTY_PRESETS[id];
    assert.equal(preset.id, id);
    assert(preset.label && preset.blurb, `${id}: a label and a menu line`);
    assert(Number.isInteger(preset.startingLives) && preset.startingLives >= 1, `${id}: lives are a whole number of at least 1`);
  }
});

test('the enemy stats are the same in every mode: the modes differ by lives and wave order, as in the original', () => {
  for (const id of DIFFICULTY_IDS) {
    assert.equal(DIFFICULTY_PRESETS[id].enemyHpMult, 1, `${id}: enemy HP`);
    assert.equal(DIFFICULTY_PRESETS[id].enemySpeedMult, 1, `${id}: enemy speed`);
  }
});

test('the team shares one pool of lives and one start purse whatever the number of seats', () => {
  for (const id of DIFFICULTY_IDS) {
    GameConfig.setDifficulty(id);
    for (const seats of [1, 2, 4]) {
      const economy = new game.EconomyManager(seats);
      try {
        assert.equal(economy.lives, DIFFICULTY_PRESETS[id].startingLives, `${id} with ${seats} seats: lives`);
        const purses = Array.from({ length: seats }, (_, seat) => economy.goldOf(seat));
        assert.equal(purses.reduce((a, b) => a + b, 0), DIFFICULTY_PRESETS[id].startingGold, `${id} with ${seats} seats: the start gold is split without loss`);
      } finally { economy.destroy(); }
    }
  }
  GameConfig.setDifficulty('normal');
});

test('a new game reads the lives of the chosen difficulty and the last life ends it', () => {
  GameConfig.setDifficulty('hard');
  const economy = new game.EconomyManager(1);
  const seen = [];
  game.EventBus.on(game.GameEvents.GAME_OVER, () => seen.push('over'));
  try {
    assert.equal(economy.lives, 1);
    economy.loseLife(2);                    // a golem costs more than the one life: it clamps and ends the game once
    assert.equal(economy.lives, 0);
    assert.deepEqual(seen, ['over']);
  } finally { economy.destroy(); GameConfig.setDifficulty('normal'); game.EventBus.removeAllListeners?.(game.GameEvents.GAME_OVER); }
});

test('`?difficulty=` picks a mode; expert is another name for insane; junk and an absent value pick nothing', () => {
  const parse = (query) => game.parseDifficulty(query);
  assert.equal(parse('?difficulty=easy'), 'easy');
  assert.equal(parse('?difficulty=HARD'), 'hard');
  assert.equal(parse('?difficulty=expert'), 'insane');
  assert.equal(parse('?difficulty=insane&seats=4'), 'insane');
  assert.equal(parse(''), null);
  assert.equal(parse('?difficulty='), null);
  assert.equal(parse('?difficulty=nightmare'), null);
});

test('the best result of each difficulty has its own key, and normal keeps the key of earlier versions', () => {
  const keys = DIFFICULTY_IDS.map((id) => game.bestResultKey(id));
  assert.equal(new Set(keys).size, DIFFICULTY_IDS.length);
  assert.equal(game.bestResultKey('normal'), 'best_result');
});

// ── Random waves ─────────────────────────────────────────────────────────────

const composition = (wave) => JSON.stringify([wave.enemyType, wave.count, wave.hpMult, wave.speedMult, wave.interval, wave.isBoss, wave.paths]);

test('the same seed gives the same wave list and the list stays a valid one of 40 waves', () => {
  const a = game.randomizedWaves(12345), b = game.randomizedWaves(12345);
  assert.deepEqual(a, b);
  assert.equal(a.length, 40);
  a.forEach((wave, i) => assert.equal(wave.wave, i + 1, 'the wave number stays with the slot'));
});

test('milestone and boss waves stay in their slots; the other waves of a block only trade places inside it', () => {
  for (const seed of [1, 2, 3, 99, 2026, 4294967295]) {
    const list = game.shuffledBaseWaves(seed);
    for (let block = 0; block < 8; block++) {
      const slots = [0, 1, 2, 3, 4].map((k) => block * 5 + k);
      const fixed = slots.filter((i) => BASE_WAVES[i].isBoss || BASE_WAVES[i].wave % 5 === 0);
      const movable = slots.filter((i) => !fixed.includes(i));
      for (const i of fixed) assert.equal(composition(list[i]), composition(BASE_WAVES[i]), `seed ${seed}: wave ${i + 1} is a milestone and must not move`);
      assert.deepEqual(movable.map((i) => composition(list[i])).sort(), movable.map((i) => composition(BASE_WAVES[i])).sort(),
        `seed ${seed}, block ${block}: the same compositions, only reordered`);
    }
    list.forEach((wave, i) => assert.equal(wave.wave, BASE_WAVES[i].wave));
  }
});

test('different seeds give different orders; the wave bonus and the taper stay with the slot', () => {
  const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => game.randomizedWaves(seed).map(composition).join('|')));
  assert(orders.size >= 7, `eight seeds should give almost as many orders, got ${orders.size}`);
  const list = game.randomizedWaves(77);
  list.forEach((wave, i) => {
    assert.equal(wave.bonusGold, WAVES[i].bonusGold, `wave ${i + 1}: the bonus belongs to the slot`);
  });
  const total = (waves) => waves.reduce((sum, wave) => sum + wave.count, 0);
  assert(Math.abs(total(list) - total(WAVES)) / total(WAVES) < 0.25, 'the enemy total stays in the same range');
});

test('`?seed=` replays an order: whole numbers only', () => {
  assert.equal(game.parseWaveSeed('?seed=42'), 42);
  assert.equal(game.parseWaveSeed('?difficulty=expert&seed=7'), 7);
  assert.equal(game.parseWaveSeed('?seed=-3'), null);
  assert.equal(game.parseWaveSeed('?seed=abc'), null);
  assert.equal(game.parseWaveSeed(''), null);
  assert.equal(game.parseWaveSeed('?seed=99999999999'), null);
});

test('WaveManager runs the list it is given, and the default is the written list', () => {
  const pool = new game.ObjectPool(() => new game.Enemy(), 2);
  const custom = game.randomizedWaves(5);
  const a = new game.WaveManager(null, pool, custom);
  const b = new game.WaveManager(null, pool);
  try {
    assert.equal(a.totalWaves, 40);
    assert.deepEqual(a.currentWaveData, custom[0]);
    assert.deepEqual(b.currentWaveData, WAVES[0]);
  } finally { a.destroy(); b.destroy(); }
});
