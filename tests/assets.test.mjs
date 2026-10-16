import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const { BUILDABLE_TOWER_IDS } = loadModules('src/data/towers.ts');
const boot = readFileSync('src/scenes/BootScene.ts', 'utf8');

function pngSize(path) {
  const data = readFileSync(path);
  assert.equal(data.subarray(1, 4).toString('latin1'), 'PNG', `${path} is not a PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

test('every texture BootScene loads exists as a PNG on disk', () => {
  const keys = [];
  for (const m of boot.matchAll(/'(icon_[a-z_]+|tw_[a-z]+)'/g)) keys.push(`public/assets/ui/${m[1]}.png`);
  for (const m of boot.matchAll(/this\.load\.image\('[a-z_]+', '(assets\/[^']+\.png)'\)/g)) keys.push(`public/${m[1]}`);
  for (const variant of ['a', 'b', 'c', 'd']) keys.push(`public/assets/tiles/grass_${variant}.png`);
  for (const variant of ['a', 'b', 'c']) keys.push(`public/assets/tiles/path_${variant}.png`);
  assert(keys.length >= 19, `the loader list could not be read (${keys.length} files)`);
  for (const file of keys) assert(existsSync(file), `missing ${file}`);
});

test('every buildable tower has a medallion icon the build panel can load', () => {
  assert(BUILDABLE_TOWER_IDS.length >= 6);
  for (const id of BUILDABLE_TOWER_IDS) {
    const key = `tw_${id.split('_')[0]}`;
    assert(boot.includes(`'${key}'`), `BootScene does not load ${key}`);
    assert.deepEqual(pngSize(`public/assets/ui/${key}.png`), { width: 96, height: 96 });
  }
});

test('terrain tiles are 80x80 (drawn at 40 px for a crisp 2x texture)', () => {
  for (const name of ['grass_a', 'grass_b', 'grass_c', 'grass_d', 'path_a', 'path_b', 'path_c']) {
    assert.deepEqual(pngSize(`public/assets/tiles/${name}.png`), { width: 80, height: 80 }, name);
  }
});
