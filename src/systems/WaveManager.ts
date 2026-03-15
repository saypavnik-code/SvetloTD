// ─────────────────────────────────────────────────────────────────────────────
// WaveManager.ts — Stage 9.
//
// BugFix 2: spawn timing is now driven by the game-speed-adjusted dt
// accumulator instead of Phaser.time.delayedCall (which ran in wall-clock
// time, making spawns appear slow at x2/x3 speed).
//
// New approach:
//   _spawnAcc accumulates adjusted seconds each update().
//   When _spawnAcc >= _spawnInterval a new enemy is emitted immediately.
//   At x3 speed dt is 3× larger → enemies spawn 3× faster → correct.
//
// The Phaser scene reference is no longer needed and has been removed.
// ─────────────────────────────────────────────────────────────────────────────

import type { EnemyId } from '../data/enemies';
import type { Waypoint } from '../data/pathData';
import { Enemy }                from '../entities/Enemy';
import { WAVES, type WaveData } from '../data/waves';
import { ALL_PATHS }            from '../data/pathData';
import { ObjectPool }           from '../utils/ObjectPool';
import { EventBus, GameEvents } from '../utils/EventBus';

export type WaveState = 'idle' | 'countdown' | 'spawning' | 'fighting' | 'victory';

const BETWEEN_WAVE_SECS = 20;
const EARLY_BONUS_MULT  = 1.2;

interface SpawnContext {
  enemyType:  EnemyId;
  paths:      Waypoint[][];
  speedMult:  number;
  isHealing:  boolean;
  hpMult:     number;
}

export class WaveManager {
  private readonly _pool: ObjectPool<Enemy>;

  readonly activeEnemies: Enemy[] = [];
  state: WaveState = 'idle';

  private _waveIndex        = 0;
  private _countdownSecs    = 0;
  private _totalCount       = 0;
  private _spawnedCount     = 0;
  private _enemiesRemaining = 0;
  private _earlyBonus       = false;

  // Spawn accumulator — replaces delayedCall
  private _spawnAcc      = 0;
  private _spawnInterval = 0;
  private _spawnCtx: SpawnContext | null = null;

  onCountdownTick?: (secsLeft: number) => void;
  onWaveStart?:     (wave: WaveData) => void;
  onWaveComplete?:  (wave: WaveData, bonusGold: number) => void;
  onVictory?:       () => void;

  constructor(_scene: unknown, pool: ObjectPool<Enemy>) {
    this._pool = pool;
    EventBus.on(GameEvents.ENEMY_KILLED,      this._onEnemyRemoved, this);
    EventBus.on(GameEvents.ENEMY_REACHED_END, this._onEnemyRemoved, this);
  }

  get currentWaveData(): WaveData | null { return WAVES[this._waveIndex] ?? null; }
  get waveNumber():  number { return this._waveIndex + 1; }
  get totalWaves():  number { return WAVES.length; }
  get countdownSecs(): number { return Math.ceil(this._countdownSecs); }

  startGame(): void { this._beginCountdown(); }

  skipCountdown(): void {
    if (this.state !== 'countdown') return;
    this._earlyBonus    = true;
    this._countdownSecs = 0;
  }

  update(dt: number): void {
    // 1. Tick enemies; cull inactive back to pool
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const e = this.activeEnemies[i];
      if (!e.isActive) {
        this._pool.release(e);
        this.activeEnemies.splice(i, 1);
      } else {
        e.update(dt);
      }
    }

    // 2. Countdown
    if (this.state === 'countdown') {
      this._countdownSecs -= dt;
      this.onCountdownTick?.(Math.ceil(Math.max(0, this._countdownSecs)));
      if (this._countdownSecs <= 0) this._launchWave();
      return;
    }

    // 3. Spawn phase — accumulate dt, pop enemies when threshold hit
    if (this.state === 'spawning' && this._spawnCtx) {
      this._spawnAcc += dt;
      while (
        this._spawnAcc >= this._spawnInterval &&
        this._spawnedCount < this._totalCount
      ) {
        this._spawnAcc -= this._spawnInterval;
        this._spawnOneEnemy();
      }
    }
  }

  private _onEnemyRemoved = (): void => {
    if (this.state !== 'fighting' && this.state !== 'spawning') return;
    this._enemiesRemaining = Math.max(0, this._enemiesRemaining - 1);
    if (this._enemiesRemaining <= 0 && this._spawnedCount >= this._totalCount) {
      this._waveComplete();
    }
  };

  private _beginCountdown(): void {
    this.state          = 'countdown';
    this._countdownSecs = BETWEEN_WAVE_SECS;
    this._earlyBonus    = false;
    this.onCountdownTick?.(BETWEEN_WAVE_SECS);
  }

  private _launchWave(): void {
    const wave = WAVES[this._waveIndex];
    if (!wave) return;

    const paths = wave.paths === -1 ? ALL_PATHS : [ALL_PATHS[wave.paths]];

    this._spawnCtx = {
      enemyType:  wave.enemyType,
      paths:      paths as Waypoint[][],
      speedMult:  wave.modifier === 'fast' ? 1.5 : 1.0,
      isHealing:  wave.modifier === 'healing',
      hpMult:     wave.hpMult,
    };

    this.state             = 'spawning';
    this._spawnedCount     = 0;
    this._totalCount       = wave.count;
    this._enemiesRemaining = wave.count;
    this._spawnInterval    = wave.interval;
    // Pre-charge so first enemy fires on frame 1 of the wave
    this._spawnAcc         = wave.interval;

    this.onWaveStart?.(wave);
    EventBus.emit(GameEvents.WAVE_STARTED, this._waveIndex + 1);
  }

  private _spawnOneEnemy(): void {
    const ctx = this._spawnCtx;
    if (!ctx || this.state === 'victory') return;

    const waypoints = ctx.paths[this._spawnedCount % ctx.paths.length];
    const enemy     = this._pool.get();

    enemy.init(ctx.enemyType, waypoints, {
      hpMult:    ctx.hpMult,
      speedMult: ctx.speedMult,
      isHealing: ctx.isHealing,
    });
    this.activeEnemies.push(enemy);
    this._spawnedCount++;

    EventBus.emit(GameEvents.ENEMY_SPAWNED, enemy);

    if (this._spawnedCount >= this._totalCount) {
      this.state     = 'fighting';
      this._spawnCtx = null;
    }
  }

  private _waveComplete(): void {
    if (this.state === 'victory') return;
    const wave  = WAVES[this._waveIndex];
    const bonus = this._earlyBonus
      ? Math.round(wave.bonusGold * EARLY_BONUS_MULT)
      : wave.bonusGold;

    this.onWaveComplete?.(wave, bonus);
    EventBus.emit(GameEvents.WAVE_COMPLETED, this._waveIndex + 1);
    this._waveIndex++;

    if (this._waveIndex >= WAVES.length) {
      this.state = 'victory';
      this.onVictory?.();
      EventBus.emit(GameEvents.GAME_OVER, { victory: true });
      return;
    }
    this._beginCountdown();
  }

  destroy(): void {
    EventBus.off(GameEvents.ENEMY_KILLED,      this._onEnemyRemoved, this);
    EventBus.off(GameEvents.ENEMY_REACHED_END, this._onEnemyRemoved, this);
  }
}
