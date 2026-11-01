import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  LATE_BAR, ROUTE_EXCESS_LIMIT, SEAT_COUNTS, SEAT_DROP_LIMIT, SEAT_SPREAD_LIMIT, TEAMS, TEAM_GAP_LIMIT, buildReport, livesLeftAfter, measure, routeLoad, run,
} from '../scripts/seat_report.mjs';
import { game, simulate } from './support/simulate.mjs';

const { WAVES, ENEMY_DEFS, DIFFICULTY_PRESETS } = game;
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const ratio = (values) => Math.max(...values) / Math.max(1, Math.min(...values));

// ── The seat-aware harness ──────────────────────────────────────────────────

test('a seat-aware run is deterministic and a one-seat run does not depend on passing seats: 1', () => {
  const four = () => simulate({ build: 'balanced', seats: 4, placement: 'zones', maxWave: 8 });
  assert.deepEqual(four(), four());
  assert.deepEqual(simulate({ build: 'arrow', maxWave: 6 }), simulate({ build: 'arrow', maxWave: 6, seats: 1 }));
});

test('every tower stands in a zone its seat owns, whatever the seat count', () => {
  for (const seats of SEAT_COUNTS) {
    const result = simulate({ build: 'arrow', seats, placement: 'zones', extraGold: 20000, maxWave: 1 });
    assert(result.towerCells.length >= 20, `${seats} seats: the starting purse buys the cells`);
    for (const cell of result.towerCells) {
      assert.equal(game.seatOfZone(game.zoneOfCell(cell.row, cell.col), seats), cell.seat, `${seats} seats: ${cell.id} at ${cell.col},${cell.row}`);
    }
  }
});

test('placement zones uses the same 24 cells for 1, 2 and 4 seats and every zone gets six', () => {
  const cells = (seats) => simulate({ build: 'arrow', seats, placement: 'zones', extraGold: 20000, maxWave: 1 }).towerCells
    .map((c) => `${c.col},${c.row}`).sort();
  assert.deepEqual(cells(2), cells(1));
  assert.deepEqual(cells(4), cells(1));
  const perZone = [0, 1, 2, 3].map((zone) => cells(1).filter((c) => { const [col, row] = c.split(',').map(Number); return game.zoneOfCell(row, col) === zone; }).length);
  assert.deepEqual(perZone, [6, 6, 6, 6]);
});

test('nothing is lost between the seats: gold and lumber are conserved in a four-seat run', () => {
  const result = simulate({ build: 'balanced', seats: 4, placement: 'zones', maxWave: 12 });
  const start = DIFFICULTY_PRESETS.normal.startingGold;
  const earned = sum(result.rows, 'bounty') + sum(result.rows, 'interest') + sum(result.rows, 'bonus');
  const invested = result.perSeat.reduce((total, seat) => total + seat.invested, 0);
  assert.equal(result.goldEnd + invested, start + earned, 'purse plus towers equals the start plus everything earned');
  assert.equal(result.goldEnd, result.perSeat.reduce((total, seat) => total + seat.goldEnd, 0));
  const cleared = result.rows.filter((row) => row.cleared).length;
  const yields = result.rows.reduce((total, row) => total + row.kills * ENEMY_DEFS[row.enemyType].lumberYield, 0);
  assert.equal(result.lumberEnd, yields + 4 * Math.floor(cleared / 5), 'kill yields plus the milestone lumber of every seat');
});

// ── Route load (fixed in v0.23.0) ───────────────────────────────────────────

test('the real WaveManager spreads the enemies over the four routes within 5% of the mean', () => {
  const oracle = simulate({ baseline: 'oracle_bank' });
  const load = [0, 1, 2, 3].map((route) => oracle.rows.reduce((total, row) => total + row.routes[route], 0));
  assert.equal(load.reduce((a, b) => a + b, 0), WAVES.reduce((total, wave) => total + wave.count, 0), 'every enemy is counted once');
  assert.deepEqual(load, routeLoad(true), 'the report formula describes what the game does');
  const mean = load.reduce((a, b) => a + b, 0) / load.length;
  for (const count of load) assert(count <= mean * (1 + ROUTE_EXCESS_LIMIT), `a route receives ${count} of a mean ${mean}: ${load.join('/')}`);
  assert(Math.max(...routeLoad(false)) > mean * (1 + ROUTE_EXCESS_LIMIT), 'without the rotation the bar would fail');
});

