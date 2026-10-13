import { loadModules } from './load-source.mjs';

// Deterministic headless run of the real wave, economy, tower, projectile and hero code over all 40 waves.
// It mirrors the per-frame order of GameScene.update (waves, hero, towers, projectiles). The hero is parked
// on the base and only auto-attacks; hero skills Q/W and the watchtower aura are NOT simulated.

const game = loadModules(
  'src/entities/Tower.ts',
  'src/entities/Enemy.ts',
  'src/entities/Projectile.ts',
  'src/entities/Hero.ts',
  'src/systems/BuildSystem.ts',
  'src/systems/WaveManager.ts',
  'src/systems/EconomyManager.ts',
  'src/systems/InterestSystem.ts',
  'src/systems/LumberManager.ts',
  'src/systems/StatusEffectSystem.ts',
  'src/systems/HitEffects.ts',
  'src/systems/GameSpeed.ts',
  'src/utils/ObjectPool.ts',
  'src/utils/EventBus.ts',
  'src/data/pathData.ts',
  'src/data/towers.ts',
  'src/data/enemies.ts',
  'src/data/waves.ts',
  'src/data/mapData.ts',
  'src/config/difficulty.ts',
  'src/config.ts',
);
const { EventBus, GameEvents, GameConfig, TOWER_DEFS, WAVES, ENEMY_DEFS, MAP_DATA, ALL_PATHS, TILE_SIZE } = game;

export { game };

// Chainable Phaser stand-in that also records input handlers, so towers are placed and upgraded
// through the real BuildSystem pointer pipeline instead of private methods.
function createScene() {
  const handlers = [];
  const chain = () => {
    const stub = new Proxy(function () {}, { get: (_, key) => (key === 'then' ? undefined : stub), apply: () => stub });
    return stub;
  };
  const scene = {
    add: { graphics: chain },
    tweens: { add: chain },
    input: { on: (name, fn) => { if (name === 'pointerdown') handlers.push(fn); return chain(); }, setDefaultCursor: chain },
  };
  const click = (col, row) => {
    const pointer = { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2, button: 0 };
    for (const handler of handlers) handler(pointer);
  };
  return { scene, click };
}

// Buildable cells ranked by how much lane they cover, so every build uses the same slots.
export function rankedSlots(radius = 110) {
  const points = [];
  const seen = new Set();
  for (const path of ALL_PATHS) {
    for (const p of path) {
      const key = `${p.x},${p.y}`;
      if (!seen.has(key)) { seen.add(key); points.push(p); }
    }
  }
  const slots = [];
  for (let row = 0; row < MAP_DATA.length; row++) {
    for (let col = 0; col < MAP_DATA[row].length; col++) {
      if (MAP_DATA[row][col] !== 'E') continue;
      const x = col * TILE_SIZE + TILE_SIZE / 2;
      const y = row * TILE_SIZE + TILE_SIZE / 2;
      const coverage = points.filter((p) => Math.hypot(p.x - x, p.y - y) <= radius).length;
      slots.push({ col, row, coverage });
    }
  }
  return slots.sort((a, b) => b.coverage - a.coverage || a.row - b.row || a.col - b.col);
}

// A build is an ordered rule list. At every decision the FIRST applicable rule is executed if it is
// affordable, otherwise the build waits (strict priority, no skipping), so runs are readable and
// reproducible. `place` is applicable while fewer than `max` towers of that family exist and a slot is
// free; `upgrade` is applicable while a tier-1 tower of the family exists.
const place = (id, max) => ({ kind: 'place', id, family: id.replace('_t1', ''), max });
const upgrade = (family) => ({ kind: 'upgrade', family });
const staged = (stages) => stages.flatMap((caps) => [
  ...Object.entries(caps).map(([family, max]) => place(`${family}_t1`, max)),
  ...Object.keys(caps).map(upgrade),
]);

