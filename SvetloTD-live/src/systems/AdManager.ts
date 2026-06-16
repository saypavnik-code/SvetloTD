// AdManager.ts — In-game rewarded + interstitial ad (Priority 6).
import { PlatformManager } from './PlatformManager';
import { EventBus, GameEvents } from '../utils/EventBus';

export type AdOpportunity = 'double_wave_reward' | 'revive_hero' | 'free_upgrade' | 'global_aura_30s';

class AdManagerClass {
  private _inAd = false;
  private _lastInterstitial = 0;
  private readonly INTERSTITIAL_CD = 3 * 60 * 1000; // 3 min

  get inAd(): boolean { return this._inAd; }

  async showRewardedForOpportunity(
    _opportunity: AdOpportunity,
    onSuccess: () => void,
    onCancel?: () => void,
  ): Promise<void> {
    if (this._inAd) { onCancel?.(); return; }
    this._inAd = true;
    EventBus.emit(GameEvents.GAME_PAUSED);
    await PlatformManager.showRewardedAd((rewarded) => {
      this._inAd = false;
      EventBus.emit(GameEvents.GAME_RESUMED);
      if (rewarded) onSuccess(); else onCancel?.();
    });
  }

  async showInterstitial(): Promise<void> {
    const now = Date.now();
    if (this._inAd || now - this._lastInterstitial < this.INTERSTITIAL_CD) return;
    this._inAd = true;
    this._lastInterstitial = now;
    EventBus.emit(GameEvents.GAME_PAUSED);
    await PlatformManager.showInterstitial();
    this._inAd = false;
    EventBus.emit(GameEvents.GAME_RESUMED);
  }
}
export const AdManager = new AdManagerClass();
