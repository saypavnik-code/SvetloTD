import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildReport } from '../scripts/economy_report.mjs';
import { BASELINES, BUILDS, game, simulate, waveTable } from './support/simulate.mjs';

const { WAVES, DIFFICULTY_PRESETS } = game;
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);

// ── Reproducibility ─────────────────────────────────────────────────────────

test('a simulated run is deterministic: the same inputs give identical results', () => {
  const run = () => simulate({ build: 'balanced', extraGold: 600 });
  assert.deepEqual(run(), run());
});

test('the oracle baseline clears all 40 waves with every enemy killed and nobody leaking', () => {
  const run = simulate({ baseline: 'oracle_bank' });
  assert.equal(run.result, 'victory');
  assert.equal(run.rows.length, 40);
  assert.equal(sum(run.rows, 'leaks'), 0);
  assert.equal(sum(run.rows, 'kills'), WAVES.reduce((total, wave) => total + wave.count, 0));
  assert.equal(run.livesLeft, 20);
});

test('oracle income does not depend on the simulation step', () => {
  const income = (stepMs) => simulate({ baseline: 'oracle_bank', stepMs }).rows
    .map((row) => [row.goldAtStart, row.bounty, row.interest, row.bonus]);
  const reference = income(1000 / 60);
  assert.deepEqual(income(1000 / 20), reference);
  assert.deepEqual(income(1000 / 144), reference);
});

// ── Ledger invariants over every build, baseline and difficulty ──────────────

test('gold, lives, kills, interest and bonus add up in every wave of every run', () => {
  const targets = [
    ...Object.keys(BUILDS).map((build) => ({ build })),
    ...Object.keys(BASELINES).map((baseline) => ({ baseline })),
  ];
  let runs = 0;
  for (const difficulty of Object.keys(DIFFICULTY_PRESETS)) {
    const cfg = DIFFICULTY_PRESETS[difficulty];
    for (const target of targets) {
      for (const extraGold of [0, 600]) {
        const run = simulate({ ...target, difficulty, extraGold });
        const tag = `${difficulty}/${target.build ?? target.baseline}/+${extraGold}`;
        runs++;
        run.rows.forEach((row, i) => {
          const previous = run.rows[i - 1];
          if (previous) {
            assert.equal(row.livesAtStart, previous.livesAtStart - previous.livesLost, `${tag}: lives before wave ${row.wave}`);
            assert.equal(row.goldAtStart, previous.goldAfterAward - row.spentBefore, `${tag}: gold before wave ${row.wave}`);
          }
          if (!row.cleared) return;
          assert.equal(row.kills + row.leaks, row.count, `${tag}: every enemy of wave ${row.wave} dies or leaks once`);
          assert.equal(row.interest, Math.floor((row.goldAtStart + row.bounty) * cfg.interestRate), `${tag}: interest in wave ${row.wave}`);
          const formula = cfg.waveBonusBase + row.wave * cfg.waveBonusScale;
          assert.equal(row.bonus, Math.max(formula, WAVES[row.wave - 1].bonusGold), `${tag}: bonus in wave ${row.wave}`);
          assert.equal(row.goldAfterAward, row.goldAtStart + row.bounty + row.interest + row.bonus, `${tag}: awards in wave ${row.wave}`);
        });
      }
    }
  }
  assert.equal(runs, 3 * targets.length * 2);
});

test('towers are bought through the real build system and cost exactly their price', () => {
  const run = simulate({ build: 'arrow', extraGold: 600, maxWave: 1 });
  const first = run.rows[0];
  assert.equal(first.spentBefore + first.goldAtStart, 150 + 600, 'purchases plus remaining gold equal the starting purse');
  assert.equal(first.invested, first.spentBefore, 'invested equals spent before the first wave');
});

// ── The committed report is the simulation's output ─────────────────────────

test('docs/ECONOMY_REPORT.md is up to date (run `npm run report:economy -- --write`)', () => {
  const committed = readFileSync('docs/ECONOMY_REPORT.md', 'utf8').replace(/\r\n/g, '\n');
  assert.equal(committed, buildReport());
});

// ── Findings that are tracked, not fixed: they are balance or design decisions ──
// A TODO test is reported but does not fail the suite; remove `todo` when the decision is made.

test('difficulty presets change the wave bonus', { todo: 'v0.6.0 finding: max(formula, bonusGold) makes waveBonusBase/Scale dead on hard and insane' }, () => {
  const total = (difficulty) => sum(waveTable(difficulty), 'bonus');
  assert(total('insane') < total('normal') * 0.9, `insane pays ${total('insane')}, normal pays ${total('normal')}`);
  assert(total('hard') < total('normal') * 0.95, `hard pays ${total('hard')}, normal pays ${total('normal')}`);
});

test('lumber is spent by some system', { todo: 'v0.6.0 finding: lumber is earned (waves, golems, bosses) but has no sink' }, () => {
  const spenders = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (path.endsWith('.ts') && !path.endsWith('LumberManager.ts') && /lumber\w*\.(spend|canAfford)\(|canAffordLumber/i.test(readFileSync(path, 'utf8'))) spenders.push(path);
    }
  };
  visit('src');
  assert(spenders.length > 0, 'no source file spends lumber');
});
