// BuildSystem.ts — Stage 8. Works with pure-TS Tower (no Container base).

import Phaser from 'phaser';
import { MAP_DATA } from '../data/mapData';
import { TOWER_DEFS, type TowerId } from '../data/towers';
import { Tower } from '../entities/Tower';
import { Projectile } from '../entities/Projectile';
import { Enemy } from '../entities/Enemy';
import { ObjectPool } from '../utils/ObjectPool';
import { EconomyManager } from './EconomyManager';
import { BuilderManager } from './BuilderManager';
import { LumberManager } from './LumberManager';
import { Seats } from './Seats';
import type { SeatId } from '../data/seats';
import { EventBus, GameEvents } from '../utils/EventBus';
import { TILE_SIZE, GRID_COLS, GRID_ROWS, DEPTH, COLORS } from '../config';

type GridOccupancy = boolean[][];

export class BuildSystem {
  private readonly _scene:      Phaser.Scene;
  private readonly _economy:    EconomyManager;
  private readonly _projPool:   ObjectPool<Projectile>;
  private readonly _getEnemies: () => Enemy[];
  private readonly _canInteract: () => boolean;
  private readonly _seats:       Seats;
  private readonly _builders:    BuilderManager;

  readonly towers: Tower[] = [];
  private readonly _occupied: GridOccupancy;

  private _pendingId:   TowerId | null = null;
  private _ghostGfx!:   Phaser.GameObjects.Graphics;
  private _ghostRange!: Phaser.GameObjects.Graphics;
  private _selectedTower: Tower | null = null;
  private _showAllRanges = false;

  onTowerSelected?: (tower: Tower | null) => void;

  constructor(
    scene: Phaser.Scene, economy: EconomyManager,
    projPool: ObjectPool<Projectile>, getEnemies: () => Enemy[],
    canInteract: () => boolean = () => true,
    seats: Seats = new Seats(1),
    // Which tower lines a seat may place and upgrade. Without one every seat owns every builder (the classic game).
    builders: BuilderManager = new BuilderManager(new LumberManager(seats.count), seats.count, 'all'),
  ) {
    this._scene=scene; this._economy=economy; this._projPool=projPool; this._getEnemies=getEnemies;
    this._canInteract = canInteract;
    this._seats = seats;
    this._builders = builders;
    this._occupied = Array.from({length:GRID_ROWS},(_,r)=>Array.from({length:GRID_COLS},(_,c)=>MAP_DATA[r][c]!=='E'));
    this._buildGhostGraphics();
    this._bindInput();
    this._bindTouch(); // [3b:bind-touch]
  }

  // [3b:touch-build] Touch placement: a tap previews, the green button builds, the red one cancels.
  private _touchCell: { col: number; row: number } | null = null;
  private _touchGfx: Phaser.GameObjects.Graphics | null = null;
  private _touchUiDown = false;

  // Touch has no hover and no right button. The DOM event type decides first, wasTouch is the fallback.
  private _isTouchPtr(ptr: Phaser.Input.Pointer): boolean {
    const p = ptr as unknown as { wasTouch?: boolean; pointerType?: string; event?: { type?: string; pointerType?: string } };
    const ev = p.event;
    if (ev && typeof ev.type === 'string') return ev.type.indexOf('touch') === 0 || ev.pointerType === 'touch';
    return p.wasTouch === true || p.pointerType === 'touch';
  }

  private _touchBar(col: number, row: number): { okX: number; noX: number; y: number; size: number } {
    const size = 48, gap = 8;
    const fieldW = GRID_COLS * TILE_SIZE, fieldH = GRID_ROWS * TILE_SIZE;
    const width = size + gap + size;
    const mid = col * TILE_SIZE + TILE_SIZE / 2;
    const okX = Math.max(4, Math.min(fieldW - width - 4, Math.round(mid - width / 2)));
    const above = row * TILE_SIZE - size - 6;
    const y = above >= 4 ? above : Math.min(fieldH - size - 4, (row + 1) * TILE_SIZE + 6);
    return { okX, noX: okX + size + gap, y, size };
  }

