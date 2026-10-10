import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/systems/StatusEffectSystem.ts',
  'src/systems/HitEffects.ts',
  'src/systems/WaveManager.ts',
  'src/systems/EconomyManager.ts',
  'src/systems/InterestSystem.ts',
  'src/systems/LumberManager.ts',
  'src/entities/Enemy.ts',
  'src/data/pathData.ts',
  'src/data/towers.ts',
  'src/data/enemies.ts',
  'src/data/waves.ts',
  'src/utils/ObjectPool.ts',
  'src/utils/EventBus.ts',
);
const { EventBus, GameEvents } = game;

// ── Status effects ──────────────────────────────────────────────────────────

function totalPoisonDamage(fps, effects, seconds) {
  const fx = new game.StatusEffectSystem();
  for (const effect of effects) fx.apply(effect);
  let dealt = 0;
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) fx.update(1000 / fps, (amount) => { dealt += amount; });
  return dealt;
}

test('poison deals value x duration whatever the frame rate', () => {
  const acid = { type: 'poison', value: 8, duration: 3, sourceId: 'acid_t1' };
  for (const fps of [144, 60, 30, 20, 10]) {
    assert.equal(totalPoisonDamage(fps, [acid], 3.5), 24, `${fps} fps`);
  }
});

test('poison from different sources stacks, the same source only refreshes', () => {
  const a = { type: 'poison', value: 8, duration: 3, sourceId: 'acid_a' };
  const b = { type: 'poison', value: 8, duration: 3, sourceId: 'acid_b' };
  assert.equal(totalPoisonDamage(60, [a, b], 3.5), 48);
  assert.equal(totalPoisonDamage(60, [a, a], 3.5), 24);
});

function spawnEnemy(id = 'grunt', opts = {}) {
  const enemy = new game.Enemy();
  enemy.init(id, game.PATH_TOP, opts);
  return enemy;
}

function slowOf(enemy) {
  return enemy.fx.update(0, () => {}).slowFraction;
}

test('an enemy killed by poison dies once and does not heal or move afterwards', () => {
  let kills = 0;
  const onKilled = () => kills++;
  EventBus.on(GameEvents.ENEMY_KILLED, onKilled);
  const enemy = spawnEnemy('grunt', { isHealing: true });
  enemy.hp = 1;
  enemy._healAcc = 0.999; // test-only: a heal tick is due on the very next update
  enemy.applyEffect({ type: 'poison', value: 600, duration: 3, sourceId: 'acid_t1' });
  const { x, y } = enemy;
  enemy.update(1 / 60);
  assert.equal(enemy.isDead, true);
  assert.equal(enemy.hp, 0);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, { x, y });
  for (let i = 0; i < 60; i++) enemy.update(1 / 60);
  assert.equal(kills, 1);
  assert.equal(enemy.isActive, false);
  EventBus.off(GameEvents.ENEMY_KILLED, onKilled);
});

// ── Tower hit effects ───────────────────────────────────────────────────────

function enemyAt(x, y) {
  const enemy = spawnEnemy();
  enemy.x = x;
  enemy.y = y;
  return enemy;
}

test('Ice Bastion slows its target by 55% and nearby enemies by 35%, not distant ones', () => {
  const { special } = game.TOWER_DEFS.slow_t2;
  const target = enemyAt(100, 100);
  const near = enemyAt(140, 100);   // 40 px away, inside the 50 px area
  const edge = enemyAt(150, 100);   // exactly on the radius
  const far = enemyAt(160, 100);    // 60 px away, outside
  const dead = enemyAt(110, 100);
  dead.takeDamage(1e9, 'chaos');
  game.applyHitSpecials(target, special, 'slow_t2', [target, near, edge, far, dead]);
  assert.equal(slowOf(target), 0.55);
  assert.equal(slowOf(near), 0.35);
  assert.equal(slowOf(edge), 0.35);
  assert.equal(slowOf(far), 0);
  assert.equal(dead.fx.effects.length, 0);
});

test('area slow never overwrites the primary slow and expires on its own timer', () => {
  const { special } = game.TOWER_DEFS.slow_t2;
  const target = enemyAt(100, 100);
  game.applyHitSpecials(target, special, 'slow_t2', [target]);
  target.fx.update(1600, () => {});             // area slow (1.5 s) expired, primary (2.5 s) remains
  assert.equal(slowOf(target), 0.55);
  target.fx.update(1000, () => {});
  assert.equal(slowOf(target), 0);
});

test('acid tower specials affect only the hit enemy', () => {
  const { special } = game.TOWER_DEFS.acid_t1;
  const target = enemyAt(100, 100);
  const neighbour = enemyAt(105, 100);
  game.applyHitSpecials(target, special, 'acid_t1', [target, neighbour]);
  assert(target.fx.hasArmorReduce() && target.fx.hasPoison());
  assert.equal(neighbour.fx.effects.length, 0);
});

test('static wiring: Tower routes on-hit specials through applyHitSpecials', () => {
  const tower = readFileSync('src/entities/Tower.ts', 'utf8');
  assert(tower.includes('applyHitSpecials(e, specials, id, this._activeEnemiesFn())'));
  assert(!tower.includes('e.applyEffect({ type: sp.type'));
});

// ── Wave lifecycle simulation (headless, deterministic) ─────────────────────

