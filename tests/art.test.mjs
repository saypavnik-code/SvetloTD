// Art pass 3, part 1 (v0.22.0): the icons and map objects the interface needs exist, have the agreed size, and are told apart by shape.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const { BUILDER_IDS } = loadModules('src/data/builders.ts');
const { DAMAGE_MATRIX } = loadModules('src/data/damageMatrix.ts');
const { ENEMY_DEFS } = loadModules('src/data/enemies.ts');
const { TOWER_DEFS } = loadModules('src/data/towers.ts');

const DAMAGE_IDS = Object.keys(DAMAGE_MATRIX);
const ARMOR_IDS = Object.keys(DAMAGE_MATRIX.normal);
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** Minimal PNG reader for the 8-bit RGBA files Pillow writes (all five filter types, no interlacing). */
function readPng(path) {
  const data = readFileSync(new URL(`../${path}`, import.meta.url));
  assert.equal(data.toString('latin1', 1, 4), 'PNG', `${path} is not a PNG`);
  const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
  assert.ok(data[24] === 8 && data[25] === 6 && data[28] === 0, `${path} must be 8-bit RGBA without interlacing`);
  const parts = [];
  for (let at = 8; at < data.length;) {
    const len = data.readUInt32BE(at);
    if (data.toString('latin1', at + 4, at + 8) === 'IDAT') parts.push(data.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * 4;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      let add;
      if (filter === 0) add = 0;
      else if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else throw new Error(`${path}: unknown PNG filter ${filter}`);
      px[y * stride + x] = (v + add) & 255;
    }
  }
  return { width, height, alpha: (x, y) => px[y * stride + x * 4 + 3] };
}

/** The silhouette: 1 where the pixel is clearly drawn. */
function silhouette(path) {
  const png = readPng(path);
  const m = [];
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) m.push(png.alpha(x, y) > 40 ? 1 : 0);
  return { w: png.width, h: png.height, m };
}
const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.m.length; k++) { i += a.m[k] & b.m[k]; u += a.m[k] | b.m[k]; } return i / u; };
const mirror = (s) => ({ ...s, m: s.m.map((_, k) => s.m[Math.floor(k / s.w) * s.w + (s.w - 1 - (k % s.w))]) });
const share = (s) => s.m.reduce((n, v) => n + v, 0) / s.m.length;
const centroid = (s) => {
  let n = 0, sx = 0, sy = 0;
  s.m.forEach((v, k) => { if (v) { n++; sx += k % s.w; sy += Math.floor(k / s.w); } });
  return { x: sx / n, y: sy / n };
};

const ICONS = [
  ...BUILDER_IDS.map((id) => ({ path: `public/assets/ui/builder_${id}.png`, size: 96 })),
  ...DAMAGE_IDS.map((id) => ({ path: `public/assets/ui/dmg_${id}.png`, size: 64 })),
  ...ARMOR_IDS.map((id) => ({ path: `public/assets/ui/armor_${id}.png`, size: 64 })),
];

test('every builder, damage type and armor class has an icon of the agreed size, and BootScene loads each family from the data ids', () => {
  assert.ok(BUILDER_IDS.length >= 6 && DAMAGE_IDS.length >= 5 && ARMOR_IDS.length >= 6);
  for (const { path, size } of ICONS) {
    const s = silhouette(path);
    assert.deepEqual([s.w, s.h], [size, size], path);
  }
  for (const [path, size] of [['public/assets/art/citadel.png', 160], ['public/assets/art/spawn_portal.png', 112]]) {
    const s = silhouette(path);
    assert.deepEqual([s.w, s.h], [size, size], path);
  }
  const boot = src('src/scenes/BootScene.ts');
  for (const line of ['for (const id of BUILDER_IDS) this.load.image(`builder_${id}`', 'for (const id of Object.keys(DAMAGE_MATRIX)) this.load.image(`dmg_${id}`',
                      'for (const id of Object.keys(DAMAGE_MATRIX.normal)) this.load.image(`armor_${id}`', "for (const n of ['citadel', 'spawn_portal']) this.load.image(`spr_${n}`"]) {
    assert.ok(boot.includes(line), `BootScene must contain: ${line}`);
  }
});

