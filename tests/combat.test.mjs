import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/entities/Tower.ts',
  'src/entities/Enemy.ts',
  'src/entities/Projectile.ts',
  'src/entities/Hero.ts',
  'src/systems/BuildSystem.ts',
  'src/systems/EconomyManager.ts',
  'src/systems/GameSpeed.ts',
  'src/utils/ObjectPool.ts',
  'src/utils/EventBus.ts',
  'src/data/pathData.ts',
  'src/data/towers.ts',
  'src/data/mapData.ts',
);
const { EventBus, GameEvents, GameSpeed, TargetPriority, TOWER_DEFS } = game;

// Every method call on this stand-in returns itself: enough Phaser surface for entities that only
// create and style graphics, tweens and input hooks. Rendering itself is not under test here.
const chain = () => {
  const stub = new Proxy(function () {}, { get: (_, key) => (key === 'then' ? undefined : stub), apply: () => stub });
  return stub;
};
const scene = { add: { graphics: chain }, tweens: { add: chain }, input: { on: chain, setDefaultCursor: chain } };

function setupTower(towerId = 'arrow_t1', col = 5, row = 5) {
  const enemies = [];
  const projectiles = new game.ObjectPool(() => new game.Projectile(), 8);
  const tower = new game.Tower(scene, towerId, col, row, projectiles, () => enemies);
  return { tower, enemies, projectiles };
}

function addEnemy(enemies, tower, dx, dy = 0, { id = 'golem', hp = 1e9 } = {}) {
  const enemy = new game.Enemy();
  enemy.init(id, game.PATH_TOP);
  enemy.x = tower.x + dx;
  enemy.y = tower.y + dy;
  enemy.hp = hp;
  enemies.push(enemy);
  return enemy;
}

function countShots(run) {
  let shots = 0;
  const onShot = () => { shots++; };
  EventBus.on(GameEvents.TOWER_SHOT, onShot);
  try { run(() => shots); } finally { EventBus.off(GameEvents.TOWER_SHOT, onShot); }
  return shots;
}

function slowOf(enemy) {
  return enemy.fx.update(0, () => {}).slowFraction;
}

// ── Tower fire rate ─────────────────────────────────────────────────────────

test('fire rate equals attackSpeed whatever the frame length', () => {
  for (const id of ['arrow_t1', 'arrow_t2', 'cannon_t1', 'magic_t1', 'slow_t1', 'acid_t1']) {
    const nominal = TOWER_DEFS[id].attackSpeed * 60;
    const results = [4, 16.667, 33.3, 50, 100].map((stepMs) => {
      const { tower, enemies } = setupTower(id);
      addEnemy(enemies, tower, 20);
      return countShots(() => { for (let t = 0; t < 60000; t += stepMs) tower.update(stepMs); });
    });
    for (const shots of results) assert(Math.abs(shots - nominal) <= 1, `${id}: ${shots} shots, nominal ${nominal} (${results})`);
  }
});

test('the game speed multiplier is applied exactly once to tower fire rate', () => {
  GameSpeed.set(3);
  try {
    const { tower, enemies } = setupTower('arrow_t2');
    addEnemy(enemies, tower, 20);
    const shots = countShots(() => { for (let t = 0; t < 20000; t += 16.667) tower.update(16.667); }); // 60 s of game time
    assert(Math.abs(shots - 84) <= 1, `${shots} shots in 60 s of game time, nominal 84`);
  } finally { GameSpeed.reset(); }
});

test('an idle tower cannot bank shots', () => {
  const { tower, enemies } = setupTower('arrow_t1');
  for (let t = 0; t < 30000; t += 16.667) tower.update(16.667);   // 30 s without a target
  addEnemy(enemies, tower, 20);
  const shots = countShots(() => { for (let t = 0; t < 1000; t += 16.667) tower.update(16.667); });
  assert(shots <= 1, `${shots} shots within one second of the first target`);
});

