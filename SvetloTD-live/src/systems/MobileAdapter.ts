// MobileAdapter.ts — Mobile detection, safe area, touch utilities.
// Used by GameScene and UI components to adapt layout/input.

export interface SafeArea {
  top:    number;
  right:  number;
  bottom: number;
  left:   number;
}

class MobileAdapterClass {
  private _isMobile    = false;
  private _isTouch     = false;
  private _safeArea:  SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  private _scaleRatio  = 1;

  init(): void {
    this._isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      || ('ontouchstart' in window)
      || window.innerWidth < 768;
    this._isTouch  = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this._readSafeArea();
    this._computeScaleRatio();
    // Re-read on resize/orientation change
    window.addEventListener('resize', () => {
      this._readSafeArea();
      this._computeScaleRatio();
    });
  }

  get isMobile():   boolean    { return this._isMobile; }
  get isTouch():    boolean    { return this._isTouch; }
  get safeArea():   SafeArea   { return this._safeArea; }
  get scaleRatio(): number     { return this._scaleRatio; }
  /** Scale a desktop pixel value to current device scale */
  px(v: number): number        { return Math.round(v * this._scaleRatio); }

  private _readSafeArea(): void {
    const cs = getComputedStyle(document.documentElement);
    const n = (key: string): number => {
      const raw = cs.getPropertyValue(key).trim();
      return raw ? parseFloat(raw) : 0;
    };
    this._safeArea = {
      top:    n('--sat') || n('env(safe-area-inset-top)') || 0,
      right:  n('--sar') || n('env(safe-area-inset-right)') || 0,
      bottom: n('--sab') || n('env(safe-area-inset-bottom)') || 0,
      left:   n('--sal') || n('env(safe-area-inset-left)') || 0,
    };
  }

  private _computeScaleRatio(): void {
    const canvas = document.querySelector('#game-container canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    // Phaser's ScaleManager reports the actual rendered size
    const scaleX = canvas.width  > 0 ? canvas.clientWidth  / canvas.width  : 1;
    const scaleY = canvas.height > 0 ? canvas.clientHeight / canvas.height : 1;
    this._scaleRatio = Math.min(scaleX, scaleY);
  }

  /** Minimum recommended touch target size in game units */
  get minTapSize(): number {
    // 44px physical → game units
    return this._isMobile ? Math.ceil(44 / Math.max(0.1, this._scaleRatio)) : 32;
  }
}

export const MobileAdapter = new MobileAdapterClass();
