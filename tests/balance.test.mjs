import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CANDIDATES, bestOf, buildProposals, evaluate, passes, taper } from '../scripts/balance_proposals.mjs';
import { BUILDS, castSkills, game, simulate, waveTable, withScenario } from './support/simulate.mjs';

const { ENEMY_DEFS, WAVES, Hero, Enemy, PATH_TOP } = game;
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const snapshot = () => JSON.stringify({ WAVES, ENEMY_DEFS });

// ── Scenarios replace balance data temporarily and always put it back ───────

test('a scenario changes the data inside the run and restores it afterwards, even when the run throws', () => {
  const before = snapshot();
  const scenario = { waveTweak: (w) => ({ count: w.count + 1 }), enemyTweak: (id, def) => ({ bounty: def.bounty * 2 }) };
  withScenario(scenario, () => {
    assert.equal(WAVES[0].count, 9);
    assert.equal(ENEMY_DEFS.grunt.bounty, 8);
  });
  assert.equal(snapshot(), before);
  assert.throws(() => withScenario(scenario, () => { throw new Error('boom'); }), /boom/);
  assert.equal(snapshot(), before, 'data restored after an exception');
  simulate({ baseline: 'oracle_bank', scenario });
  assert.equal(snapshot(), before, 'data restored after a simulation');
});

test('scenario levers reach the real systems: starting gold, bounty and wave size', () => {
  const plain = simulate({ baseline: 'oracle_bank' });
  assert.equal(plain.rows[0].goldAtStart, 150);
  const rich = simulate({ baseline: 'oracle_bank', scenario: { startGold: 400, enemyTweak: (id, def) => ({ bounty: def.bounty * 2 }) } });
  assert.equal(rich.rows[0].goldAtStart, 400);
  assert.equal(sum(rich.rows, 'bounty'), sum(plain.rows, 'bounty') * 2);
  const small = simulate({ baseline: 'oracle_bank', scenario: { waveTweak: (w) => ({ count: w.count === 1 ? 1 : Math.ceil(w.count / 2) }) } });
  assert(sum(small.rows, 'kills') < sum(plain.rows, 'kills'));
  const poorer = simulate({ baseline: 'oracle_bank', scenario: { startGold: 100 } });
  assert.equal(poorer.rows[0].goldAtStart, 100, 'starting gold can be lowered as well');
});

test('taper keeps boss waves at one enemy, never exceeds the current values and reaches them at the end', () => {
  const tweak = taper({ hp: 0.3, count: 0.5, until: 30 });
  for (const wave of WAVES) {
    const t = tweak(wave);
    assert(t.hpMult <= wave.hpMult + 1e-9 && t.count <= wave.count, `wave ${wave.wave} is not harder than today`);
    assert(t.count >= 1);
    if (wave.count === 1) assert.equal(t.count, 1, `wave ${wave.wave} keeps its single enemy`);
    if (wave.wave >= 30) assert.deepEqual(t, { hpMult: wave.hpMult, count: wave.count }, `wave ${wave.wave} is unchanged`);
  }
  assert.equal(tweak(WAVES[0]).hpMult, Math.round(WAVES[0].hpMult * 0.3 * 100) / 100, 'wave 1 starts at the given HP fraction');
  assert.equal(tweak(WAVES[0]).count, Math.round(WAVES[0].count * 0.5), 'wave 1 starts at the given count fraction');
});

test('ledger invariants hold under every candidate scenario', () => {
  for (const candidate of CANDIDATES) {
    for (const skills of [false, true]) {
      const run = simulate({ build: 'balanced', skills, scenario: candidate.scenario });
      const tag = `${candidate.id}/${skills ? 'skills' : 'idle'}`;
      withScenario(candidate.scenario, () => {
        run.rows.forEach((row, i) => {
          const previous = run.rows[i - 1];
          if (previous) {
            assert.equal(row.livesAtStart, previous.livesAtStart - previous.livesLost, `${tag}: lives before wave ${row.wave}`);
            assert.equal(row.goldAtStart, previous.goldAfterAward - row.spentBefore, `${tag}: gold before wave ${row.wave}`);
          }
          if (row.cleared) assert.equal(row.kills + row.leaks, row.count, `${tag}: wave ${row.wave} count`);
        });
      });
    }
  }
});