test('a shot is not wasted when the target dies between target ticks', () => {
  const { tower, enemies } = setupTower('cannon_t1');
  addEnemy(enemies, tower, 20);
  addEnemy(enemies, tower, 30);
  let elapsed = 0;
  const step = (ms) => { tower.update(ms); elapsed += ms; };
  const shots = countShots((current) => {
    while (current() < 1) step(10);                       // first shot, cooldown 2.5 s starts
    const firstShotAt = elapsed;
    while (elapsed < firstShotAt + 2450) step(10);        // ~50 ms of cooldown left
    const victim = tower._target;                         // test-only: the tower's current target
    victim.takeDamage(1e12, 'chaos');                     // dies between two target ticks
    for (let i = 0; i < 10; i++) step(10);                // cooldown elapses; the next target tick is still ~100 ms away
    assert.equal(current(), 2, 'the second shot must go to the surviving enemy');
  });
  assert.equal(shots, 2);
});

// ── Tower targeting ─────────────────────────────────────────────────────────

test('target priority rules pick the expected enemy and a change takes effect at once', () => {
  const { tower, enemies } = setupTower('arrow_t1');
  const ahead = addEnemy(enemies, tower, 60, 0, { hp: 50 });    // closer to the base, weak
  const behind = addEnemy(enemies, tower, -50, 0, { hp: 900 }); // farther from the base, strong
  const pickedBy = (priority) => {
    tower.setTargetPriority(priority);
    tower.update(250);
    return tower._target;
  };
  assert.equal(pickedBy(TargetPriority.FIRST), ahead);
  assert.equal(pickedBy(TargetPriority.LAST), behind);
  assert.equal(pickedBy(TargetPriority.STRONGEST), behind);
  assert.equal(pickedBy(TargetPriority.WEAKEST), ahead);
  assert.equal(pickedBy(TargetPriority.NEAREST), behind);       // 50 px vs 60 px
});

test('a tower keeps its current target until it dies or leaves range', () => {
  const { tower, enemies } = setupTower('arrow_t1');
  const trailing = addEnemy(enemies, tower, -60);
  tower.update(250);
  addEnemy(enemies, tower, 60);                                  // a leader (closer to the base) appears
  for (let i = 0; i < 20; i++) tower.update(50);
  assert.equal(tower._target, trailing);
  trailing.takeDamage(1e12, 'chaos');
  for (let i = 0; i < 6; i++) tower.update(50);
  assert.notEqual(tower._target, trailing);
  assert(tower._target, 'the tower must pick the leader once the trailing target is gone');
});

test('targeting respects range and the air/ground capabilities of the tower', () => {
  const ground = setupTower('cannon_t1');                        // ground only, range 100
  const flyer = addEnemy(ground.enemies, ground.tower, 30, 0, { id: 'wyvern' });
  ground.tower.update(250);
  assert.equal(ground.tower._target, null);
  flyer.takeDamage(1e12, 'chaos');

  const arrow = setupTower('arrow_t1');                          // air and ground, range 120
  const inside = addEnemy(arrow.enemies, arrow.tower, TOWER_DEFS.arrow_t1.range);
  addEnemy(arrow.enemies, arrow.tower, TOWER_DEFS.arrow_t1.range + 1);
  arrow.tower.update(250);
  assert.equal(arrow.tower._target, inside);
  const wyvern = addEnemy(arrow.enemies, arrow.tower, -30, 0, { id: 'wyvern' });
  arrow.tower.setTargetPriority(TargetPriority.NEAREST);
  arrow.tower.update(250);
  assert.equal(arrow.tower._target, wyvern);
});

// ── Projectiles ─────────────────────────────────────────────────────────────

function fly(projectile, stepMs, limitMs = 5000) {
  for (let t = 0; t < limitMs && projectile.isActive; t += stepMs) projectile.update(stepMs);
}

test('a projectile hits its target exactly once at any step size', () => {
  for (const stepMs of [4, 16.667, 50, 100, 300]) {
    const target = new game.Enemy();
    target.init('golem', game.PATH_TOP);
    target.x = 300; target.y = 100; target.hp = 1e9;
    const projectile = new game.Projectile();
    let hits = 0;
    projectile.onEnemyHit = () => { hits++; };
    projectile.init(100, 100, target, 25, 'chaos', 0, 0xffffff, [target], 320);
    fly(projectile, stepMs);
    assert.equal(hits, 1, `step ${stepMs} ms`);
    assert.equal(target.hp, 1e9 - 25, `step ${stepMs} ms`);
    assert.equal(projectile.isFinished, true);
  }
});

