// FloatingTextPool.ts — Stage 8. Amber colour, 13px bold. No GameSpeed.
import { DEPTH, FONT_FAMILY, COLORS } from '../config';
const POOL_SIZE = 20;
const FLOAT_DY = -30;
const DURATION = 700;
export class FloatingTextPool {
    constructor(scene) {
        Object.defineProperty(this, "_pool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "_scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_cursor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this._scene = scene;
        for (let i = 0; i < POOL_SIZE; i++) {
            const t = scene.add.text(0, 0, '', {
                fontFamily: FONT_FAMILY, fontSize: '13px', fontStyle: 'bold',
                color: COLORS.amberWarm_css,
                stroke: COLORS.walnutDark_css, strokeThickness: 2,
            });
            t.setDepth(DEPTH.FLOATING_TEXT).setVisible(false).setActive(false);
            this._pool.push(t);
        }
    }
    show(x, y, message, color) {
        const t = this._pool[this._cursor];
        this._cursor = (this._cursor + 1) % POOL_SIZE;
        this._scene.tweens.killTweensOf(t);
        t.setText(message);
        t.setColor(color ?? COLORS.amberWarm_css);
        t.setPosition(x - t.width / 2, y - 16).setAlpha(1).setVisible(true).setActive(true);
        this._scene.tweens.add({
            targets: t, y: t.y + FLOAT_DY, alpha: 0,
            duration: DURATION, ease: 'Cubic.easeOut',
            onComplete: () => t.setVisible(false).setActive(false),
        });
    }
}