export const BUILDS = {
  arrow: staged([{ arrow: 3 }, { arrow: 5 }, { arrow: 8 }, { arrow: 12 }, { arrow: 16 }, { arrow: 24 }]),
  cannon_arrow: staged([{ arrow: 1, cannon: 1 }, { arrow: 2, cannon: 3 }, { arrow: 4, cannon: 5 }, { arrow: 6, cannon: 8 }, { arrow: 10, cannon: 12 }, { arrow: 12, cannon: 12 }]),
  magic_slow: staged([{ magic: 1, slow: 1 }, { magic: 3, slow: 2 }, { magic: 5, slow: 3 }, { magic: 8, slow: 4 }, { magic: 12, slow: 6 }, { magic: 16, slow: 8 }]),
  balanced: staged([{ arrow: 1, magic: 1 }, { arrow: 2, magic: 2, cannon: 1, slow: 1 }, { arrow: 3, magic: 3, cannon: 2, slow: 2, acid: 1 }, { arrow: 5, magic: 5, cannon: 4, slow: 3, acid: 2 }, { arrow: 8, magic: 7, cannon: 6, slow: 4, acid: 3 }]),
};

// Baselines: `none` builds nothing, `oracle` kills every enemy the moment it spawns. With `bank` the
// oracle never spends (interest compounds); with `spend` it empties the purse every build phase.
export const BASELINES = { none: { towers: false }, oracle_bank: { oracle: true }, oracle_spend: { oracle: true, spendAll: true } };

