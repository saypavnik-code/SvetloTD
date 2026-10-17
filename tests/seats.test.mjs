import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/config.ts', 'src/config/difficulty.ts', 'src/data/seats.ts', 'src/data/mapData.ts', 'src/data/pathData.ts',
  'src/data/towers.ts', 'src/systems/Seats.ts', 'src/systems/EconomyManager.ts', 'src/systems/LumberManager.ts',
  'src/systems/InterestSystem.ts', 'src/systems/EnemyOutcomes.ts', 'src/systems/BuildSystem.ts', 'src/systems/GameSpeed.ts',
  'src/entities/Enemy.ts', 'src/entities/Projectile.ts', 'src/entities/Tower.ts', 'src/utils/ObjectPool.ts', 'src/utils/EventBus.ts',
);
const { EventBus, GameEvents, GameConfig } = game;
const N = 18;

function recorder(event) {
  const calls = [];
  const fn = (...args) => calls.push(args);
  EventBus.on(event, fn);
  return { calls, stop: () => EventBus.off(event, fn) };
}

test('zones: a clockwise partition, one quarter turn moves every zone on by one, every zone has 62 building tiles', () => {
  const counts = [0, 0, 0, 0];
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const zone = game.zoneOfCell(row, col);
      assert([0, 1, 2, 3].includes(zone));
      assert.equal(game.zoneOfCell(col, N - 1 - row), (zone + 1) % 4, `cell ${row},${col}`);
      if (game.MAP_DATA[row][col] === 'E') counts[zone]++;
    }
  }
  assert.deepEqual(counts, [62, 62, 62, 62], 'the seats start with equal room');
  assert.equal(game.zoneOfCell(0, 0), 0); assert.equal(game.zoneOfCell(0, 17), 1);
  assert.equal(game.zoneOfCell(17, 17), 2); assert.equal(game.zoneOfCell(17, 0), 3);
});

test('seat ownership of zones for one, two and four seats; splitEvenly never loses a coin', () => {
  assert.deepEqual([0, 1, 2, 3].map((z) => game.seatOfZone(z, 1)), [0, 0, 0, 0]);
  assert.deepEqual([0, 1, 2, 3].map((z) => game.seatOfZone(z, 2)), [0, 0, 1, 1]);
  assert.deepEqual([0, 1, 2, 3].map((z) => game.seatOfZone(z, 4)), [0, 1, 2, 3]);
  for (const total of [0, 1, 3, 7, 40, 260, 299, 300]) {
    for (const parts of [1, 2, 4]) {
      const split = game.splitEvenly(total, parts);
      assert.equal(split.length, parts);
      assert.equal(split.reduce((a, b) => a + b, 0), total);
      assert(Math.max(...split) - Math.min(...split) <= 1, 'as even as integers allow');
    }
  }
});

test('Seats: the active seat changes only to a real seat, announces it once, and decides where a seat may build', () => {
  const seats = new game.Seats(4);
  const seen = recorder(GameEvents.SEAT_CHANGED);
  assert.equal(seats.active, 0);
  assert.equal(seats.setActive(2), true);
  assert.equal(seats.setActive(2), false, 'already active');
  for (const bad of [4, -1, 1.5, NaN]) assert.equal(seats.setActive(bad), false);
  seen.stop();
  assert.deepEqual(seen.calls, [[2]]);
  assert.equal(seats.active, 2);
  assert.equal(seats.canBuild(2, 14, 14), true);
  assert.equal(seats.canBuild(2, 5, 5), false);
  const solo = new game.Seats(1);
  assert.equal(solo.setActive(1), false, 'a one-seat game has one seat');
  assert([[2, 2], [5, 12], [14, 14], [12, 3]].every(([r, c]) => solo.canBuild(0, r, c)), 'a lone player owns the whole field');
  assert.equal(game.parseSeatCount('?seats=4'), 4);
  assert.equal(game.parseSeatCount('?seats=2&x=1'), 2);
  for (const bad of ['', '?seats=3', '?seats=0', '?seats=abc', '?seats=40']) assert.equal(game.parseSeatCount(bad), 1);
});

test('EconomyManager: wallets are separate, the start gold is split without loss, lives are shared', () => {
  GameConfig.setDifficulty('normal');
  const start = GameConfig.difficulty.startingGold;
  const solo = new game.EconomyManager();
  assert.equal(solo.gold, start);
  assert.equal(solo.goldOf(0), start);
  solo.destroy();
  const economy = new game.EconomyManager(4);
  const gold = recorder(GameEvents.GOLD_CHANGED);
  assert.equal(economy.totalGold, start);
  assert.deepEqual([0, 1, 2, 3].map((s) => economy.goldOf(s)), game.splitEvenly(start, 4));
  economy.addGold(10, 2);
  assert.equal(economy.spendGold(5, 3), true);
  assert.equal(economy.spendGold(1e9, 1), false, 'no overdraft');
  assert.equal(economy.spendGold(5, 7), false, 'no such seat');
  economy.addGold(10, 9);
  gold.stop();
  assert.deepEqual(gold.calls, [[economy.goldOf(2), 2], [economy.goldOf(3), 3]], 'each event names its seat');
  assert.equal(economy.goldOf(2), game.splitEvenly(start, 4)[2] + 10);
  assert.equal(economy.goldOf(3), game.splitEvenly(start, 4)[3] - 5);
  assert.equal(economy.totalGold, start + 5);
  const lives = economy.lives;
  economy.loseLife(2);
  assert.equal(economy.lives, lives - 2, 'one pool of lives for the whole team');
  economy.destroy();
});

