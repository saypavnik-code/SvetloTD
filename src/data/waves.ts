// ─────────────────────────────────────────────────────────────────────────────
// waves.ts — All 40 wave definitions (20 hand-made, 20 generated), shaped by WAVE_TAPER and WAVE_BONUS_FACTOR.
// ─────────────────────────────────────────────────────────────────────────────

import type { EnemyId } from './enemies';

export type WaveModifier = 'fast' | 'healing' | null;

export interface WaveData {
  wave:       number;
  enemyType:  EnemyId;
  count:      number;
  interval:   number;   // seconds between spawns
  hpMult:     number;   // HP multiplier applied at spawn
  paths:      number;   // -1 = distribute across all 4
  isBoss:     boolean;
  modifier:   WaveModifier;
  bonusGold:  number;   // rewarded when wave clears
  preview:    string;   // shown in wave-incoming banner
}

const EARLY_WAVES: WaveData[] = [
  // ── Phase 1: Tutorial ─────────────────────────────────────────────────────
  { wave:1,  enemyType:'grunt',        count:8,  interval:1.0, hpMult:1.0, paths:-1, isBoss:false, modifier:null,      bonusGold:20,  preview:'Гоблины-разведчики' },
  { wave:2,  enemyType:'grunt',        count:10, interval:0.9, hpMult:1.2, paths:-1, isBoss:false, modifier:null,      bonusGold:25,  preview:'Больше гоблинов' },
  { wave:3,  enemyType:'runner',       count:15, interval:0.5, hpMult:1.0, paths:-1, isBoss:false, modifier:null,      bonusGold:25,  preview:'Быстрые бегуны!' },
  { wave:4,  enemyType:'grunt',        count:12, interval:0.8, hpMult:1.5, paths:-1, isBoss:false, modifier:null,      bonusGold:30,  preview:'Закалённые гоблины' },
  { wave:5,  enemyType:'golem',        count:3,  interval:2.0, hpMult:1.0, paths:-1, isBoss:false, modifier:null,      bonusGold:40,  preview:'Тяжёлые големы' },

  // ── Phase 2: Air ──────────────────────────────────────────────────────────
  { wave:6,  enemyType:'grunt',        count:14, interval:0.7, hpMult:2.0, paths:-1, isBoss:false, modifier:null,      bonusGold:35,  preview:'Усиленные гоблины' },
  { wave:7,  enemyType:'wyvern',       count:8,  interval:1.0, hpMult:1.0, paths:-1, isBoss:false, modifier:null,      bonusGold:40,  preview:'⚠ ВОЗДУХ: Виверны' },
  { wave:8,  enemyType:'runner',       count:20, interval:0.4, hpMult:1.5, paths:-1, isBoss:false, modifier:'fast',    bonusGold:40,  preview:'Очень быстрый рой' },
  { wave:9,  enemyType:'golem',        count:5,  interval:1.5, hpMult:1.5, paths:-1, isBoss:false, modifier:null,      bonusGold:45,  preview:'Отряд големов' },
  { wave:10, enemyType:'boss_goliath', count:1,  interval:0,   hpMult:1.0, paths:0,  isBoss:true,  modifier:null,      bonusGold:100, preview:'💀 БОСС: Каменный Голиаф' },

  // ── Phase 3: Escalation ───────────────────────────────────────────────────
  { wave:11, enemyType:'grunt',        count:18, interval:0.5, hpMult:3.0, paths:-1, isBoss:false, modifier:'healing', bonusGold:50,  preview:'Гоблины с регенерацией' },
  { wave:12, enemyType:'wyvern',       count:12, interval:0.7, hpMult:2.0, paths:-1, isBoss:false, modifier:null,      bonusGold:50,  preview:'⚠ Стая виверн' },
  { wave:13, enemyType:'runner',       count:30, interval:0.3, hpMult:2.0, paths:-1, isBoss:false, modifier:'fast',    bonusGold:55,  preview:'Безумный рой' },
  { wave:14, enemyType:'golem',        count:8,  interval:1.2, hpMult:2.5, paths:-1, isBoss:false, modifier:null,      bonusGold:60,  preview:'Тяжёлая бронетехника' },
  { wave:15, enemyType:'boss_goliath', count:1,  interval:0,   hpMult:2.5, paths:1,  isBoss:true,  modifier:null,      bonusGold:120, preview:'💀 БОСС: Древний Голиаф' },

  // ── Phase 4: Chaos ────────────────────────────────────────────────────────
  { wave:16, enemyType:'grunt',        count:25, interval:0.4, hpMult:5.0, paths:-1, isBoss:false, modifier:'healing', bonusGold:70,  preview:'Элитные гоблины' },
  { wave:17, enemyType:'wyvern',       count:15, interval:0.5, hpMult:4.0, paths:-1, isBoss:false, modifier:'fast',    bonusGold:75,  preview:'⚠ Быстрые виверны!' },
  { wave:18, enemyType:'golem',        count:12, interval:0.8, hpMult:4.0, paths:-1, isBoss:false, modifier:null,      bonusGold:80,  preview:'Армия големов' },
  { wave:19, enemyType:'runner',       count:40, interval:0.2, hpMult:3.0, paths:-1, isBoss:false, modifier:'fast',    bonusGold:90,  preview:'Последний рой' },
  { wave:20, enemyType:'boss_goliath', count:1,  interval:0,   hpMult:8.0, paths:2,  isBoss:true,  modifier:'healing', bonusGold:200, preview:'💀 ФИНАЛ: Руиновейл' },
];

