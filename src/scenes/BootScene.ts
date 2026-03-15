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

  create(): void {
    // Crisp pixels — no bilinear blur for procedural geometry

    // Warm dark background during handoff
    this.cameras.main.setBackgroundColor(COLORS.walnutDark);

    // Procedural game — nothing to load; jump straight to menu
    this.scene.start('MenuScene');
  }
}