test('a projectile whose target dies in flight deals no damage and finishes', () => {
  const target = new game.Enemy();
  target.init('golem', game.PATH_TOP);
  target.x = 300; target.y = 100; target.hp = 1e9;
  const bystander = new game.Enemy();
  bystander.init('golem', game.PATH_TOP);
  bystander.x = 300; bystander.y = 100; bystander.hp = 1e9;
  const projectile = new game.Projectile();
  let hits = 0;
  projectile.onEnemyHit = () => { hits++; };
  projectile.init(100, 100, target, 25, 'chaos', 0, 0xffffff, [target, bystander], 320);
  projectile.update(100);
  target.takeDamage(1e12, 'chaos');
  fly(projectile, 16.667);
  assert.equal(hits, 0);
  assert.equal(bystander.hp, 1e9);
  assert.equal(projectile.isFinished, true);
});

test('splash damages every living enemy in radius once and the projectile outlives its ring animation', () => {
  const make = (x) => {
    const enemy = new game.Enemy();
    enemy.init('golem', game.PATH_TOP);
    enemy.x = x; enemy.y = 100; enemy.hp = 1e9;
    return enemy;
  };
  const center = make(300), near = make(340), edge = make(360), far = make(361), dead = make(310);
  dead.takeDamage(1e12, 'chaos');
  const hitList = [];
  const projectile = new game.Projectile();
  projectile.onEnemyHit = (enemy) => hitList.push(enemy);
  projectile.init(100, 100, center, 40, 'chaos', 60, 0xffffff, [center, near, edge, far, dead], 320);
  fly(projectile, 16.667);
  assert.deepEqual(hitList, [center, near, edge]);
  assert.equal(far.hp, 1e9);
  assert.equal(projectile.isActive, false);
  assert.equal(projectile.isFinished, false, 'the splash ring is still animating');
  projectile.tickSplash(0.31);
  assert.equal(projectile.isFinished, true);
});

test('reset clears every reference a recycled projectile could leak', () => {
  const target = new game.Enemy();
  target.init('golem', game.PATH_TOP);
  const projectile = new game.Projectile();
  projectile.onEnemyHit = () => { throw new Error('stale callback'); };
  projectile.init(0, 0, target, 10, 'chaos', 60, 0xffffff, [target], 320);
  projectile.reset();
  assert.equal(projectile.isActive, false);
  assert.equal(projectile.onEnemyHit, undefined);
  assert.equal(projectile.isFinished, true);
  projectile.update(1000); // inactive projectiles ignore updates
});

test('projectile flight scales with game speed exactly once', () => {
  const timeToHit = (speed) => {
    GameSpeed.set(speed);
    try {
      const target = new game.Enemy();
      target.init('golem', game.PATH_TOP);
      target.x = 420; target.y = 100; target.hp = 1e9;
      const projectile = new game.Projectile();
      projectile.init(100, 100, target, 10, 'chaos', 0, 0xffffff, [target], 320);
      let elapsed = 0;
      while (projectile.isActive) { projectile.update(10); elapsed += 10; }
      return elapsed;
    } finally { GameSpeed.reset(); }
  };
  const normal = timeToHit(1);
  const triple = timeToHit(3);
  assert(Math.abs(normal / triple - 3) < 0.35, `x1 ${normal} ms, x3 ${triple} ms`);
});

// ── Hero skills ─────────────────────────────────────────────────────────────