test('LumberManager: one wallet per seat', () => {
  const lumber = new game.LumberManager(2);
  const seen = recorder(GameEvents.LUMBER_CHANGED);
  lumber.add(2, 1); lumber.add(1);
  assert.equal(lumber.spend(3, 1), false);
  assert.equal(lumber.spend(1, 1), true);
  lumber.add(1, 5);
  seen.stop();
  assert.deepEqual([lumber.lumberOf(0), lumber.lumberOf(1), lumber.lumber], [1, 1, 1]);
  assert.equal(lumber.canAfford(1, 1), true);
  assert.equal(lumber.canAfford(2, 0), false);
  assert.deepEqual(seen.calls, [[2, 1], [1, 0], [1, 1]]);
});

test('InterestSystem: interest on each seat\'s own gold, the wave bonus split without loss, lumber for every seat', () => {
  GameConfig.setDifficulty('normal');
  const economy = new game.EconomyManager(4);
  const lumber = new game.LumberManager(4);
  const interest = new game.InterestSystem(economy, lumber);
  [0, 1, 2, 3].forEach((seat) => { economy.spendGold(economy.goldOf(seat), seat); economy.addGold(100 * (seat + 1), seat); });
  const before = economy.totalGold;
  const interestEvent = recorder(GameEvents.INTEREST_AWARDED);
  const bonusEvent = recorder(GameEvents.WAVE_BONUS_AWARDED);
  EventBus.emit(GameEvents.WAVE_COMPLETED, 5, { bonusGold: 102 });
  interestEvent.stop(); bonusEvent.stop();
  const rate = GameConfig.difficulty.interestRate, mult = GameConfig.difficulty.waveBonusMult;
  const bonus = Math.round(102 * mult);
  const earned = [100, 200, 300, 400].map((g) => Math.floor(g * rate));
  const shares = game.splitEvenly(bonus, 4);
  [0, 1, 2, 3].forEach((seat) => assert.equal(economy.goldOf(seat), 100 * (seat + 1) + earned[seat] + shares[seat], `seat ${seat}`));
  assert.equal(economy.totalGold - before, earned.reduce((a, b) => a + b, 0) + bonus, 'nothing lost, nothing made up');
  assert.deepEqual(interestEvent.calls, [[earned.reduce((a, b) => a + b, 0)]]);
  assert.deepEqual(bonusEvent.calls, [[bonus]]);
  assert.deepEqual([0, 1, 2, 3].map((s) => lumber.lumberOf(s)), [1, 1, 1, 1], 'every seat gets the wave 5 lumber');
  interest.destroy(); economy.destroy();
});

test('EnemyOutcomes: the bounty and the lumber go to the seat that made the kill; a leak costs the shared lives', () => {
  GameConfig.setDifficulty('normal');
  const economy = new game.EconomyManager(4);
  const lumber = new game.LumberManager(4);
  const outcomes = new game.EnemyOutcomes(economy, lumber);
  const kill = (seat) => {
    const enemy = new game.Enemy();
    enemy.init('golem', game.ALL_PATHS[0]);
    if (seat !== undefined) enemy.creditSeat = seat;
    EventBus.emit(GameEvents.ENEMY_KILLED, { enemy, goldReward: enemy.def.bounty });
    return enemy;
  };
  const start = [0, 1, 2, 3].map((s) => economy.goldOf(s));
  const golem = kill(2);
  assert.equal(economy.goldOf(2), start[2] + golem.def.bounty);
  assert.deepEqual([0, 1, 3].map((s) => economy.goldOf(s)), [start[0], start[1], start[3]]);
  assert.deepEqual([0, 1, 2, 3].map((s) => lumber.lumberOf(s)), [0, 0, golem.def.lumberYield, 0]);
  kill();
  assert.equal(economy.goldOf(0), start[0] + golem.def.bounty, 'nobody hit it: seat 0');
  const lives = economy.lives;
  EventBus.emit(GameEvents.ENEMY_REACHED_END, golem);
  assert.equal(economy.lives, lives - golem.def.livesCost);
  outcomes.destroy(); economy.destroy();
  const fresh = new game.Enemy();
  fresh.init('grunt', game.ALL_PATHS[1]);
  assert.equal(fresh.creditSeat, 0, 'a recycled enemy starts without a credited seat');
});

