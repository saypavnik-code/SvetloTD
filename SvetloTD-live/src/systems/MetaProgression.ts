// MetaProgression.ts — Persistent upgrade tree (Priority 5).
import { PlatformManager } from './PlatformManager';
import { EventBus, GameEvents } from '../utils/EventBus';

export interface MetaUpgrade {
  id: string; name: string; description: string;
  maxLevel: number; costPerLevel: number; icon: string;
}
export interface MetaState { stars: number; levels: Record<string, number>; }

export const META_UPGRADES: MetaUpgrade[] = [
  { id:'start_gold',    name:'Военный бюджет',  description:'+25 золота на старте за уровень',     maxLevel:5, costPerLevel:3, icon:'◆' },
  { id:'tower_damage',  name:'Кузница',          description:'+5% урона всех башен за уровень',     maxLevel:5, costPerLevel:4, icon:'⚔' },
  { id:'tower_range',   name:'Дальнозоркость',   description:'+4% дальности башен за уровень',      maxLevel:4, costPerLevel:3, icon:'◎' },
  { id:'hero_hp',       name:'Закалка Героя',    description:'+1 жизнь на старте за уровень',       maxLevel:5, costPerLevel:3, icon:'♥' },
  { id:'interest_rate', name:'Ростовщик',        description:'+1% ставка процентов за уровень',     maxLevel:4, costPerLevel:5, icon:'%' },
  { id:'sell_refund',   name:'Скупщик',          description:'+3% возврат при продаже за уровень',  maxLevel:3, costPerLevel:4, icon:'✕' },
];

class MetaProgressionClass {
  private _state: MetaState = { stars: 0, levels: {} };
  private _loaded = false;

  async load(): Promise<void> {
    try {
      const data = await PlatformManager.loadData();
      if (data?.meta) this._state = data.meta as MetaState;
    } catch { /**/ }
    this._loaded = true;
  }

  async save(): Promise<void> {
    try {
      const existing = await PlatformManager.loadData() ?? {};
      await PlatformManager.saveData({ ...existing, meta: this._state });
    } catch { /**/ }
  }

  get stars(): number   { return this._state.stars; }
  get loaded(): boolean { return this._loaded; }

  getLevel(id: string): number { return this._state.levels[id] ?? 0; }

  canUpgrade(id: string): boolean {
    const u = META_UPGRADES.find(u => u.id === id);
    if (!u) return false;
    return this.getLevel(id) < u.maxLevel && this._state.stars >= u.costPerLevel;
  }

  upgrade(id: string): boolean {
    if (!this.canUpgrade(id)) return false;
    const u = META_UPGRADES.find(u => u.id === id)!;
    this._state.stars -= u.costPerLevel;
    this._state.levels[id] = (this._state.levels[id] ?? 0) + 1;
    void this.save();
    EventBus.emit(GameEvents.META_UPGRADED, id);
    return true;
  }

  awardStars(wavesCompleted: number, victory: boolean): void {
    const earned = Math.floor(wavesCompleted / 5) + (victory ? 3 : 0);
    this._state.stars += earned;
    void this.save();
    EventBus.emit(GameEvents.STARS_EARNED, earned);
  }

  get bonusStartGold():   number { return this.getLevel('start_gold')    * 25; }
  get bonusDamagePct():   number { return this.getLevel('tower_damage')  * 0.05; }
  get bonusRangePct():    number { return this.getLevel('tower_range')   * 0.04; }
  get bonusStartLives():  number { return this.getLevel('hero_hp'); }
  get bonusInterestPct(): number { return this.getLevel('interest_rate') * 0.01; }
  get bonusSellRefund():  number { return this.getLevel('sell_refund')   * 0.03; }
}

export const MetaProgression = new MetaProgressionClass();
