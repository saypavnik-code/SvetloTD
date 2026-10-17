// ─────────────────────────────────────────────────────────────────────────────
// SeatOverlay.ts — What a shared screen shows about the seats: the four zone tints, a bar with one chip per seat
// (click it to take that seat), and a coloured dot on every tower for its owner. Display only: it reads gold and
// lumber and never changes money (the one state it sets is the active seat, through Seats.setActive).
// Only created when more than one seat plays.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { COLORS, DEPTH, FONT_FAMILY, GRID_COLS, GRID_ROWS, TILE_SIZE } from '../config';
import { SEAT_COLORS, SEAT_NAMES, seatOfZone } from '../data/seats';
import type { Tower } from '../entities/Tower';
import type { EconomyManager } from '../systems/EconomyManager';
import type { LumberManager } from '../systems/LumberManager';
import type { Seats } from '../systems/Seats';

const CHIP_X = 736, CHIP_Y = 10, CHIP_W = 126, CHIP_H = 30, CHIP_GAP = 6;

export class SeatOverlay {
  private readonly _scene:   Phaser.Scene;
  private readonly _seats:   Seats;
  private readonly _economy: EconomyManager;
  private readonly _lumber:  LumberManager;
  private readonly _towers:  () => readonly Tower[];
  private readonly _zones:   Phaser.GameObjects.Graphics;
  private readonly _chips:   Phaser.GameObjects.Graphics;
  private readonly _marks:   Phaser.GameObjects.Graphics;
  private readonly _labels:  Phaser.GameObjects.Text[] = [];
  private readonly _hits:    Phaser.GameObjects.Zone[] = [];
  private _drawn = '';

  constructor(scene: Phaser.Scene, seats: Seats, economy: EconomyManager, lumber: LumberManager, towers: () => readonly Tower[]) {
    this._scene = scene; this._seats = seats; this._economy = economy; this._lumber = lumber; this._towers = towers;

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
    for (let seat = 0; seat < seats.count; seat++) {
      const x = CHIP_X + seat * (CHIP_W + CHIP_GAP);
      this._labels.push(scene.add.text(x + 10, CHIP_Y + 7, '', {
        fontFamily: FONT_FAMILY, fontSize: '13px', color: COLORS.textPrimary_css, fontStyle: 'bold',
      }).setDepth(DEPTH.PANEL + 3));
      this._hits.push(scene.add.zone(x, CHIP_Y, CHIP_W, CHIP_H).setOrigin(0).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { this._seats.setActive(seat); }));
    }
    this.update();
  }

  /** Called every frame: redraws the chips only when a number or the active seat changed; marks follow the towers. */
  update(): void {
    const parts: string[] = [];
    for (let seat = 0; seat < this._seats.count; seat++) {
      parts.push(`${SEAT_NAMES[seat]} ${this._economy.goldOf(seat)}◆ ${this._lumber.lumberOf(seat)}д`);
    }
    const key = `${this._seats.active}|${parts.join('|')}`;
    if (key !== this._drawn) {
      this._drawn = key;
      this._chips.clear();
      parts.forEach((text, seat) => {
        const x = CHIP_X + seat * (CHIP_W + CHIP_GAP), active = seat === this._seats.active;
        this._chips.fillStyle(COLORS.walnutDark, active ? 0.95 : 0.6);
        this._chips.fillRoundedRect(x, CHIP_Y, CHIP_W, CHIP_H, 6);
        this._chips.lineStyle(active ? 3 : 1, SEAT_COLORS[seat], active ? 1 : 0.7);
        this._chips.strokeRoundedRect(x, CHIP_Y, CHIP_W, CHIP_H, 6);
        this._labels[seat].setText(text);
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
    this._hits.forEach(zone => zone.destroy());
  }
}
