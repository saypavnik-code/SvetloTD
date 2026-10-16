import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules('src/ui/SpriteViews.ts', 'src/data/towers.ts', 'src/data/enemies.ts', 'src/data/pathData.ts', 'src/entities/Enemy.ts');
const { SpriteViews, TOWER_DEFS, ENEMY_DEFS, PATH_TOP, Enemy } = game;

function pngSize(path) {
  const data = readFileSync(path);
  assert.equal(data.subarray(1, 4).toString('latin1'), 'PNG', `${path} is not a PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function recorder() {
  const images = [];
  const scene = { add: { image: (x, y, key) => {
    const rec = { key, calls: [], destroyed: false };
    rec.proxy = new Proxy({}, { get: (_, name) => (name === 'destroy' ? () => { rec.destroyed = true; } : (...args) => { rec.calls.push([name, ...args]); return rec.proxy; }) });
    images.push(rec);
    return rec.proxy;
  } } };
  return { images, scene };
}
const last = (rec, name) => rec.calls.filter((call) => call[0] === name).at(-1);

test('every tower kind, enemy and the hero have a 128 px sprite that BootScene loads', () => {
  const boot = readFileSync('src/scenes/BootScene.ts', 'utf8');
  const names = [...Object.keys(TOWER_DEFS), ...Object.keys(ENEMY_DEFS), 'hero'];
  assert(names.length >= 16);
  for (const name of names) {
    assert(boot.includes(`'${name}'`), `BootScene does not load ${name}`);
    assert(existsSync(`public/assets/art/${name}.png`), `missing sprite ${name}`);
    assert.deepEqual(pngSize(`public/assets/art/${name}.png`), { width: 128, height: 128 }, name);
  }
});

test('SpriteViews keeps exactly one image per live entity and cleans up after it', () => {
  const { images, scene } = recorder();
  const views = new SpriteViews(scene);
  const tower = { x: 100, y: 100, towerId: 'arrow_t1', spawnBounce: 1 };
  const grunt = { isActive: true, x: 50, y: 50, def: { id: 'grunt' }, flying: false, dyingFraction: 1, isFlashing: false };
  const hero = { x: 10, y: 10 };
  views.update([tower], [grunt], hero, 0);
  assert.deepEqual(views.counts, { towers: 1, enemies: 1, hero: 1 });
  assert.deepEqual(images.map((i) => i.key), ['spr_arrow_t1', 'spr_grunt', 'spr_hero']);

  grunt.x = 40;
  views.update([tower], [grunt], hero, 16);
  assert.deepEqual(last(images[1], 'setFlipX'), ['setFlipX', true], 'an enemy walking left is mirrored');
  grunt.isFlashing = true;
  views.update([tower], [grunt], hero, 32);
  assert.deepEqual(last(images[1], 'setTintFill'), ['setTintFill', 0xffffff], 'a hit flashes white');
  grunt.dyingFraction = 0.5;
  views.update([tower], [grunt], hero, 48);
  assert.deepEqual(last(images[1], 'setAlpha'), ['setAlpha', 0.5], 'a dying enemy fades');
  tower.towerId = 'arrow_t2';
  tower.spawnBounce = 1.2;
  views.update([tower], [grunt], hero, 64);
  assert.deepEqual(last(images[0], 'setTexture'), ['setTexture', 'spr_arrow_t2'], 'an upgrade swaps the texture');
  assert.equal(last(images[0], 'setDisplaySize')[1], 48 * 1.2, 'a fresh tower pulses');

  views.update([], [], hero, 80);
  assert(images[0].destroyed && images[1].destroyed, 'a sold tower and a dead enemy lose their images');
  assert.deepEqual(views.counts, { towers: 0, enemies: 0, hero: 1 });
  grunt.dyingFraction = 1; grunt.isFlashing = false;
  views.update([], [grunt], hero, 96);
  assert.equal(images.length, 4, 'a pooled enemy that spawns again gets a fresh image');
  views.destroy();
  assert.deepEqual(views.counts, { towers: 0, enemies: 0, hero: 0 });
  assert(images.every((image) => image.destroyed));
});

test('Enemy.drawTo without the body keeps the shadow and overlays but not the vector shape', () => {
  const gfx = () => {
    const calls = [];
    const g = new Proxy({}, { get: (_, name) => (...args) => { calls.push(name); return g; } });
    return { g, calls };
  };
  const enemy = new Enemy();
  enemy.init('runner', PATH_TOP);
  const full = gfx(); enemy.drawTo(full.g);
  const bare = gfx(); enemy.drawTo(bare.g, false);
  assert(full.calls.includes('fillPoints'), 'the default still draws the vector body');
  assert(!bare.calls.includes('fillPoints'), 'the sprite layer replaces the body');
  assert(bare.calls.includes('fillEllipse'), 'the ground shadow stays');
});

test('GameScene hands the bodies to the sprite layer and releases it on shutdown', () => {
  const scene = readFileSync('src/scenes/GameScene.ts', 'utf8');
  for (const call of ['drawTo(this._towerGfx, false)', 'drawTo(this._enemyGfx, false)', 'drawTo(this._heroGfx, false)', 'this._views.update(', 'this._views.destroy()']) {
    assert(scene.includes(call), `GameScene lost ${call}`);
  }
});
