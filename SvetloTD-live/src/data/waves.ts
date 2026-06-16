// waves.ts — Stage 10 Phase 4: new enemies + armored modifier + speedMult.
import type { EnemyId } from './enemies';

export type WaveModifier = 'fast' | 'healing' | 'armored' | null;

export interface WaveData {
  wave:       number;
  enemyType:  EnemyId;
  count:      number;
  interval:   number;
  hpMult:     number;
  speedMult?: number;
  paths:      number;
  isBoss:     boolean;
  modifier:   WaveModifier;
  bonusGold:  number;
  preview:    string;
}

export const WAVES: WaveData[] = [
  // Phase 1 — Tutorial
  { wave: 1,  enemyType:'grunt',          count: 8,  interval:1.0, hpMult:1.0,               paths:-1, isBoss:false, modifier:null,      bonusGold:20,  preview:'Гоблины-разведчики' },
  { wave: 2,  enemyType:'grunt',          count:10,  interval:0.9, hpMult:1.2,               paths:-1, isBoss:false, modifier:null,      bonusGold:25,  preview:'Отряд гоблинов' },
  { wave: 3,  enemyType:'runner',         count:15,  interval:0.5, hpMult:1.0,               paths:-1, isBoss:false, modifier:null,      bonusGold:25,  preview:'Быстрые бегуны!' },
  { wave: 4,  enemyType:'grunt',          count:12,  interval:0.8, hpMult:1.5,               paths:-1, isBoss:false, modifier:'armored', bonusGold:30,  preview:'⚙ Бронированные гоблины' },
  { wave: 5,  enemyType:'golem',          count: 3,  interval:2.0, hpMult:1.0,               paths:-1, isBoss:false, modifier:null,      bonusGold:40,  preview:'Тяжёлые Големы' },
  // Phase 2 — Air
  { wave: 6,  enemyType:'grunt',          count:14,  interval:0.7, hpMult:2.0,               paths:-1, isBoss:false, modifier:null,      bonusGold:35,  preview:'Усиленные гоблины' },
  { wave: 7,  enemyType:'wyvern',         count: 8,  interval:1.0, hpMult:1.0,               paths:-1, isBoss:false, modifier:null,      bonusGold:40,  preview:'⚠ ВОЗДУХ: Виверны' },
  { wave: 8,  enemyType:'runner',         count:20,  interval:0.4, hpMult:1.5, speedMult:1.4,paths:-1, isBoss:false, modifier:'fast',    bonusGold:40,  preview:'⚡ Молниеносный рой' },
  { wave: 9,  enemyType:'golem',          count: 5,  interval:1.5, hpMult:1.5,               paths:-1, isBoss:false, modifier:'armored', bonusGold:45,  preview:'⚙ Закованные Големы' },
  { wave:10,  enemyType:'boss_goliath',   count: 1,  interval:0,   hpMult:1.0,               paths: 0, isBoss:true,  modifier:null,      bonusGold:100, preview:'💀 БОСС: Каменный Голиаф' },
  // Phase 3 — Escalation
  { wave:11,  enemyType:'grunt',          count:18,  interval:0.5, hpMult:3.0,               paths:-1, isBoss:false, modifier:'healing', bonusGold:50,  preview:'💚 Гоблины с регенерацией' },
  { wave:12,  enemyType:'wyvern',         count:12,  interval:0.7, hpMult:2.0,               paths:-1, isBoss:false, modifier:null,      bonusGold:50,  preview:'⚠ Стая виверн' },
  { wave:13,  enemyType:'phantom',        count:10,  interval:0.6, hpMult:1.0,               paths:-1, isBoss:false, modifier:null,      bonusGold:55,  preview:'👁 Невидимые Призраки!' },
  { wave:14,  enemyType:'golem',          count: 8,  interval:1.2, hpMult:2.5,               paths:-1, isBoss:false, modifier:'armored', bonusGold:60,  preview:'⚙ Крепость из камня' },
  { wave:15,  enemyType:'boss_goliath',   count: 1,  interval:0,   hpMult:2.5,               paths: 1, isBoss:true,  modifier:'healing', bonusGold:120, preview:'💀 БОСС: Древний Голиаф' },
  // Phase 4 — Chaos
  { wave:16,  enemyType:'grunt',          count:25,  interval:0.4, hpMult:5.0,               paths:-1, isBoss:false, modifier:'healing', bonusGold:70,  preview:'💚 Орда элиты' },
  { wave:17,  enemyType:'nether_drake',   count: 1,  interval:0,   hpMult:1.0,               paths: 3, isBoss:true,  modifier:null,      bonusGold:90,  preview:'💀 БОСС: Нефритовый Дракон' },
  { wave:18,  enemyType:'phantom',        count:20,  interval:0.4, hpMult:2.0, speedMult:1.3,paths:-1, isBoss:false, modifier:'fast',    bonusGold:80,  preview:'👁⚡ Стремительные призраки' },
  { wave:19,  enemyType:'mountain_giant', count: 1,  interval:0,   hpMult:1.0,               paths: 2, isBoss:true,  modifier:null,      bonusGold:110, preview:'💀 БОСС: Горный Титан' },
  { wave:20,  enemyType:'boss_goliath',   count: 1,  interval:0,   hpMult:8.0,               paths: 0, isBoss:true,  modifier:'healing', bonusGold:200, preview:'💀 ФИНАЛ: Руиновейл' },
];
