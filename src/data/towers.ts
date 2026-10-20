// towers.ts — Stage 10: Phase 3 additions (slow_t2, watchtower, new fields).
// All new fields have defaults so existing code compiles without changes.

export type DamageType = 'normal' | 'piercing' | 'magic' | 'siege' | 'chaos';
export type TowerId    =
  | 'arrow_t1' | 'cannon_t1' | 'magic_t1' | 'slow_t1' | 'acid_t1'
  | 'arrow_t2' | 'cannon_t2' | 'magic_t2' | 'slow_t2' | 'watchtower'
  | 'fire_ult' | 'water_ult' | 'earth_ult' | 'nature_ult';

export interface TowerSpecial {
  type:     'slow' | 'armor_reduce' | 'poison' | 'aoe_slow';
  value:    number;
  duration: number;
  radius?:  number;
}

export interface TowerData {
  id:                 TowerId;
  name:               string;
  damage:             number;
  attackSpeed:        number;
  range:              number;
  damageType:         DamageType;
  cost:               number;
  /** Lumber paid together with `cost` when the tower is built or upgraded to (v0.20.0: only the ultimates). */
  lumberCost:         number;
  color:              number;
  canTargetAir:       boolean;
  canTargetGround:    boolean;
  splash:             number;
  special:            TowerSpecial[];
  upgradeTo:          TowerId[];
  description:        string;
  canDetectInvisible: boolean;
  auraRadius:         number;
  auraBuff:           number;
}

// Helper to pad legacy entries with new fields
const def = (d: Omit<TowerData, 'canDetectInvisible' | 'auraRadius' | 'auraBuff' | 'lumberCost'> & { lumberCost?: number }): TowerData =>
  ({ lumberCost: 0, ...d, canDetectInvisible: false, auraRadius: 0, auraBuff: 0 });