  private _touchHit(ptr: Phaser.Input.Pointer): 'ok' | 'no' | null {
    const c = this._touchCell;
    if (!c) return null;
    const b = this._touchBar(c.col, c.row);
    const inside = (x: number): boolean => ptr.x >= x && ptr.x <= x + b.size && ptr.y >= b.y && ptr.y <= b.y + b.size;
    if (inside(b.okX)) return 'ok';
    if (inside(b.noX)) return 'no';
    return null;
  }

  private _drawTouchBar(col: number, row: number, canPlace: boolean): void {
    if (!this._touchGfx) this._touchGfx = this._scene.add.graphics().setDepth(DEPTH.VFX + 4);
    const g = this._touchGfx as Phaser.GameObjects.Graphics;
    const b = this._touchBar(col, row);
    const s = b.size;
    g.clear().setVisible(true);
    // Confirm: a check mark, dimmed while the cell is blocked.
    const okA = canPlace ? 1 : 0.35;
    g.fillStyle(0x14221a, 0.9); g.fillRoundedRect(b.okX, b.y, s, s, 10);
    g.lineStyle(3, COLORS.success, okA); g.strokeRoundedRect(b.okX, b.y, s, s, 10);
    g.lineStyle(5, COLORS.success, okA);
    const ox = b.okX + s / 2, oy = b.y + s / 2;
    g.lineBetween(ox - 11, oy, ox - 3, oy + 9); g.lineBetween(ox - 3, oy + 9, ox + 11, oy - 9);
    // Cancel: a cross.
    g.fillStyle(0x24161a, 0.9); g.fillRoundedRect(b.noX, b.y, s, s, 10);
    g.lineStyle(3, COLORS.danger, 1); g.strokeRoundedRect(b.noX, b.y, s, s, 10);
    g.lineStyle(5, COLORS.danger, 1);
    const nx = b.noX + s / 2, ny = b.y + s / 2;
    g.lineBetween(nx - 9, ny - 9, nx + 9, ny + 9); g.lineBetween(nx + 9, ny - 9, nx - 9, ny + 9);
  }

  private _touchPreview(col: number, row: number): void {
    this._touchCell = { col, row };
    const ok = this._canPlace(col, row);
    this._drawGhost(col, row, ok);
    this._drawTouchBar(col, row, ok);
  }

  private _hideTouchBar(): void {
    if (this._touchGfx) this._touchGfx.setVisible(false);
  }

  private _bindTouch(): void {
    this._scene.input.on('pointerup', () => { this._touchUiDown = false; });
  }
  private _buildGhostGraphics(): void {
    this._ghostGfx   = this._scene.add.graphics().setDepth(DEPTH.GRID+1).setVisible(false);
    this._ghostRange = this._scene.add.graphics().setDepth(DEPTH.TOWER_BASE).setVisible(false);
  }

  private _drawGhost(col: number, row: number, canPlace: boolean): void {
    const data=TOWER_DEFS[this._pendingId!];
    const px=col*TILE_SIZE, py=row*TILE_SIZE;
    const cx=px+TILE_SIZE/2, cy=py+TILE_SIZE/2;
    const fillColor = canPlace ? COLORS.success : COLORS.danger;

    this._ghostGfx.clear().setVisible(true);
    this._ghostGfx.fillStyle(fillColor, 0.25); this._ghostGfx.fillRect(px,py,TILE_SIZE,TILE_SIZE);
    this._ghostGfx.lineStyle(2,fillColor,0.8); this._ghostGfx.strokeRect(px+1,py+1,TILE_SIZE-2,TILE_SIZE-2);
    // Ghost tower shape (preview at 50% alpha)
    this._ghostGfx.fillStyle(data.color, 0.50); this._ghostGfx.fillRect(cx-15,cy-15,30,30);

    this._ghostRange.clear().setVisible(true).setPosition(0,0);
    this._ghostRange.lineStyle(1,data.color,0.45); this._ghostRange.strokeCircle(cx,cy,data.range);
    this._ghostRange.fillStyle(data.color,0.05); this._ghostRange.fillCircle(cx,cy,data.range);
  }

