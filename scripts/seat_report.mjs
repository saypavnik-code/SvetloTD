// Generates docs/SEAT_REPORT.md: how the layout and the number of seats change what the catalogued builds achieve.
//   node scripts/seat_report.mjs            print the report
//   node scripts/seat_report.mjs --write    rewrite docs/SEAT_REPORT.md
// Run from the repository root. tests/seatsim.test.mjs fails when the committed report is stale.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { BUILDS, game, simulate } from '../tests/support/simulate.mjs';

const REPORT_PATH = 'docs/SEAT_REPORT.md';
export const SEAT_COUNTS = [1, 2, 4];
/** Late-game bar (waves 21-40): the best catalogued build must still hold wave `upToWave` with `minLives` lives left. */
export const LATE_BAR = { upToWave: 30, minLives: 3 };
/** Cooperation bar: with 2 or 4 seats a build may end at most this many waves earlier than with one seat (same cells, same total gold). */
export const SEAT_DROP_LIMIT = 5;
/** Fairness bar: in the four-seat run of the best build the richest seat may have at most this many times the kills of the poorest. Only that run
 *  plays all 40 waves, so kills average out. Lumber is reported but not barred: it comes in drops of 1 (golem) and 2 (boss) and its spread is
 *  1.1 to 1.5 whatever the routes do (v0.25.0 measurement), so a bar on it would measure luck. */
export const SEAT_SPREAD_LIMIT = 1.25;
/** Route bar: no route may receive more than this share above the mean number of enemies over 40 waves. */
export const ROUTE_EXCESS_LIMIT = 0.05;

/** Licensed teams (one free builder per seat, 6 cells each, gifts on): the default picks of a four-seat game and four contrasts. */
export const TEAMS = {
  default: ['fire', 'earth', 'nature', 'water'],
  no_support: ['fire', 'earth', 'nature', 'nature'],
  two_water: ['fire', 'nature', 'water', 'water'],
  mono_magic: ['fire', 'fire', 'fire', 'fire'],
  mono_arrow: ['nature', 'nature', 'nature', 'nature'],
};
/** Team bar (open, owner decision): the default mixed team may end at most this many waves earlier than the best mono team. */
export const TEAM_GAP_LIMIT = 10;

/** Where ultimates are measured (zones, normal): the licensed teams and the catalogued one-seat builds. */
export const ULTIMATE_CASES = [
  ...['default', 'mono_arrow', 'mono_magic'].map((name) => ({ name: `team ${name}`, options: { seats: 4, team: TEAMS[name], placement: 'zones' } })),
  ...['arrow', 'cannon_arrow', 'magic_slow', 'balanced'].map((name) => ({ name: `one seat ${name}`, options: { build: name, seats: 1, placement: 'zones' } })),
];
/** Expert (difficulty insane: 1 life, shuffled waves): the builds and the seeds that are replayed. A measurement, not a bar. */
export const EXPERT_BUILDS = ['arrow', 'magic_slow', 'balanced'];
export const EXPERT_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const cache = new Map();
export function run(options) {
  const key = JSON.stringify(options);
  if (!cache.has(key)) cache.set(key, simulate(options));
  return cache.get(key);
}
const zones = (build, seats, extra = {}) => run({ build, seats, placement: 'zones', ...extra });
const label = (r) => (r.result === 'victory' ? 'win' : `w${r.reachedWave}`);
const ratio = (values) => Math.max(...values) / Math.max(1, Math.min(...values));
export function livesLeftAfter(result, wave) {
  const row = result.rows[wave - 1];
  return row && row.cleared ? row.livesAtStart - row.livesLost : 0;
}

/** Enemies each route receives over 40 waves with the first route of a wave rotating (true) or fixed at route 0 (false). */
export function routeLoad(rotate) {
  const routes = game.ALL_PATHS.length;
  const load = new Array(routes).fill(0);
  game.WAVES.forEach((wave, index) => {
    for (let k = 0; k < wave.count; k++) {
      load[wave.paths === -1 ? (k + (rotate ? index : 0)) % routes : wave.paths]++;
    }
  });
  return load;
}

