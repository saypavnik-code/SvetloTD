// Generates docs/BALANCE_PROPOSALS.md: opening and economy proposals measured with the headless simulation.
//   npm run report:balance            print the document
//   npm run report:balance -- --write rewrite docs/BALANCE_PROPOSALS.md
// Run from the repository root. tests/balance.test.mjs fails when the committed document is stale.
// Nothing here changes game data: a candidate is a temporary scenario (see `withScenario`).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { BUILDS, game, simulate, waveTable, withScenario } from '../tests/support/simulate.mjs';

const DOC_PATH = 'docs/BALANCE_PROPOSALS.md';
const { TOWER_DEFS, DAMAGE_MATRIX, DIFFICULTY_PRESETS, WAVES } = game;
const BUILD_NAMES = Object.keys(BUILDS);
const MIN_LIVES = 3;          // acceptance: lives left when wave 11 starts
const WINDOW_SECONDS = 10;    // assumed time enemies stay inside tower range, from the wave-1 run

const round2 = (x) => Math.round(x * 100) / 100;
const table = (header, rows) => [
  `| ${header.join(' | ')} |`,
  `| ${header.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.join(' | ')} |`),
].join('\n');

// Early waves are softer and taper linearly back to the current values at wave `until`. Single-enemy
// (boss) waves keep their count of 1.
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
const bountyTimes = (factor) => (id, def) => ({ bounty: Math.round(def.bounty * factor) });

export const CANDIDATES = [
  {
    id: 'A', name: 'Wave side: softer early waves', startGold: 150, bounty: 1, ramp: { hp: 0.3, count: 0.7, until: 30 },
    note: 'Economy untouched; waves 1-29 start much easier and return to current values at wave 30.',
  },
  {
    id: 'B', name: 'Economy side: richer start and bounties', startGold: 900, bounty: 2, ramp: null,
    note: 'Waves untouched; the player starts with six times the gold and kills pay double.',
  },
  {
    id: 'C', name: 'Balanced', startGold: 300, bounty: 1.5, ramp: { hp: 0.4, count: 0.8, until: 30 },
    note: 'Both sides move less: double the starting gold, 1.5x bounties, waves start at 40% HP and 80% count.',
  },
].map((candidate) => ({
  ...candidate,
  scenario: {
    startGold: candidate.startGold,
    ...(candidate.ramp ? { waveTweak: taper(candidate.ramp) } : {}),
    ...(candidate.bounty !== 1 ? { enemyTweak: bountyTimes(candidate.bounty) } : {}),
  },
}));

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
  };
}

// Every catalogued build, with an idle hero and with the scripted skills.
export function evaluate(scenario, maxWave = 40) {
  const result = { idle: [], skills: [] };
  for (const skills of [false, true]) {
    for (const build of BUILD_NAMES) {
      result[skills ? 'skills' : 'idle'].push(outcome(simulate({ build, skills, scenario, maxWave })));
    }
  }
  return result;
}

const better = (a, b) => (!b || a.lives10 > b.lives10 || (a.lives10 === b.lives10 && a.cleared > b.cleared) ? a : b);
export const bestOf = (outcomes) => outcomes.reduce((best, o) => better(o, best), null);
export const passes = (outcomes) => bestOf(outcomes).lives10 >= MIN_LIVES;
const fate = (o) => (o.result === 'victory' ? 'victory' : `defeated in wave ${o.reachedWave}`);

function pressureIndex(scenario) {
  const startGold = scenario?.startGold ?? DIFFICULTY_PRESETS.normal.startingGold;
  const arrow = TOWER_DEFS.arrow_t1;
  const dpsPerGold = (arrow.damage * DAMAGE_MATRIX[arrow.damageType].medium * arrow.attackSpeed) / arrow.cost;
  const hero = new game.Hero();
  const heroDps = hero.ATTACK_DAMAGE / hero.ATTACK_INTERVAL;
  return withScenario(scenario, () => {
    let gold = startGold;
    return waveTable('normal').map((w) => {
      const affordable = gold * dpsPerGold + heroDps;
      gold += w.income;
      return affordable / (w.totalHp / WINDOW_SECONDS);
    });
  });
}

