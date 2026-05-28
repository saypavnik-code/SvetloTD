// ─────────────────────────────────────────────────────────────────────────────
// difficulty.ts — Difficulty presets. Single source of truth.
// Phase 2: referenced by InterestSystem, WaveManager spawn, EnemyDef scaling.
// ─────────────────────────────────────────────────────────────────────────────

export type DifficultyId = 'normal' | 'hard' | 'insane';

export interface DifficultyConfig {
  id:              DifficultyId;
  label:           string;
  enemyHpMult:     number;   // applied on top of wave hpMult
  enemySpeedMult:  number;
  interestRate:    number;   // fraction of unspent gold awarded per wave
  waveBonusBase:   number;   // flat gold at wave completion
  waveBonusScale:  number;   // +N per wave number
  startingGold:    number;
}

export const DIFFICULTY_PRESETS: Record<DifficultyId, DifficultyConfig> = {
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
  private _difficulty: DifficultyConfig = DIFFICULTY_PRESETS.normal;

  get difficulty(): DifficultyConfig { return this._difficulty; }

  setDifficulty(id: DifficultyId): void {
    this._difficulty = DIFFICULTY_PRESETS[id];
  }
}

export const GameConfig = new GameConfigClass();