test('a wave that pins one route keeps it, and the rotation never changes how many enemies spawn', () => {
  const oracle = simulate({ baseline: 'oracle_bank' });
  WAVES.forEach((wave, index) => {
    const routes = oracle.rows[index].routes;
    assert.equal(routes.reduce((a, b) => a + b, 0), wave.count, `wave ${wave.wave}`);
    if (wave.paths >= 0) assert.equal(routes[wave.paths], wave.count, `wave ${wave.wave} stays on route ${wave.paths}`);
    else assert.equal(routes[index % 4] >= routes[(index + 1) % 4], true, `wave ${wave.wave} starts on route ${index % 4}`);
  });
});

// ── Licensed teams (v0.24.0) ────────────────────────────────────────────────

test('a licensed seat builds only its own builder line and the common tower', () => {
  const result = simulate({ seats: 4, team: TEAMS.default, placement: 'zones', extraGold: 20000, maxWave: 1 });
  assert(result.towerCells.length >= 20, 'the starting purse buys the cells');
  for (const cell of result.towerCells) {
    const own = game.BUILDERS[TEAMS.default[cell.seat]].roots.flatMap((root) => game.towerLine(root));
    assert([...own, ...game.COMMON_TOWER_IDS].includes(cell.id), `seat ${cell.seat} (${TEAMS.default[cell.seat]}) owns ${cell.id}`);
  }
  assert.throws(() => simulate({ seats: 4, team: ['fire', 'earth'], maxWave: 1 }), /one builder per seat/);
});

test('gifts between licensed seats create and lose nothing', () => {
  for (const gifts of [true, false]) {
    const result = simulate({ seats: 4, team: TEAMS.default, placement: 'zones', gifts, maxWave: 14 });
    const earned = sum(result.rows, 'bounty') + sum(result.rows, 'interest') + sum(result.rows, 'bonus');
    const invested = result.perSeat.reduce((total, seat) => total + seat.invested, 0);
    assert.equal(result.goldEnd + invested, DIFFICULTY_PRESETS.normal.startingGold + earned, `gifts ${gifts}`);
  }
  const a = simulate({ seats: 4, team: TEAMS.default, placement: 'zones', maxWave: 10 });
  assert.deepEqual(a, simulate({ seats: 4, team: TEAMS.default, placement: 'zones', maxWave: 10 }), 'deterministic');
});

// Closed by the line rebalance of v0.25.0 (docs/SEAT_REPORT.md finding 8): the mixed default team ended 17 waves behind four Wardens (wave 23 against 40).
test('the default mixed team ends within the limit of the best mono team', () => {
  const m = measure();
  assert(m.monoBest - m.teams.default.reachedWave <= TEAM_GAP_LIMIT, `default team ends in wave ${m.teams.default.reachedWave}, best mono team in wave ${m.monoBest}`);
});

// ── Bars measured by docs/SEAT_REPORT.md ────────────────────────────────────

test('co-operation is no handicap: with 2 or 4 seats no build ends more than the limit earlier than with one seat', () => {
  const m = measure();
  for (const name of m.names) {
    for (const seats of [2, 4]) {
      const drop = m.bySeats[name][1].reachedWave - m.bySeats[name][seats].reachedWave;
      assert(drop <= SEAT_DROP_LIMIT, `${name}: ${seats} seats end ${drop} waves earlier than one seat`);
    }
  }
});

test('the four seats of the best build earn kills evenly', () => {
  const m = measure();
  const perSeat = m.bySeats[m.best][4].perSeat;
  assert(ratio(perSeat.map((s) => s.kills)) <= SEAT_SPREAD_LIMIT, `kills ${perSeat.map((s) => s.kills).join('/')}`);
});

test('late-game bar: the best catalogued build holds the listed wave with the listed lives left', () => {
  const m = measure();
  const bestRun = m.bySeats[m.best][1];
  assert(livesLeftAfter(bestRun, LATE_BAR.upToWave) >= LATE_BAR.minLives, `${m.best} has ${livesLeftAfter(bestRun, LATE_BAR.upToWave)} lives after wave ${LATE_BAR.upToWave}`);
  assert(bestRun.result === 'victory' || bestRun.reachedWave > LATE_BAR.upToWave);
  assert.equal(run({ build: m.best, seats: 1, placement: 'zones' }), bestRun, 'the report and the bar use the same run');
});

test('docs/SEAT_REPORT.md is up to date (run `node scripts/seat_report.mjs --write`)', () => {
  const committed = readFileSync('docs/SEAT_REPORT.md', 'utf8').replace(/\r\n/g, '\n');
  assert.equal(committed, buildReport());
});