  private _hideGhost(): void { this._ghostGfx.setVisible(false); this._ghostRange.setVisible(false); this._touchCell = null; this._hideTouchBar(); } // [3b:hide]

  private _bindInput(): void {
    this._scene.input.on('pointermove', (arg: unknown) => {
      const ptr = arg as Phaser.Input.Pointer;
      if (!this._canInteract() || !this._pendingId) return;
      const {col,row}=this._ptrToGrid(ptr);
      if (col<0||col>=GRID_COLS||row<0||row>=GRID_ROWS) { this._hideGhost(); return; }
      if (this._isTouchPtr(ptr)) { if (!this._touchUiDown) this._touchPreview(col, row); return; } // [3b:drag-preview]
      this._drawGhost(col, row, this._canPlace(col,row));
    });

    this._scene.input.on('pointerdown', (arg: unknown) => {
      const ptr = arg as Phaser.Input.Pointer;
      if (!this._canInteract() || ptr.button!==0) return;
      const {col,row}=this._ptrToGrid(ptr);
      const inGrid=col>=0&&col<GRID_COLS&&row>=0&&row<GRID_ROWS;
      if (this._pendingId) {
        // [3b:tap-flow] finger: a tap previews the cell; the green button, or a second tap on the same cell, builds; the red button cancels
        if (this._isTouchPtr(ptr)) {
          const hit = this._touchHit(ptr);
          if (hit === 'no') { this._touchUiDown = true; this.cancelPlacement(); return; }
          if (hit === 'ok') {
            this._touchUiDown = true;
            const at = this._touchCell;
            if (at && this._canPlace(at.col, at.row)) { this._touchCell = null; this._hideTouchBar(); this._place(this._pendingId, at.col, at.row); }
            return;
          }
          this._touchUiDown = false;
          if (!inGrid) return;
          const again = this._touchCell !== null && this._touchCell.col === col && this._touchCell.row === row;
          if (again && this._canPlace(col, row)) { this._touchCell = null; this._hideTouchBar(); this._place(this._pendingId, col, row); }
          else this._touchPreview(col, row);
          return;
        }
        if (inGrid&&this._canPlace(col,row)) this._place(this._pendingId,col,row);
        return;
      }
      if (!inGrid) { this._selectTower(null); return; }
      const hit=this.towers.find(t=>t.gridCol===col&&t.gridRow===row);
      this._selectTower(hit??null);
    });

    this._scene.input.on('pointerdown', (arg: unknown) => {
      const ptr = arg as Phaser.Input.Pointer;
      if (!this._canInteract() || ptr.button!==2) return;
      if (this._pendingId) this.cancelPlacement(); else this._selectTower(null);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  selectTowerType(id: TowerId): void {
    if (!this._canInteract()) return;
    if (!this._builders.canPlace(this._seats.active, id)) return;   // only a tower of the seat's own builders
    this._selectTower(null);
    this._pendingId=id; this._touchCell=null; this._hideTouchBar(); // [3b:select]
    this._scene.input.setDefaultCursor('crosshair');
  }

  cancelPlacement(): void {
    this._pendingId=null; this._hideGhost();
    this._scene.input.setDefaultCursor('default');
  }

  upgradeSelected(toId: TowerId): void {
    if (!this._canInteract() || !this._selectedTower) return;
    const t=this._selectedTower, cost=TOWER_DEFS[toId].cost;
    if (!t.data.upgradeTo.includes(toId)) return;
    if (t.ownerSeat !== this._seats.active) return;   // only the owner changes a tower
    if (!this._builders.canUpgrade(t.ownerSeat, toId)) return;   // the line's builder, and mastery for an ultimate
    const lumberCost = this._builders.lumberCostOf(toId);
    // Check both purses first: a refused upgrade must not take the gold and keep the tower.
    if (this._economy.goldOf(t.ownerSeat) < cost || !this._builders.canAffordLumber(t.ownerSeat, lumberCost)) return;
    if (!this._economy.spendGold(cost, t.ownerSeat)) return;
    this._builders.chargeLumber(t.ownerSeat, lumberCost);   // lumber is never refunded: a sale returns gold only
    const col=t.gridCol, row=t.gridRow, invested=t.totalInvested+cost;
    this._removeTower(t);
    const nt=new Tower(this._scene,toId,col,row,this._projPool,this._getEnemies,invested,t.ownerSeat);
    nt.setTargetPriority(t.targetPriority); // an upgrade keeps the player's targeting choice
    this.towers.push(nt); this._occupied[row][col]=true;
    EventBus.emit(GameEvents.TOWER_UPGRADED, nt);
    this._selectTower(nt);
  }

  sellSelected(): void {
    if (!this._canInteract() || !this._selectedTower) return;
    if (this._selectedTower.ownerSeat !== this._seats.active) return;   // only the owner changes a tower
    const rate   = this._economy.sellRefundRate;
    const refund = this._selectedTower.sellValue(rate);
    const owner  = this._selectedTower.ownerSeat;
    this._removeTower(this._selectedTower);
    this._economy.addGold(refund, owner);
    EventBus.emit(GameEvents.TOWER_SOLD, { refund });
    this._selectTower(null);
  }

  /** Cede the selected tower to another seat (owner only, free). It keeps its cell, level and investment. */
  cedeSelected(toSeat: number): boolean {
    const tower = this._selectedTower;
    if (!this._canInteract() || !tower || tower.ownerSeat !== this._seats.active) return false;
    if (!Number.isInteger(toSeat) || toSeat < 0 || toSeat >= this._seats.count || toSeat === tower.ownerSeat) return false;
    const from = tower.ownerSeat;
    tower.transferTo(toSeat as SeatId);
    EventBus.emit(GameEvents.TOWER_CEDED, { tower, from, to: toSeat });
    this._selectTower(null);
    return true;
  }

  toggleAllRanges(): void {
    this._showAllRanges = !this._showAllRanges;
    for (const t of this.towers) t.showRangeGhost(this._showAllRanges);
  }

  get selectedTower(): Tower | null { return this._selectedTower; }
  get isPlacing(): boolean { return this._pendingId !== null; }

  private _canPlace(col: number, row: number): boolean {
    if (this._occupied[row][col]) return false;
    const seat = this._seats.active;
    if (!this._seats.canBuild(seat, row, col)) return false;   // a seat builds only in its own zones
    if (!this._builders.canPlace(seat, this._pendingId!)) return false;
    return this._economy.goldOf(seat) >= TOWER_DEFS[this._pendingId!].cost;
  }

  private _place(id: TowerId, col: number, row: number): void {
    const seat = this._seats.active;
    if (!this._seats.canBuild(seat, row, col) || !this._builders.canPlace(seat, id)) return;
    if (!this._economy.spendGold(TOWER_DEFS[id].cost, seat)) return;
    const t=new Tower(this._scene,id,col,row,this._projPool,this._getEnemies,undefined,seat);
    this.towers.push(t); this._occupied[row][col]=true;
    EventBus.emit(GameEvents.TOWER_PLACED, t);
    this.cancelPlacement();
  }

  private _removeTower(tower: Tower): void {
    const i=this.towers.indexOf(tower); if (i!==-1) this.towers.splice(i,1);
    this._occupied[tower.gridRow][tower.gridCol]=false;
    tower.showRange(false); tower.destroy();
    if (this._selectedTower===tower) this._selectedTower=null;
  }

  private _selectTower(tower: Tower | null): void {
    if (this._selectedTower) this._selectedTower.showRange(false);
    this._selectedTower=tower;
    if (tower) tower.showRange(true,true);
    this.onTowerSelected?.(tower);
  }

  private _ptrToGrid(ptr: Phaser.Input.Pointer) {
    return { col: Math.floor(ptr.x/TILE_SIZE), row: Math.floor(ptr.y/TILE_SIZE) };
  }

  update(delta: number): void {
    for (const t of this.towers) t.update(delta);
  }

  /** Programmatically deselect current tower */
  deselect(): void { this._selectTower(null); }
}
