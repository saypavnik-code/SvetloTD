import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';
import { simulate } from './support/simulate.mjs';

const game = loadModules(
  'src/systems/EconomyManager.ts',
  'src/systems/LumberManager.ts',
  'src/systems/InterestSystem.ts',
  'src/systems/WaveManager.ts',
  'src/systems/EnemyOutcomes.ts',
  'src/entities/Enemy.ts',
  'src/data/enemies.ts',
  'src/data/waves.ts',
  'src/utils/ObjectPool.ts',
  'src/utils/Subscriptions.ts',
  'src/utils/EventBus.ts',
);
const { EventBus, GameEvents, Subscriptions, ENEMY_DEFS, WAVES } = game;

const listenerCounts = () => Object.fromEntries(Object.values(GameEvents).map((event) => [event, EventBus.listenerCount(event)]));

function makeSystems() {
  const economy = new game.EconomyManager();
  const lumber = new game.LumberManager();
  const interest = new game.InterestSystem(economy, lumber);
  const waves = new game.WaveManager(null, new game.ObjectPool(() => new game.Enemy(), 4));
  const outcomes = new game.EnemyOutcomes(economy, lumber);
  const destroyAll = () => { waves.destroy(); outcomes.destroy(); interest.destroy(); economy.destroy(); };
  return { economy, lumber, interest, waves, outcomes, destroyAll };
}

// ── Subscriptions ───────────────────────────────────────────────────────────

test('Subscriptions removes exactly what it registered and may be disposed repeatedly', () => {
  const calls = [];
  const foreign = () => calls.push('foreign');
  EventBus.on(GameEvents.GOLD_CHANGED, foreign);
  const subs = new Subscriptions();
  subs.on(GameEvents.GOLD_CHANGED, () => calls.push('a'));
  subs.on(GameEvents.GOLD_CHANGED, () => calls.push('b'));
  subs.on(GameEvents.LIVES_CHANGED, () => calls.push('c'));
  assert.equal(subs.size, 3);
  EventBus.emit(GameEvents.GOLD_CHANGED, 1);
  assert.deepEqual(calls, ['foreign', 'a', 'b'], 'listeners run in registration order');
  subs.dispose();
  subs.dispose();
  assert.equal(subs.size, 0);
  calls.length = 0;
  EventBus.emit(GameEvents.GOLD_CHANGED, 2);
  EventBus.emit(GameEvents.LIVES_CHANGED, 2);
  assert.deepEqual(calls, ['foreign'], 'only the foreign listener is left');
  EventBus.off(GameEvents.GOLD_CHANGED, foreign);
});

test('every system removes all its listeners on destroy, so scene restarts cannot stack them', () => {
  const before = listenerCounts();
  for (let restart = 0; restart < 3; restart++) {
    const systems = makeSystems();
    const during = listenerCounts();
    assert.equal(during[GameEvents.ENEMY_KILLED] - before[GameEvents.ENEMY_KILLED], 2, 'WaveManager + EnemyOutcomes');
    assert.equal(during[GameEvents.ENEMY_REACHED_END] - before[GameEvents.ENEMY_REACHED_END], 2, 'WaveManager + EnemyOutcomes');
    assert.equal(during[GameEvents.WAVE_COMPLETED] - before[GameEvents.WAVE_COMPLETED], 1, 'InterestSystem');
    assert.equal(during[GameEvents.GAME_OVER] - before[GameEvents.GAME_OVER], 1, 'WaveManager');
    assert.equal(during[GameEvents.BUILD_PHASE_START] - before[GameEvents.BUILD_PHASE_START], 1, 'EconomyManager');
    systems.destroyAll();
    systems.destroyAll(); // a second destroy is harmless
    assert.deepEqual(listenerCounts(), before, `listeners left behind after restart ${restart + 1}`);
  }
});

// ── EnemyOutcomes: the kill and leak rules ──────────────────────────────────