function bonusTotals(multipliers) {
  return Object.fromEntries(Object.entries(multipliers).map(([id, m]) => [id, WAVES.reduce((sum, w) => sum + Math.round(w.bonusGold * m), 0)]));
}

export function buildProposals() {
  const baseline = evaluate(null);
  const candidates = CANDIDATES.map((c) => ({ ...c, result: evaluate(c.scenario) }));
  const arrow = TOWER_DEFS.arrow_t1;
  const dpsPerGold = (arrow.damage * DAMAGE_MATRIX[arrow.damageType].medium * arrow.attackSpeed) / arrow.cost;
  const indexBase = pressureIndex(null);
  const indexCand = CANDIDATES.map((c) => pressureIndex(c.scenario));

  const lines = [];
  lines.push('# Opening and economy proposals (generated)');
  lines.push('');
  lines.push('Generated by `npm run report:balance -- --write` from the headless simulation. Do not edit by hand:');
  lines.push('`tests/balance.test.mjs` fails when this file is stale. **Nothing here changes game data.** A candidate is a temporary');
  lines.push('scenario; the owner picks one (or asks for another) and a later patch writes the numbers into the data files.');
  lines.push('Browser smoke: not run.');
  lines.push('');
  lines.push('## Method, metric and limits');
  lines.push('');
  lines.push('- Same simulation as `docs/ECONOMY_REPORT.md` (real code, 30 Hz, deterministic), difficulty normal, the four catalogued');
  lines.push('  tower builds. Two hero modes: `idle` (parked on the base, auto-attack only) and `skills` (also casts Q when two or more');
  lines.push('  enemies are inside its blast radius, W when a tower is inside its radius). Hero movement and the watchtower are not simulated.');
  lines.push(`- **Acceptance:** the best build still has at least ${MIN_LIVES} lives when wave 11 starts, i.e. it held waves 1-10. It is a bar for`);
  lines.push('  the opening only; it says nothing about waves 11-40.');
  lines.push('- `cleared` counts waves that ended (leaks allowed). `lives@11` is the lives left when wave 11 starts (0 if defeated earlier).');
  lines.push('- Results depend on the four build rule lists in `tests/support/simulate.mjs`; a smarter player does better by an unmeasured amount.');
  lines.push('');
  lines.push('## Current data');
  lines.push('');
  lines.push(table(
    ['build', 'hero', 'outcome', 'cleared', 'lives@11', 'Q casts', 'W casts'],
    BUILD_NAMES.flatMap((name, i) => ['idle', 'skills'].map((mode) => {
      const o = baseline[mode][i];
      return [name, mode, fate(o), o.cleared, o.lives10, o.casts.q, o.casts.w];
    })),
  ));
  lines.push('');
  lines.push('## Pressure index (analytic aid, waves 1-20)');
  lines.push('');
  lines.push(`Affordable damage per second divided by the damage per second needed to kill the wave in ${WINDOW_SECONDS} s. Affordable = every gold`);
  lines.push(`earned so far (starting gold plus bounty and bonus of all earlier waves, nothing wasted) spent on tier-1 arrow towers at`);
  lines.push(`${dpsPerGold.toFixed(2)} dps per gold against medium armor, plus the idle hero. The ${WINDOW_SECONDS} s window is read from the wave-1 run. A value`);
  lines.push('below 1 means the wave cannot be killed by what the economy could have bought. It ignores armor, range and focus, so it is');
  lines.push('an aid for reading the simulation, not a result.');
  lines.push('');
  lines.push(table(
    ['wave', 'enemy', 'current', ...CANDIDATES.map((c) => `candidate ${c.id}`)],
    waveTable('normal').slice(0, 20).map((w, i) => [
      w.wave, `${w.enemyType} x${w.count}`, indexBase[i].toFixed(2), ...indexCand.map((index) => index[i].toFixed(2)),
    ]),
  ));
  lines.push('');
  lines.push('## Candidates');
  lines.push('');
  lines.push(table(
    ['candidate', 'starting gold', 'waves 1-29 HP and count', 'bounty', 'note'],
    candidates.map((c) => [
      `${c.id}: ${c.name}`, c.startGold,
      c.ramp ? `from ${Math.round(c.ramp.hp * 100)}% HP and ${Math.round(c.ramp.count * 100)}% count, linear to 100% at wave ${c.ramp.until}` : 'unchanged',
      c.bounty === 1 ? 'unchanged' : `x${c.bounty}`, c.note,
    ]),
  ));
  lines.push('');
  lines.push(table(
    ['candidate', 'hero', 'best build', 'acceptance', 'lives@11', 'best build over 40 waves'],
    candidates.flatMap((c) => ['idle', 'skills'].map((mode) => {
      const best = bestOf(c.result[mode]);
      return [c.id, mode, best.build, passes(c.result[mode]) ? 'PASS' : 'FAIL', best.lives10, `${fate(best)}, ${best.cleared} cleared`];
    })),
  ));
  lines.push('');
  for (const c of candidates) {
    lines.push(`### Candidate ${c.id}: all builds`);
    lines.push('');
    lines.push(table(
      ['build', 'idle: outcome', 'idle lives@11', 'skills: outcome', 'skills lives@11'],
      BUILD_NAMES.map((name, i) => [name, fate(c.result.idle[i]), c.result.idle[i].lives10, fate(c.result.skills[i]), c.result.skills[i].lives10]),
    ));
    lines.push('');
  }
  lines.push('## Sweep: how much each lever matters (best build, skills, waves 1-11 only)');
  lines.push('');
  lines.push('Bounty x1.5 in every row. HP and count scale from the given fraction at wave 1 to 100% at wave 30.');
  lines.push('');
  const sweep = [];
  for (const startGold of [150, 250, 400]) {
    for (const hp of [1, 0.6, 0.4]) {
      for (const count of [1, 0.7]) {
        const scenario = {
          startGold,
          ...(hp === 1 && count === 1 ? {} : { waveTweak: taper({ hp, count, until: 30 }) }),
          enemyTweak: bountyTimes(1.5),
        };
        const best = bestOf(BUILD_NAMES.map((build) => outcome(simulate({ build, skills: true, scenario, maxWave: 11 }))));
        sweep.push([startGold, `${Math.round(hp * 100)}%`, `${Math.round(count * 100)}%`, best.build, best.lives10, best.lives10 >= MIN_LIVES ? 'PASS' : 'FAIL']);
      }
    }
  }
  lines.push(table(['starting gold', 'HP at wave 1', 'count at wave 1', 'best build', 'lives@11', 'acceptance'], sweep));
  lines.push('');
  lines.push('## Decisions the owner has to make');
  lines.push('');
  lines.push('1. **Opening.** Pick candidate A, B or C, or name other numbers. A and C change `src/data/waves.ts`; B and C change');
  lines.push('   `startingGold` in `src/config/difficulty.ts` and `bounty` in `src/data/enemies.ts`. Whatever is picked, waves 11+ stay');
  lines.push('   unsolved (see "best build over 40 waves"): they need their own measurement and a later sprint.');
  const totals = bonusTotals({ normal: 1, hard: 0.8, insane: 0.6 });
  const current = (difficulty) => waveTable(difficulty).reduce((sum, w) => sum + w.bonus, 0);
  const change = (difficulty) => totals.normal - current(difficulty);
  lines.push('2. **Difficulty bonus.** `max(formula, bonusGold)` makes `waveBonusBase/Scale` dead. Options: (a) delete the two fields: the bonus becomes');
  lines.push(`   \`bonusGold\` on every difficulty (${totals.normal} gold over 40 waves; change against today: ${change('normal')} / ${change('hard')} / ${change('insane')} gold on normal / hard / insane); (b) replace the`);
  lines.push(`   rule with \`round(bonusGold x multiplier)\` using 1.0 / 0.8 / 0.6 for normal / hard / insane (${totals.normal} / ${totals.hard} / ${totals.insane} gold).`);
  lines.push('3. **Lumber.** It is earned and never spent. Options: (a) remove it from the HUD and the systems; (b) add the sink that the');
  lines.push('   `LumberManager` header comment describes (mercenaries and tier-3 towers), which needs new content and is a larger sprint.');
  lines.push('4. **Calibration.** The skill rule is fixed and the hero never moves. One human play of waves 1-3 with skills (lives lost per wave)');
  lines.push('   tells how pessimistic `idle` and `skills` are before any number is written into the data.');
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
