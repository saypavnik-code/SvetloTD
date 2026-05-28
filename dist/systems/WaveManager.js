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
import { WAVES } from '../data/waves';
import { ALL_PATHS } from '../data/pathData';
import { EventBus, GameEvents } from '../utils/EventBus';
const BETWEEN_WAVE_SECS = 20;
export class WaveManager {
    constructor(_scene, pool) {
        Object.defineProperty(this, "_pool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "activeEnemies", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'idle'
        });
        Object.defineProperty(this, "_waveIndex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_countdownSecs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_totalCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_spawnedCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_enemiesRemaining", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // Spawn accumulator — replaces delayedCall
        Object.defineProperty(this, "_spawnAcc", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_spawnInterval", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_spawnCtx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onCountdownTick", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onWaveStart", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onWaveComplete", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onVictory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_onEnemyRemoved", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                if (this.state !== 'fighting' && this.state !== 'spawning')
                    return;
                this._enemiesRemaining = Math.max(0, this._enemiesRemaining - 1);
                if (this._enemiesRemaining <= 0 && this._spawnedCount >= this._totalCount) {
                    this._waveComplete();
                }
            }
        });
        this._pool = pool;
        EventBus.on(GameEvents.ENEMY_KILLED, this._onEnemyRemoved, this);
        EventBus.on(GameEvents.ENEMY_REACHED_END, this._onEnemyRemoved, this);
    }
    get currentWaveData() { return WAVES[this._waveIndex] ?? null; }
    get waveNumber() { return this._waveIndex + 1; }
    get totalWaves() { return WAVES.length; }
    get countdownSecs() { return Math.ceil(this._countdownSecs); }
    startGame() { this._beginCountdown(); }
    skipCountdown() {
        if (this.state !== 'countdown')
            return;
        this._countdownSecs = 0;
    }
    update(dt) {
        // 1. Tick enemies; cull inactive back to pool
        for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
            const e = this.activeEnemies[i];
            if (!e.isActive) {
                this._pool.release(e);
                this.activeEnemies.splice(i, 1);
            }
            else {
                e.update(dt);
            }
        }
        // 2. Countdown
        if (this.state === 'countdown') {
            this._countdownSecs -= dt;
            this.onCountdownTick?.(Math.ceil(Math.max(0, this._countdownSecs)));
            if (this._countdownSecs <= 0)
                this._launchWave();
            return;
        }
        // 3. Spawn phase — accumulate dt, pop enemies when threshold hit
        if (this.state === 'spawning' && this._spawnCtx) {
            this._spawnAcc += dt;
            while (this._spawnAcc >= this._spawnInterval &&
                this._spawnedCount < this._totalCount) {
                this._spawnAcc -= this._spawnInterval;
                this._spawnOneEnemy();
            }
        }
    }
    _beginCountdown() {
        this.state = 'countdown';
        this._countdownSecs = BETWEEN_WAVE_SECS;
        this.onCountdownTick?.(BETWEEN_WAVE_SECS);
    }
    _launchWave() {
        const wave = WAVES[this._waveIndex];
        if (!wave)
            return;
        const paths = wave.paths === -1 ? ALL_PATHS : [ALL_PATHS[wave.paths]];
        this._spawnCtx = {
            enemyType: wave.enemyType,
            paths: paths,
            speedMult: wave.modifier === 'fast' ? 1.5 : 1.0,
            isHealing: wave.modifier === 'healing',
            hpMult: wave.hpMult,
        };
        this.state = 'spawning';
        this._spawnedCount = 0;
        this._totalCount = wave.count;
        this._enemiesRemaining = wave.count;
        this._spawnInterval = wave.interval;
        // Pre-charge so first enemy fires on frame 1 of the wave
        this._spawnAcc = wave.interval;
        this.onWaveStart?.(wave);
        EventBus.emit(GameEvents.BUILD_PHASE_END); // combat begins → 70% sell
        EventBus.emit(GameEvents.WAVE_STARTED, this._waveIndex + 1);
    }
    _spawnOneEnemy() {
        const ctx = this._spawnCtx;
        if (!ctx || this.state === 'victory')
            return;
        const waypoints = ctx.paths[this._spawnedCount % ctx.paths.length];
        const enemy = this._pool.get();
        enemy.init(ctx.enemyType, waypoints, {
            hpMult: ctx.hpMult,
            speedMult: ctx.speedMult,
            isHealing: ctx.isHealing,
        });
        this.activeEnemies.push(enemy);
        this._spawnedCount++;
        EventBus.emit(GameEvents.ENEMY_SPAWNED, enemy);
        if (this._spawnedCount >= this._totalCount) {
            this.state = 'fighting';
            this._spawnCtx = null;
        }
    }
    _waveComplete() {
        if (this.state === 'victory')
            return;
        const wave = WAVES[this._waveIndex];
        // NOTE: InterestSystem now handles bonusGold calculation from WaveData.
        // The old local bonus/earlyBonus logic is removed — InterestSystem takes
        // EARLY_BONUS via the earlyBonus flag emitted below if needed.
        this.onWaveComplete?.(wave, wave.bonusGold);
        // Pass waveNumber (1-based) AND WaveData so InterestSystem can read bonusGold
        EventBus.emit(GameEvents.WAVE_COMPLETED, this._waveIndex + 1, wave);
        // Build phase begins — no enemies on field → 100% sell refund
        EventBus.emit(GameEvents.BUILD_PHASE_START);
        this._waveIndex++;
        if (this._waveIndex >= WAVES.length) {
            this.state = 'victory';
            this.onVictory?.();
            EventBus.emit(GameEvents.GAME_OVER, { victory: true });
            return;
        }
        this._beginCountdown();
    }
    destroy() {
        EventBus.off(GameEvents.ENEMY_KILLED, this._onEnemyRemoved, this);
        EventBus.off(GameEvents.ENEMY_REACHED_END, this._onEnemyRemoved, this);
    }
}
