// ─────────────────────────────────────────────────────────────────────────────
// SeatOverlay.ts — What a shared screen shows about the seats: the four zone tints, a bar with one chip per seat
// (click it to take that seat), three small buttons under every other seat's chip (give gold, give lumber, cede the
// selected tower to that seat) and a coloured dot on every tower for its owner.
// Display and input only: the rules (who may give or cede, nothing created or lost) live in EconomyManager,
// LumberManager and BuildSystem; the buttons just call the actions the scene hands in. The one state it sets itself
// is the active seat, through Seats.setActive. Only created when more than one seat plays.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { COLORS, DEPTH, FONT_FAMILY, GRID_COLS, GRID_ROWS, TILE_SIZE } from '../config';
import { GIVE_GOLD_STEP, GIVE_LUMBER_STEP, SEAT_COLORS, SEAT_NAMES, seatOfZone } from '../data/seats';
import type { Tower } from '../entities/Tower';
import type { EconomyManager } from '../systems/EconomyManager';
import type { LumberManager } from '../systems/LumberManager';
import type { Seats } from '../systems/Seats';

export interface SeatActions {
  giveGold(to: number): void;
  giveLumber(to: number): void;
  cede(to: number): void;
  /** True while the active seat has one of its own towers selected. */
  canCede(): boolean;
}

const CHIP_X = 736, CHIP_Y = 10, CHIP_W = 126, CHIP_H = 30, CHIP_GAP = 6;
const BTN_Y = CHIP_Y + CHIP_H + 4, BTN_W = 38, BTN_H = 15, BTN_GAP = 6;
const BUTTONS = [`+${GIVE_GOLD_STEP}◆`, `+${GIVE_LUMBER_STEP}д`, '⇄'] as const;

export class SeatOverlay {
  private readonly _scene:   Phaser.Scene;
  private readonly _seats:   Seats;
  private readonly _economy: EconomyManager;
  private readonly _lumber:  LumberManager;
  private readonly _towers:  () => readonly Tower[];
  private readonly _actions: SeatActions;
  private readonly _zones:   Phaser.GameObjects.Graphics;
  private readonly _chips:   Phaser.GameObjects.Graphics;
  private readonly _marks:   Phaser.GameObjects.Graphics;
  private readonly _labels:  Phaser.GameObjects.Text[] = [];
  private readonly _btnTxt:  Phaser.GameObjects.Text[][] = [];
  private readonly _hits:    Phaser.GameObjects.Zone[] = [];
  private _drawn = '';

