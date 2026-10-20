// Generates docs/BALANCE_PROPOSALS.md: the status of balance decisions, open proposals and what-ifs, measured with the
// headless simulation.
//   npm run report:balance            print the document
//   npm run report:balance -- --write rewrite docs/BALANCE_PROPOSALS.md
// Run from the repository root. tests/balance.test.mjs fails when the committed document is stale.
// Nothing here changes game data: a proposal is a temporary scenario (see `withScenario` in the harness).
// To put a new proposal on the table, add it to CANDIDATES; the owner's pick is then written into the data files by a
// later patch and the candidate is removed again.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { BUILDS, game, simulate, waveTable, withScenario } from '../tests/support/simulate.mjs';

const DOC_PATH = 'docs/BALANCE_PROPOSALS.md';
const { BASE_WAVES, TOWER_DEFS, DAMAGE_MATRIX, DIFFICULTY_PRESETS, ENEMY_DEFS, WAVE_TAPER, WAVE_BONUS_FACTOR, taperWave } = game;
const BUILD_NAMES = Object.keys(BUILDS);
const MIN_LIVES = 3;          // acceptance: lives left when the wave after the bar starts
const OPENING_BAR = 11;       // "held waves 1-10": lives when wave 11 starts
const MID_BAR = 21;           // "held waves 1-20": lives when wave 21 starts
const WINDOW_SECONDS = 10;    // assumed time enemies stay inside tower range, from the wave-1 run

const table = (header, rows) => [
  `| ${header.join(' | ')} |`,
  `| ${header.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.join(' | ')} |`),
].join('\n');

// Scenario building blocks. `retaper` re-derives the HP and count of every wave from BASE_WAVES (the waves as written)
// with the same rule that `taperWave` applies to the data, so retaper(WAVE_TAPER) is the identity on current data.
export const retaper = (taper) => (wave) => {
  const tapered = taperWave(BASE_WAVES[wave.wave - 1], taper);
  return { hpMult: tapered.hpMult, count: tapered.count };
};
export const bonusTimes = (factor) => (wave) => ({ bonusGold: Math.round(BASE_WAVES[wave.wave - 1].bonusGold * factor) });
export const upgradeCostTimes = (factor) => (id, def) => (/_t[23]$/.test(id) ? { cost: Math.round(def.cost * factor) } : {});
const both = (...tweaks) => (wave) => Object.assign({}, ...tweaks.map((tweak) => tweak(wave)));
const pct = (x) => `${Math.round(x * 100)}%`;

// Mid-game alternatives that were not taken (D is applied in the data), each { id, name, note, changes, scenario }. `changes` is what the table shows.
export const CANDIDATES = [
  {
    id: 'E', name: 'Moderate curve, 1.5x bonus, cheaper upgrades',
    note: 'The curve is only half as soft as in D; the economy answers with a 1.5x bonus and tier-2/3 upgrades that cost 30% less.',
    taper: { hp: 0.4, count: 0.8, until: 40, end: 0.5 }, bonus: 1.5, upgrades: 0.7,
  },
  {
    id: 'F', name: 'Waves only',
    note: 'Softer than the applied D at the end (20% instead of 30%) but with the wave bonus unchanged. Shows how far the curve alone can go.',
    taper: { hp: 0.4, count: 0.8, until: 40, end: 0.2 }, bonus: 1, upgrades: 1,
  },
].map((c) => ({
  ...c,
  changes: [
    `HP and count from ${pct(c.taper.hp)} / ${pct(c.taper.count)} at wave 1, linear to ${pct(c.taper.end)} at wave ${c.taper.until}`,
    c.bonus === 1 ? 'wave bonus unchanged' : `wave bonus x${c.bonus}`,
    c.upgrades === 1 ? 'upgrade costs unchanged' : `tier-2/3 upgrade costs x${c.upgrades}`,
  ],
  scenario: {
    waveTweak: both(retaper(c.taper), ...(c.bonus === 1 ? [] : [bonusTimes(c.bonus)])),
    ...(c.upgrades === 1 ? {} : { towerTweak: upgradeCostTimes(c.upgrades) }),
  },
}));