export function simulate({ build = null, baseline = null, difficulty = 'normal', stepMs = 1000 / 30, maxWave = 40, slotCap = 24, hero = true, layout = null, extraGold = 0 } = {}) {
  const spec = baseline ? BASELINES[baseline] : { towers: true };
  const plan = build ? BUILDS[build] : (layout ? [] : null);
  if (baseline ? !spec : !plan) throw new Error(`unknown build/baseline: ${build ?? baseline}`);

  GameConfig.setDifficulty(difficulty);
  game.GameSpeed.reset();
  const economy = new game.EconomyManager();
  const lumber = new game.LumberManager();
  const interest = new game.InterestSystem(economy, lumber);
  const enemyPool = new game.ObjectPool(() => new game.Enemy(), 64);
  const projectilePool = new game.ObjectPool(() => new game.Projectile(), 64);
  if (extraGold > 0) economy.addGold(extraGold);
  const waves = new game.WaveManager(null, enemyPool);
  const { scene, click } = createScene();
  const builder = new game.BuildSystem(scene, economy, projectilePool, () => waves.activeEnemies);
  const slots = rankedSlots().slice(0, slotCap);
  const heroUnit = hero && !baseline ? new game.Hero() : null;

  const rows = [];
  let current = null;
  let time = 0;
  let spentPending = 0;
  let terminal = null;

  const towerValue = () => builder.towers.reduce((sum, t) => sum + t.totalInvested, 0);
  const handlers = [
    [GameEvents.WAVE_STARTED, (n) => {
      const wave = WAVES[n - 1];
      current = {
        wave: n, enemyType: wave.enemyType, count: wave.count, startedAt: time,
        goldAtStart: economy.gold, spentBefore: spentPending, towers: builder.towers.length, invested: towerValue(),
        livesAtStart: economy.lives, kills: 0, leaks: 0, livesLost: 0, bounty: 0, interest: 0, bonus: 0,
        lumberAtStart: lumber.lumber, clearSecs: null, goldAfterAward: null, cleared: false,
      };
      spentPending = 0;
      rows.push(current);
    }],
    [GameEvents.ENEMY_KILLED, ({ goldReward }) => { economy.addGold(goldReward); if (current) { current.kills++; current.bounty += goldReward; } }],
    [GameEvents.ENEMY_REACHED_END, (enemy) => { economy.loseLife(enemy.def.livesCost); if (current) { current.leaks++; current.livesLost += enemy.def.livesCost; } }],
    [GameEvents.INTEREST_AWARDED, (amount) => { if (current) current.interest += amount; }],
    [GameEvents.WAVE_BONUS_AWARDED, (amount) => { if (current) current.bonus += amount; }],
    [GameEvents.WAVE_COMPLETED, (n) => { if (current && current.wave === n) { current.cleared = true; current.clearSecs = time - current.startedAt; current.goldAfterAward = economy.gold; } }],
    [GameEvents.GAME_OVER, ({ victory }) => { if (!terminal) terminal = victory ? 'victory' : 'defeat'; }],
  ];
  for (const [event, handler] of handlers) EventBus.on(event, handler);

  const priceOf = (id) => TOWER_DEFS[id].cost;
  const familyCount = (family) => builder.towers.filter((t) => t.towerId.startsWith(`${family}_`)).length;
  const freeSlot = () => slots.find((s) => !builder.towers.some((t) => t.gridCol === s.col && t.gridRow === s.row));
  // Returns the next applicable rule with its price, or null when the plan is exhausted.
  const nextAction = () => {
    for (const rule of plan) {
      if (rule.kind === 'place') {
        if (familyCount(rule.family) < rule.max && freeSlot()) return { rule, price: priceOf(rule.id) };
      } else {
        const target = builder.towers.find((t) => t.towerId === `${rule.family}_t1` && TOWER_DEFS[t.towerId].upgradeTo.length > 0);
        if (target) return { rule, target, price: priceOf(TOWER_DEFS[target.towerId].upgradeTo[0]) };
      }
    }
    return null;
  };
  const buyAccordingToPlan = () => {
    for (let guard = 0; guard < 200; guard++) {
      const action = nextAction();
      if (!action || economy.gold < action.price) return;
      if (action.rule.kind === 'place') {
        const slot = freeSlot();
        builder.selectTowerType(action.rule.id);
        click(slot.col, slot.row);
      } else {
        click(action.target.gridCol, action.target.gridRow);
        builder.upgradeSelected(TOWER_DEFS[action.target.towerId].upgradeTo[0]);
      }
      spentPending += action.price;
    }
  };

  for (const item of layout ?? []) {
    builder.selectTowerType(item.id);
    click(item.col, item.row);
    spentPending += priceOf(item.id);
  }
  waves.startGame();
  const dt = stepMs / 1000;
  const maxSteps = Math.ceil((maxWave * 140) / dt);
  for (let step = 0; step < maxSteps && !terminal; step++) {
    time += dt;
    waves.update(dt);
    if (terminal) break;
    if (heroUnit) heroUnit.update(dt, waves.activeEnemies);
    if (spec.oracle) {
      for (const e of waves.activeEnemies) if (e.isActive && !e.isDead) e.takeDamage(1e12, 'chaos');
    } else {
      builder.update(stepMs);
      for (const projectile of [...projectilePool.activeItems]) {
        projectile.update(stepMs);
        projectile.tickSplash(dt);
        if (projectile.isFinished) projectilePool.release(projectile);
      }
    }
    if (waves.state === 'countdown') {
      if (spec.spendAll && economy.gold > 0) { spentPending += economy.gold; economy.spendGold(economy.gold); }
      else if (plan) buyAccordingToPlan();
    }
    if (current && current.wave >= maxWave && current.cleared) break;
  }

  const result = {
    build: build ?? baseline, difficulty, result: terminal ?? 'unfinished', reachedWave: current ? current.wave : 0,
    livesLeft: economy.lives, goldEnd: economy.gold, lumberEnd: lumber.lumber, seconds: Math.round(time),
    towersEnd: builder.towers.length, investedEnd: towerValue(), rows,
  };

  for (const [event, handler] of handlers) EventBus.off(event, handler);
  waves.destroy(); interest.destroy(); economy.destroy();
  for (const t of [...builder.towers]) t.destroy();
  GameConfig.setDifficulty('normal');
  return result;
}

// Static, simulation-free view of what every wave brings and what killing it pays.
export function waveTable(difficulty = 'normal') {
  const cfg = game.DIFFICULTY_PRESETS[difficulty];
  return WAVES.map((w) => {
    const def = ENEMY_DEFS[w.enemyType];
    const hpEach = Math.round(def.hp * w.hpMult * cfg.enemyHpMult);
    const bounty = def.bounty * w.count;
    const formula = cfg.waveBonusBase + w.wave * cfg.waveBonusScale;
    const bonus = Math.max(formula, w.bonusGold);
    return {
      wave: w.wave, enemyType: w.enemyType, count: w.count, flying: def.isFlying, armor: def.armorType,
      hpEach, totalHp: hpEach * w.count, bounty, bonus, bonusGold: w.bonusGold, formulaBonus: formula, income: bounty + bonus,
      livesAtStake: def.livesCost * w.count,
    };
  });
}
