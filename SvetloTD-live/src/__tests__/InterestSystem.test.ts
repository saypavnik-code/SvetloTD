// InterestSystem.test.ts
jest.mock('../utils/EventBus', () => ({
  EventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
  GameEvents: {
    WAVE_COMPLETED:    'wave:completed',
    LUMBER_CHANGED:    'lumber:changed',
    INTEREST_AWARDED:  'interest:awarded',
    WAVE_BONUS_AWARDED:'wavebonus:awarded',
    GOLD_CHANGED:      'gold:changed',
    LIVES_CHANGED:     'lives:changed',
    GAME_OVER:         'game:over',
    BUILD_PHASE_START: 'build:phase:start',
    BUILD_PHASE_END:   'build:phase:end',
  },
}));
jest.mock('../config/difficulty', () => ({
  GameConfig: {
    difficulty: {
      startingGold: 150, interestRate: 0.05,
      waveBonusBase: 15, waveBonusScale: 3,
    },
  },
}));
jest.mock('../config', () => ({ STARTING_LIVES: 20 }));

import { EconomyManager } from '../systems/EconomyManager';
import { LumberManager }  from '../systems/LumberManager';
import { InterestSystem } from '../systems/InterestSystem';
import { EventBus, GameEvents } from '../utils/EventBus';

type WaveDataLike = { wave: number; bonusGold: number };

describe('InterestSystem', () => {
  let eco:     EconomyManager;
  let lumber:  LumberManager;
  let onWaveCompleted: (waveNum: number, data: WaveDataLike) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    eco    = new EconomyManager();
    lumber = new LumberManager();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _sys = new InterestSystem(eco, lumber);
    // Capture WAVE_COMPLETED handler
    const calls = (EventBus.on as jest.Mock).mock.calls;
    const match = calls.find(([evt]: [string]) => evt === GameEvents.WAVE_COMPLETED);
    onWaveCompleted = match?.[1];
  });

  describe('Gold interest (5% of current gold)', () => {
    it('awards floor(150 × 0.05) = 7 interest on wave 1', () => {
      onWaveCompleted(1, { wave: 1, bonusGold: 0 });
      expect(EventBus.emit).toHaveBeenCalledWith(GameEvents.INTEREST_AWARDED, 7);
    });
    it('does not award interest if gold is 0', () => {
      // Drain all gold
      jest.clearAllMocks();
      eco.spendGold(150);
      onWaveCompleted(1, { wave: 1, bonusGold: 0 });
      expect(EventBus.emit).not.toHaveBeenCalledWith(GameEvents.INTEREST_AWARDED, expect.any(Number));
    });
  });

  describe('Wave completion bonus', () => {
    it('wave 1 bonus = base(15) + 1×scale(3) = 18', () => {
      onWaveCompleted(1, { wave: 1, bonusGold: 0 });
      expect(EventBus.emit).toHaveBeenCalledWith(GameEvents.WAVE_BONUS_AWARDED, 18);
    });
    it('wave 5 bonus = 15 + 5×3 = 30', () => {
      onWaveCompleted(5, { wave: 5, bonusGold: 0 });
      expect(EventBus.emit).toHaveBeenCalledWith(GameEvents.WAVE_BONUS_AWARDED, 30);
    });
    it('wave 10 bonus = 15 + 10×3 = 45', () => {
      onWaveCompleted(10, { wave: 10, bonusGold: 0 });
      expect(EventBus.emit).toHaveBeenCalledWith(GameEvents.WAVE_BONUS_AWARDED, 45);
    });
    it('uses waveData.bonusGold if higher than formula (boss wave 200g)', () => {
      onWaveCompleted(1, { wave: 1, bonusGold: 200 });
      expect(EventBus.emit).toHaveBeenCalledWith(GameEvents.WAVE_BONUS_AWARDED, 200);
    });
    it('uses formula if higher than waveData.bonusGold', () => {
      onWaveCompleted(10, { wave: 10, bonusGold: 5 }); // formula=45 wins
      expect(EventBus.emit).toHaveBeenCalledWith(GameEvents.WAVE_BONUS_AWARDED, 45);
    });
  });

  describe('Lumber every 5 waves', () => {
    it('awards +1 lumber on wave 5', () => {
      onWaveCompleted(5, { wave: 5, bonusGold: 0 });
      expect(lumber.lumber).toBe(1);
    });
    it('awards +1 lumber on wave 10', () => {
      onWaveCompleted(5, { wave: 5, bonusGold: 0 });
      onWaveCompleted(10, { wave: 10, bonusGold: 0 });
      expect(lumber.lumber).toBe(2);
    });
    it('does NOT award lumber on non-multiples of 5', () => {
      onWaveCompleted(1, { wave: 1, bonusGold: 0 });
      onWaveCompleted(3, { wave: 3, bonusGold: 0 });
      onWaveCompleted(7, { wave: 7, bonusGold: 0 });
      expect(lumber.lumber).toBe(0);
    });
    it('awards lumber on wave 20 (end game)', () => {
      onWaveCompleted(20, { wave: 20, bonusGold: 0 });
      expect(lumber.lumber).toBe(1);
    });
  });
});
