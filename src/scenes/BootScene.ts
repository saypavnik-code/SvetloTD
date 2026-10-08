// ─────────────────────────────────────────────────────────────────────────────
// BootScene.ts  —  First scene. Sets up global Phaser config, then hands off
//                  to MenuScene immediately.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { COLORS } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.load.image('tile_grass', 'assets/tiles/grass.png');
    this.load.image('tile_path', 'assets/tiles/path.png');
    this.load.image('tile_base', 'assets/tiles/base.png');
  }

  create(): void {
    // Crisp pixels — no bilinear blur for procedural geometry

    // Warm dark background during handoff
    this.cameras.main.setBackgroundColor(COLORS.walnutDark);

    // Procedural game — nothing to load; jump straight to menu
    this.scene.start('MenuScene');
  }
}
