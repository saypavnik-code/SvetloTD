import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const { SeatOverlay, PAD_HALF, SEAT_COLORS, Seats, EconomyManager, LumberManager } = loadModules(
  'src/ui/SeatOverlay.ts', 'src/entities/Tower.ts', 'src/data/seats.ts', 'src/systems/Seats.ts', 'src/systems/EconomyManager.ts', 'src/systems/LumberManager.ts',
);

// A stand-in for the Phaser surface the overlay touches: every Graphics records its calls, every other object is a chainable no-op.
function stage(seatCount, towers) {
  const graphics = [];
  const chain = () => new Proxy(function () {}, { get: (_, key) => (key === 'then' ? undefined : () => chain()), apply: () => chain() });
  const add = {
    graphics: () => {
      const calls = [];
      const g = new Proxy({}, { get: (_, key) => { if (key === 'calls') return calls; return (...args) => { calls.push([key, ...args]); return g; }; } });
      graphics.push(g);
      return g;
    },
    text: chain, zone: chain,
  };
  const seats = new Seats(seatCount, false);
  const overlay = new SeatOverlay({ add }, seats, new EconomyManager(seatCount), new LumberManager(seatCount), () => towers, { giveGold() {}, giveLumber() {}, cede() {}, canCede: () => false });
  return { overlay, marks: graphics[2] };   // zones, chips, marks
}

// The calls of the last frame: everything after the last clear() (the constructor draws one frame as well).
const lastFrame = (marks) => marks.calls.slice(marks.calls.map(([name]) => name).lastIndexOf('clear') + 1);

test('every tower pad gets a rim in the colour of its seat and one to four pips', () => {
  const towers = [0, 1, 2, 3].map((seat) => ({ x: 100 + seat * 80, y: 140, ownerSeat: seat }));
  const { overlay, marks } = stage(4, towers);
  overlay.update();
  const frame = lastFrame(marks);
  const rims = frame.filter(([name]) => name === 'strokeRoundedRect');
  assert.equal(rims.length, 4, 'one rim per tower');
  // the colour in force when each rim is drawn is the last lineStyle before it
  let colour = null; const seen = [];
  for (const [name, ...args] of frame) {
    if (name === 'lineStyle') colour = args[1];
    if (name === 'strokeRoundedRect') seen.push(colour);
  }
  assert.deepEqual(seen, SEAT_COLORS.slice(0, 4));
  for (const [, x, y, w] of rims) assert(w <= PAD_HALF * 2 && x < 100 + 3 * 80, 'the rim stays inside the pad');
  const pips = frame.filter(([name]) => name === 'fillCircle');
  assert.equal(pips.length, 1 + 2 + 3 + 4, 'seat I has one pip, seat IV four');
});

test('the marks are redrawn from scratch every frame and follow a sold tower', () => {
  const towers = [{ x: 100, y: 100, ownerSeat: 1 }, { x: 200, y: 100, ownerSeat: 2 }];
  const { overlay, marks } = stage(4, towers);
  overlay.update();
  towers.pop();
  overlay.update();
  assert.equal(lastFrame(marks).filter(([name]) => name === 'strokeRoundedRect').length, 1);
});