test('Shockwave hits living enemies in radius, slows them and respects its cooldown', () => {
  const hero = new game.Hero();
  const place = (dx) => {
    const enemy = new game.Enemy();
    enemy.init('golem', game.PATH_TOP);
    enemy.x = hero.x + dx; enemy.y = hero.y; enemy.hp = 1e9;
    return enemy;
  };
  const inside = place(50), edge = place(90), outside = place(91), dead = place(10);
  dead.takeDamage(1e12, 'chaos');
  const events = [];
  const onSkill = (...args) => events.push(args);
  EventBus.on(GameEvents.HERO_SKILL_Q, onSkill);
  try {
    assert.equal(hero.useSkillQ([inside, edge, outside, dead]), true);
    assert.equal(inside.hp, 1e9 - 40);
    assert.equal(edge.hp, 1e9 - 40);
    assert.equal(outside.hp, 1e9);
    assert.equal(slowOf(inside), 0.4);
    assert.equal(slowOf(outside), 0);
    assert.equal(events.length, 1);
    assert.equal(events[0][3], 2, 'hit count reported to the effects');
    assert.equal(hero.useSkillQ([inside]), false, 'cooldown');
    assert.equal(inside.hp, 1e9 - 40);
    for (let t = 0; t < 11.9; t += 0.1) hero.update(0.1, []);
    assert.equal(hero.useSkillQ([inside]), false, 'still cooling down after 11.9 s');
    for (let t = 0; t < 0.3; t += 0.1) hero.update(0.1, []);
    assert.equal(hero.useSkillQ([inside]), true, 'ready after 12 s');
  } finally { EventBus.off(GameEvents.HERO_SKILL_Q, onSkill); }
});

test('Amber Shield buffs towers in radius by 25% for 6 s and refreshing does not stack', () => {
  const hero = new game.Hero();
  const near = setupTower('arrow_t1', 7, 7);        // ~85 px from the hero at the base centre
  const far = setupTower('arrow_t1', 0, 0);
  assert.equal(hero.useSkillW([near.tower, far.tower]), true);
  assert.equal(near.tower._effectiveAttackSpeed(), 1.25);
  assert.equal(far.tower._effectiveAttackSpeed(), 1);
  hero.skillWCooldown = 0;
  hero.useSkillW([near.tower]);
  assert.equal(near.tower._effectiveAttackSpeed(), 1.25, 'refresh must not stack');
  addEnemy(near.enemies, near.tower, 20);
  const buffedShots = countShots(() => { for (let t = 0; t < 6000; t += 16.667) near.tower.update(16.667); });
  const afterwards = countShots(() => { for (let t = 0; t < 10000; t += 16.667) near.tower.update(16.667); });
  assert(buffedShots >= 7 && buffedShots <= 8, `${buffedShots} shots during the 6 s buff`);
  assert(afterwards >= 9 && afterwards <= 11, `${afterwards} shots in 10 s after the buff expired`);
});

// ── Build, upgrade, sell ────────────────────────────────────────────────────

function buildWorld(gold) {
  const economy = new game.EconomyManager();
  economy.spendGold(economy.gold);
  economy.addGold(gold);
  const enemies = [];
  const projectiles = new game.ObjectPool(() => new game.Projectile(), 4);
  const build = new game.BuildSystem(scene, economy, projectiles, () => enemies);
  const cell = { col: 3, row: 3 }; // buildable terrain
  return { economy, build, cell, dispose: () => economy.destroy() };
}

test('placing a tower spends its cost once and occupies the cell', () => {
  const world = buildWorld(130);
  world.build._place('arrow_t1', world.cell.col, world.cell.row);
  assert.equal(world.economy.gold, 80);
  assert.equal(world.build.towers.length, 1);
  assert.equal(world.build._canPlace(world.cell.col, world.cell.row), false, 'occupied cell');
  world.build._place('arrow_t1', world.cell.col, world.cell.row + 1);
  world.build._place('arrow_t1', world.cell.col, world.cell.row + 2);
  assert.equal(world.build.towers.length, 2, 'the third tower cannot be afforded');
  assert.equal(world.economy.gold, 30);
  world.dispose();
});