test('a kill pays the bounty and the enemy type\'s lumber; a leak costs its lives', () => {
  const { economy, lumber, destroyAll } = makeSystems();
  try {
    const gold = economy.gold;
    EventBus.emit(GameEvents.ENEMY_KILLED, { enemy: { def: ENEMY_DEFS.grunt }, goldReward: ENEMY_DEFS.grunt.bounty });
    assert.equal(economy.gold, gold + ENEMY_DEFS.grunt.bounty);
    assert.equal(lumber.lumber, 0, 'a grunt yields no lumber');
    EventBus.emit(GameEvents.ENEMY_KILLED, { enemy: { def: ENEMY_DEFS.golem }, goldReward: ENEMY_DEFS.golem.bounty });
    EventBus.emit(GameEvents.ENEMY_KILLED, { enemy: { def: ENEMY_DEFS.boss_goliath }, goldReward: ENEMY_DEFS.boss_goliath.bounty });
    assert.equal(lumber.lumber, ENEMY_DEFS.golem.lumberYield + ENEMY_DEFS.boss_goliath.lumberYield);
    assert(lumber.lumber >= 3);
    const lives = economy.lives;
    EventBus.emit(GameEvents.ENEMY_REACHED_END, { def: ENEMY_DEFS.boss_goliath });
    assert.equal(economy.lives, lives - ENEMY_DEFS.boss_goliath.livesCost);
    EventBus.emit(GameEvents.ENEMY_REACHED_END, {});
    assert.equal(economy.lives, lives - ENEMY_DEFS.boss_goliath.livesCost - 1, 'an enemy without a definition costs one life');
  } finally { destroyAll(); }
});

test('later listeners (the scene\'s presentation) see the kill already paid, and a destroyed system pays nothing', () => {
  const { economy, outcomes, destroyAll } = makeSystems();
  const start = economy.gold;
  let seen = null;
  const spy = () => { seen = economy.gold; };
  EventBus.on(GameEvents.ENEMY_KILLED, spy);
  try {
    EventBus.emit(GameEvents.ENEMY_KILLED, { enemy: { def: ENEMY_DEFS.runner }, goldReward: 5 });
    assert.equal(seen, start + 5);
    outcomes.destroy();
    EventBus.emit(GameEvents.ENEMY_KILLED, { enemy: { def: ENEMY_DEFS.runner }, goldReward: 5 });
    assert.equal(economy.gold, start + 5);
    EventBus.emit(GameEvents.ENEMY_REACHED_END, { def: ENEMY_DEFS.runner });
    assert.equal(economy.lives, 20);
  } finally { EventBus.off(GameEvents.ENEMY_KILLED, spy); destroyAll(); }
});

test('a full oracle run earns lumber from the every-5-waves rule and from golem and boss kills', () => {
  const run = simulate({ baseline: 'oracle_bank' });
  const fromKills = WAVES.reduce((sum, wave) => sum + wave.count * ENEMY_DEFS[wave.enemyType].lumberYield, 0);
  assert(fromKills > 0, 'the data has lumber-yielding enemies');
  assert.equal(run.lumberEnd, Math.floor(WAVES.length / 5) + fromKills);
});

// ── Static guards ───────────────────────────────────────────────────────────

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

test('only EventBus.ts and Subscriptions.ts subscribe to the bus directly', () => {
  const allowed = new Set([join('src', 'utils', 'EventBus.ts'), join('src', 'utils', 'Subscriptions.ts')]);
  const offenders = sourceFiles('src').filter((file) => !allowed.has(file) && /EventBus\.(on|once|off)\(/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('scenes never change gold, lives or lumber (EnemyOutcomes, InterestSystem and BuildSystem own them)', () => {
  const offenders = sourceFiles(join('src', 'scenes')).filter((file) => /\.(addGold|spendGold|loseLife)\(|umber\w*\.(add|spend)\(/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('GameScene wires EnemyOutcomes right after WaveManager and owns its listeners through Subscriptions', () => {
  const scene = readFileSync(join('src', 'scenes', 'GameScene.ts'), 'utf8');
  const waves = scene.indexOf('new WaveManager(');
  const outcomes = scene.indexOf('new EnemyOutcomes(');
  assert(waves > 0 && outcomes > waves && outcomes - waves < 400, 'EnemyOutcomes must be created directly after WaveManager');
  const shutdown = scene.slice(scene.indexOf('shutdown(): void'), scene.indexOf('// ── Systems'));
  assert(shutdown.includes('this._outcomes.destroy()') && shutdown.includes('this._subs.dispose()'));
  assert(scene.includes("this.events.once('shutdown', this.shutdown, this)"));
});
