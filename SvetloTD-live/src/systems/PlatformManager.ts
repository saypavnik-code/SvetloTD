// PlatformManager.ts — VK Games / VK Bridge abstraction.
// All platform-specific calls go here. Stubs work in dev/local play.
// Wrap in try/catch everywhere — SDK may not load in local dev.

declare global {
  interface Window {
    vkPlaySdk?: VKPlaySdk;
    __workaround_vkBridge?: VKBridge;
  }
}

interface VKPlaySdk {
  init(): Promise<void>;
  getUser(): Promise<{ id: number; name: string; photo: string }>;
  showAd(type: 'rewarded' | 'interstitial'): Promise<{ result: boolean }>;
  getGameData(): Promise<{ data: string }>;
  setGameData(data: { data: string }): Promise<void>;
  showLeaderboard(score: number): Promise<void>;
  getPurchases(): Promise<Array<{ id: string }>>;
}

interface VKBridge {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

export interface UserInfo {
  id:    number;
  name:  string;
  photo: string;
}

type AdCallback = (rewarded: boolean) => void;

class PlatformManagerClass {
  private _sdk:      VKPlaySdk | null = null;
  private _user:     UserInfo | null  = null;
  private _ready     = false;
  private _lastInterstitialTs = 0;
  private readonly INTERSTITIAL_COOLDOWN = 3 * 60 * 1000; // 3 min

  // ── Initialise ─────────────────────────────────────────────────────────────
  async init(): Promise<void> {
    try {
      if (window.vkPlaySdk) {
        this._sdk = window.vkPlaySdk;
        await this._sdk.init();
        this._user = await this._sdk.getUser();
        console.log('[Platform] VK Play SDK ready. User:', this._user?.name);
      } else {
        console.log('[Platform] No SDK found. Running in standalone mode.');
      }
    } catch (e) {
      console.warn('[Platform] SDK init failed:', e);
    }
    this._ready = true;
  }

  get isVK(): boolean { return !!this._sdk; }
  get user(): UserInfo | null { return this._user; }
  get ready(): boolean { return this._ready; }

  // ── Rewarded video ─────────────────────────────────────────────────────────
  async showRewardedAd(onRewarded: AdCallback): Promise<void> {
    if (!this._sdk) { onRewarded(true); return; } // dev: always reward
    try {
      const res = await this._sdk.showAd('rewarded');
      onRewarded(res.result);
    } catch (e) {
      console.warn('[Platform] Rewarded ad failed:', e);
      onRewarded(false);
    }
  }

  // ── Interstitial (with cooldown) ───────────────────────────────────────────
  async showInterstitial(): Promise<void> {
    if (!this._sdk) return;
    const now = Date.now();
    if (now - this._lastInterstitialTs < this.INTERSTITIAL_COOLDOWN) return;
    try {
      await this._sdk.showAd('interstitial');
      this._lastInterstitialTs = now;
    } catch (e) {
      console.warn('[Platform] Interstitial ad failed:', e);
    }
  }

  // ── Cloud saves ────────────────────────────────────────────────────────────
  async saveData(payload: Record<string, unknown>): Promise<void> {
    const json = JSON.stringify(payload);
    // Always write localStorage as fallback
    try { localStorage.setItem('svetlotd_save', json); } catch { /**/ }
    if (!this._sdk) return;
    try { await this._sdk.setGameData({ data: json }); }
    catch (e) { console.warn('[Platform] Cloud save failed:', e); }
  }

  async loadData(): Promise<Record<string, unknown> | null> {
    if (this._sdk) {
      try {
        const res = await this._sdk.getGameData();
        if (res.data) return JSON.parse(res.data) as Record<string, unknown>;
      } catch (e) {
        console.warn('[Platform] Cloud load failed, using localStorage:', e);
      }
    }
    try {
      const raw = localStorage.getItem('svetlotd_save');
      return raw ? JSON.parse(raw) as Record<string, unknown> : null;
    } catch { return null; }
  }

  // ── Leaderboard ────────────────────────────────────────────────────────────
  async submitScore(score: number): Promise<void> {
    if (!this._sdk) return;
    try { await this._sdk.showLeaderboard(score); }
    catch (e) { console.warn('[Platform] Leaderboard submit failed:', e); }
  }
}

export const PlatformManager = new PlatformManagerClass();
