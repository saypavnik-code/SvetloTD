// ─────────────────────────────────────────────────────────────────────────────
// difficulty.ts — Difficulty presets. Single source of truth.
// Phase 2: referenced by InterestSystem, WaveManager spawn, EnemyDef scaling.
// ─────────────────────────────────────────────────────────────────────────────

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'insane';
export const DIFFICULTY_IDS: readonly DifficultyId[] = ['easy', 'normal', 'hard', 'insane'];

export interface DifficultyConfig {
  id:              DifficultyId;
  label:           string;
  enemyHpMult:     number;   // applied on top of wave hpMult
  enemySpeedMult:  number;
  interestRate:    number;   // fraction of unspent gold awarded per wave
  waveBonusMult:   number;   // multiplies WaveData.bonusGold, rounded, paid at wave completion
  startingGold:    number;
  /** The one pool of lives the whole team shares, whatever the number of seats (the original: 50 / 25 / 1 / 1). */
  startingLives:   number;
  /** Expert: the order of the waves inside every block of five is shuffled (the milestone wave of a block stays last). */
  randomWaves:     boolean;
  /** One line for the menu. */
  blurb:           string;
}

// v0.21.0 (Burbenog track step B5): the lives of the original (easy 50, normal 25, hard 1, expert 1 with random waves). The lives are
// one pool for the team and do not depend on the number of seats: the gold is already split between the seats without loss and the
// waves do not grow with the seat count, so the total of both stays equal for one, two and four players. In the original the modes differ
// by lives (and the expert wave order) only, so hard and expert no longer multiply enemy HP and speed; their gold, interest and bonus
// handicaps (an owner decision of 2026-10-11) stay.
export const DIFFICULTY_PRESETS: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy', label: 'Легко',
    enemyHpMult: 1.0, enemySpeedMult: 1.0,
    interestRate: 0.05,
    waveBonusMult: 1.0,
    startingGold: 300,
    startingLives: 50, randomWaves: false,
    blurb: '50 жизней. Волны и экономика как на «Нормально».',
  },
  normal: {
    id: 'normal', label: 'Нормально',
    enemyHpMult: 1.0, enemySpeedMult: 1.0,
    interestRate: 0.05,
    waveBonusMult: 1.0,
    startingGold: 300,
    startingLives: 25, randomWaves: false,
    blurb: '25 жизней, как в оригинале.',
  },
  hard: {
    id: 'hard', label: 'Сложно',
    enemyHpMult: 1.0, enemySpeedMult: 1.0,   // v0.21.0: was 1.6 / 1.15; with one life it killed every catalogued build in waves 3-7
    interestRate: 0.03,
    waveBonusMult: 0.8,
    startingGold: 260,
    startingLives: 1, randomWaves: false,
    blurb: 'Одна жизнь. Любая утечка — конец.',
  },
  insane: {
    id: 'insane', label: 'Эксперт',
    enemyHpMult: 1.0, enemySpeedMult: 1.0,   // v0.21.0: was 2.8 / 1.3; with one life it killed every catalogued build in wave 1
    interestRate: 0.01,
    waveBonusMult: 0.6,
    startingGold: 200,
    startingLives: 1, randomWaves: true,
    blurb: 'Одна жизнь и случайный порядок волн.',
  },
};

/** localStorage key of the best result of a difficulty (normal keeps the key of earlier versions): the records of the modes never mix. */
export function bestResultKey(id: DifficultyId): string { return id === 'normal' ? 'best_result' : `best_result_${id}`; }

/** `?difficulty=easy|normal|hard|insane` (`expert` is the original's name for insane); null when absent or unknown. */
export function parseDifficulty(search: string): DifficultyId | null {
  const raw = new URLSearchParams(search).get('difficulty')?.trim().toLowerCase();
  if (raw === 'expert') return 'insane';
  return (DIFFICULTY_IDS as readonly string[]).includes(raw ?? '') ? raw as DifficultyId : null;
}

// ── Runtime singleton — holds the active choice ───────────────────────────────
class GameConfigClass {
  private _difficulty: DifficultyConfig = DIFFICULTY_PRESETS.normal;

  get difficulty(): DifficultyConfig { return this._difficulty; }

  setDifficulty(id: DifficultyId): void {
    this._difficulty = DIFFICULTY_PRESETS[id];
  }
}

export const GameConfig = new GameConfigClass();
