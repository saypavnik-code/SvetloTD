// AdManager.ts — In-game rewarded ad opportunities.
// Shows non-intrusive "Watch Ad" prompts at defined moments.
// Pauses AudioManager + GameSpeed during ad playback.

import { PlatformManager } from './PlatformManager';
import { EventBus, GameEvents } from '../utils/EventBus';

export type AdOpportunity =
  | 'double_wave_reward'   // after wave clear: 2x bonus gold
  | 'revive_hero'          // hero died: restore to 50% HP
  | 'free_upgrade'         // instant tower upgrade (post-wave)
  | 'global_aura_30s';     // all towers +25% attack speed for 30s

class AdManagerClass {
  private _inAd = false;

  get inAd(): boolean { return this._inAd; }

  async showRewardedForOpportunity(
    opportunity: AdOpportunity,
    onSuccess: () => void,
    onCancel?: () => void,
  ): Promise<void> {
    if (this._inAd) return;
    this._inAd = true;

    // Pause game
    EventBus.emit(GameEvents.GAME_PAUSED);

    await PlatformManager.showRewardedAd((rewarded) => {
      this._inAd = false;
      EventBus.emit(GameEvents.GAME_RESUMED);
      if (rewarded) {
        onSuccess();
      } else {
        onCancel?.();
      }
    });
  }
}

export const AdManager = new AdManagerClass();
