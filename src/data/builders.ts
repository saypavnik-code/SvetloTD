// ─────────────────────────────────────────────────────────────────────────────
// builders.ts — Builders (governors): the elemental factions of the Burbenog track, step B4 (v0.20.0).
//
// A builder is a set of tower lines a seat may place. Every seat starts with one builder for free; each further
// builder is bought with lumber (BuilderManager). The towers themselves stay in data/towers.ts: a builder only names
// its tier-1 roots, and the tier tree is read from `TowerData.upgradeTo`, so there is one source for tower stats.
//
// Lumber is a milestone currency (boss and golem kills, every fifth wave): it buys licenses, a builder's mastery
// (the research that unlocks its ultimate tower) and the ultimate tower itself. Pure data, no Phaser.
// ─────────────────────────────────────────────────────────────────────────────
import { TOWER_DEFS, type TowerId } from './towers';

export type BuilderId = 'fire' | 'water' | 'earth' | 'nature' | 'light' | 'shadow';
export const BUILDER_IDS: readonly BuilderId[] = ['fire', 'water', 'earth', 'nature', 'light', 'shadow'];

export interface BuilderDef {
  id:       BuilderId;
  name:     string;            // the governor's title
  element:  string;            // short element label for the panel
  color:    number;
  /** False for a placeholder: it has no roster yet, cannot be picked or bought, and the panel shows it as "soon". */
  open:     boolean;
  /** Tier-1 towers this builder places. */
  roots:    readonly TowerId[];
  /** Ultimate tower: upgrade of the final tier-2 tower of a line, needs this builder's mastery plus lumber. */
  ultimate: TowerId | null;
  summary:  string;
}

export const BUILDERS: Record<BuilderId, BuilderDef> = {
  fire: {
    id: 'fire', name: 'Пиромант', element: 'Огонь', color: 0xE8793A, open: true,
    roots: ['magic_t1', 'acid_t1'], ultimate: 'fire_ult',
    summary: 'Дальний магический и хаос-урон, плавит броню.',
  },
  water: {
    id: 'water', name: 'Гидромант', element: 'Вода', color: 0x62B5E5, open: true,
    roots: ['slow_t1'], ultimate: 'water_ult',
    summary: 'Замедление и заморозка: поддержка для чужого урона.',
  },
  earth: {
    id: 'earth', name: 'Геомант', element: 'Земля', color: 0x9C7B54, open: true,
    roots: ['cannon_t1'], ultimate: 'earth_ult',
    summary: 'Тяжёлый осадный урон по площади. Не бьёт воздух.',
  },
  nature: {
    id: 'nature', name: 'Хранитель', element: 'Природа', color: 0x6DBF67, open: true,
    roots: ['arrow_t1'], ultimate: 'nature_ult',
    summary: 'Дальние колющие стрелы, бьют и воздух.',
  },
  light: {
    id: 'light', name: 'Инквизитор', element: 'Свет', color: 0xF2E3A0, open: false,
    roots: [], ultimate: null,
    summary: 'Заготовка: ауры, невидимки, снайперы (позже).',
  },
  shadow: {
    id: 'shadow', name: 'Некромант', element: 'Тень', color: 0x8E6FBF, open: false,
    roots: [], ultimate: null,
    summary: 'Заготовка: порча брони, урон в процентах (позже).',
  },
};

/** Towers every seat may place whatever its builders are (utility, not an element). */
export const COMMON_TOWER_IDS: readonly TowerId[] = ['watchtower'];

/** Lumber for the 2nd, 3rd and 4th builder a seat buys (the first one is free). */
export const LICENSE_LUMBER: readonly number[] = [2, 3, 4];
/** Lumber for one builder's mastery, the research that unlocks its ultimate tower. */
export const MASTERY_LUMBER = 3;

/** Free first builder of seat 0, 1, 2, 3 when the owner picks none (a two-seat game gets fire and earth). */
export const DEFAULT_PICKS: readonly BuilderId[] = ['fire', 'earth', 'nature', 'water'];

/** The tier tree of a root: the root, then every upgrade in order (depth first). */
export function towerLine(root: TowerId): TowerId[] {
  const line: TowerId[] = [root];
  for (const next of TOWER_DEFS[root].upgradeTo) line.push(...towerLine(next));
  return line;
}

/** Which builder owns a tower kind; null for the common towers. Built once from the roots. */
const LINE_OWNER = new Map<TowerId, BuilderId>();
for (const id of BUILDER_IDS) for (const root of BUILDERS[id].roots) for (const tower of towerLine(root)) LINE_OWNER.set(tower, id);

export function builderOfTower(tower: TowerId): BuilderId | null { return LINE_OWNER.get(tower) ?? null; }

/** Lumber price of the next license for a seat that already owns `owned` builders (at least one: the free first). */
export function licenseLumber(owned: number): number { return LICENSE_LUMBER[Math.max(0, owned - 1)] ?? LICENSE_LUMBER[LICENSE_LUMBER.length - 1]; }

/**
 * `?builders=fire,earth` picks the free first builder of seat 0, 1, ... (licensed game, in a one-seat game too);
 * `?builders=all` gives every seat every open builder. Unknown names are ignored; null means "no choice made".
 */
export function parseBuilderPicks(search: string): 'all' | BuilderId[] | null {
  const raw = new URLSearchParams(search).get('builders');
  if (raw === null) return null;
  if (raw === 'all') return 'all';
  const picks = raw.split(',').map(part => part.trim()).filter((part): part is BuilderId =>
    (BUILDER_IDS as readonly string[]).includes(part) && BUILDERS[part as BuilderId].open);
  return picks.length > 0 ? picks : null;
}