export const TOWER_DEFS: Record<TowerId, TowerData> = {
  arrow_t1: def({
    id: 'arrow_t1', name: 'Вахтурм',
    damage: 12, attackSpeed: 1.0, range: 120, damageType: 'piercing', cost: 50,
    color: 0xC68E17, canTargetAir: true, canTargetGround: true, splash: 0,
    special: [], upgradeTo: ['arrow_t2'],
    description: 'Дальнобойная. Атакует воздух и землю.',
  }),
  cannon_t1: def({
    id: 'cannon_t1', name: 'Фестунг',
    damage: 40, attackSpeed: 0.4, range: 100, damageType: 'siege', cost: 75,
    color: 0x5D4037, canTargetAir: false, canTargetGround: true, splash: 60,
    special: [], upgradeTo: ['cannon_t2'],
    description: 'Медленная. AoE урон. Только земля.',
  }),
  magic_t1: def({
    id: 'magic_t1', name: 'Лёйхттурм',
    damage: 20, attackSpeed: 0.7, range: 140, damageType: 'magic', cost: 60,
    color: 0xF5A623, canTargetAir: true, canTargetGround: true, splash: 0,
    special: [], upgradeTo: ['magic_t2'],
    description: 'Большая дальность. Магический урон.',
  }),
  slow_t1: def({
    id: 'slow_t1', name: 'Виндмюле',
    damage: 5, attackSpeed: 0.8, range: 100, damageType: 'magic', cost: 50,
    color: 0x5F8A8B, canTargetAir: true, canTargetGround: true, splash: 0,
    special: [{ type: 'slow', value: 0.3, duration: 2.0 }],
    upgradeTo: ['slow_t2'], description: 'Замедляет врагов на 30%.',
  }),
  acid_t1: def({
    id: 'acid_t1', name: 'Альхимист',
    damage: 15, attackSpeed: 0.5, range: 160, damageType: 'piercing', cost: 70,
    color: 0x6B8E6B, canTargetAir: false, canTargetGround: true, splash: 0,
    special: [
      { type: 'armor_reduce', value: 3, duration: 4.0 },
      { type: 'poison',       value: 8, duration: 3.0 },
    ],
    upgradeTo: [], description: 'Снижает броню, отравляет.',
  }),
  arrow_t2: def({
    id: 'arrow_t2', name: 'Руна бури',
    damage: 25, attackSpeed: 1.4, range: 140, damageType: 'piercing', cost: 120,
    color: 0xFFBF00, canTargetAir: true, canTargetGround: true, splash: 0,
    special: [], upgradeTo: ['nature_ult'], description: 'Быстрее и сильнее Вахтурм.',
  }),
  cannon_t2: def({
    id: 'cannon_t2', name: 'Драконья руна',
    damage: 90, attackSpeed: 0.35, range: 110, damageType: 'siege', cost: 180,
    color: 0xD4726A, canTargetAir: false, canTargetGround: true, splash: 80,
    special: [], upgradeTo: ['earth_ult'], description: 'Огромный AoE урон.',
  }),
  magic_t2: def({
    id: 'magic_t2', name: 'Кристалл хаоса',
    damage: 45, attackSpeed: 0.6, range: 160, damageType: 'chaos', cost: 200,
    color: 0xFFD700, canTargetAir: true, canTargetGround: true, splash: 0,
    special: [], upgradeTo: ['fire_ult'], description: 'Хаос-урон — игнорирует броню.',
  }),
  slow_t2: {
    id: 'slow_t2', name: 'Ледяной Бастион',
    damage: 10, attackSpeed: 0.9, range: 130, damageType: 'magic', cost: 150,
    color: 0x7EC8E3, canTargetAir: true, canTargetGround: true, splash: 0,
    special: [
      { type: 'slow',     value: 0.55, duration: 2.5 },
      { type: 'aoe_slow', value: 0.35, duration: 1.5, radius: 50 },
    ],
    upgradeTo: ['water_ult'], description: 'Замедляет 55% + AoE вокруг цели.',
    canDetectInvisible: false, auraRadius: 0, auraBuff: 0, lumberCost: 0,
  },
  watchtower: {
    id: 'watchtower', name: 'Стража',
    damage: 0, attackSpeed: 0, range: 0, damageType: 'normal', cost: 60,
    color: 0xD4A84B, canTargetAir: false, canTargetGround: false, splash: 0,
    special: [], upgradeTo: [],
    description: 'Аура +15% скорость башням. Видит невидимок.',
    canDetectInvisible: true, auraRadius: 110, auraBuff: 0.15, lumberCost: 0,
  },

  // Ultimates (v0.20.0, track step B4): one per builder, reached by upgrading the final tier-2 tower of its line.
  // Gold plus lumber, and the builder's mastery (see data/builders.ts). The numbers are a first draft that no
  // headless run has measured yet; no catalogued build uses them, so the economy report did not move (balance: step B6).
  fire_ult: def({
    id: 'fire_ult', name: 'Фойертурм',
    damage: 70, attackSpeed: 0.8, range: 170, damageType: 'chaos', cost: 420, lumberCost: 3,
    color: 0xFF7A33, canTargetAir: true, canTargetGround: true, splash: 70,
    special: [{ type: 'armor_reduce', value: 4, duration: 4.0 }],
    upgradeTo: [], description: 'Ультимейт Пироманта. Хаос-взрывы плавят броню.',
  }),
  water_ult: def({
    id: 'water_ult', name: 'Айсбург',
    damage: 28, attackSpeed: 1.0, range: 150, damageType: 'magic', cost: 360, lumberCost: 3,
    color: 0x9FE3F7, canTargetAir: true, canTargetGround: true, splash: 0,
    special: [
      { type: 'slow',     value: 0.65, duration: 3.0 },
      { type: 'aoe_slow', value: 0.45, duration: 2.0, radius: 80 },
    ],
    upgradeTo: [], description: 'Ультимейт Гидроманта. Глубокая заморозка.',
  }),
  earth_ult: def({
    id: 'earth_ult', name: 'Бергфестунг',
    damage: 210, attackSpeed: 0.35, range: 120, damageType: 'siege', cost: 450, lumberCost: 3,
    color: 0x9C7B54, canTargetAir: false, canTargetGround: true, splash: 100,
    special: [], upgradeTo: [], description: 'Ультимейт Геоманта. Сокрушающий AoE. Только земля.',
  }),
  nature_ult: def({
    id: 'nature_ult', name: 'Вальдвахтер',
    damage: 40, attackSpeed: 2.0, range: 175, damageType: 'piercing', cost: 400, lumberCost: 3,
    color: 0x6FCF6B, canTargetAir: true, canTargetGround: true, splash: 0,
    special: [{ type: 'poison', value: 12, duration: 4.0 }],
    upgradeTo: [], description: 'Ультимейт Хранителя. Быстрые ядовитые стрелы.',
  }),
};

export const BUILDABLE_TOWER_IDS: TowerId[] = [
  'arrow_t1', 'cannon_t1', 'magic_t1', 'slow_t1', 'acid_t1', 'watchtower',
];
