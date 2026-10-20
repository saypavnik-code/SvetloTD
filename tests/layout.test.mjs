import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/config.ts', 'src/config/difficulty.ts', 'src/ui/layout.ts', 'src/ui/HUD.ts', 'src/ui/WaveInfo.ts', 'src/ui/TowerPanel.ts',
  'src/ui/BuilderPanel.ts', 'src/systems/WaveManager.ts', 'src/systems/EconomyManager.ts', 'src/systems/LumberManager.ts',
  'src/systems/BuilderManager.ts', 'src/systems/Seats.ts', 'src/entities/Enemy.ts', 'src/utils/ObjectPool.ts', 'src/utils/EventBus.ts',
);
const { FIELD, SIDE, HUD_STRIP, BOTTOM_BAR, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, GRID_COLS, GRID_ROWS } = game;

// ── Geometry ────────────────────────────────────────────────────────────────

test('the field is the full 18 x 18 tile square at the left and the side column is the rest of the canvas', () => {
  assert.deepEqual(FIELD, { x: 0, y: 0, w: GRID_COLS * TILE_SIZE, h: GRID_ROWS * TILE_SIZE });
  assert.deepEqual(SIDE, { x: FIELD.w, y: 0, w: GAME_WIDTH - FIELD.w, h: GAME_HEIGHT });
  assert(FIELD.h <= GAME_HEIGHT, 'the whole field fits in the canvas: no tile row is cut off');
});

test('no bar, slot or list of the interface overlaps the field (the first and last tile rows stay uncovered)', () => {
  const rects = { HUD_STRIP, BOTTOM_BAR, skillQ: game.skillSlotRect(0), skillW: game.skillSlotRect(1) };
  for (const seats of [1, 2, 4]) {
    rects[`seatBar${seats}`] = { x: SIDE.x, y: game.SEAT_BAR_Y, w: SIDE.w, h: game.SEAT_BAR_H };
    rects[`list${seats}`] = { x: SIDE.x, y: game.listTop(seats), w: SIDE.w, h: game.listBottom(seats) - game.listTop(seats) };
    rects[`builders${seats}`] = { x: SIDE.x, y: game.buildersTop(seats), w: SIDE.w, h: game.buildersBottom(seats) - game.buildersTop(seats) };
  }
  for (const [name, rect] of Object.entries(rects)) {
    assert(game.inside(rect, SIDE), `${name} leaves the side column: ${JSON.stringify(rect)}`);
    assert(!game.overlaps(rect, FIELD), `${name} covers the field`);
  }
});

test('the side column stacks without overlap for one, two and four seats', () => {
  for (const seats of [1, 2, 4]) {
    const order = [HUD_STRIP.y + HUD_STRIP.h, game.panelTop(seats), game.listTop(seats), game.listBottom(seats), game.buildersTop(seats), game.buildersBottom(seats), BOTTOM_BAR.y];
    for (let i = 1; i < order.length; i++) assert(order[i] > order[i - 1], `${seats} seats: layer ${i} (${order[i]}) is not below layer ${i - 1} (${order[i - 1]})`);
    if (seats > 1) assert(game.SEAT_BAR_Y + game.SEAT_BAR_H <= game.panelTop(seats), `${seats} seats: the seat bar lies on the list`);
  }
  const q = game.skillSlotRect(0), w = game.skillSlotRect(1);
  assert(!game.overlaps(q, w) && w.x + w.w < BOTTOM_BAR.x + BOTTOM_BAR.w, 'two skill slots fit in the bottom bar');
});

// ── What the real classes draw ───────────────────────────────────────────────

// Records every position the real UI classes hand to the scene, so a bar that is moved back onto the field fails here.
function recordingScene() {
  const marks = [];
  const note = (what, x, y, w = 0, h = 0) => marks.push({ what, x, y, w, h });
  const chain = () => { const stub = new Proxy(function () {}, { get: (_, key) => (key === 'then' ? undefined : stub), apply: () => stub }); return stub; };
  const graphics = () => new Proxy({}, { get: (_, key) => {
    if (['fillRect', 'strokeRect', 'fillRoundedRect', 'strokeRoundedRect'].includes(key)) return (x, y, w, h) => { note(key, x, y, w, h); return graphics(); };
    if (['moveTo', 'lineTo'].includes(key)) return (x, y) => { note(key, x, y); return graphics(); };
    if (['fillCircle', 'strokeCircle'].includes(key)) return (x, y, r) => { note(key, x - r, y - r, 2 * r, 2 * r); return graphics(); };
    return () => graphics();
  } });
  const scene = {
    add: {
      graphics, container: chain,
      // Empty text parked at (0, 0) is a tooltip slot: the tooltip places it left of the panel only while the pointer hovers a row.
      text: (x, y, str) => { if (!(x === 0 && y === 0 && str === '')) note('text', x, y); return chain(); }, image: (x, y) => { note('image', x, y); return chain(); },
      zone: (x, y, w, h) => { note('zone', x, y, w, h); return chain(); },
    },
    tweens: { add: chain }, time: { delayedCall: chain }, input: { on: chain, setDefaultCursor: chain }, cameras: { main: chain() },
  };
  return { scene, marks };
}

function assertInSide(marks, who) {
  assert(marks.length > 0, `${who}: nothing was drawn`);
  for (const mark of marks) {
    assert(mark.x >= SIDE.x && mark.x + mark.w <= GAME_WIDTH && mark.y >= 0 && mark.y + mark.h <= GAME_HEIGHT,
      `${who}: ${mark.what} at (${mark.x}, ${mark.y}, ${mark.w}, ${mark.h}) is outside the side column`);
  }
}

test('HUD, wave bar, build panel and builders section draw only in the side column', () => {
  game.GameConfig.setDifficulty('normal');
  for (const seatCount of [1, 4]) {
    const economy = new game.EconomyManager(seatCount);
    const lumber = new game.LumberManager(seatCount);
    const seats = new game.Seats(seatCount);
    const builders = new game.BuilderManager(lumber, seatCount, seatCount === 1 ? 'all' : game.DEFAULT_PICKS);
    const waves = new game.WaveManager(null, new game.ObjectPool(() => new game.Enemy(), 4));
    try {
      let rec = recordingScene();
      new game.HUD(rec.scene, economy, waves);
      assertInSide(rec.marks, `HUD (${seatCount} seats)`);
      rec = recordingScene();
      new game.WaveInfo(rec.scene, waves);
      assertInSide(rec.marks, `WaveInfo (${seatCount} seats)`);
      rec = recordingScene();
      new game.TowerPanel(rec.scene, { onTowerSelected: null, selectTowerType() {} }, economy, seats, builders, lumber);
      assertInSide(rec.marks, `TowerPanel and BuilderPanel (${seatCount} seats)`);
    } finally {
      waves.destroy(); economy.destroy();
    }
  }
});

test('the build list shows one row per tower the active seat may build, and the seat bar keeps clear of it', () => {
  const lumber = new game.LumberManager(4);
  const builders = new game.BuilderManager(lumber, 4, game.DEFAULT_PICKS);
  assert(builders.buildableFor(0).length <= game.LIST_ROWS && builders.buildableFor(0).length > 0);
  assert(new game.BuilderManager(lumber, 1, 'all').buildableFor(0).length <= game.LIST_ROWS, 'the classic list fits the six rows');
});
