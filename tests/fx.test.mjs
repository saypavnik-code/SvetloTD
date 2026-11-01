// [3a:fx-test] cosmetic FX contract: what the new overlays draw, and that the sprite layer path never uses fillPoints
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/entities/Enemy.ts', 'src/entities/Hero.ts', 'src/entities/Tower.ts', 'src/entities/Projectile.ts',
  'src/data/pathData.ts', 'src/data/towers.ts', 'src/utils/ObjectPool.ts',
);

function recorder() {
  const calls = [];
  const g = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, ...args]); return g; } });
  return { g, calls };
}
const count = (calls, name, radius) => calls.filter((c) => c[0] === name && (radius === undefined || c[3] === radius)).length;
const chain = () => { const stub = new Proxy(function () {}, { get: (_, key) => (key === 'then' ? undefined : stub), apply: () => stub }); return stub; };
const scene = { add: { graphics: chain }, tweens: { add: chain } };

function enemy(id, opts) {
  const e = new game.Enemy();
  e.init(id, game.PATH_TOP, opts);
  return e;
}
function draw(e) { const r = recorder(); e.drawTo(r.g, false); return r.calls; }

test('boss bezel: a gold ring and twelve ticks around the boss, never a filled polygon', () => {
  const calls = draw(enemy('boss_goliath'));
  assert.equal(count(calls, 'strokeCircle', 29), 1, 'outer bezel at radius + 11');
  assert.equal(count(calls, 'lineTo'), 12, 'twelve ticks');
  assert.equal(count(calls, 'fillPoints'), 0);
  assert.equal(count(draw(enemy('grunt')), 'strokeCircle', 29), 0, 'only bosses get the bezel');
});

test('poison, slow and healing draw their own overlays and nothing else changes', () => {
  const base = draw(enemy('grunt'));
  const poisoned = enemy('grunt');
  poisoned.applyEffect({ type: 'poison', value: 8, duration: 3, sourceId: 't' });
  assert.equal(count(draw(poisoned), 'fillCircle') - count(base, 'fillCircle'), 3, 'three poison bubbles');
  const slowed = enemy('grunt');
  slowed.applyEffect({ type: 'slow', value: 0.3, duration: 2, sourceId: 't' });
  const slowCalls = draw(slowed);
  assert.equal(count(slowCalls, 'fillCircle') - count(base, 'fillCircle'), 4, 'four frost sparkles');
  assert.equal(count(slowCalls, 'strokeCircle', 13.5), 1, 'frost ring');
  const healing = enemy('grunt', { isHealing: true });
  const full = draw(healing);
  healing.hp = 10;
  assert.equal(count(draw(healing), 'lineTo') - count(full, 'lineTo'), 2, 'the plus appears only while wounded');
  assert.equal(count(base, 'fillPoints') + count(slowCalls, 'fillPoints'), 0);
});

test('tower tier pips: one per tier, three and a glow for ultimates, none for the watchtower', () => {
  const pool = new game.ObjectPool(() => new game.Projectile(), 2);
  const pips = (id) => {
    const tower = new game.Tower(scene, id, 5, 5, pool, () => []);
    const r = recorder();
    tower.drawTo(r.g, false);
    return r.calls;
  };
  assert.equal(count(pips('arrow_t1'), 'fillCircle', 3), 1);
  assert.equal(count(pips('slow_t2'), 'fillCircle', 3), 2);
  assert.equal(count(pips('fire_ult'), 'fillCircle', 3), 3);
  assert.equal(count(pips('watchtower'), 'fillCircle', 3), 0);
});

test('hero aura: one orbit marker per ready skill', () => {
  const hero = new game.Hero();
  const orbits = () => { const r = recorder(); hero.drawTo(r.g, false); return count(r.calls, 'fillCircle', 2.2); };
  assert.equal(orbits(), 2);
  hero.useSkillQ([]);
  assert.equal(orbits(), 1);
  hero.useSkillW([]);
  assert.equal(orbits(), 0);
});
