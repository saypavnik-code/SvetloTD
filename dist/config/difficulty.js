// ─────────────────────────────────────────────────────────────────────────────
// difficulty.ts — Difficulty presets. Single source of truth.
// Phase 2: referenced by InterestSystem, WaveManager spawn, EnemyDef scaling.
// ─────────────────────────────────────────────────────────────────────────────
export const DIFFICULTY_PRESETS = {
    normal: {
        id: 'normal', label: 'Нормально',
        enemyHpMult: 1.0, enemySpeedMult: 1.0,
        interestRate: 0.05,
        waveBonusBase: 15, waveBonusScale: 3,
        startingGold: 150,
    },
    hard: {
        id: 'hard', label: 'Сложно',
        enemyHpMult: 1.6, enemySpeedMult: 1.15,
        interestRate: 0.03,
        waveBonusBase: 10, waveBonusScale: 2,
        startingGold: 130,
    },
    insane: {
        id: 'insane', label: 'Безумие',
        enemyHpMult: 2.8, enemySpeedMult: 1.3,
        interestRate: 0.01,
        waveBonusBase: 5, waveBonusScale: 1,
        startingGold: 100,
    },
};
// ── Runtime singleton — holds the active choice ───────────────────────────────
class GameConfigClass {
    constructor() {
        Object.defineProperty(this, "_difficulty", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: DIFFICULTY_PRESETS.normal
        });
    }
    get difficulty() { return this._difficulty; }
    setDifficulty(id) {
        this._difficulty = DIFFICULTY_PRESETS[id];
    }
}
export const GameConfig = new GameConfigClass();