test('upgrade validates the target and the price, keeps priority, and accumulates the investment', () => {
  const world = buildWorld(500);
  const { col, row } = world.cell;
  world.build._place('arrow_t1', col, row);
  const tower = world.build.towers[0];
  world.build._selectTower(tower);
  tower.setTargetPriority(TargetPriority.STRONGEST);

  world.build.upgradeSelected('cannon_t2');                      // not an upgrade of this tower
  assert.equal(world.economy.gold, 450);
  assert.equal(world.build.towers[0], tower);

  world.build.upgradeSelected('arrow_t2');                       // 120 gold
  assert.equal(world.economy.gold, 330);
  const upgraded = world.build.towers[0];
  assert.equal(world.build.towers.length, 1);
  assert.equal(upgraded.towerId, 'arrow_t2');
  assert.equal(upgraded.totalInvested, 170);
  assert.equal(upgraded.targetPriority, TargetPriority.STRONGEST, 'an upgrade keeps the chosen priority');

  world.economy.spendGold(world.economy.gold);
  world.build._selectTower(upgraded);
  world.build.upgradeSelected('arrow_t2');                       // no further tier
  assert.equal(world.build.towers[0], upgraded);
  world.dispose();
});

test('selling refunds floor(invested x phase rate) once and frees the cell', () => {
  for (const [phase, expected] of [[GameEvents.BUILD_PHASE_START, 170], [GameEvents.BUILD_PHASE_END, 119]]) {
    const world = buildWorld(500);
    const { col, row } = world.cell;
    world.build._place('arrow_t1', col, row);
    world.build._selectTower(world.build.towers[0]);
    world.build.upgradeSelected('arrow_t2');
    EventBus.emit(phase);
    const goldBefore = world.economy.gold;
    const refunds = [];
    const onSold = (payload) => refunds.push(payload.refund);
    EventBus.on(GameEvents.TOWER_SOLD, onSold);
    try {
      world.build.sellSelected();
      world.build.sellSelected();                                // repeated sell must do nothing
    } finally { EventBus.off(GameEvents.TOWER_SOLD, onSold); }
    assert.deepEqual(refunds, [expected]);
    assert.equal(world.economy.gold, goldBefore + expected);
    assert.equal(world.build.towers.length, 0);
    world.build.selectTowerType('arrow_t1');                     // _canPlace needs a pending tower type
    assert.equal(world.build._canPlace(col, row), true, 'the cell is free again');
    world.dispose();
  }
});

test('sell value is the exact floored percentage, with no floating-point loss', () => {
  const { tower } = setupTower('arrow_t1');
  for (let invested = 1; invested <= 2000; invested++) {
    tower.totalInvested = invested;
    assert.equal(tower.sellValue(0.7), Math.floor((invested * 70) / 100), `70% of ${invested}`);
    assert.equal(tower.sellValue(1), invested, `100% of ${invested}`);
  }
});

// ── Static guards ───────────────────────────────────────────────────────────

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(dir, entry.name))
      : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : []);
}

test('static guard: no method is interpolated into a template string without being called', () => {
  const files = sourceFiles('src').map((path) => [path, readFileSync(path, 'utf8')]);
  const methods = new Set();
  const getters = new Set();
  for (const [, text] of files) {
    for (const m of text.matchAll(/^\s+(?:public |private |readonly |static )*(get )?([A-Za-z_]\w*)\s*\([^)]*\)\s*(?::\s*[^{=]+)?\{/gm)) {
      if (['if', 'for', 'while', 'switch', 'catch', 'constructor', 'function'].includes(m[2])) continue;
      (m[1] ? getters : methods).add(m[2]);
    }
  }
  const offenders = [];
  for (const [path, text] of files) {
    for (const m of text.matchAll(/\$\{\s*[\w.?!]*\.(\w+)\s*\}/g)) {
      if (methods.has(m[1]) && !getters.has(m[1])) offenders.push(`${path}: \${...${m[1]}}`);
    }
  }
  assert.deepEqual(offenders, [], 'a template string would print the method source instead of its result');
});

test('static guard: target priority is only changed through Tower.setTargetPriority', () => {
  const offenders = sourceFiles('src')
    .filter((path) => !path.endsWith('Tower.ts'))
    .filter((path) => /\.targetPriority\s*=[^=]/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
});
