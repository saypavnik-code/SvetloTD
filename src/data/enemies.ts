// enemies.ts — Stage 10: added lumberYield for Phase 2 economy.
// Phase 3: phantom (invisible), nether_drake (flying boss), mountain_giant (spawns minions).

export type ArmorType = 'unarmored' | 'light' | 'medium' | 'heavy' | 'fortified' | 'heroic';
export type EnemyId   =
  | 'grunt' | 'runner' | 'golem' | 'wyvern' | 'boss_goliath'
  | 'phantom' | 'nether_drake' | 'mountain_giant';

export interface EnemyDef {
  id:          EnemyId;
  name:        string;
  hp:          number;
  speed:       number;
  armorType:   ArmorType;
  bounty:      number;
  lumberYield: number;   // lumber awarded to LumberManager on kill (0 for most)
  livesCost:   number;
  isFlying:    boolean;
  isInvisible: boolean;
  color:       number;
  colorDark:   number;
  radius:      number;
  isBoss?:     boolean;
}

export const ENEMY_DEFS: Record<EnemyId, EnemyDef> = {
  grunt: {
    id: 'grunt', name: 'Гоблин',
    hp: 100, speed: 60, armorType: 'medium', bounty: 4, lumberYield: 0, livesCost: 1,
    isFlying: false, isInvisible: false,
    color: 0x4A3728, colorDark: 0x2E1A12, radius: 8,
  },
  runner: {
    id: 'runner', name: 'Бегун',
    hp: 50, speed: 120, armorType: 'light', bounty: 3, lumberYield: 0, livesCost: 1,
    isFlying: false, isInvisible: false,
    color: 0x2C4A3E, colorDark: 0x1A2E26, radius: 6,
  },
  golem: {
    id: 'golem', name: 'Голем',
    hp: 400, speed: 30, armorType: 'heavy', bounty: 14, lumberYield: 1, livesCost: 2,
    isFlying: false, isInvisible: false,
    color: 0x5C3A21, colorDark: 0x3A2010, radius: 12,
  },
  wyvern: {
    id: 'wyvern', name: 'Виверна',
    hp: 80, speed: 80, armorType: 'light', bounty: 7, lumberYield: 0, livesCost: 2,
    isFlying: true, isInvisible: false,
    color: 0x3B3456, colorDark: 0x221F38, radius: 7,
  },
  boss_goliath: {
    id: 'boss_goliath', name: 'Голиаф',
    hp: 2000, speed: 25, armorType: 'fortified', bounty: 60, lumberYield: 2, livesCost: 5,
    isFlying: false, isInvisible: false,
    color: 0x1A0A05, colorDark: 0x0A0402, radius: 18, isBoss: true,
  },

  // ── Phase 3: New enemy types ───────────────────────────────────────────────

  phantom: {
    id: 'phantom', name: 'Призрак',
    hp: 120, speed: 90, armorType: 'unarmored', bounty: 10, lumberYield: 0, livesCost: 2,
    isFlying: false, isInvisible: true,
    color: 0xBB99DD, colorDark: 0x7755AA, radius: 7,
  },

  nether_drake: {
    id: 'nether_drake', name: 'Нефритовый Дракон',
    hp: 1800, speed: 45, armorType: 'heroic', bounty: 45, lumberYield: 1, livesCost: 4,
    isFlying: true, isInvisible: false,
    color: 0x2E1A52, colorDark: 0x180D2E, radius: 16, isBoss: true,
  },

  mountain_giant: {
    id: 'mountain_giant', name: 'Горный Титан',
    hp: 3000, speed: 15, armorType: 'fortified', bounty: 55, lumberYield: 2, livesCost: 6,
    isFlying: false, isInvisible: false,
    color: 0x5A4A3A, colorDark: 0x2E2418, radius: 20, isBoss: true,
  },
};