// Prototype second half. Four bosses, alternating air/ground lanes, no hidden RNG.
// Balance MUST be measured with deterministic simulations and playtests.
const LATE_ENEMIES: EnemyId[] = ['grunt', 'runner', 'wyvern', 'golem'];
const LATE_WAVES: WaveData[] = Array.from({ length: 20 }, (_, index) => {
  const wave = index + 21;
  const isBoss = wave % 5 === 0;
  const enemyType: EnemyId = isBoss ? 'boss_goliath' : LATE_ENEMIES[index % LATE_ENEMIES.length];
  return {
    wave,
    enemyType,
    count: isBoss ? 1 : Math.min(45, 18 + index * 2),
    interval: isBoss ? 0.5 : Math.max(0.28, 0.75 - index * 0.015),
    hpMult: isBoss ? 7 + index * 1.0 : 4 + index * 0.65,
    paths: isBoss ? (index / 5 | 0) % 4 : -1,
    isBoss,
    modifier: isBoss ? 'healing' : (index % 3 === 1 ? 'fast' : null),
    bonusGold: 110 + index * 12,
    preview: isBoss ? `Citadel guardian ${wave}` : `Reinforcements ${wave}`,
  };
});
// Wave shape. v0.8.0 chose the opening (candidate C of docs/BALANCE_PROPOSALS.md); v0.13.0 chose the mid game (proposal D; the owner
// delegated the choice). HP and count start at 40% / 80% at wave 1 and move linearly to 30% at wave 40: the curve keeps rising but far
// slower than the numbers as written. Single-enemy (boss) waves keep their count of 1. The wave bonus pays WAVE_BONUS_FACTOR times the
// `bonusGold` written above, before the difficulty multiplier. Edit these constants to retune; the report scripts re-derive every
// alternative from BASE_WAVES (the waves as written).
export const WAVE_TAPER = { hp: 0.4, count: 0.8, until: 40, end: 0.3 } as const;
export const WAVE_BONUS_FACTOR = 2;

export interface WaveTaper {
  hp: number;      // HP fraction at wave 1
  count: number;   // count fraction at wave 1
  until: number;   // wave at which both fractions have reached `end`
  end?: number;    // fraction from `until` on (default 1: the written values)
}

// Pure function so balance proposals can try other tapers on BASE_WAVES (see tests/support/simulate.mjs).
export function taperWave(wave: WaveData, taper: WaveTaper = WAVE_TAPER): WaveData {
  const end = taper.end ?? 1;
  const t = Math.min(1, (wave.wave - 1) / (taper.until - 1));
  if (t >= 1 && end === 1) return wave;
  const hpFactor = taper.hp + (end - taper.hp) * t;
  const countFactor = taper.count + (end - taper.count) * t;
  return {
    ...wave,
    hpMult: Math.round(wave.hpMult * hpFactor * 100) / 100,
    count: wave.count === 1 ? 1 : Math.max(1, Math.round(wave.count * countFactor)),
  };
}

// The waves as written, before the taper.
export const BASE_WAVES: WaveData[] = [...EARLY_WAVES, ...LATE_WAVES];

function shapeWave(wave: WaveData): WaveData {
  return { ...taperWave(wave), bonusGold: Math.round(wave.bonusGold * WAVE_BONUS_FACTOR) };
}

export const WAVES: WaveData[] = BASE_WAVES.map((wave) => shapeWave(wave));

/** Small seeded generator (mulberry32): the same seed always gives the same order, so a random run can be replayed. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `?seed=123` fixes the order of an expert game (to replay a run); null when absent or not a whole number. */
export function parseWaveSeed(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed');
  return raw !== null && /^\d{1,10}$/.test(raw.trim()) ? Number(raw.trim()) >>> 0 : null;
}

/**
 * The wave list of an expert game (v0.21.0). Waves come in blocks of five (1-5, 6-10, ...); inside a block the first four swap their
 * compositions at random, while the fifth (the milestone: golems or a boss) and every boss wave stay where they are. What belongs to the
 * slot stays with the slot: the wave number, hence the taper (applied later by `randomizedWaves`), and the wave bonus. Count, enemy type, HP, speed modifier and lane move with
 * the composition. Pure: the same seed gives the same list; a different seed almost always gives a different one.
 */
export function shuffledBaseWaves(seed: number, base: readonly WaveData[] = BASE_WAVES): WaveData[] {
  const random = seededRandom(seed);
  const slots = base.map((wave) => ({ ...wave }));
  for (let start = 0; start < slots.length; start += 5) {
    const movable: number[] = [];
    for (let i = start; i < Math.min(start + 5, slots.length); i++) if (!slots[i].isBoss && slots[i].wave % 5 !== 0) movable.push(i);
    const order = movable.map((i) => base[i]);
    for (let i = order.length - 1; i > 0; i--) {                     // Fisher-Yates
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    movable.forEach((slotIndex, k) => {
      slots[slotIndex] = { ...order[k], wave: base[slotIndex].wave, bonusGold: base[slotIndex].bonusGold };
    });
  }
  return slots;
}

/** The shuffled list with the taper and the wave bonus applied, ready for a WaveManager. */
export function randomizedWaves(seed: number): WaveData[] {
  return shuffledBaseWaves(seed).map((wave) => shapeWave(wave));
}
