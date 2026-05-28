// BuildSystem.ts — Stage 8. Works with pure-TS Tower (no Container base).
import { MAP_DATA } from '../data/mapData';
import { TOWER_DEFS } from '../data/towers';
import { Tower } from '../entities/Tower';
import { EventBus, GameEvents } from '../utils/EventBus';
import { TILE_SIZE, GRID_COLS, GRID_ROWS, DEPTH, COLORS } from '../config';
export class BuildSystem {
    constructor(scene, economy, projPool, getEnemies) {
        Object.defineProperty(this, "_scene", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_economy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_projPool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_getEnemies", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "towers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "_occupied", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_pendingId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_ghostGfx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_ghostRange", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_selectedTower", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_showAllRanges", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "onTowerSelected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._scene = scene;
        this._economy = economy;
        this._projPool = projPool;
        this._getEnemies = getEnemies;
        this._occupied = Array.from({ length: GRID_ROWS }, (_, r) => Array.from({ length: GRID_COLS }, (_, c) => MAP_DATA[r][c] !== 'E'));
        this._buildGhostGraphics();
        this._bindInput();
    }
    _buildGhostGraphics() {
        this._ghostGfx = this._scene.add.graphics().setDepth(DEPTH.GRID + 1).setVisible(false);
        this._ghostRange = this._scene.add.graphics().setDepth(DEPTH.TOWER_BASE).setVisible(false);
    }
    _drawGhost(col, row, canPlace) {
        const data = TOWER_DEFS[this._pendingId];
        const px = col * TILE_SIZE, py = row * TILE_SIZE;
        const cx = px + TILE_SIZE / 2, cy = py + TILE_SIZE / 2;
        const fillColor = canPlace ? COLORS.success : COLORS.danger;
        this._ghostGfx.clear().setVisible(true);
        this._ghostGfx.fillStyle(fillColor, 0.25);
        this._ghostGfx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        this._ghostGfx.lineStyle(2, fillColor, 0.8);
        this._ghostGfx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        // Ghost tower shape (preview at 50% alpha)
        this._ghostGfx.fillStyle(data.color, 0.50);
        this._ghostGfx.fillRect(cx - 15, cy - 15, 30, 30);
        this._ghostRange.clear().setVisible(true).setPosition(0, 0);
        this._ghostRange.lineStyle(1, data.color, 0.45);
        this._ghostRange.strokeCircle(cx, cy, data.range);
        this._ghostRange.fillStyle(data.color, 0.05);
        this._ghostRange.fillCircle(cx, cy, data.range);
    }
    _hideGhost() { this._ghostGfx.setVisible(false); this._ghostRange.setVisible(false); }
    _bindInput() {
        this._scene.input.on('pointermove', (arg) => {
            const ptr = arg;
            if (!this._pendingId)
                return;
            const { col, row } = this._ptrToGrid(ptr);
            if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) {
                this._hideGhost();
                return;
            }
            this._drawGhost(col, row, this._canPlace(col, row));
        });
        this._scene.input.on('pointerdown', (arg) => {
            const ptr = arg;
            if (ptr.button !== 0)
                return;
            const { col, row } = this._ptrToGrid(ptr);
            const inGrid = col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
            if (this._pendingId) {
                if (inGrid && this._canPlace(col, row))
                    this._place(this._pendingId, col, row);
                return;
            }
            if (!inGrid) {
                this._selectTower(null);
                return;
            }
            const hit = this.towers.find(t => t.gridCol === col && t.gridRow === row);
            this._selectTower(hit ?? null);
        });
        this._scene.input.on('pointerdown', (arg) => {
            const ptr = arg;
            if (ptr.button !== 2)
                return;
            if (this._pendingId)
                this.cancelPlacement();
            else
                this._selectTower(null);
        });
    }
    // ── Public API ─────────────────────────────────────────────────────────────
    selectTowerType(id) {
        this._selectTower(null);
        this._pendingId = id;
        this._scene.input.setDefaultCursor('crosshair');
    }
    cancelPlacement() {
        this._pendingId = null;
        this._hideGhost();
        this._scene.input.setDefaultCursor('default');
    }
    upgradeSelected(toId) {
        if (!this._selectedTower)
            return;
        const t = this._selectedTower, cost = TOWER_DEFS[toId].cost;
        if (!this._economy.spendGold(cost))
            return;
        const col = t.gridCol, row = t.gridRow, invested = t.totalInvested + cost;
        this._removeTower(t);
        const nt = new Tower(this._scene, toId, col, row, this._projPool, this._getEnemies, invested);
        this.towers.push(nt);
        this._occupied[row][col] = true;
        EventBus.emit(GameEvents.TOWER_UPGRADED, nt);
        this._selectTower(nt);
    }
    sellSelected() {
        if (!this._selectedTower)
            return;
        const rate = this._economy.sellRefundRate;
        const refund = this._selectedTower.sellValue(rate);
        this._removeTower(this._selectedTower);
        this._economy.addGold(refund);
        EventBus.emit(GameEvents.TOWER_SOLD, { refund });
        this._selectTower(null);
    }
    toggleAllRanges() {
        this._showAllRanges = !this._showAllRanges;
        for (const t of this.towers)
            t.showRangeGhost(this._showAllRanges);
    }
    get selectedTower() { return this._selectedTower; }
    get isPlacing() { return this._pendingId !== null; }
    _canPlace(col, row) {
        if (this._occupied[row][col])
            return false;
        return this._economy.gold >= TOWER_DEFS[this._pendingId].cost;
    }
    _place(id, col, row) {
        if (!this._economy.spendGold(TOWER_DEFS[id].cost))
            return;
        const t = new Tower(this._scene, id, col, row, this._projPool, this._getEnemies);
        this.towers.push(t);
        this._occupied[row][col] = true;
        EventBus.emit(GameEvents.TOWER_PLACED, t);
        this.cancelPlacement();
    }
    _removeTower(tower) {
        const i = this.towers.indexOf(tower);
        if (i !== -1)
            this.towers.splice(i, 1);
        this._occupied[tower.gridRow][tower.gridCol] = false;
        tower.showRange(false);
        tower.destroy();
        if (this._selectedTower === tower)
            this._selectedTower = null;
    }
    _selectTower(tower) {
        if (this._selectedTower)
            this._selectedTower.showRange(false);
        this._selectedTower = tower;
        if (tower)
            tower.showRange(true, true);
        this.onTowerSelected?.(tower);
    }
    _ptrToGrid(ptr) {
        return { col: Math.floor(ptr.x / TILE_SIZE), row: Math.floor(ptr.y / TILE_SIZE) };
    }
    update(delta) {
        for (const t of this.towers)
            t.update(delta);
    }
    /** Programmatically deselect current tower */
    deselect() { this._selectTower(null); }
}