test('Projectile credits its seat BEFORE the damage, because the kill event fires inside takeDamage', () => {
  const credited = [];
  const onKill = (data) => credited.push(data.enemy.creditSeat);
  EventBus.on(GameEvents.ENEMY_KILLED, onKill);
  const target = new game.Enemy();
  target.init('grunt', game.ALL_PATHS[0], { hpMult: 0.01 });
  const bystander = new game.Enemy();
  bystander.init('grunt', game.ALL_PATHS[1], { hpMult: 0.01 });
  bystander.x = target.x + 5; bystander.y = target.y;
  const shot = new game.Projectile();
  shot.init(target.x, target.y, target, 500, 'piercing', 60, 0xffffff, [target, bystander]);
  shot.ownerSeat = 3;
  shot._dealDamage();
  EventBus.off(GameEvents.ENEMY_KILLED, onKill);
  assert.deepEqual(credited, [3, 3], 'splash kills are credited too');
  const reused = new game.Projectile();
  reused.ownerSeat = 2;
  reused.init(0, 0, target, 1, 'piercing', 0, 0xffffff, []);
  assert.equal(reused.ownerSeat, 0, 'a recycled projectile forgets its old seat');
});

function buildWorld(seatCount) {
  GameConfig.setDifficulty('normal');
  game.GameSpeed.reset();
  const handlers = [];
  const chain = () => { const stub = new Proxy(function () {}, { get: (_, key) => (key === 'then' ? undefined : stub), apply: () => stub }); return stub; };
  const scene = { add: { graphics: chain }, tweens: { add: chain },
    input: { on: (name, fn) => { if (name === 'pointerdown') handlers.push(fn); return chain(); }, setDefaultCursor: chain } };
  const click = (col, row) => handlers.forEach((fn) => fn({ x: col * 40 + 20, y: row * 40 + 20, button: 0 }));
  const seats = new game.Seats(seatCount);
  const economy = new game.EconomyManager(seatCount);
  const pool = new game.ObjectPool(() => new game.Projectile(), 8);
  const build = new game.BuildSystem(scene, economy, pool, () => [], () => true, seats);
  const place = (col, row, id = 'arrow_t1') => { build.selectTowerType(id); click(col, row); build.cancelPlacement(); };
  return { seats, economy, build, click, place };
}

test('BuildSystem: a seat builds only in its own zone, pays from its own wallet and owns the tower', () => {
  const { seats, economy, build, place } = buildWorld(4);
  const gold = [0, 1, 2, 3].map((s) => economy.goldOf(s));
  place(5, 5);                                   // zone 0, seat 0 is active
  place(12, 5);                                  // zone 1: not this seat's
  assert.equal(build.towers.length, 1);
  assert.equal(build.towers[0].ownerSeat, 0);
  assert.equal(economy.goldOf(0), gold[0] - 50);
  assert.equal(economy.goldOf(1), gold[1]);
  seats.setActive(1);
  place(12, 5);                                  // now it is
  place(5, 6);                                   // zone 0 again: no
  assert.equal(build.towers.length, 2);
  assert.equal(build.towers[1].ownerSeat, 1);
  assert.equal(economy.goldOf(1), gold[1] - 50);
});

test('BuildSystem: only the owner upgrades or sells, and the refund goes to the owner wallet', () => {
  const { seats, economy, build, place, click } = buildWorld(4);
  economy.addGold(1000, 0);
  economy.addGold(1000, 1);
  place(5, 5);
  const tower = build.towers[0];
  click(5, 5);                                   // select it
  assert.equal(build.selectedTower, tower);
  seats.setActive(1);
  const before = [0, 1, 2, 3].map((s) => economy.goldOf(s));
  build.upgradeSelected('arrow_t2');
  build.sellSelected();
  assert.equal(build.towers.length, 1, 'seat 1 could neither upgrade nor sell seat 0\'s tower');
  assert.equal(build.towers[0], tower);
  assert.deepEqual([0, 1, 2, 3].map((s) => economy.goldOf(s)), before);
  seats.setActive(0);
  click(5, 5);
  build.upgradeSelected('arrow_t2');
  assert.equal(build.towers.length, 1);
  assert.equal(build.towers[0].towerId, 'arrow_t2');
  assert.equal(build.towers[0].ownerSeat, 0, 'an upgrade keeps its owner');
  const gold0 = economy.goldOf(0);
  build.sellSelected();
  assert.equal(build.towers.length, 0);
  assert(economy.goldOf(0) > gold0, 'the refund went to the owner');
  assert.equal(economy.goldOf(1), before[1]);
});

test('BuildSystem: a one-seat game builds anywhere from the single wallet, exactly as before', () => {
  const { economy, build, place } = buildWorld(1);
  const start = economy.gold;
  place(5, 5); place(12, 5); place(12, 14); place(5, 14);
  assert.equal(build.towers.length, 4);
  assert.equal(economy.gold, start - 200);
  assert(build.towers.every((tower) => tower.ownerSeat === 0));
});

test('guard: nothing but the seat-0 shortcut of the managers reads one wallet; code that acts for a seat names it', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!path.endsWith('.ts') || /(EconomyManager|LumberManager)\.ts$/.test(path)) continue;
      const text = readFileSync(path, 'utf8');
      if (/\b_?economy\.gold\b/.test(text) || /\b_?lumber\.lumber\b/.test(text)) offenders.push(path);
    }
  };
  walk('src');
  assert.deepEqual(offenders, [], 'use goldOf(seat) and lumberOf(seat)');
});
