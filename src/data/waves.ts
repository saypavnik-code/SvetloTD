// ─────────────────────────────────────────────────────────────────────────────
// waves.ts — All 20 wave definitions.
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

export const WAVES: WaveData[] = [
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
