// main.ts — Mobile-first entry point. Priority 3 rework.

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { GameSpeed }      from './systems/GameSpeed';
import { MobileAdapter }    from './systems/MobileAdapter';
import { MetaProgression }  from './systems/MetaProgression';
import { BootScene }      from './scenes/BootScene';
import { MenuScene }      from './scenes/MenuScene';
import { GameScene }      from './scenes/GameScene';
import { GameOverScene }  from './scenes/GameOverScene';
import { MetaScreen }       from './scenes/MetaScreen';

// ── Prevent browser defaults that break touch gaming ─────────────────────────
document.addEventListener('contextmenu',  (e) => e.preventDefault());
document.addEventListener('selectstart',  (e) => e.preventDefault());
document.addEventListener('dragstart',    (e) => e.preventDefault());

// ── Pause GameScene when tab is hidden (prevents massive dt on return) ────────
document.addEventListener('visibilitychange', () => {
  if (!window.game) return;
  const gs = window.game.scene.getScene('GameScene');
  if (!gs) return;
  if (document.hidden) { if (gs.scene.isActive()) gs.scene.pause(); }
  else                 { if (gs.scene.isPaused()) gs.scene.resume(); }
});

// ── Prevent double-tap zoom on iOS ──────────────────────────────────────────
let lastTap = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTap < 300) e.preventDefault();
  lastTap = now;
}, { passive: false });

// ── Prevent pinch zoom ──────────────────────────────────────────────────────
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// ── Init mobile adapter ──────────────────────────────────────────────────────
MobileAdapter.init();
(globalThis as any).__MetaProgression = MetaProgression;
void MetaProgression.load();
(window as any).GameSpeed = GameSpeed;

// ── Loading bar progress ─────────────────────────────────────────────────────
function setLoadingProgress(pct: number): void {
  const bar = document.getElementById('loading-bar');
  if (bar) bar.style.width = `${Math.round(pct * 100)}%`;
}
function hideLoading(): void {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 500);
  }
}

// ── Phaser configuration ─────────────────────────────────────────────────────
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width:  GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0A0806',

  // ── Scale: ENVELOP fills screen, centred, maintains aspect ratio ──────────
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: { width: 320, height: 180 },
    max: { width: GAME_WIDTH, height: GAME_HEIGHT },
    expandParent: true,
  },

  // ── Input: multi-touch enabled, active pointer tracking ──────────────────
  input: {
    activePointers:  3,    // support 2-finger gestures
    touch: { capture: true },
  },

  render: {
    antialias:          false,
    antialiasGL:        false,
    pixelArt:           false,
    roundPixels:        true,
    premultipliedAlpha: false,
    transparent:        false,
  },

  physics: {
    default: 'arcade',
    arcade:  { gravity: { x: 0, y: 0 }, debug: false },
  },

  callbacks: {
    preBoot: (game: Phaser.Game) => {
      // Progress bar during asset loading
      game.events.on('progress', (value: number) => setLoadingProgress(value));
      game.events.on('ready',    () => {
        setLoadingProgress(1);
        setTimeout(hideLoading, 200);
        MobileAdapter.init();
(globalThis as any).__MetaProgression = MetaProgression;
void MetaProgression.load(); // re-run after canvas exists
      });
    },
  },

  scene: [BootScene, MenuScene, GameScene, GameOverScene, MetaScreen],

  banner: import.meta.env.DEV
    ? { hidePhaser: false, text: '#E3A63A', background: ['#0A0806', '#AD731E'] }
    : false,
};

declare global { interface Window { game: Phaser.Game; } }
window.game = new Phaser.Game(config);
