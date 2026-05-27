// FloatingTextPool.ts — Stage 10 Phase 5: Scale-pop, size variants, shadow.

import Phaser from 'phaser';
import { DEPTH, FONT_FAMILY, COLORS } from '../config';

const POOL_SIZE = 28;
const FLOAT_DY  = -38;
const DURATION  = 780;

export class FloatingTextPool {
  private readonly _pool:  Phaser.GameObjects.Text[] = [];
  private readonly _scene: Phaser.Scene;
  private _cursor = 0;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
    for (let i = 0; i < POOL_SIZE; i++) {
      const t = scene.add.text(0, 0, '', {
        fontFamily: FONT_FAMILY, fontSize: '14px', fontStyle: 'bold',
        color: COLORS.amberWarm_css,
        stroke: '#0A0806', strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 1, color: '#000000', blur: 4, fill: true },
      });
      t.setDepth(DEPTH.FLOATING_TEXT).setVisible(false).setActive(false);
      this._pool.push(t);
    }
  }

  /**
   * @param size  'sm' = 11px, 'md' = 14px (default), 'lg' = 18px (boss kills)
   */
  show(x: number, y: number, message: string, color?: string, size: 'sm' | 'md' | 'lg' = 'md'): void {
    const t = this._pool[this._cursor];
    this._cursor = (this._cursor + 1) % POOL_SIZE;
    this._scene.tweens.killTweensOf(t);

    const fontSize = size === 'sm' ? '11px' : size === 'lg' ? '20px' : '14px';
    const stroke   = size === 'lg' ? 4 : 3;
    t.setStyle({ fontSize, strokeThickness: stroke });
    t.setText(message);
    t.setColor(color ?? COLORS.amberWarm_css);
    t.setPosition(x - t.width / 2, y - 16).setAlpha(1).setScale(0.6).setVisible(true).setActive(true);

    // Pop scale → 1 then float up + fade
    this._scene.tweens.add({
      targets: t,
      scaleX: { from: 0.6, to: 1.0 },
      scaleY: { from: 0.6, to: 1.0 },
      duration: 120, ease: 'Back.easeOut',
      onComplete: () => {
        this._scene.tweens.add({
          targets: t,
          y: t.y + FLOAT_DY,
          alpha: 0,
          duration: DURATION, ease: 'Cubic.easeOut',
          onComplete: () => t.setVisible(false).setActive(false),
        });
      },
    });
  }
}
