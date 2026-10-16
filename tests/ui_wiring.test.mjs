import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/ui/WaveInfo.ts',
  'src/systems/WaveManager.ts',
  'src/systems/EconomyManager.ts',
  'src/systems/EnemyOutcomes.ts',
  'src/systems/InterestSystem.ts',
  'src/systems/LumberManager.ts',
  'src/entities/Enemy.ts',
  'src/data/waves.ts',
  'src/config/difficulty.ts',
  'src/utils/ObjectPool.ts',
  'src/utils/EventBus.ts',
);
const { EventBus, GameEvents, GameConfig, WAVES, DIFFICULTY_PRESETS } = game;

// Chainable stand-in for the Phaser scene: enough for UI classes that only build display objects.
const chain = () => {
  const stub = new Proxy(function () {}, { get: (_, key) => (key === 'then' ? undefined : stub), apply: () => stub });
  return stub;
};
const scene = {
  add: new Proxy({}, { get: () => chain }),
  tweens: { add: chain },
  time: { delayedCall: chain },
  input: { on: chain, setDefaultCursor: chain },
  cameras: { main: chain() },
};

// Plays wave 1 to its clear with the REAL WaveInfo wired to the WaveManager, exactly as GameScene does.
// Kill bounties are credited by the real EnemyOutcomes, registered right after WaveManager as in GameScene.
function playWaveOne(difficulty) {
  GameConfig.setDifficulty(difficulty);
  const economy = new game.EconomyManager();
  const lumber = new game.LumberManager();
  const interest = new game.InterestSystem(economy, lumber);
  const pool = new game.ObjectPool(() => new game.Enemy(), 16);
  const waves = new game.WaveManager(null, pool);
  const outcomes = new game.EnemyOutcomes(economy, lumber);
  // The third argument is ignored once WaveInfo no longer needs the economy.
  const info = new game.WaveInfo(scene, waves, economy);
  const start = economy.gold;
  const seen = { bounty: 0, interest: 0, bonus: 0, cleared: false };
  const handlers = [
    [GameEvents.ENEMY_KILLED, ({ goldReward }) => { seen.bounty += goldReward; }],
    [GameEvents.INTEREST_AWARDED, (amount) => { seen.interest += amount; }],
    [GameEvents.WAVE_BONUS_AWARDED, (amount) => { seen.bonus += amount; }],
    [GameEvents.WAVE_COMPLETED, () => { seen.cleared = true; }],
  ];
  for (const [event, handler] of handlers) EventBus.on(event, handler);
  try {
    waves.startGame();
    for (let step = 0; step < 100000 && !seen.cleared; step++) {
      waves.update(0.1);
      for (const enemy of waves.activeEnemies) if (enemy.isActive && !enemy.isDead) enemy.takeDamage(1e9, 'chaos');
    }
    assert(seen.cleared, 'wave 1 never cleared');
    return { start, gold: economy.gold, seen, info };
  } finally {
    for (const [event, handler] of handlers) EventBus.off(event, handler);
    waves.destroy(); outcomes.destroy(); interest.destroy(); economy.destroy();
    GameConfig.setDifficulty('normal');
  }
}

test('the wave bonus is paid once, scaled by difficulty, with the real WaveInfo wired in', () => {
  for (const difficulty of Object.keys(DIFFICULTY_PRESETS)) {
    const { start, gold, seen } = playWaveOne(difficulty);
    const expectedBonus = Math.round(WAVES[0].bonusGold * DIFFICULTY_PRESETS[difficulty].waveBonusMult);
    assert.equal(seen.bonus, expectedBonus, `${difficulty}: reported wave bonus`);
    // Every unit of gold has to be explained by a reported event: no silent payout from UI code.
    assert.equal(gold, start + seen.bounty + seen.interest + seen.bonus, `${difficulty}: gold ledger after wave 1`);
  }
});

// ── Ownership guard ─────────────────────────────────────────────────────────

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

test('UI components never change gold, lives or lumber (the economy systems own them)', () => {
  const offenders = sourceFiles('src/ui').filter((file) => /\.(addGold|spendGold|loseLife)\(|umber\w*\.(add|spend)\(/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});

// ── Findings that need an owner decision ────────────────────────────────────

test('starting a wave early pays the bonus printed on the button', { todo: 'owner decision needed: WaveInfo prints "+N" on the start-now button (round(bonusGold x 1.2)) but no system pays an early-start bonus' }, () => {
  const economy = new game.EconomyManager();
  const lumber = new game.LumberManager();
  const interest = new game.InterestSystem(economy, lumber);
  const pool = new game.ObjectPool(() => new game.Enemy(), 16);
  const waves = new game.WaveManager(null, pool);
  try {
    const before = economy.gold;
    waves.startGame();
    waves.skipCountdown();
    waves.update(0.1);
    const printed = Math.round(WAVES[0].bonusGold * 1.2);
    assert.equal(economy.gold, before + printed, 'no early-start bonus is paid');
  } finally {
    waves.destroy(); interest.destroy(); economy.destroy();
  }
});
