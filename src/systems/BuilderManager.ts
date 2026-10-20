// ─────────────────────────────────────────────────────────────────────────────
// BuilderManager.ts — Which builders each seat owns and what they unlock (Burbenog track, step B4, v0.20.0).
//
// The one owner of the lumber sink: licenses, mastery research and the lumber price of an ultimate tower are all
// paid here, through LumberManager, and always for a named seat. It places no tower; BuildSystem asks it whether a
// seat may place or upgrade one (`canPlace`, `canUpgrade`) and charges the lumber of an upgrade through `chargeLumber`.
//
// Start modes: 'all' gives every seat every open builder (the classic one-seat game, and the default of tests that
// do not care); a list gives seat i the free first builder list[i] (a licensed game: every further builder costs lumber).
// Pure logic, no Phaser. Emits BUILDERS_CHANGED (seat) when a seat's builders or mastery change.
// ─────────────────────────────────────────────────────────────────────────────
import { BUILDERS, BUILDER_IDS, COMMON_TOWER_IDS, DEFAULT_PICKS, MASTERY_LUMBER, builderOfTower, licenseLumber, type BuilderId } from '../data/builders';
import type { SeatCount } from '../data/seats';
import { BUILDABLE_TOWER_IDS, TOWER_DEFS, type TowerId } from '../data/towers';
import { EventBus, GameEvents } from '../utils/EventBus';
import { LumberManager } from './LumberManager';

const OPEN_BUILDERS: readonly BuilderId[] = BUILDER_IDS.filter(id => BUILDERS[id].open);

export class BuilderManager {
  readonly seatCount: SeatCount;
  private readonly _lumber: LumberManager;
  private readonly _owned: Set<BuilderId>[];
  private readonly _mastery: Set<BuilderId>[];

  constructor(lumber: LumberManager, seatCount: SeatCount = 1, start: 'all' | readonly BuilderId[] = 'all') {
    this._lumber = lumber;
    this.seatCount = seatCount;
    this._owned = Array.from({ length: seatCount }, (_, seat) => new Set<BuilderId>(
      start === 'all' ? OPEN_BUILDERS : [(start[seat] && BUILDERS[start[seat]].open ? start[seat] : DEFAULT_PICKS[seat % DEFAULT_PICKS.length])]));
    this._mastery = Array.from({ length: seatCount }, () => new Set<BuilderId>());
  }

  /** The start list for a game: the owner's picks, else a one-seat game owns everything, else the default picks. */
  static startFor(seatCount: SeatCount, picks: 'all' | readonly BuilderId[] | null): 'all' | readonly BuilderId[] {
    if (picks !== null) return picks;
    return seatCount === 1 ? 'all' : DEFAULT_PICKS;
  }

  private _valid(seat: number): boolean { return Number.isInteger(seat) && seat >= 0 && seat < this.seatCount; }

  owns(seat: number, builder: BuilderId): boolean { return this._valid(seat) && this._owned[seat].has(builder); }
  hasMastery(seat: number, builder: BuilderId): boolean { return this._valid(seat) && this._mastery[seat].has(builder); }
  ownedBy(seat: number): BuilderId[] { return BUILDER_IDS.filter(id => this.owns(seat, id)); }

  /** Tier-1 towers the seat may place now, in the order of the build list (the classic game keeps its old keys 1-6). */
  buildableFor(seat: number): TowerId[] {
    const allowed = new Set<TowerId>(COMMON_TOWER_IDS);
    for (const builder of this.ownedBy(seat)) for (const root of BUILDERS[builder].roots) allowed.add(root);
    return BUILDABLE_TOWER_IDS.filter(id => allowed.has(id));
  }

  canPlace(seat: number, tower: TowerId): boolean { return this._valid(seat) && this.buildableFor(seat).includes(tower); }

  /** Why a seat may not upgrade to `to`: it lacks the line's builder, or the mastery of an ultimate. Null: it may. Gold and lumber are not checked. */
  upgradeBlock(seat: number, to: TowerId): 'builder' | 'mastery' | null {
    const builder = builderOfTower(to);
    if (builder === null) return this._valid(seat) ? null : 'builder';   // a common tower
    if (!this.owns(seat, builder)) return 'builder';
    return BUILDERS[builder].ultimate !== to || this.hasMastery(seat, builder) ? null : 'mastery';
  }

  canUpgrade(seat: number, to: TowerId): boolean { return this.upgradeBlock(seat, to) === null; }

  /** Lumber price of the seat's next license, or null when it owns every open builder. */
  nextLicenseCost(seat: number): number | null {
    if (!this._valid(seat) || OPEN_BUILDERS.every(id => this.owns(seat, id))) return null;
    return licenseLumber(this._owned[seat].size);
  }

  /** Buy a builder license with lumber. False (nothing spent) for a placeholder, an owned builder or too little lumber. */
  buyLicense(seat: number, builder: BuilderId): boolean {
    const cost = this.nextLicenseCost(seat);
    if (cost === null || !BUILDERS[builder].open || this.owns(seat, builder)) return false;
    if (!this._lumber.spend(cost, seat)) return false;
    this._owned[seat].add(builder);
    EventBus.emit(GameEvents.BUILDERS_CHANGED, seat);
    return true;
  }

  /** Research a builder's mastery with lumber. It unlocks the ultimate tower of that builder. */
  research(seat: number, builder: BuilderId): boolean {
    if (!this.owns(seat, builder) || this.hasMastery(seat, builder) || BUILDERS[builder].ultimate === null) return false;
    if (!this._lumber.spend(MASTERY_LUMBER, seat)) return false;
    this._mastery[seat].add(builder);
    EventBus.emit(GameEvents.BUILDERS_CHANGED, seat);
    return true;
  }

  /** Lumber the tower costs to build or upgrade to (0 for everything but the ultimates). */
  lumberCostOf(tower: TowerId): number { return TOWER_DEFS[tower].lumberCost; }

  canAffordLumber(seat: number, amount: number): boolean { return this._lumber.canAfford(amount, seat); }

  /** Pay the lumber part of a tower. BuildSystem calls it only after every other check passed. */
  chargeLumber(seat: number, amount: number): boolean { return amount === 0 || this._lumber.spend(amount, seat); }
}
