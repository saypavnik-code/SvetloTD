import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CANDIDATES, WHAT_IFS, bestOf, bonusTimes, buildProposals, evaluate, passes, retaper, upgradeCostTimes } from '../scripts/balance_proposals.mjs';
import { castSkills, game, simulate, withScenario } from './support/simulate.mjs';

const { BASE_WAVES, DIFFICULTY_PRESETS, ENEMY_DEFS, OPENING_TAPER, TOWER_DEFS, WAVES, Hero, Enemy, PATH_TOP, taperWave } = game;
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const snapshot = () => JSON.stringify({ WAVES, ENEMY_DEFS, TOWER_DEFS, DIFFICULTY_PRESETS });

// ── The owner's decisions of v0.8.0 are in the data ─────────────────────────

test('opening candidate C is in the data: starting gold, bounties and the wave taper', () => {
  assert.deepEqual(['normal', 'hard', 'insane'].map((d) => DIFFICULTY_PRESETS[d].startingGold), [300, 260, 200]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(ENEMY_DEFS).map(([id, def]) => [id, def.bounty])),
    { grunt: 6, runner: 5, golem: 21, wyvern: 11, boss_goliath: 90 },
  );
  assert.deepEqual({ ...OPENING_TAPER }, { hp: 0.4, count: 0.8, until: 30 });
  assert.equal(WAVES.length, 40);
  assert.deepEqual([WAVES[0].count, WAVES[0].hpMult], [6, 0.4], 'wave 1: 8 enemies at 100% HP become 6 at 40%');
  assert(WAVES[28].hpMult > 8.9 && WAVES[28].hpMult < 9.2, 'wave 29 is softened only slightly');
  assert.deepEqual([WAVES[29].hpMult, WAVES[39].hpMult, WAVES[30].count], [16, 26, 38], 'waves from 30 on are untouched');
  for (const wave of WAVES) if (wave.isBoss) assert.equal(wave.count, 1, `boss wave ${wave.wave} keeps one enemy`);
  for (let i = 1; i < 10; i++) assert(WAVES[i].hpMult * WAVES[i].count > 0);
});

test('the applied opening meets the acceptance bar with an idle hero and with the scripted skills', () => {
  const result = evaluate(null, 11);
  assert(passes(result.idle), `idle: best build has ${bestOf(result.idle).lives10} lives at wave 11`);
  assert(passes(result.skills), `skills: best build has ${bestOf(result.skills).lives10} lives at wave 11`);
});

// ── Scenarios replace balance data temporarily and always put it back ───────

test('a scenario changes the data inside the run and restores it afterwards, even when the run throws', () => {
  const before = snapshot();
  const count = WAVES[0].count;
  const bounty = ENEMY_DEFS.grunt.bounty;
  const scenario = { waveTweak: (w) => ({ count: w.count + 1 }), enemyTweak: (id, def) => ({ bounty: def.bounty * 2 }) };
  withScenario(scenario, () => {
    assert.equal(WAVES[0].count, count + 1);
    assert.equal(ENEMY_DEFS.grunt.bounty, bounty * 2);
  });
  assert.equal(snapshot(), before);
  assert.throws(() => withScenario(scenario, () => { throw new Error('boom'); }), /boom/);
  assert.equal(snapshot(), before, 'data restored after an exception');
  simulate({ baseline: 'oracle_bank', scenario });
  assert.equal(snapshot(), before, 'data restored after a simulation');
});

test('scenario levers reach the real systems: starting gold, bounty and wave size', () => {
  const start = DIFFICULTY_PRESETS.normal.startingGold;
  const plain = simulate({ baseline: 'oracle_bank' });
  assert.equal(plain.rows[0].goldAtStart, start);
  const rich = simulate({ baseline: 'oracle_bank', scenario: { startGold: start + 250, enemyTweak: (id, def) => ({ bounty: def.bounty * 2 }) } });
  assert.equal(rich.rows[0].goldAtStart, start + 250);
  assert.equal(sum(rich.rows, 'bounty'), sum(plain.rows, 'bounty') * 2);
  const small = simulate({ baseline: 'oracle_bank', scenario: { waveTweak: (w) => ({ count: w.count === 1 ? 1 : Math.ceil(w.count / 2) }) } });
  assert(sum(small.rows, 'kills') < sum(plain.rows, 'kills'));
  const poorer = simulate({ baseline: 'oracle_bank', scenario: { startGold: 100 } });
  assert.equal(poorer.rows[0].goldAtStart, 100, 'starting gold can be lowered as well');
});

test('taperWave: the data is BASE_WAVES tapered by OPENING_TAPER, and retaper of it changes nothing', () => {
  assert.equal(BASE_WAVES.length, 40);
  WAVES.forEach((wave, i) => assert.deepEqual(wave, taperWave(BASE_WAVES[i]), `wave ${wave.wave} is the tapered base wave`));
  const identity = retaper(OPENING_TAPER);
  for (const wave of WAVES) assert.deepEqual(identity(wave), { hpMult: wave.hpMult, count: wave.count }, `wave ${wave.wave}`);
});

