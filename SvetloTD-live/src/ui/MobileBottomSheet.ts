// MobileBottomSheet.ts — Mobile tower build drawer (Priority 3).
// On mobile: slides up from bottom as a horizontal scrollable strip.
// On desktop: hidden (uses regular TowerPanel instead).

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, FONT_FAMILY } from '../config';
import { BUILDABLE_TOWER_IDS, TOWER_DEFS, type TowerId } from '../data/towers';
import { EconomyManager } from '../systems/EconomyManager';
import { BuildSystem }    from '../systems/BuildSystem';
import { MobileAdapter }  from '../systems/MobileAdapter';

const FONT     = FONT_FAMILY;
const BTN_SIZE = 72;   // px — large enough for thumb tap
const BTN_PAD  = 10;
const BAR_H    = BTN_SIZE + BTN_PAD * 2 + 28; // total strip height
const BAR_Y    = GAME_HEIGHT - BAR_H;

export class MobileBottomSheet {
  private readonly _scene:   Phaser.Scene;
  private readonly _build:   BuildSystem;
  private readonly _economy: EconomyManager;

  private _root!:      Phaser.GameObjects.Container;
  private _btnGfxs:   Phaser.GameObjects.Graphics[] = [];
  private _btnLabels: Phaser.GameObjects.Text[]      = [];
  private _visible    = false;

  constructor(scene: Phaser.Scene, build: BuildSystem, economy: EconomyManager) {
    this._scene   = scene;
    this._build   = build;
    this._economy = economy;

    if (!MobileAdapter.isMobile) return;  // desktop: skip
    this._build_ui();
  }

  private _build_ui(): void {
    const s   = this._scene;
    const cnt = BUILDABLE_TOWER_IDS.length;
    const totalW = cnt * (BTN_SIZE + BTN_PAD) + BTN_PAD;
    const startX = (GAME_WIDTH - totalW) / 2;

    this._root = s.add.container(0, BAR_H)  // start off-screen below
      .setDepth(DEPTH.PANEL + 5);

    // ── Background strip ─────────────────────────────────────────────────────
    const bg = s.add.graphics();
    bg.fillStyle(0x0E0B08, 0.96);
    bg.fillRoundedRect(0, BAR_Y - 4, GAME_WIDTH, BAR_H + 8, 12);
    bg.lineStyle(2, COLORS.amberWarm, 0.80);
    bg.beginPath(); bg.moveTo(0, BAR_Y - 4); bg.lineTo(GAME_WIDTH, BAR_Y - 4); bg.strokePath();
    bg.lineStyle(1, COLORS.amberGlow, 0.25);
    bg.beginPath(); bg.moveTo(0, BAR_Y - 2); bg.lineTo(GAME_WIDTH, BAR_Y - 2); bg.strokePath();
    this._root.add(bg);

    // ── Handle pill ──────────────────────────────────────────────────────────
    const handle = s.add.graphics();
    handle.fillStyle(COLORS.walnutLight, 0.40);
    handle.fillRoundedRect(GAME_WIDTH / 2 - 24, BAR_Y - 16, 48, 6, 3);
    this._root.add(handle);

    // ── Tower buttons ────────────────────────────────────────────────────────
    BUILDABLE_TOWER_IDS.forEach((id, i) => {
      const data = TOWER_DEFS[id];
      const bx   = startX + i * (BTN_SIZE + BTN_PAD);
      const by   = BAR_Y + BTN_PAD;

      // Card background
      const cardG = s.add.graphics();
      this._draw_card(cardG, id, bx, by, false);
      this._root.add(cardG);
      this._btnGfxs.push(cardG);

      // Tower color swatch
      const swG = s.add.graphics();
      swG.fillStyle(data.color, 1);
      swG.fillRoundedRect(bx + BTN_SIZE / 2 - 12, by + 8, 24, 24, 4);
      swG.fillStyle(0xFFFFFF, 0.12);
      swG.fillRoundedRect(bx + BTN_SIZE / 2 - 11, by + 9, 22, 8, 3);
      this._root.add(swG);

      // Tower name — short
      const nameT = s.add.text(bx + BTN_SIZE / 2, by + 40, data.name, {
        fontFamily: FONT, fontSize: '10px', color: COLORS.textPrimary_css,
        align: 'center', wordWrap: { width: BTN_SIZE - 6 },
      }).setOrigin(0.5, 0);
      this._root.add(nameT);

      // Cost
      const costT = s.add.text(bx + BTN_SIZE / 2, by + BTN_SIZE - 16, `${data.cost}◆`, {
        fontFamily: FONT, fontSize: '11px', fontStyle: 'bold',
        color: COLORS.amberGlow_css,
      }).setOrigin(0.5, 0);
      this._root.add(costT);
      this._btnLabels.push(costT);

      // Touch zone — large target
      const zone = s.add.zone(bx, by, BTN_SIZE, BTN_SIZE)
        .setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this._draw_card(cardG, id, bx, by, true));
      zone.on('pointerout',  () => this._draw_card(cardG, id, bx, by, false));
      zone.on('pointerdown', () => {
        if (this._economy.gold < data.cost) {
          // Flash red — can't afford
          s.tweens.addCounter({
            from: 0, to: 3, duration: 300,
            onUpdate: (tw) => {
              const v = Math.floor(tw.getValue() ?? 0);
              cardG.clear();
              this._draw_card(cardG, id, bx, by, v % 2 === 0, 0xCC3322);
            },
            onComplete: () => this._draw_card(cardG, id, bx, by, false),
          });
          return;
        }
        this._build.selectTowerType(id);
        this._hide();
      });
      this._root.add(zone);
    });