export function measure() {
  const names = Object.keys(BUILDS);
  const coverage = Object.fromEntries(names.map((name) => [name, run({ build: name })]));
  const bySeats = Object.fromEntries(names.map((name) => [name, Object.fromEntries(SEAT_COUNTS.map((n) => [n, zones(name, n)]))]));
  const hard = Object.fromEntries(names.map((name) => [name, zones(name, 1, { difficulty: 'hard' })]));
  const best = names.reduce((a, b) => (bySeats[b][1].reachedWave > bySeats[a][1].reachedWave ? b : a));
  const teams = Object.fromEntries(Object.entries(TEAMS).map(([name, team]) => [name, run({ seats: 4, team, placement: 'zones' })]));
  const monoBest = Math.max(teams.mono_arrow.reachedWave, teams.mono_magic.reachedWave);
  const ultimates = ULTIMATE_CASES.map((c) => ({ ...c, plain: run(c.options), withUlt: run({ ...c.options, ultimates: true }) }));
  const expertOptions = { seats: 1, placement: 'zones', ultimates: true, difficulty: 'insane' };
  const expert = Object.fromEntries(EXPERT_BUILDS.map((name) => [name, {
    fixed: run({ ...expertOptions, build: name }),
    seeded: EXPERT_SEEDS.map((seed) => run({ ...expertOptions, build: name, waveSeed: seed })),
  }]));
  return { names, coverage, bySeats, hard, best, teams, monoBest, ultimates, expert };
}

const table = (header, rows) => [
  `| ${header.join(' | ')} |`,
  `| ${header.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.join(' | ')} |`),
].join('\n');

