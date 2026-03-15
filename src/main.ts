// main.ts — Entry point. Stage 7: Fix A (visibilitychange pause), amber bg.

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { GameSpeed } from './systems/GameSpeed';
import { BootScene     } from './scenes/BootScene';
import { MenuScene     } from './scenes/MenuScene';
import { GameScene     } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('selectstart',  (e) => e.preventDefault());
document.addEventListener('dragstart',    (e) => e.preventDefault());

// Fix A: pause GameScene when tab is hidden → prevents massive delta on return.
document.addEventListener('visibilitychange', () => {
  if (!window.game) return;
  const gs = window.game.scene.getScene('GameScene');
  if (!gs) return;
  if (document.hidden) { if (gs.scene.isActive()) gs.scene.pause(); }
  else                 { if (gs.scene.isPaused()) gs.scene.resume(); }
});

(window as unknown as Record<string, unknown>).GameSpeed = GameSpeed;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH, height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#E8E2D6',
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scale: {
    mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH,
    min: { width: 640, height: 360 }, max: { width: GAME_WIDTH, height: GAME_HEIGHT },
  },
  render: { antialias: false, antialiasGL: false, pixelArt: false, roundPixels: true, premultipliedAlpha: false },
  banner: import.meta.env.DEV
    ? { hidePhaser: false, text: '#2E1A12', background: ['#F0EEE9', '#F5A623'] }
    : false,
};

declare global { interface Window { game: Phaser.Game; } }
window.game = new Phaser.Game(config);
