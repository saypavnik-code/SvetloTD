// Generates docs/BALANCE_PROPOSALS.md: the status of balance decisions and any open proposals, measured with the
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
const { TOWER_DEFS, DAMAGE_MATRIX, DIFFICULTY_PRESETS, ENEMY_DEFS, OPENING_TAPER } = game;
const BUILD_NAMES = Object.keys(BUILDS);
const MIN_LIVES = 3;          // acceptance: lives left when wave 11 starts
const WINDOW_SECONDS = 10;    // assumed time enemies stay inside tower range, from the wave-1 run

const round2 = (x) => Math.round(x * 100) / 100;
const table = (header, rows) => [
  `| ${header.join(' | ')} |`,
  `| ${header.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.join(' | ')} |`),
].join('\n');

// A softer opening that tapers linearly back to the current values at wave `until`. Single-enemy (boss) waves keep
// their count of 1. This is the rule `OPENING_TAPER` in src/data/waves.ts applies to the data.
export function taper({ hp, count, until }) {
  return (wave) => {
    const t = Math.min(1, (wave.wave - 1) / (until - 1));
    if (t >= 1) return { hpMult: wave.hpMult, count: wave.count };   // exactly the current values
    return {
      hpMult: round2(wave.hpMult * (hp + (1 - hp) * t)),
      count: wave.count === 1 ? 1 : Math.max(1, Math.round(wave.count * (count + (1 - count) * t))),
    };
  };
}

// Open proposals, each { id, name, note, scenario }. Empty: the owner's pick of v0.8.0 (candidate C) is in the data.
export const CANDIDATES = [];