  constructor(scene: Phaser.Scene, seats: Seats, economy: EconomyManager, lumber: LumberManager,
              towers: () => readonly Tower[], actions: SeatActions) {
    this._scene = scene; this._seats = seats; this._economy = economy; this._lumber = lumber;
    this._towers = towers; this._actions = actions;

    // Zone tints: the quadrant of every zone in the colour of the seat that owns it.
    const half = (GRID_COLS * TILE_SIZE) / 2, halfRows = (GRID_ROWS * TILE_SIZE) / 2;
    const corner: Array<[number, number]> = [[0, 0], [half, 0], [half, halfRows], [0, halfRows]];   // zone 0..3
    this._zones = scene.add.graphics().setDepth(DEPTH.GRID);
    corner.forEach(([x, y], zone) => {
      this._zones.fillStyle(SEAT_COLORS[seatOfZone(zone, seats.count)], 0.09);
      this._zones.fillRect(x, y, half, halfRows);
    });
    this._zones.lineStyle(1, COLORS.gridLine, 0.35);
    this._zones.strokeRect(0, 0, half * 2, halfRows * 2);
    this._zones.lineBetween(half, 0, half, halfRows * 2);
    this._zones.lineBetween(0, halfRows, half * 2, halfRows);

    this._chips = scene.add.graphics().setDepth(DEPTH.PANEL + 2);   // above the right panel, which sits at PANEL
    this._marks = scene.add.graphics().setDepth(DEPTH.TOWER_SELECTION);
    const style = { fontFamily: FONT_FAMILY, fontSize: '13px', color: COLORS.textPrimary_css, fontStyle: 'bold' };
    const small = { fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textPrimary_css, fontStyle: 'bold' };
    for (let seat = 0; seat < seats.count; seat++) {
      const x = CHIP_X + seat * (CHIP_W + CHIP_GAP);
      this._labels.push(scene.add.text(x + 10, CHIP_Y + 7, '', style).setDepth(DEPTH.PANEL + 3));
      this._hits.push(scene.add.zone(x, CHIP_Y, CHIP_W, CHIP_H).setOrigin(0).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { this._seats.setActive(seat); }));
      const row: Phaser.GameObjects.Text[] = [];
      BUTTONS.forEach((label, index) => {
        const bx = x + index * (BTN_W + BTN_GAP);
        row.push(scene.add.text(bx + 6, BTN_Y + 1, label, small).setDepth(DEPTH.PANEL + 3));
        this._hits.push(scene.add.zone(bx, BTN_Y, BTN_W, BTN_H).setOrigin(0).setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this._press(seat, index)));
      });
      this._btnTxt.push(row);
    }
    this.update();
  }

  private _press(seat: number, button: number): void {
    if (seat === this._seats.active) return;
    if (button === 0) this._actions.giveGold(seat);
    else if (button === 1) this._actions.giveLumber(seat);
    else this._actions.cede(seat);
  }

  /** Called every frame: redraws the chips only when a number or the active seat changed; marks follow the towers. */
  update(): void {
    const active = this._seats.active;
    const parts: string[] = [];
    for (let seat = 0; seat < this._seats.count; seat++) {
      parts.push(`${SEAT_NAMES[seat]} ${this._economy.goldOf(seat)}◆ ${this._lumber.lumberOf(seat)}д`);
    }
    const enabled = [
      this._economy.goldOf(active) >= GIVE_GOLD_STEP,
      this._lumber.lumberOf(active) >= GIVE_LUMBER_STEP,
      this._actions.canCede(),
    ];
    const key = `${active}|${parts.join('|')}|${enabled.join(',')}`;
    if (key !== this._drawn) {
      this._drawn = key;
      this._chips.clear();
      parts.forEach((text, seat) => {
        const x = CHIP_X + seat * (CHIP_W + CHIP_GAP), isActive = seat === active;
        this._chips.fillStyle(COLORS.walnutDark, isActive ? 0.95 : 0.6);
        this._chips.fillRoundedRect(x, CHIP_Y, CHIP_W, CHIP_H, 6);
        this._chips.lineStyle(isActive ? 3 : 1, SEAT_COLORS[seat], isActive ? 1 : 0.7);
        this._chips.strokeRoundedRect(x, CHIP_Y, CHIP_W, CHIP_H, 6);
        this._labels[seat].setText(text);
        this._btnTxt[seat].forEach((label, index) => {
          label.setVisible(!isActive).setAlpha(enabled[index] ? 1 : 0.35);
          if (isActive) return;
          const bx = x + index * (BTN_W + BTN_GAP);
          this._chips.fillStyle(SEAT_COLORS[seat], enabled[index] ? 0.35 : 0.1);
          this._chips.fillRoundedRect(bx, BTN_Y, BTN_W, BTN_H, 4);
        });
      });
    }
    this._marks.clear();
    for (const tower of this._towers()) {
      this._marks.fillStyle(SEAT_COLORS[tower.ownerSeat], 1);
      this._marks.fillCircle(tower.x - 14, tower.y - 14, 4);
    }
  }

  destroy(): void {
    this._zones.destroy(); this._chips.destroy(); this._marks.destroy();
    this._labels.forEach(label => label.destroy());
    this._btnTxt.forEach(row => row.forEach(label => label.destroy()));
    this._hits.forEach(zone => zone.destroy());
  }
}