// Questions for the owner that are about design, not tuning: what would the numbers do?
export const WHAT_IFS = [
  { id: 'W0', name: 'Current data', scenario: null },
  { id: 'W1', name: 'Tier-2/3 upgrades cost 30% less', scenario: { towerTweak: upgradeCostTimes(0.7) } },
  {
    id: 'W2', name: 'Arrow towers deal `normal` damage (x1.5 against medium armor)',
    scenario: { towerTweak: (id) => (id.startsWith('arrow_') ? { damageType: 'normal' } : {}) },
  },
];

function outcome(run) {
  const livesAt = (wave) => {
    const row = run.rows.find((r) => r.wave === wave);
    return row ? row.livesAtStart : 0;
  };
  return {
    build: run.build,
    cleared: run.rows.filter((row) => row.cleared).length,
    result: run.result,
    reachedWave: run.reachedWave,
    lives11: livesAt(OPENING_BAR),
    lives21: livesAt(MID_BAR),
    livesEnd: run.livesLeft,
    casts: run.casts,
    rows: run.rows,
  };
}

// Every catalogued build, with an idle hero and with the scripted skills.
export function evaluate(scenario, maxWave = 40, difficulty = 'normal') {
  const result = { idle: [], skills: [] };
  for (const skills of [false, true]) {
    for (const build of BUILD_NAMES) {
      result[skills ? 'skills' : 'idle'].push(outcome(simulate({ build, skills, scenario, maxWave, difficulty })));
    }
  }
  return result;
}

const key = (bar) => (bar === MID_BAR ? 'lives21' : 'lives11');
const better = (bar) => (a, b) => (!b || a[key(bar)] > b[key(bar)] || (a[key(bar)] === b[key(bar)] && a.cleared > b.cleared) ? a : b);
export const bestOf = (outcomes, bar = OPENING_BAR) => outcomes.reduce((best, o) => better(bar)(o, best), null);
export const passes = (outcomes, bar = OPENING_BAR, minLives = MIN_LIVES) => bestOf(outcomes, bar)[key(bar)] >= minLives;
const fate = (o) => (o.result === 'victory' ? 'victory' : o.result === 'unfinished' ? `alive in wave ${o.reachedWave}` : `defeated in wave ${o.reachedWave}`);
const verdict = (outcomes, bar, minLives = MIN_LIVES) => (passes(outcomes, bar, minLives) ? 'PASS' : 'FAIL');

const dpsPerGold = (def, armor, cost) => (def.damage * (DAMAGE_MATRIX[def.damageType]?.[armor] ?? 1) * def.attackSpeed) / cost;
function cumulativeCost(id) {
  const parent = Object.entries(TOWER_DEFS).find(([, def]) => (def.upgradeTo ?? []).includes(id));
  return TOWER_DEFS[id].cost + (parent ? cumulativeCost(parent[0]) : 0);
}

function pressureIndex(scenario) {
  const arrow = TOWER_DEFS.arrow_t1;
  const perGold = dpsPerGold(arrow, 'medium', arrow.cost);
  const hero = new game.Hero();
  const heroDps = hero.ATTACK_DAMAGE / hero.ATTACK_INTERVAL;
  return withScenario(scenario, () => {
    let gold = scenario?.startGold ?? DIFFICULTY_PRESETS.normal.startingGold;
    return waveTable('normal').map((w) => {
      const affordable = gold * perGold + heroDps;
      gold += w.income;
      return affordable / (w.totalHp / WINDOW_SECONDS);
    });
  });
}

