// DamageCalculator.test.ts — values verified against damageMatrix.ts
import { DamageCalculator } from '../systems/DamageCalculator';

const calc = new DamageCalculator();

describe('DamageCalculator', () => {

  describe('Piercing vs armor types', () => {
    it('deals 100% vs unarmored (×1.0)', () => {
      expect(calc.calculate(10, 'piercing', 'unarmored')).toBe(10);
    });
    it('deals 200% vs light (×2.0)', () => {
      expect(calc.calculate(10, 'piercing', 'light')).toBe(20);
    });
    it('deals 75% vs medium (×0.75 → rounds to 8)', () => {
      expect(calc.calculate(10, 'piercing', 'medium')).toBe(8);
    });
    it('deals 100% vs heavy (×1.0)', () => {
      expect(calc.calculate(10, 'piercing', 'heavy')).toBe(10);
    });
    it('deals 35% vs fortified (×0.35 → rounds to 4)', () => {
      expect(calc.calculate(10, 'piercing', 'fortified')).toBe(4);
    });
  });

  describe('Chaos damage', () => {
    it('deals 100% vs all armor types (×1.0 universal)', () => {
      const armors = ['unarmored','light','medium','heavy','fortified','heroic'] as const;
      for (const armor of armors) {
        expect(calc.calculate(10, 'chaos', armor)).toBe(10);
      }
    });
  });

  describe('Magic vs armor', () => {
    it('deals 100% vs unarmored (×1.0)', () => {
      expect(calc.calculate(100, 'magic', 'unarmored')).toBe(100);
    });
    it('deals 200% vs heavy (×2.0)', () => {
      expect(calc.calculate(100, 'magic', 'heavy')).toBe(200);
    });
    it('deals 125% vs light (×1.25)', () => {
      expect(calc.calculate(100, 'magic', 'light')).toBe(125);
    });
  });

  describe('Siege vs armor', () => {
    it('deals 150% vs fortified (×1.5)', () => {
      expect(calc.calculate(100, 'siege', 'fortified')).toBe(150);
    });
    it('deals 50% vs light (×0.5)', () => {
      expect(calc.calculate(100, 'siege', 'light')).toBe(50);
    });
  });

  describe('Armor reduction stacking', () => {
    it('5 stacks add 25% bonus (×1.25) multiplicatively', () => {
      const base    = calc.calculate(100, 'magic', 'light');     // 125
      const boosted = calc.calculate(100, 'magic', 'light', 5);  // 125 × 1.25 = 156
      expect(base).toBe(125);
      expect(boosted).toBe(156);
    });
    it('minimum damage is always at least 1', () => {
      expect(calc.calculate(1, 'normal', 'fortified')).toBeGreaterThanOrEqual(1);
    });
    it('10 stacks gives 50% bonus', () => {
      const base    = calc.calculate(100, 'piercing', 'unarmored');     // 100
      const boosted = calc.calculate(100, 'piercing', 'unarmored', 10); // 150
      expect(boosted).toBe(150);
    });
  });

  describe('Normal damage', () => {
    it('deals 150% vs medium (×1.5)', () => {
      expect(calc.calculate(100, 'normal', 'medium')).toBe(150);
    });
    it('deals 70% vs fortified (×0.7 → 70)', () => {
      expect(calc.calculate(100, 'normal', 'fortified')).toBe(70);
    });
  });

});
