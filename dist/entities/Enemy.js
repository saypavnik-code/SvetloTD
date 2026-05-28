// Enemy.ts — Stage 8. Pure TS class (no Phaser Container).
// Batch-rendered via enemyGfx / healthbarGfx in GameScene.
import Phaser from 'phaser';
import { ENEMY_DEFS } from '../data/enemies';
import { BASE_CENTER_X, BASE_CENTER_Y } from '../data/mapData';
import { EventBus, GameEvents } from '../utils/EventBus';
import { COLORS } from '../config';
import { StatusEffectSystem } from '../systems/StatusEffectSystem';
import { dmgCalc } from '../systems/DamageCalculator';
export class Enemy {
    get isDead() { return this._isDead; }
    get radius() { return this.def?.radius ?? 8; }
    // No Phaser scene dependency — pure data class
    constructor() {
        // Pool / lifecycle
        Object.defineProperty(this, "isActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_isDead", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // Dying animation — brief scale-down + flash before pool return
        Object.defineProperty(this, "_isDying", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_dyingTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // World position (read by Tower, Projectile, GameScene)
        Object.defineProperty(this, "x", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "y", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // Stats
        Object.defineProperty(this, "def", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "maxHp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "fx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new StatusEffectSystem()
        });
        // Movement
        Object.defineProperty(this, "_baseSpeed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_speed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_isFlying", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_targetX", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_targetY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_waypoints", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "_wpIndex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_angle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // radians, wyvern facing
        // Visual state
        Object.defineProperty(this, "_flashTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // ms — white-hit flash
        Object.defineProperty(this, "_bossGlowT", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_isHealing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_healAcc", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    // ── Init ──────────────────────────────────────────────────────────────────
    init(enemyId, waypoints, opts = {}) {
        const def = ENEMY_DEFS[enemyId];
        this.def = def;
        this.hp = Math.round(def.hp * (opts.hpMult ?? 1));
        this.maxHp = this.hp;
        this._baseSpeed = def.speed * (opts.speedMult ?? 1);
        this._speed = this._baseSpeed;
        this._isFlying = def.isFlying;
        this._isHealing = opts.isHealing ?? false;
        this._healAcc = 0;
        this._isDead = false;
        this._isDying = false;
        this._dyingTimer = 0;
        this._bossGlowT = 0;
        this._flashTimer = 0;
        this.isActive = true;
        this.fx.reset();
        if (this._isFlying) {
            const spawn = waypoints[0];
            this.x = spawn.x;
            this.y = spawn.y;
            this._targetX = BASE_CENTER_X;
            this._targetY = BASE_CENTER_Y;
            this._angle = Math.atan2(BASE_CENTER_Y - spawn.y, BASE_CENTER_X - spawn.x);
        }
        else {
            this._waypoints = waypoints;
            this._wpIndex = 0;
            this.x = waypoints[0].x;
            this.y = waypoints[0].y;
        }
    }
    // ── Update — dt = GameSpeed-adjusted seconds ───────────────────────────────
    update(dt) {
        // Dying animation — runs even though isDead is true
        if (this._isDying) {
            this._dyingTimer -= dt;
            if (this._dyingTimer <= 0) {
                this._isDying = false;
                this.reset();
            }
            return;
        }
        if (!this.isActive)
            return;
        const { slowFraction } = this.fx.update(dt * 1000, (dmg, type) => this.takeDamage(dmg, type));
        this._speed = this._baseSpeed * (1 - slowFraction);
        if (this._isHealing && this.hp < this.maxHp) {
            this._healAcc += dt;
            if (this._healAcc >= 1) {
                this._healAcc -= 1;
                this.hp = Math.min(this.maxHp, this.hp + Math.ceil(this.maxHp * 0.01));
            }
        }
        if (this.def.isBoss)
            this._bossGlowT += dt;
        if (this._flashTimer > 0) {
            this._flashTimer -= dt * 1000;
        }
        if (this._isFlying) {
            const dx = this._targetX - this.x, dy = this._targetY - this.y;
            if (dx !== 0 || dy !== 0)
                this._angle = Math.atan2(dy, dx);
            this._moveDirect(dt);
        }
        else {
            this._moveAlongPath(dt);
        }
    }
    _moveDirect(dt) {
        const dx = this._targetX - this.x, dy = this._targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy), step = this._speed * dt;
        if (dist <= step) {
            this.x = this._targetX;
            this.y = this._targetY;
            this._leak();
        }
        else {
            this.x += dx / dist * step;
            this.y += dy / dist * step;
        }
    }
    _moveAlongPath(dt) {
        if (this._wpIndex >= this._waypoints.length) {
            this._leak();
            return;
        }
        const tgt = this._waypoints[this._wpIndex];
        const dx = tgt.x - this.x, dy = tgt.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy), step = this._speed * dt;
        if (dist <= step) {
            this.x = tgt.x;
            this.y = tgt.y;
            this._wpIndex++;
            if (this._wpIndex >= this._waypoints.length)
                this._leak();
        }
        else {
            this.x += dx / dist * step;
            this.y += dy / dist * step;
        }
    }
    // ── Damage — Fix C guard ───────────────────────────────────────────────────
    takeDamage(baseDamage, damageType) {
        if (!this.isActive || this._isDead)
            return false;
        const armorRed = this.fx.effects.filter(e => e.type === 'armor_reduce').reduce((s, e) => s + e.value, 0);
        const finalDmg = dmgCalc.calculate(baseDamage, damageType, this.def.armorType, armorRed);
        this.hp = Math.max(0, this.hp - finalDmg);
        this._flashTimer = 80;
        if (this.hp <= 0) {
            this._die();
            return true;
        }
        return false;
    }
    applyEffect(effect) {
        if (this._isDead)
            return;
        this.fx.apply(effect);
    }
    _die() {
        this._isDead = true;
        // Emit immediately so gold/kills register at death, not after animation
        EventBus.emit(GameEvents.ENEMY_KILLED, { enemy: this, goldReward: this.def.bounty });
        // Start dying animation — actual pool return happens when timer expires
        this._isDying = true;
        this._dyingTimer = Enemy.DYING_DURATION;
        // Stop movement and effects during animation
        this.fx.reset();
    }
    _leak() {
        if (this._isDead)
            return;
        this._isDead = true;
        EventBus.emit(GameEvents.ENEMY_REACHED_END, this);
        this.reset();
    }
    reset() {
        this.isActive = false;
        this._isDead = false;
        this._isDying = false;
        this._dyingTimer = 0;
        this._waypoints = [];
        this._wpIndex = 0;
        this.hp = 0;
        this._flashTimer = 0;
        this._bossGlowT = 0;
        this.fx.reset();
    }
    // ── Batch draw ─────────────────────────────────────────────────────────────
    drawTo(g) {
        // Dying animation — shrink + white flash, then hidden
        if (this._isDying) {
            const t = this._dyingTimer / Enemy.DYING_DURATION; // 1→0
            const scale = t;
            const r = this.radius * scale;
            if (r < 0.5)
                return;
            // Alternate white/normal every 0.06 s for flash effect
            const flashOn = Math.floor(this._dyingTimer / 0.06) % 2 === 0;
            g.fillStyle(flashOn ? 0xFFFFFF : this.def.color, t * 0.9);
            g.fillCircle(this.x, this.y, r);
            return;
        }
        const r = this.radius;
        const cx = this.x, cy = this.y;
        const flash = this._flashTimer > 0;
        const c = flash ? 0xFFFFFF : this.def.color;
        const cd = this.def.colorDark;
        switch (this.def.id) {
            case 'grunt':
                g.fillStyle(c, 1);
                g.fillCircle(cx, cy, r);
                g.lineStyle(1.5, cd, 0.9);
                g.strokeCircle(cx, cy, r);
                g.lineStyle(1.5, cd, 0.7);
                for (let i = 0; i < 4; i++) {
                    const a = Phaser.Math.DegToRad(45 + i * 90);
                    g.beginPath();
                    g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
                    g.lineTo(cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4));
                    g.strokePath();
                }
                break;
            case 'runner': {
                const pts = [{ x: cx, y: cy - r * 1.5 }, { x: cx + r, y: cy }, { x: cx, y: cy + r * 1.5 }, { x: cx - r, y: cy }];
                g.fillStyle(c, 1);
                g.fillPoints(pts, true);
                g.lineStyle(1, cd, 0.8);
                g.strokePoints(pts, true);
                break;
            }
            case 'golem': {
                const pts = this._hex(cx, cy, r, 0);
                g.fillStyle(c, 1);
                g.fillPoints(pts, true);
                g.lineStyle(2, cd, 1);
                g.strokePoints(pts, true);
                g.lineStyle(1, cd, 0.35);
                g.strokePoints(this._hex(cx, cy, r - 3, 0), true);
                break;
            }
            case 'wyvern': {
                const nx = Math.cos(this._angle), ny = Math.sin(this._angle), px = -ny, py = nx;
                const pts = [{ x: cx + nx * r * 1.4, y: cy + ny * r * 1.4 }, { x: cx + px * r * 0.8, y: cy + py * r * 0.8 }, { x: cx - nx * r * 0.9, y: cy - ny * r * 0.9 }, { x: cx - px * r * 0.8, y: cy - py * r * 0.8 }];
                g.fillStyle(c, 1);
                g.fillPoints(pts, true);
                g.lineStyle(1, cd, 0.7);
                g.strokePoints(pts, true);
                break;
            }
            case 'boss_goliath': {
                const glowA = 0.10 + 0.15 * (0.5 + Math.sin(this._bossGlowT * Math.PI * 2) * 0.5);
                g.fillStyle(COLORS.danger, glowA);
                g.fillCircle(cx, cy, r + 8);
                const pts = this._hex(cx, cy, r, 30);
                g.fillStyle(c, 1);
                g.fillPoints(pts, true);
                g.lineStyle(2, COLORS.danger, 0.9);
                g.strokePoints(pts, true);
                g.lineStyle(1, cd, 0.5);
                g.strokePoints(this._hex(cx, cy, r - 4, 30), true);
                break;
            }
        }
        // FX overlays
        if (this.fx.hasSlow()) {
            g.lineStyle(2, COLORS.seaMuted, 0.75);
            g.strokeCircle(cx, cy, r + 3);
        }
        if (this.fx.hasArmorReduce()) {
            g.lineStyle(1.5, COLORS.amberWarm, 0.85);
            for (let i = 0; i < 4; i++) {
                const a = Phaser.Math.DegToRad(45 + i * 90);
                g.beginPath();
                g.moveTo(cx + Math.cos(a) * (r + 1), cy + Math.sin(a) * (r + 1));
                g.lineTo(cx + Math.cos(a) * (r + 5), cy + Math.sin(a) * (r + 5));
                g.strokePath();
            }
        }
    }
    drawHealthbarTo(g) {
        if (this._isDying || this.hp >= this.maxHp)
            return;
        const ratio = this.hp / this.maxHp;
        const barW = this.radius * 2.4;
        const barX = this.x - barW / 2;
        const barY = this.y - this.radius - 8;
        g.fillStyle(COLORS.walnutDark, 0.45);
        g.fillRect(barX, barY, barW, 3);
        const col = ratio > 0.6 ? COLORS.success : ratio > 0.3 ? COLORS.amberWarm : COLORS.danger;
        g.fillStyle(col, 1);
        g.fillRect(barX, barY, barW * ratio, 3);
    }
    // Flying shadow (drawn under main enemy layer) — called from GameScene
    drawShadowTo(g) {
        if (!this._isFlying || !this.isActive)
            return;
        const r = this.radius;
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(this.x + 4, this.y + 6, r * 2.4, r * 0.85);
    }
    _hex(cx, cy, r, rot) {
        const pts = [];
        for (let i = 0; i < 6; i++) {
            const a = Phaser.Math.DegToRad(rot + 60 * i);
            pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
        return pts;
    }
}
Object.defineProperty(Enemy, "DYING_DURATION", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 0.28
}); // seconds
