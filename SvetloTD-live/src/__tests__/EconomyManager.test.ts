// EconomyManager.test.ts
jest.mock('../utils/EventBus', () => ({
  EventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
  GameEvents: {
    GOLD_CHANGED:      'gold:changed',
    LIVES_CHANGED:     'lives:changed',
    GAME_OVER:         'game:over',
    BUILD_PHASE_START: 'build:phase:start',
    BUILD_PHASE_END:   'build:phase:end',
  },
}));
jest.mock('../config/difficulty', () => ({
  GameConfig: { difficulty: { startingGold: 150 } },
}));
jest.mock('../config', () => ({ STARTING_LIVES: 20 }));

import { EconomyManager } from '../systems/EconomyManager';
import { EventBus, GameEvents } from '../utils/EventBus';

describe('EconomyManager', () => {
  let eco: EconomyManager;
  let buildStartHandler: () => void;
  let buildEndHandler: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    eco = new EconomyManager();
    // Capture registered event handlers
    const calls = (EventBus.on as jest.Mock).mock.calls;
    const startCall = calls.find(([evt]: [string]) => evt === GameEvents.BUILD_PHASE_START);
    const endCall   = calls.find(([evt]: [string]) => evt === GameEvents.BUILD_PHASE_END);
    buildStartHandler = startCall?.[1];
    buildEndHandler   = endCall?.[1];
  });

  describe('gold', () => {
    it('starts at configured amount (150)', () => {
      expect(eco.gold).toBe(150);
    });
    it('addGold increases gold and emits GOLD_CHANGED', () => {
      eco.addGold(50);
      expect(eco.gold).toBe(200);
      expect(EventBus.emit).toHaveBeenCalledWith(GameEvents.GOLD_CHANGED, 200);
    });
    it('spendGold deducts and returns true when sufficient', () => {
      expect(eco.spendGold(50)).toBe(true);
      expect(eco.gold).toBe(100);
      expect(EventBus.emit).toHaveBeenCalledWith(GameEvents.GOLD_CHANGED, 100);
    });
    it('spendGold returns false and does not change gold when insufficient', () => {
      expect(eco.spendGold(200)).toBe(false);
      expect(eco.gold).toBe(150);
    });
    it('addGold then spendGold works correctly', () => {
      eco.addGold(100);
      eco.spendGold(80);
      expect(eco.gold).toBe(170);
    });
  });

  describe('lives', () => {
    it('starts at 20', () => {
      expect(eco.lives).toBe(20);
    });
    it('loseLife(1) decrements and emits LIVES_CHANGED', () => {
      eco.loseLife();
      expect(eco.lives).toBe(19);
      expect(EventBus.emit).toHaveBeenCalledWith(GameEvents.LIVES_CHANGED, 19);
    });
    it('loseLife(3) decrements by 3', () => {
      eco.loseLife(3);
      expect(eco.lives).toBe(17);
    });
    it('emits GAME_OVER when lives reach 0', () => {
      for (let i = 0; i < 20; i++) eco.loseLife();
      expect(eco.lives).toBe(0);
      expect(EventBus.emit).toHaveBeenCalledWith(GameEvents.GAME_OVER, { victory: false });
    });
    it('lives never go below 0', () => {
      for (let i = 0; i < 30; i++) eco.loseLife();
      expect(eco.lives).toBe(0);
    });
  });

  describe('sellRefundRate', () => {
    it('defaults to 0.7 (combat rate)', () => {
      expect(eco.sellRefundRate).toBe(0.7);
    });
    it('switches to 1.0 after BUILD_PHASE_START', () => {
      buildStartHandler?.();
      expect(eco.sellRefundRate).toBe(1.0);
    });
    it('reverts to 0.7 after BUILD_PHASE_END', () => {
      buildStartHandler?.();
      buildEndHandler?.();
      expect(eco.sellRefundRate).toBe(0.7);
    });
  });
});