test('taperWave keeps boss waves at one enemy, never exceeds the base values for end <= 1 and honours `end`', () => {
  const soft = { hp: 0.3, count: 0.5, until: 30 };
  for (const base of BASE_WAVES) {
    const t = taperWave(base, soft);
    assert(t.hpMult <= base.hpMult + 1e-9 && t.count <= base.count, `wave ${base.wave} is not harder than written`);
    assert(t.count >= 1);
    if (base.count === 1) assert.equal(t.count, 1, `wave ${base.wave} keeps its single enemy`);
    if (base.wave >= 30) assert.deepEqual(t, base, `wave ${base.wave} is unchanged when end is 1`);
  }
  assert.equal(taperWave(BASE_WAVES[0], soft).hpMult, Math.round(BASE_WAVES[0].hpMult * 0.3 * 100) / 100, 'wave 1 starts at the given HP fraction');
  assert.equal(taperWave(BASE_WAVES[0], soft).count, Math.round(BASE_WAVES[0].count * 0.5), 'wave 1 starts at the given count fraction');
  const lower = { ...soft, until: 40, end: 0.5 };
  assert.equal(taperWave(BASE_WAVES[39], lower).hpMult, Math.round(BASE_WAVES[39].hpMult * 0.5 * 100) / 100, 'from `until` on the fraction is `end`');
  assert.equal(taperWave(BASE_WAVES[39], lower).count, 1, 'the final boss stays alone');
});

test('tower and preset tweaks reach the real systems and are restored', () => {
  const before = snapshot();
  const cost = TOWER_DEFS.arrow_t2.cost;
  withScenario({ towerTweak: upgradeCostTimes(0.5) }, () => {
    assert.equal(TOWER_DEFS.arrow_t2.cost, Math.round(cost * 0.5));
    assert.equal(TOWER_DEFS.arrow_t1.cost, 50, 'tier-1 towers keep their price');
  });
  assert.equal(snapshot(), before);
  assert(!('__id' in TOWER_DEFS.arrow_t1) && !('__id' in DIFFICULTY_PRESETS.normal), 'no marker fields are left behind');
  const plain = simulate({ baseline: 'oracle_bank' });
  const rich = simulate({ baseline: 'oracle_bank', scenario: { presetTweak: (id) => (id === 'normal' ? { interestRate: 0.1 } : {}) } });
  assert(sum(rich.rows, 'interest') > sum(plain.rows, 'interest') * 1.5, 'a higher interest rate pays more interest');
  assert.equal(snapshot(), before);
  const arrow = simulate({ build: 'arrow', extraGold: 600, maxWave: 1 });
  const cheaper = simulate({ build: 'arrow', extraGold: 600, maxWave: 1, scenario: { towerTweak: (id) => (id === 'arrow_t1' ? { cost: 25 } : {}) } });
  assert(cheaper.rows[0].towers > arrow.rows[0].towers, 'cheaper towers buy more towers with the same gold');
  assert.equal(bonusTimes(2)({ wave: 10 }).bonusGold, BASE_WAVES[9].bonusGold * 2);
});

test('ledger invariants hold under a scenario that changes gold, bounty and waves', () => {
  const scenario = {
    startGold: 200,
    waveTweak: retaper({ hp: 0.5, count: 0.9, until: 20 }),
    enemyTweak: (id, def) => ({ bounty: def.bounty * 2 }),
    towerTweak: upgradeCostTimes(0.8),
    presetTweak: (id) => (id === 'normal' ? { interestRate: 0.07 } : {}),
  };
  for (const skills of [false, true]) {
    const run = simulate({ build: 'balanced', skills, scenario });
    const tag = skills ? 'skills' : 'idle';
    withScenario(scenario, () => {
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

// ── Mid-game proposals ──────────────────────────────────────────────────────

test('proposals D and E meet the mid-game bar with an idle hero and with the scripted skills; F with the skills', () => {
  const MID = 21;
  const byId = Object.fromEntries(CANDIDATES.map((c) => [c.id, evaluate(c.scenario, MID)]));
  for (const id of ['D', 'E']) {
    assert(passes(byId[id].idle, MID), `${id} idle: best build has ${bestOf(byId[id].idle, MID).lives21} lives at wave 21`);
    assert(passes(byId[id].skills, MID), `${id} skills: best build has ${bestOf(byId[id].skills, MID).lives21} lives at wave 21`);
  }
  assert(passes(byId.F.skills, MID), 'F skills');
});

test('current data does not meet the mid-game bar, and the what-ifs are measured against it', () => {
  const current = evaluate(WHAT_IFS[0].scenario, 21);
  assert(!passes(current.idle, 21) && !passes(current.skills, 21), 'the wall in the mid game is the finding the proposals answer');
  assert.equal(WHAT_IFS[0].scenario, null);
  assert(WHAT_IFS.length >= 3);
});

// ── The committed status document is the simulation's output ────────────────

test('docs/BALANCE_PROPOSALS.md is up to date (run `npm run report:balance -- --write`)', () => {
  const committed = readFileSync('docs/BALANCE_PROPOSALS.md', 'utf8').replace(/\r\n/g, '\n');
  assert.equal(committed, buildProposals());
});