    // ── Drag handle to open/close ────────────────────────────────────────────
    const dragZone = s.add.zone(GAME_WIDTH / 2 - 60, BAR_Y - 22, 120, 28)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    dragZone.on('pointerdown', () => this._visible ? this._hide() : this._show());
    this._root.add(dragZone);
  }

  private _draw_card(
    g: Phaser.GameObjects.Graphics, id: TowerId,
    bx: number, by: number, hover: boolean,
    overrideColor?: number,
  ): void {
    const data = TOWER_DEFS[id];
    const canAfford = this._economy.gold >= data.cost;
    const base = overrideColor ?? (hover ? COLORS.amberDeep : 0x1A1510);
    g.clear();
    g.fillStyle(base, hover ? 0.45 : 0.85);
    g.fillRoundedRect(bx, by, BTN_SIZE, BTN_SIZE, 8);
    if (hover && !overrideColor) {
      g.fillStyle(0xFFFFFF, 0.06);
      g.fillRoundedRect(bx + 2, by + 2, BTN_SIZE - 4, BTN_SIZE / 2 - 2, 6);
    }
    const borderCol = overrideColor
      ? overrideColor
      : canAfford
        ? (hover ? COLORS.amberBright : COLORS.amberDeep)
        : COLORS.walnutLight;
    g.lineStyle(hover ? 2 : 1.5, borderCol, hover ? 0.95 : 0.40);
    g.strokeRoundedRect(bx, by, BTN_SIZE, BTN_SIZE, 8);
  }

  show(): void  { if (MobileAdapter.isMobile) this._show(); }
  hide(): void  { if (MobileAdapter.isMobile) this._hide(); }
  get isOpen(): boolean { return this._visible; }

  private _show(): void {
    if (this._visible || !this._root) return;
    this._visible = true;
    this._scene.tweens.add({
      targets: this._root, y: 0, duration: 280, ease: 'Back.easeOut',
    });
    this._refreshAffordability();
  }

  private _hide(): void {
    if (!this._visible || !this._root) return;
    this._visible = false;
    this._scene.tweens.add({
      targets: this._root, y: BAR_H, duration: 220, ease: 'Cubic.easeIn',
    });
  }

  private _refreshAffordability(): void {
    BUILDABLE_TOWER_IDS.forEach((id, i) => {
      const data   = TOWER_DEFS[id];
      const afford = this._economy.gold >= data.cost;
      this._btnLabels[i]?.setColor(afford ? COLORS.amberGlow_css : COLORS.textMuted_css);
    });
  }

  /** Call from GameScene.update to keep cost colours fresh */
  update(): void {
    if (!this._visible || !MobileAdapter.isMobile) return;
    this._refreshAffordability();
  }
}