export function buildProposals() {
  const normal = evaluate(null);
  const other = ['hard', 'insane'].map((difficulty) => ({ difficulty, result: evaluate(null, OPENING_BAR, difficulty) }));
  const candidates = CANDIDATES.map((c) => ({ ...c, result: evaluate(c.scenario) }));
  const whatIfs = WHAT_IFS.map((w) => ({ ...w, result: evaluate(w.scenario, MID_BAR) }));
  const arrow = TOWER_DEFS.arrow_t1;
  const perGold = dpsPerGold(arrow, 'medium', arrow.cost);
  const index = [pressureIndex(null), ...CANDIDATES.map((c) => pressureIndex(c.scenario))];
  const presets = Object.values(DIFFICULTY_PRESETS);
  const bounties = Object.values(ENEMY_DEFS).map((d) => `${d.id} ${d.bounty}`).join(', ');
  const best = bestOf(normal.skills, MID_BAR);

  const lines = [];
  lines.push('# Balance decisions and proposals (generated)');
  lines.push('');
  lines.push('Generated by `npm run report:balance -- --write` from the headless simulation. Do not edit by hand:');
  lines.push('`tests/balance.test.mjs` fails when this file is stale. A proposal is a temporary scenario that changes no game data; the');
  lines.push('owner picks one and a later patch writes the numbers into the data files. Browser smoke: not run.');
  lines.push('');
  lines.push('## Decisions applied');
  lines.push('');
  lines.push(`- **Opening, candidate C** (owner, 2026-10-11, patch v0.8.0). Starting gold ${presets.map((p) => `${p.startingGold} (${p.id})`).join(', ')}, which is twice the old values. Bounties x1.5, rounded:`);
  lines.push(`  ${bounties}.`);
  lines.push(`- **Mid game, proposal D** (assistant under the owner's delegation of 2026-10-14, patch v0.13.0). HP and count start at ${pct(WAVE_TAPER.hp)} and ${pct(WAVE_TAPER.count)} at wave 1`);
  lines.push(`  and move linearly to ${pct(WAVE_TAPER.end)} at wave ${WAVE_TAPER.until} (\`WAVE_TAPER\` in \`src/data/waves.ts\`); single-enemy waves keep their count of 1. The wave bonus pays`);
  lines.push(`  x${WAVE_BONUS_FACTOR} the written \`bonusGold\` (\`WAVE_BONUS_FACTOR\`). Towers and upgrade costs are untouched. Why D: it leaves the best build the most lives at wave 21`);
  lines.push('  in both hero modes (see "Current data" and the alternatives below).');
  lines.push(`- **Difficulty bonus.** \`round(bonusGold x waveBonusMult)\` with ${presets.map((p) => `${p.waveBonusMult.toFixed(1)} (${p.id})`).join(', ')}. The old dead \`waveBonusBase/Scale\` fields are gone.`);
  lines.push('- **Lumber.** Spent since v0.20.0 on builder licenses, mastery and the ultimate towers (BuilderManager); no catalogued build buys them, so these runs leave it unspent.');
  lines.push('');
  lines.push('## Method, metric and limits');
  lines.push('');
  lines.push('- Same simulation as `docs/ECONOMY_REPORT.md` (real code, 30 Hz, deterministic), difficulty normal unless stated, the four catalogued');
  lines.push('  tower builds. Two hero modes: `idle` (parked on the base, auto-attack only) and `skills` (also casts Q when two or more');
  lines.push('  enemies are inside its blast radius, W when a tower is inside its radius). Hero movement and the watchtower are not simulated.');
  lines.push(`- **Acceptance bars:** the best build still has at least ${MIN_LIVES} lives when wave ${OPENING_BAR} starts (it held waves 1-10, the opening bar) or`);
  lines.push(`  when wave ${MID_BAR} starts (waves 1-20, the mid-game bar).`);
  lines.push('- `cleared` counts waves that ended (leaks allowed). `lives@11` and `lives@21` are the lives left when that wave starts (0 if defeated earlier).');
  lines.push('- Results depend on the four build rule lists in `tests/support/simulate.mjs`. None of them kills the fortified wave bosses reliably');
  lines.push('  (a cannon-heavy probe did not either), so a human who plans for the bosses does better by an unmeasured amount.');
  lines.push('');
  lines.push('## Current data (normal)');
  lines.push('');
  lines.push(`Opening bar: idle hero **${verdict(normal.idle, OPENING_BAR)}**, scripted skills **${verdict(normal.skills, OPENING_BAR)}**. Mid-game bar: idle hero **${verdict(normal.idle, MID_BAR)}**, scripted skills **${verdict(normal.skills, MID_BAR)}**.`);
  lines.push('');
  lines.push(table(
    ['build', 'hero', 'outcome', 'cleared', 'lives@11', 'lives@21', 'Q casts', 'W casts'],
    BUILD_NAMES.flatMap((name, i) => ['idle', 'skills'].map((mode) => {
      const o = normal[mode][i];
      return [name, mode, fate(o), o.cleared, o.lives11, o.lives21, o.casts.q, o.casts.w];
    })),
  ));
  lines.push('');
  lines.push('### Other difficulties (informational, waves 1-11 only)');
  lines.push('');
  lines.push('Hard and insane (the expert mode) have one life and the enemy stats of normal (v0.21.0): the bar there is "still alive when wave 11 starts" (at least');
  lines.push('min(3, lives) lives). The catalogued builds are fixed scripts that never react to a leak, so a one-life run is a harsh test of them and says little about a human');
  lines.push('player; the harness also runs insane with the written wave order, not with a shuffled one.');
  lines.push('');
  lines.push(table(
    ['difficulty', 'lives', 'hero', 'best build', 'lives@11', 'opening bar'],
    other.flatMap(({ difficulty, result }) => ['idle', 'skills'].map((mode) => {
      const top = bestOf(result[mode]);
      const lives = DIFFICULTY_PRESETS[difficulty].startingLives;
      return [difficulty, lives, mode, top.build, top.lives11, verdict(result[mode], OPENING_BAR, Math.min(MIN_LIVES, lives))];
    })),
  ));
  lines.push('');
  lines.push('### Where the best build loses (normal, scripted skills)');
  lines.push('');
  lines.push(`Best build: \`${best.build}\`, ${fate(best)}, ${best.cleared} waves cleared. Waves in which it leaked:`);
  lines.push('');
  const leaking = best.rows.filter((row) => row.leaks > 0);
  lines.push(leaking.length === 0 ? 'None.' : table(
    ['wave', 'enemy', 'leaks of count', 'lives lost', 'towers', 'invested'],
    leaking.map((row) => [row.wave, row.enemyType, `${row.leaks} of ${row.count}`, row.livesLost, row.towers, row.invested]),
  ));
  lines.push('');
  lines.push('## Mid-game alternatives that were not taken (E and F)');
  lines.push('');
  lines.push('Scenarios against the waves as written; the applied data is proposal D (see "Decisions applied").');
  lines.push('');
  lines.push(table(
    ['proposal', 'what changes', 'idle hero', 'scripted skills'],
    candidates.map((c) => {
      const cell = (mode) => {
        const top = bestOf(c.result[mode], MID_BAR);
        return `${verdict(c.result[mode], MID_BAR)}: ${top.build}, ${top.lives21} lives at wave 21, ${fate(top)}`;
      };
      return [`${c.id}: ${c.name}`, c.changes.join('; '), cell('idle'), cell('skills')];
    }),
  ));
  lines.push('');
  for (const c of candidates) {
    lines.push(`### Proposal ${c.id}: all builds`);
    lines.push('');
    lines.push(c.note);
    lines.push('');
    lines.push(table(
      ['build', 'hero', 'outcome', 'cleared', 'lives@11', 'lives@21'],
      BUILD_NAMES.flatMap((name, i) => ['idle', 'skills'].map((mode) => {
        const o = c.result[mode][i];
        return [name, mode, fate(o), o.cleared, o.lives11, o.lives21];
      })),
    ));
    lines.push('');
  }
  lines.push('## What-ifs for the design questions (not proposals, waves 1-20)');
  lines.push('');
  lines.push('Each row changes one thing against the current data and reports the best build.');
  lines.push('');
  lines.push(table(
    ['what-if', 'idle hero', 'scripted skills'],
    whatIfs.map((w) => {
      const cell = (mode) => {
        const top = bestOf(w.result[mode], MID_BAR);
        return `${verdict(w.result[mode], MID_BAR)}: ${top.build}, ${top.lives21} lives at wave 21, ${fate(top)}`;
      };
      return [`${w.id}: ${w.name}`, cell('idle'), cell('skills')];
    }),
  ));
  lines.push('');
  lines.push('## Tower efficiency (analytic, from the data)');
  lines.push('');
  lines.push('Damage per second per gold of cumulative cost against each armor, from the damage matrix. Splash, slow, poison, range and');
  lines.push('targeting are ignored, so it is an aid for reading the simulation, not a result.');
  lines.push('');
  const attackers = Object.entries(TOWER_DEFS).filter(([, def]) => def.damage > 0);
  lines.push(table(
    ['tower', 'cumulative cost', 'damage type', 'light', 'medium', 'heavy', 'fortified'],
    attackers.map(([id, def]) => {
      const cost = cumulativeCost(id);
      return [id, cost, def.damageType, ...['light', 'medium', 'heavy', 'fortified'].map((a) => dpsPerGold(def, a, cost).toFixed(3))];
    }),
  ));
  lines.push('');
  const types = new Set(attackers.map(([, def]) => def.damageType));
  const unused = Object.keys(DAMAGE_MATRIX).filter((type) => !types.has(type));
  lines.push(`Damage types in the matrix that no attacking tower uses: ${unused.length ? unused.map((t) => `\`${t}\` (x${DAMAGE_MATRIX[t].medium} against medium armor)`).join(', ') : 'none'}.`);
  lines.push(`Best tower against medium armor, the armor of the most common enemy: ${(() => {
    const top = attackers.map(([id, def]) => [id, dpsPerGold(def, 'medium', cumulativeCost(id))]).sort((a, b) => b[1] - a[1])[0];
    return `\`${top[0]}\` at ${top[1].toFixed(3)} dps per gold`;
  })()}.`);
  lines.push('');
  lines.push('## Pressure index (analytic aid, waves 1-20, current data and the alternatives)');
  lines.push('');
  lines.push(`Affordable damage per second divided by the damage per second needed to kill the wave in ${WINDOW_SECONDS} s. Affordable = every gold`);
  lines.push(`earned so far (starting gold plus bounty and bonus of all earlier waves, nothing wasted) spent on tier-1 arrow towers at`);
  lines.push(`${perGold.toFixed(2)} dps per gold against medium armor, plus the idle hero. The ${WINDOW_SECONDS} s window is read from the wave-1 run. A value`);
  lines.push('below 1 means the wave cannot be killed by what the economy could have bought. It ignores armor, range and focus.');
  lines.push('');
  lines.push(table(
    ['wave', 'enemy', 'current', ...CANDIDATES.map((c) => `proposal ${c.id}`)],
    waveTable('normal').slice(0, 20).map((w, i) => [
      w.wave, `${w.enemyType} x${w.count}`, ...index.map((values) => values[i].toFixed(2)),
    ]),
  ));
  lines.push('');
  lines.push('## Open decisions');
  lines.push('');
  lines.push(`1. **Late game (waves 21-40).** The bars cover waves 1-20 only. With the applied curve the best build is ${fate(best)} with the scripted skills and`);
  lines.push(`   ${fate(bestOf(normal.idle, MID_BAR))} with an idle hero. A late-game bar, the boss waves and the ultimate towers are the next design decisions.`);
  lines.push('2. **Upgrades and damage types.** The what-if rows give the numbers: cheaper upgrades and a `normal`-damage tower are each a');
  lines.push('   design decision, not a tuning detail. See the efficiency table.');
  lines.push('3. **Lumber sink.** Licenses, mastery and the four ultimate towers cost lumber since v0.20.0, but no catalogued build buys them and the');
  lines.push('   ultimates are not measured: a build that spends lumber is part of the next balance step.');
  lines.push('4. **Calibration.** The skill rule is fixed, the hero never moves and no build plans for the bosses. One human play of waves 1-3');
  lines.push('   and one of the wave 10 boss tell how pessimistic `idle` and `skills` are before any proposal is applied.');
  lines.push('');
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const doc = buildProposals();
  if (process.argv.includes('--write')) {
    const existing = (() => { try { return readFileSync(DOC_PATH, 'utf8'); } catch { return ''; } })();
    writeFileSync(DOC_PATH, existing.includes('\r\n') ? doc.replace(/\n/g, '\r\n') : doc);
    process.stdout.write(`wrote ${DOC_PATH} (${doc.length} chars)\n`);
  } else {
    process.stdout.write(doc);
  }
}