export function buildReport() {
  const m = measure();
  const lines = [];
  const push = (...text) => lines.push(...text);
  const drops = m.names.flatMap((name) => [2, 4].map((n) => m.bySeats[name][1].reachedWave - m.bySeats[name][n].reachedWave));
  const worstDrop = Math.max(...drops);
  const bestFour = m.bySeats[m.best][4];
  const killSpread = ratio(bestFour.perSeat.map((s) => s.kills));
  const lumberSpread = ratio(bestFour.perSeat.map((s) => s.lumberEnd));
  const bestRun = m.bySeats[m.best][1];
  const bar = LATE_BAR;
  const barLives = livesLeftAfter(bestRun, bar.upToWave);
  const fixed = routeLoad(false), turning = routeLoad(true);

  push('# Seat and layout report (generated)', '');
  push('Generated by `node scripts/seat_report.mjs --write` from the headless simulation in `tests/support/simulate.mjs`.');
  push('Do not edit by hand: `tests/seatsim.test.mjs` fails when this file is stale. Regenerate it after any change to wave, enemy, tower,');
  push('seat or economy data. Browser smoke: not run. This report measures; the bars it lists are pinned by that test.', '');
  push('## Method and limits', '');
  push('- The harness of `docs/ECONOMY_REPORT.md` with real `Seats`, `BuilderManager` and `BuildSystem`: every seat has its own wallet (the starting gold is');
  push('  split without loss), buys only in its own zones and runs the same build rules on its own gold. Every seat owns every builder, so the');
  push('  numbers isolate what the zones and the split wallets do. Idle hero on the base, normal difficulty, 24 cells, no selling.');
  push('- Layout `coverage` is the old list: the 24 cells that cover the most lane waypoints. Layout `zones` takes the 6 best cells of the north-west');
  push('  zone and turns them by 90 degrees into the other three zones (the map is rotation-symmetric), interleaved by rank, so 1, 2 and 4 seats use');
  push('  exactly the same cells and only the wallets and the zone rule differ.');
  push('- A build is a strict-priority rule list, so one seat can wait for an expensive upgrade while another buys: differences between seat counts');
  push('  partly measure the rule lists, not the game. They are a guard against a handicap for co-operation, not a balance target.', '');
  push('## Findings', '');
  push(`1. **Route load.** Over 40 waves the four routes receive ${fixed.join(' / ')} enemies when every wave starts on route 0 and ${turning.join(' / ')} when the`);
  push('   first route turns with the wave number (the game does the latter). Without the rotation the remainder of every wave, and every small wave,');
  push('   landed on the first routes, so some seats met more enemies and earned more kills and lumber than others.');
  push(`2. **Layout.** One seat with the \`coverage\` list ends at ${m.names.map((n) => `${n} ${label(m.coverage[n])}`).join(', ')}; with the interleaved \`zones\` cells it ends at`);
  push(`   ${m.names.map((n) => `${n} ${label(m.bySeats[n][1])}`).join(', ')}. The old figures understate what spread-out towers do.`);
  push(`3. **Seat count.** With the same cells and the same total gold the defeat wave moves by at most ${worstDrop > 0 ? `${worstDrop} waves down` : 'nothing down'} when 2 or 4 seats play instead of one (limit ${SEAT_DROP_LIMIT}); see table 1.`);
  push(`4. **Fairness inside a four-seat run.** In the best build (${m.best}) the richest seat has ${killSpread.toFixed(2)}x the kills and ${lumberSpread.toFixed(2)}x the lumber of the poorest (kill limit ${SEAT_SPREAD_LIMIT}; lumber is shown, not barred); see table 2.`);
  push(`5. **Late-game bar.** The best catalogued build (${m.best}, one seat) ${bestRun.result === 'victory' ? 'wins' : `is defeated in wave ${bestRun.reachedWave}`}; after wave ${bar.upToWave} it has ${barLives} lives left (bar: at least ${bar.minLives}).`);
  push(`6. **Unspent gold.** The build rules stop at 24 towers of the second tier, so the best build ends with ${m.bySeats[m.best][4].goldEnd} gold in the purse: a defeat in wave 40 is not a ceiling, and builds with more cells are not measured.`);
  push(`7. **Hard (1 life).** ${m.names.map((n) => `${n} ${label(m.hard[n])}`).join(', ')}: one leak ends the run, so the catalogued builds describe a floor, not what a careful player does.`);
  const team = m.teams;
  push(`8. **Licensed teams.** The default four-seat team (${TEAMS.default.join(', ')}; 6 cells each, gifts from a finished seat) ends at ${label(team.default)}; four Wardens end at ${label(team.mono_arrow)},`);
  push(`   four Pyromancers at ${label(team.mono_magic)}. The mixed team is ${m.monoBest - team.default.reachedWave} waves behind the best mono team (limit ${TEAM_GAP_LIMIT}): ${m.monoBest - team.default.reachedWave <= TEAM_GAP_LIMIT ? 'within the limit' : 'over the limit'}.`);
  push('   The mixed team ends where the first wave of wyverns it cannot kill arrives: cannons cannot hit air, so the earth seat adds nothing there.', '');
  const ult = m.ultimates;
  const gains = ult.map((c) => c.withUlt.reachedWave - c.plain.reachedWave);
  push(`9. **Ultimates.** Buying them with the lumber that was lying unused (mastery 3 lumber per builder, 3 lumber and 360-450 gold per tower) moves the defeat wave by ${Math.min(...gains)} to ${Math.max(...gains)}`);
  const wardens = ult.find((c) => c.name === 'team mono_arrow').withUlt;
  const wallWave = game.WAVES[wardens.reachedWave - 1];
  push(`   waves over ${ult.length} cases (table 4) ${Math.min(...gains) >= 0 ? 'and never backwards' : 'and sometimes backwards'}. Four Wardens with ${wardens.ultimatesEnd} ultimates still end in wave ${wardens.reachedWave}${wallWave && wallWave.isBoss ? `, a boss wave (fortified armor: piercing deals x${game.DAMAGE_MATRIX.piercing.fortified})` : ''},`);
  push('   so the wall of a team is its weakest answer to air and to fortified bosses, not its number of ultimates.');
  const spread = Object.entries(m.expert).map(([name, e]) => {
    const waves = e.seeded.map((r) => r.reachedWave).sort((a, b) => a - b);
    return `${name} ${waves[0]}-${waves[waves.length - 1]} (fixed order ${label(e.fixed)})`;
  });
  push(`10. **Expert (1 life, shuffled waves).** Over ${EXPERT_SEEDS.length} seeds the catalogued builds end at ${spread.join(', ')}: the first leak ends the run and the rule lists do not react to a leak,`);
  push('   so this is a floor and no bar; it shows that the order of the first five waves alone moves a run by up to ' + Math.max(...Object.values(m.expert).map((e) => { const w = e.seeded.map((r) => r.reachedWave); return Math.max(...w) - Math.min(...w); })) + ' waves.', '');
  push('## Table 1: defeat wave by layout and seat count (normal)', '');
  push(table(['build', '1 seat, coverage cells', '1 seat', '2 seats', '4 seats', 'gold unspent at the end (4 seats)'],
    m.names.map((n) => [n, label(m.coverage[n]), ...SEAT_COUNTS.map((c) => label(m.bySeats[n][c])), m.bySeats[n][4].goldEnd])), '');
  push('## Table 2: four seats, per seat (kills / lumber at the end)', '');
  push(table(['build', 'kills I / II / III / IV', 'lumber I / II / III / IV', 'kill spread', 'lumber spread'],
    m.names.map((n) => {
      const r = m.bySeats[n][4];
      return [n, r.perSeat.map((s) => s.kills).join(' / '), r.perSeat.map((s) => s.lumberEnd).join(' / '),
        ratio(r.perSeat.map((s) => s.kills)).toFixed(2), ratio(r.perSeat.map((s) => s.lumberEnd)).toFixed(2)];
    })), '');
  push('## Table 3: licensed four-seat teams (zones, normal, gifts on)', '');
  push(table(['team (seats I-IV)', 'result', 'kills I / II / III / IV', 'gold unspent'],
    Object.entries(TEAMS).map(([name, members]) => [`${name}: ${members.join(' ')}`, label(team[name]), team[name].perSeat.map((s) => s.kills).join(' / '), team[name].goldEnd])), '');
  push('## Table 4: ultimates (zones, normal)', '');
  push(table(['case', 'tier 2 only', 'with ultimates', 'ultimates bought', 'lumber left'],
    ult.map((c) => [c.name, label(c.plain), label(c.withUlt), c.withUlt.ultimatesEnd, c.withUlt.lumberEnd])), '');
  push('## Table 5: expert, one seat, ultimates on (insane difficulty, defeat wave per seed)', '');
  push(table(['build', 'fixed order', ...EXPERT_SEEDS.map((s) => `seed ${s}`)],
    EXPERT_BUILDS.map((name) => [name, label(m.expert[name].fixed), ...m.expert[name].seeded.map((r) => label(r))])), '');
  push('## Table 6: lives left after late waves (zones, one seat, normal)', '');
  const checkpoints = [20, 25, 30, 35, 40];
  push(table(['build', ...checkpoints.map((w) => `after ${w}`)],
    m.names.map((n) => [n, ...checkpoints.map((w) => livesLeftAfter(m.bySeats[n][1], w))])), '');
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildReport();
  if (process.argv.includes('--write')) {
    const existing = (() => { try { return readFileSync(REPORT_PATH, 'utf8'); } catch { return ''; } })();
    writeFileSync(REPORT_PATH, existing.includes('\r\n') ? report.replace(/\n/g, '\r\n') : report);
    process.stdout.write(`wrote ${REPORT_PATH} (${report.length} chars)\n`);
  } else {
    process.stdout.write(report);
  }
}
