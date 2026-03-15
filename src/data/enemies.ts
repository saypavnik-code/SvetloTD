// enemies.ts — Stage 7: Baltic amber palette colours. Added colorDark + isBoss.

export type ArmorType = 'unarmored' | 'light' | 'medium' | 'heavy' | 'fortified' | 'heroic';
export type EnemyId   = 'grunt' | 'runner' | 'golem' | 'wyvern' | 'boss_goliath';

export interface EnemyDef {
  id:          EnemyId;
  name:        string;
  hp:          number;
  speed:       number;
  armorType:   ArmorType;
  bounty:      number;
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
    hp: 100, speed: 60, armorType: 'medium', bounty: 5, livesCost: 1,
    isFlying: false, isInvisible: false,
    color: 0x4A3728, colorDark: 0x2E1A12, radius: 8,
  },
  runner: {
    id: 'runner', name: 'Бегун',
    hp: 50, speed: 120, armorType: 'light', bounty: 3, livesCost: 1,
    isFlying: false, isInvisible: false,
    color: 0x2C4A3E, colorDark: 0x1A2E26, radius: 6,
  },
  golem: {
    id: 'golem', name: 'Голем',
    hp: 400, speed: 30, armorType: 'heavy', bounty: 12, livesCost: 2,
    isFlying: false, isInvisible: false,
    color: 0x5C3A21, colorDark: 0x3A2010, radius: 12,
  },
  wyvern: {
    id: 'wyvern', name: 'Виверна',
    hp: 80, speed: 80, armorType: 'light', bounty: 8, livesCost: 2,
    isFlying: true, isInvisible: false,
    color: 0x3B3456, colorDark: 0x221F38, radius: 7,
  },
  boss_goliath: {
    id: 'boss_goliath', name: 'Голиаф',
    hp: 2000, speed: 25, armorType: 'fortified', bounty: 50, livesCost: 5,
    isFlying: false, isInvisible: false,
    color: 0x1A0A05, colorDark: 0x0A0402, radius: 18, isBoss: true,
  },
};
