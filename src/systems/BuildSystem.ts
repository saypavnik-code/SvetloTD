// BuildSystem.ts — Stage 8. Works with pure-TS Tower (no Container base).

import Phaser from 'phaser';
import { MAP_DATA } from '../data/mapData';
import { TOWER_DEFS, type TowerId } from '../data/towers';
import { Tower } from '../entities/Tower';
import { Projectile } from '../entities/Projectile';
import { Enemy } from '../entities/Enemy';
import { ObjectPool } from '../utils/ObjectPool';
import { EconomyManager } from './EconomyManager';
import { EventBus, GameEvents } from '../utils/EventBus';
import { TILE_SIZE, GRID_COLS, GRID_ROWS, DEPTH, COLORS } from '../config';

type GridOccupancy = boolean[][];

export class BuildSystem {
  private readonly _scene:      Phaser.Scene;
  private readonly _economy:    EconomyManager;
  private readonly _projPool:   ObjectPool<Projectile>;
  private readonly _getEnemies: () => Enemy[];

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
  ) {
    this._scene=scene; this._economy=economy; this._projPool=projPool; this._getEnemies=getEnemies;
    this._occupied = Array.from({length:GRID_ROWS},(_,r)=>Array.from({length:GRID_COLS},(_,c)=>MAP_DATA[r][c]!=='E'));
    this._buildGhostGraphics();
    this._bindInput();
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

  private _hideGhost(): void { this._ghostGfx.setVisible(false); this._ghostRange.setVisible(false); }

  private _bindInput(): void {
    this._scene.input.on('pointermove', (arg: unknown) => {
      const ptr = arg as Phaser.Input.Pointer;
      if (!this._pendingId) return;
      const {col,row}=this._ptrToGrid(ptr);
      if (col<0||col>=GRID_COLS||row<0||row>=GRID_ROWS) { this._hideGhost(); return; }
      this._drawGhost(col, row, this._canPlace(col,row));
    });

    this._scene.input.on('pointerdown', (arg: unknown) => {
      const ptr = arg as Phaser.Input.Pointer;
      if (ptr.button!==0) return;
      const {col,row}=this._ptrToGrid(ptr);
      const inGrid=col>=0&&col<GRID_COLS&&row>=0&&row<GRID_ROWS;
      if (this._pendingId) {
        if (inGrid&&this._canPlace(col,row)) this._place(this._pendingId,col,row);
        return;
      }
      if (!inGrid) { this._selectTower(null); return; }
      const hit=this.towers.find(t=>t.gridCol===col&&t.gridRow===row);
      this._selectTower(hit??null);
    });

    this._scene.input.on('pointerdown', (arg: unknown) => {
      const ptr = arg as Phaser.Input.Pointer;
      if (ptr.button!==2) return;
      if (this._pendingId) this.cancelPlacement(); else this._selectTower(null);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  selectTowerType(id: TowerId): void {
    this._selectTower(null);
    this._pendingId=id;
    this._scene.input.setDefaultCursor('crosshair');
  }

  cancelPlacement(): void {
    this._pendingId=null; this._hideGhost();
    this._scene.input.setDefaultCursor('default');
  }

  upgradeSelected(toId: TowerId): void {
    if (!this._selectedTower) return;
    const t=this._selectedTower, cost=TOWER_DEFS[toId].cost;
    if (!this._economy.spendGold(cost)) return;
    const col=t.gridCol, row=t.gridRow, invested=t.totalInvested+cost;
    this._removeTower(t);
    const nt=new Tower(this._scene,toId,col,row,this._projPool,this._getEnemies,invested);
    this.towers.push(nt); this._occupied[row][col]=true;
    EventBus.emit(GameEvents.TOWER_UPGRADED, nt);
    this._selectTower(nt);
  }

  sellSelected(): void {
    if (!this._selectedTower) return;
    const refund=this._selectedTower.sellValue;
    this._removeTower(this._selectedTower);
    this._economy.addGold(refund);
    EventBus.emit(GameEvents.TOWER_SOLD, { refund });
    this._selectTower(null);
  }

  toggleAllRanges(): void {
    this._showAllRanges = !this._showAllRanges;
    for (const t of this.towers) t.showRangeGhost(this._showAllRanges);
  }

  get selectedTower(): Tower | null { return this._selectedTower; }
  get isPlacing(): boolean { return this._pendingId !== null; }

  private _canPlace(col: number, row: number): boolean {
    if (this._occupied[row][col]) return false;
    return this._economy.gold >= TOWER_DEFS[this._pendingId!].cost;
  }

  private _place(id: TowerId, col: number, row: number): void {
    if (!this._economy.spendGold(TOWER_DEFS[id].cost)) return;
    const t=new Tower(this._scene,id,col,row,this._projPool,this._getEnemies);
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