test('every enemy armor class and tower damage type that the game can show has its icon', () => {
  for (const def of Object.values(ENEMY_DEFS)) assert.ok(ARMOR_IDS.includes(def.armorType), `no armor icon for ${def.armorType}`);
  for (const def of Object.values(TOWER_DEFS)) assert.ok(DAMAGE_IDS.includes(def.damageType), `no damage icon for ${def.damageType}`);
  const labels = /const DAMAGE_LABELS[^{]*\{([^}]*)\}/.exec(src('src/ui/TowerPanel.ts'));
  assert.ok(labels, 'TowerPanel must name every damage type');
  for (const id of DAMAGE_IDS) assert.ok(new RegExp(`\\b${id}:`).test(labels[1]), `no label for damage type ${id}`);
  // the wave bar keeps its own enemy-to-armor table: it must agree with the enemy data, or the icon would lie
  const table = /_enemyArmorKey[\s\S]*?const defs[^{]*\{([^}]*)\}/.exec(src('src/ui/WaveInfo.ts'));
  assert.ok(table, 'WaveInfo armor table not found');
  for (const [id, def] of Object.entries(ENEMY_DEFS)) assert.ok(new RegExp(`${id}:\\s*'${def.armorType}'`).test(table[1]), `WaveInfo says a different armor for ${id}`);
});

test('icons are shapes with a transparent border, and armor classes and damage types differ by silhouette, not only by colour', () => {
  for (const { path } of ICONS) {
    const s = silhouette(path);
    assert.equal(s.m[0], 0, `${path}: top-left corner must be transparent`);
    assert.equal(s.m[s.m.length - 1], 0, `${path}: bottom-right corner must be transparent`);
    assert.ok(share(s) > 0.15 && share(s) < 0.8, `${path}: covers ${share(s).toFixed(2)} of the square`);
  }
  for (const [family, ids] of [['armor', ARMOR_IDS], ['dmg', DAMAGE_IDS]]) {
    const shapes = ids.map((id) => [id, silhouette(`public/assets/ui/${family}_${id}.png`)]);
    for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
      assert.ok(iou(shapes[i][1], shapes[j][1]) < 0.85, `${family}_${shapes[i][0]} and ${family}_${shapes[j][0]} have almost the same silhouette`);
    }
  }
});

test('the base and the spawn portal sit on the exact centre of their footprint, so the four-fold symmetric map stays symmetric', () => {
  const base = silhouette('public/assets/art/citadel.png');
  assert.ok(iou(base, mirror(base)) > 0.97, 'the citadel must be left-right symmetric');
  assert.ok(Math.abs(centroid(base).x - base.w / 2) < 2, 'the citadel is off-centre');
  const portal = silhouette('public/assets/art/spawn_portal.png');
  assert.ok(iou(portal, mirror(portal)) > 0.97, 'the portal turns, so it must be symmetric');
  assert.ok(Math.abs(centroid(portal).x - portal.w / 2) < 1.5 && Math.abs(centroid(portal).y - portal.h / 2) < 1.5, 'the portal would wobble while it turns');
  const game = src('src/scenes/GameScene.ts');
  assert.match(game, /const BASE_SIZE\s*=\s*2 \* TILE_SIZE;/, 'the base footprint is 2x2 tiles');
  assert.ok(game.includes(".add.image(cx,cy,'spr_citadel').setDisplaySize(BASE_SIZE,BASE_SIZE)"), 'the citadel must fill exactly the 2x2 base');
  assert.match(game, /for \(const spawn of SPAWN_POSITIONS\) \{\s*const portal = this\.add\.image\(spawn\.x, spawn\.y, 'spr_spawn_portal'\)/, 'one portal per spawn position, centred on it');
  const portalSize = Number(/const PORTAL_SIZE\s*=\s*(\d+)/.exec(game)?.[1]);
  assert.ok(portalSize > 0 && portalSize <= 60, 'a portal larger than one and a half tiles would hide buildable cells');
});

test('the interface classes show the new icons', () => {
  assert.ok(src('src/ui/BuilderPanel.ts').includes('`builder_${id}`'), 'builder rows show the emblem');
  assert.ok(src('src/ui/TowerPanel.ts').includes('`dmg_${data.damageType}`'), 'the tooltip shows the damage icon');
  assert.ok(src('src/ui/WaveInfo.ts').includes('`armor_${armorKey}`'), 'the wave bar shows the armor icon');
});

test('the tower tooltip text is light on its dark background (it was once drawn in the background colour)', () => {
  const config = src('src/config.ts');
  const hex = (name) => { const m = new RegExp(`${name}:\\s*'#([0-9A-Fa-f]{6})'`).exec(config); assert.ok(m, `${name} not found`); return m[1]; };
  const lum = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((n, c, i) => n + c * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const panel = src('src/ui/TowerPanel.ts');
  assert.ok(!panel.includes('bgPrimary_css') && !panel.includes('bgDark_css'), 'TowerPanel must not draw text in a background colour');
  assert.ok(contrast(hex('textPrimary_css'), hex('bgDark_css')) >= 7, 'light text on the tooltip background needs a contrast of at least 7');
});
