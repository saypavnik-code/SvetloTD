// ─────────────────────────────────────────────────────────────────────────────
// SkillBar.ts — Hero skill Q / W UI slots (Phase 4 extraction from GameScene).
// Renders two cooldown slots bottom-left, updates each frame via update().
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { GAME_HEIGHT, COLORS, DEPTH, FONT_MAIN } from '../config';
import { Hero } from '../entities/Hero';
import { SFX  } from '../systems/SFX';

const SLOT = 42;
const PAD  = 8;
const FONT = FONT_MAIN;

interface SkillSlot {
  bg:  Phaser.GameObjects.Graphics;
  key: Phaser.GameObjects.Text;
  cd:  Phaser.GameObjects.Text;
}

export class SkillBar {
  private readonly _scene: Phaser.Scene;
  private readonly _hero:  Hero;
  private _slots:  SkillSlot[] = [];
  private _timer   = 0;
  private _sfx:    SFX | null = null;

  constructor(scene: Phaser.Scene, hero: Hero) {
    this._scene = scene;
    this._hero  = hero;
    this._build();
  }

  setSfx(sfx: SFX | null): void { this._sfx = sfx; }

  private _build(): void {
    const s     = this._scene;
    const baseY = GAME_HEIGHT - 52 - PAD;
    const baseX = PAD;
    const keys  = ['Q', 'W'] as const;

    keys.forEach((key, i) => {
      const sx = baseX + i * (SLOT + PAD);
      const sy = baseY;

      const bg = s.add.graphics().setDepth(DEPTH.HUD);
      bg.lineStyle(1, COLORS.walnutLight, 0.6);
      bg.fillStyle(COLORS.walnutDark, 0.20);
      bg.fillRoundedRect(sx, sy, SLOT, SLOT, 6);
      bg.strokeRoundedRect(sx, sy, SLOT, SLOT, 6);

      const keyTxt = s.add.text(sx + 5, sy + 4, key, {
        fontFamily: FONT, fontSize: '12px',
        color: COLORS.textSecondary_css, fontStyle: 'bold',
      }).setDepth(DEPTH.HUD + 1);

      const cdTxt = s.add.text(sx + SLOT / 2, sy + SLOT / 2 + 4, '✓', {
        fontFamily: FONT, fontSize: '15px',
        color: COLORS.amberWarm_css, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(DEPTH.HUD + 1);

      this._slots.push({ bg, key: keyTxt, cd: cdTxt });
    });
  }

  /** Call from GameScene.update() — throttled internally to 100 ms. */
  update(dtSecs: number): void {
    this._timer -= dtSecs;
    if (this._timer > 0) return;
    this._timer = 0.1;

    const cds    = [this._hero.skillQCooldown, this._hero.skillWCooldown];
    const maxCds = [this._hero.SKILL_Q_MAX_CD, this._hero.SKILL_W_MAX_CD];
    const baseX  = PAD;
    const baseY  = GAME_HEIGHT - 52 - PAD;

    this._slots.forEach((slot, i) => {
      const sx    = baseX + i * (SLOT + PAD);
      const sy    = baseY;
      const cd    = cds[i];
      const ready = cd <= 0;

      slot.bg.clear();
      if (ready) {
        slot.bg.lineStyle(2, COLORS.amberWarm, 0.90);
        slot.bg.fillStyle(COLORS.amberDeep, 0.25);
      } else {
        slot.bg.lineStyle(1, COLORS.walnutLight, 0.45);
        slot.bg.fillStyle(COLORS.walnutDark, 0.50);
      }
      slot.bg.fillRoundedRect(sx, sy, SLOT, SLOT, 6);
      slot.bg.strokeRoundedRect(sx, sy, SLOT, SLOT, 6);

      if (!ready) {
        const frac  = cd / maxCds[i];
        const fillH = Math.round(SLOT * frac);
        slot.bg.fillStyle(COLORS.walnutDark, 0.55);
        slot.bg.fillRoundedRect(sx, sy + SLOT - fillH, SLOT, fillH, 6);
      }

      slot.cd.setText(ready ? '✓' : String(Math.ceil(cd)));
      slot.cd.setColor(ready ? COLORS.amberWarm_css : COLORS.textMuted_css);
    });
  }
}