function outcome(run) {
  const wave11 = run.rows.find((row) => row.wave === 11);
  return {
    build: run.build,
    cleared: run.rows.filter((row) => row.cleared).length,
    result: run.result,
    reachedWave: run.reachedWave,
    lives10: wave11 ? wave11.livesAtStart : 0,
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

const better = (a, b) => (!b || a.lives10 > b.lives10 || (a.lives10 === b.lives10 && a.cleared > b.cleared) ? a : b);
export const bestOf = (outcomes) => outcomes.reduce((best, o) => better(o, best), null);
export const passes = (outcomes) => bestOf(outcomes).lives10 >= MIN_LIVES;
const fate = (o) => (o.result === 'victory' ? 'victory' : `defeated in wave ${o.reachedWave}`);
const verdict = (outcomes) => (passes(outcomes) ? 'PASS' : 'FAIL');

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
  const other = ['hard', 'insane'].map((difficulty) => ({ difficulty, result: evaluate(null, 11, difficulty) }));
  const candidates = CANDIDATES.map((c) => ({ ...c, result: evaluate(c.scenario) }));
  const arrow = TOWER_DEFS.arrow_t1;
  const perGold = dpsPerGold(arrow, 'medium', arrow.cost);
  const index = [pressureIndex(null), ...CANDIDATES.map((c) => pressureIndex(c.scenario))];
  const presets = Object.values(DIFFICULTY_PRESETS);
  const bounties = Object.values(ENEMY_DEFS).map((d) => `${d.id} ${d.bounty}`).join(', ');
  const best = bestOf(normal.skills);

  const lines = [];
  lines.push('# Balance decisions and proposals (generated)');
  lines.push('');
  lines.push('Generated by `npm run report:balance -- --write` from the headless simulation. Do not edit by hand:');
  lines.push('`tests/balance.test.mjs` fails when this file is stale. A proposal is a temporary scenario that changes no game data; the');
  lines.push('owner picks one and a later patch writes the numbers into the data files. Browser smoke: not run.');
  lines.push('');
  lines.push('## Decisions applied (owner, 2026-10-11, patch v0.8.0)');
  lines.push('');
  lines.push(`- **Opening, candidate C.** Starting gold ${presets.map((p) => `${p.startingGold} (${p.id})`).join(', ')}, which is twice the old values. Bounties x1.5, rounded:`);
  lines.push(`  ${bounties}. Waves 1-${OPENING_TAPER.until - 1} start at ${Math.round(OPENING_TAPER.hp * 100)}% HP and ${Math.round(OPENING_TAPER.count * 100)}% count and return linearly to`);
  lines.push(`  100% at wave ${OPENING_TAPER.until} (\`OPENING_TAPER\` in \`src/data/waves.ts\`); single-enemy waves keep their count of 1.`);
  lines.push(`- **Difficulty bonus.** \`round(bonusGold x waveBonusMult)\` with ${presets.map((p) => `${p.waveBonusMult.toFixed(1)} (${p.id})`).join(', ')}. The old dead \`waveBonusBase/Scale\` fields are gone.`);
  lines.push('- **Lumber.** Stays earned and unspent; a sink is added later (tracked by a TODO test).');
  lines.push('');
  lines.push('## Method, metric and limits');
  lines.push('');
  lines.push('- Same simulation as `docs/ECONOMY_REPORT.md` (real code, 30 Hz, deterministic), difficulty normal unless stated, the four catalogued');
  lines.push('  tower builds. Two hero modes: `idle` (parked on the base, auto-attack only) and `skills` (also casts Q when two or more');
  lines.push('  enemies are inside its blast radius, W when a tower is inside its radius). Hero movement and the watchtower are not simulated.');
  lines.push(`- **Acceptance:** the best build still has at least ${MIN_LIVES} lives when wave 11 starts, i.e. it held waves 1-10. It is a bar for`);
  lines.push('  the opening only; it says nothing about waves 11-40.');
  lines.push('- `cleared` counts waves that ended (leaks allowed). `lives@11` is the lives left when wave 11 starts (0 if defeated earlier).');
  lines.push('- Results depend on the four build rule lists in `tests/support/simulate.mjs`; a smarter player does better by an unmeasured amount.');
  lines.push('');
  lines.push('## Current data (normal)');
  lines.push('');
  lines.push(`Acceptance: idle hero **${verdict(normal.idle)}**, scripted skills **${verdict(normal.skills)}**.`);
  lines.push('');
  lines.push(table(
    ['build', 'hero', 'outcome', 'cleared', 'lives@11', 'Q casts', 'W casts'],
    BUILD_NAMES.flatMap((name, i) => ['idle', 'skills'].map((mode) => {
      const o = normal[mode][i];
      return [name, mode, fate(o), o.cleared, o.lives10, o.casts.q, o.casts.w];
    })),
  ));
  lines.push('');
  lines.push('### Other difficulties (informational, waves 1-11 only)');
  lines.push('');
  lines.push(table(
    ['difficulty', 'hero', 'best build', 'lives@11', 'acceptance'],
    other.flatMap(({ difficulty, result }) => ['idle', 'skills'].map((mode) => {
      const top = bestOf(result[mode]);
      return [difficulty, mode, top.build, top.lives10, verdict(result[mode])];
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
  for (const c of candidates) {
    lines.push(`## Open proposal ${c.id}: ${c.name}`);
    lines.push('');
    lines.push(c.note);
    lines.push('');
    lines.push(table(
      ['hero', 'best build', 'acceptance', 'lives@11', 'best build over 40 waves'],
      ['idle', 'skills'].map((mode) => {
        const top = bestOf(c.result[mode]);
        return [mode, top.build, verdict(c.result[mode]), top.lives10, `${fate(top)}, ${top.cleared} cleared`];
      }),
    ));
    lines.push('');
  }
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
  lines.push(`## Pressure index (analytic aid, waves 1-20${CANDIDATES.length ? ', current data and open proposals' : ''})`);
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
  lines.push('1. **Mid game (waves 11-40).** The opening is addressed; the best build still loses where the table above says. Needs its own');
  lines.push('   measurement and a proposal.');
  lines.push('2. **Lumber sink.** Lumber is earned and never spent. The `LumberManager` header comment describes the intended sink (mercenaries');
  lines.push('   and tier-3 towers), which needs new content.');
  lines.push('3. **Damage types and upgrades.** See the efficiency table: the type listed as unused has no tower, and a tier-2 upgrade');
  lines.push('   gives less damage per gold than another tier-1 tower. Whether that is intended is a design decision.');
  lines.push('4. **Calibration.** The skill rule is fixed and the hero never moves. One human play of waves 1-3 with skills (lives lost per wave)');
  lines.push('   tells how pessimistic `idle` and `skills` are, and whether the new opening is now too easy for a human.');
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