// ── Hero skill rule ─────────────────────────────────────────────────────────

const enemyAt = (hero, dx, dy = 0) => {
  const enemy = new Enemy();
  enemy.init('golem', PATH_TOP);
  enemy.x = hero.x + dx; enemy.y = hero.y + dy; enemy.hp = 1e9;
  return enemy;
};
const towerAt = (hero, dx) => ({ x: hero.x + dx, y: hero.y, buffs: [], applyBuff(buff) { this.buffs.push(buff); } });

test('Q is cast only when two or more enemies stand in its blast radius, W only with a tower in its radius', () => {
  const casts = { q: 0, w: 0 };
  const hero = new Hero();
  castSkills(hero, [enemyAt(hero, 30)], [], casts);
  assert.deepEqual(casts, { q: 0, w: 0 }, 'one enemy and no tower: nothing');
  assert.equal(hero.skillQCooldown, 0, 'a skipped Q must not start its cooldown');
  castSkills(hero, [enemyAt(hero, 30), enemyAt(hero, -40), enemyAt(hero, 400)], [], casts);
  assert.deepEqual(casts, { q: 1, w: 0 }, 'two enemies inside, one far away: Q only');
  assert(hero.skillQCooldown > 11);
  castSkills(hero, [enemyAt(hero, 30), enemyAt(hero, -40)], [], casts);
  assert.equal(casts.q, 1, 'Q is on cooldown');
  const far = new Hero();
  castSkills(far, [enemyAt(far, 30)], [towerAt(far, 500)], casts);
  assert.equal(casts.w, 0, 'tower out of reach');
  assert.equal(far.skillWCooldown, 0);
  const near = towerAt(far, 100);
  castSkills(far, [enemyAt(far, 30)], [near], casts);
  assert.equal(casts.w, 1, 'tower in reach and an enemy alive');
  assert.equal(near.buffs.length, 1, 'the tower received the buff');
  const idle = new Hero();
  castSkills(idle, [], [towerAt(idle, 50)], casts);
  assert.equal(casts.w, 1, 'no enemy alive: W is kept');
});

test('skills are off by default, cost nothing when off and respect the cooldowns when on', () => {
  const off = simulate({ build: 'arrow', extraGold: 600 });
  assert.deepEqual(off.casts, { q: 0, w: 0 });
  const on = simulate({ build: 'arrow', extraGold: 600, skills: true });
  assert(on.casts.q > 0 && on.casts.w > 0, 'the rule fires in a real run');
  assert(on.casts.q <= Math.ceil(on.seconds / 12) + 1, 'Q cooldown is 12 s');
  assert(on.casts.w <= Math.ceil(on.seconds / 25) + 1, 'W cooldown is 25 s');
  assert.deepEqual(simulate({ build: 'arrow', extraGold: 600, skills: true }), on, 'deterministic');
});

// ── The proposals ───────────────────────────────────────────────────────────

test('every candidate meets the acceptance bar with the scripted skills, and candidate C also with an idle hero', () => {
  for (const candidate of CANDIDATES) {
    const result = evaluate(candidate.scenario, 11);
    assert(passes(result.skills), `candidate ${candidate.id} with skills: best build has ${bestOf(result.skills).lives10} lives at wave 11`);
  }
  const balanced = CANDIDATES.find((c) => c.id === 'C');
  assert(passes(evaluate(balanced.scenario, 11).idle), 'candidate C with an idle hero');
});

test('current data does not meet the acceptance bar (this is the finding the proposals answer)', () => {
  const result = evaluate(null, 11);
  assert(!passes(result.idle) && !passes(result.skills));
  assert.equal(waveTable('normal')[0].count, 8);
});

test('docs/BALANCE_PROPOSALS.md is up to date (run `npm run report:balance -- --write`)', () => {
  const committed = readFileSync('docs/BALANCE_PROPOSALS.md', 'utf8').replace(/\r\n/g, '\n');
  assert.equal(committed, buildProposals());
});