// Mirrors GameScene: WaveManager subscribes first, scene-level handlers after it.
function createWorld() {
  const economy = new game.EconomyManager();
  const lumber = new game.LumberManager();
  const interest = new game.InterestSystem(economy, lumber);
  const pool = new game.ObjectPool(() => new game.Enemy(), 8);
  const waves = new game.WaveManager(null, pool);
  const log = { completed: [], terminal: [], bonuses: 0, kills: 0, leaks: 0 };
  const handlers = [
    [GameEvents.ENEMY_REACHED_END, (enemy) => { log.leaks++; economy.loseLife(enemy.def.livesCost); }],
    [GameEvents.ENEMY_KILLED, ({ goldReward }) => { log.kills++; economy.addGold(goldReward); }],
    [GameEvents.WAVE_COMPLETED, (waveNumber) => log.completed.push(waveNumber)],
    [GameEvents.WAVE_BONUS_AWARDED, () => { log.bonuses++; }],
    // Same first-wins arbitration as GameScene._onGameOver.
    [GameEvents.GAME_OVER, ({ victory }) => { if (!log.terminal.length) log.terminal.push(victory ? 'victory' : 'defeat'); }],
  ];
  for (const [event, handler] of handlers) EventBus.on(event, handler);
  return {
    economy, pool, waves, log,
    killAllActive() {
      for (const enemy of waves.activeEnemies) if (enemy.isActive && !enemy.isDead) enemy.takeDamage(1e9, 'chaos');
    },
    dispose() {
      for (const [event, handler] of handlers) EventBus.off(event, handler);
      waves.destroy(); interest.destroy(); economy.destroy();
    },
  };
}

function run(world, { dt = 0.1, maxSteps = 400000, killOnSight = false, until }) {
  for (let step = 0; step < maxSteps; step++) {
    world.waves.update(dt);
    if (killOnSight) world.killAllActive();
    if (until()) return step;
  }
  throw new Error('simulation did not reach the expected state');
}

test('all 40 waves clear exactly once each, award once and end in a single victory', () => {
  const world = createWorld();
  world.waves.startGame();
  let unreleased = 0;
  run(world, {
    killOnSight: true,
    until: () => {
      // Two seconds into every countdown all enemies of the previous wave must be back in the pool.
      if (world.waves.state === 'countdown' && world.waves.countdownSecs <= 18 && world.pool.activeCount !== 0) unreleased++;
      return world.log.terminal.length > 0;
    },
  });
  const totalEnemies = game.WAVES.reduce((sum, wave) => sum + wave.count, 0);
  assert.deepEqual(world.log.completed, Array.from({ length: 40 }, (_, i) => i + 1));
  assert.deepEqual(world.log.terminal, ['victory']);
  assert.equal(world.waves.state, 'victory');
  assert.equal(world.log.bonuses, 40);
  assert.equal(world.log.kills, totalEnemies);
  assert.equal(world.log.leaks, 0);
  assert.equal(world.economy.lives, 20);
  assert.equal(unreleased, 0, 'enemies were not returned to the pool between waves');
  assert(world.pool.activeCount <= 1, 'only the final, still-dying enemy may remain checked out');
  assert(world.pool.totalCreated <= 64, `enemy pool grew to ${world.pool.totalCreated}`);
  world.dispose();
});

test('the 40-wave run is identical at 1x and 3x simulation speed steps', () => {
  const completedAt = (dt) => {
    const world = createWorld();
    world.waves.startGame();
    run(world, { dt, killOnSight: true, until: () => world.log.terminal.length > 0 });
    const result = { completed: world.log.completed.length, kills: world.log.kills };
    world.dispose();
    return result;
  };
  assert.deepEqual(completedAt(0.1), completedAt(0.3));
});

test('leaking every enemy ends in exactly one defeat and stops completing waves', () => {
  const world = createWorld();
  world.waves.startGame();
  run(world, { until: () => world.log.terminal.length > 0 });
  const completedAtDefeat = world.log.completed.length;
  for (let i = 0; i < 2000; i++) world.waves.update(0.1); // the scene would be frozen; the manager must be too
  assert.deepEqual(world.log.terminal, ['defeat']);
  assert.equal(world.economy.lives, 0);
  assert.equal(world.log.completed.length, completedAtDefeat);
  world.dispose();
});

test('losing the last life on the final enemy of a wave is a defeat, not a wave clear', () => {
  const world = createWorld();
  world.economy.loseLife(12); // wave 1 has 8 grunts of one life each: 8 lives left
  world.waves.startGame();
  run(world, { until: () => world.log.terminal.length > 0 });
  for (let i = 0; i < 50; i++) world.waves.update(0.1);
  assert.deepEqual(world.log.terminal, ['defeat']);
  assert.deepEqual(world.log.completed, []);
  assert.equal(world.log.bonuses, 0);
  world.dispose();
});

test('losing the last life to the final boss is a defeat, never a victory', () => {
  const world = createWorld();
  world.economy.loseLife(15); // five lives left == boss livesCost
  world.waves._waveIndex = 39; // test-only: jump to the final wave
  world.waves.startGame();
  run(world, { until: () => world.log.terminal.length > 0 });
  for (let i = 0; i < 50; i++) world.waves.update(0.1);
  assert.deepEqual(world.log.terminal, ['defeat']);
  assert.notEqual(world.waves.state, 'victory');
  assert.deepEqual(world.log.completed, []);
  world.dispose();
});

test('the countdown before every wave is a build phase with a full sell refund', () => {
  const world = createWorld();
  world.waves.startGame();
  assert.equal(world.economy.sellRefundRate, 1);          // countdown before wave 1
  run(world, { until: () => world.waves.state === 'spawning' });
  assert.equal(world.economy.sellRefundRate, 0.7);        // combat
  run(world, { killOnSight: true, until: () => world.log.completed.length === 1 });
  assert.equal(world.waves.state, 'countdown');
  assert.equal(world.economy.sellRefundRate, 1);          // countdown before wave 2
  world.dispose();
});
