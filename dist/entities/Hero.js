// ─────────────────────────────────────────────────────────────────────────────
// Hero.ts — Stage 5B. Skills Q & W added.
//
// Skill Q "Ударная волна" — AoE chaos damage + slow (CD 12 s)
// Skill W "Янтарный щит"  — attack-speed buff to nearby towers (CD 25 s)
//
// All timers are GameSpeed-adjusted so they scale with ×2/×3.
// StatusEffect 'remaining' field omitted from applyEffect() calls —
// Enemy.applyEffect() accepts Omit<StatusEffect, 'remaining'>.
// ─────────────────────────────────────────────────────────────────────────────
import { COLORS, GRID_COLS, GRID_ROWS, TILE_SIZE } from '../config';
import { BASE_CENTER_X, BASE_CENTER_Y } from '../data/mapData';
import { EventBus, GameEvents } from '../utils/EventBus';
const FIELD_W = GRID_COLS * TILE_SIZE; // 720
const FIELD_H = GRID_ROWS * TILE_SIZE; // 720
export class Hero {
    // ─────────────────────────────────────────────────────────────────────────
    constructor(startX = BASE_CENTER_X, startY = BASE_CENTER_Y) {
        Object.defineProperty(this, "x", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "y", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // ── Movement ──────────────────────────────────────────────────────────────
        Object.defineProperty(this, "_targetX", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_targetY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_isMoving", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "MOVE_SPEED", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 150
        }); // px/s, game-speed adjusted
        // ── Auto-attack ───────────────────────────────────────────────────────────
        Object.defineProperty(this, "_attackCooldown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_attackTarget", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "ATTACK_INTERVAL", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0.83
        });
        Object.defineProperty(this, "ATTACK_DAMAGE", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 15
        });
        Object.defineProperty(this, "ATTACK_RANGE", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 80
        });
        Object.defineProperty(this, "DAMAGE_TYPE", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'chaos'
        });
        // ── Skill Q — Shockwave ───────────────────────────────────────────────────
        Object.defineProperty(this, "skillQCooldown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "SKILL_Q_MAX_CD", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 12
        });
        Object.defineProperty(this, "Q_RADIUS", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 90
        });
        Object.defineProperty(this, "Q_DAMAGE", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 40
        });
        Object.defineProperty(this, "Q_SLOW", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0.4
        });
        Object.defineProperty(this, "Q_SLOW_DUR", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 2.5
        });
        // ── Skill W — Amber Shield ────────────────────────────────────────────────
        Object.defineProperty(this, "skillWCooldown", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "SKILL_W_MAX_CD", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 25
        });
        Object.defineProperty(this, "W_RADIUS", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 130
        });
        Object.defineProperty(this, "W_BUFF_VAL", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0.25
        }); // +25 % attack speed
        Object.defineProperty(this, "W_BUFF_DUR", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 6
        });
        // ── Visual ────────────────────────────────────────────────────────────────
        Object.defineProperty(this, "_flashTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_glowT", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.x = startX;
        this.y = startY;
        this._targetX = startX;
        this._targetY = startY;
    }
    // ── Public API ─────────────────────────────────────────────────────────────
    moveTo(worldX, worldY) {
        this._targetX = Math.max(0, Math.min(FIELD_W, worldX));
        this._targetY = Math.max(0, Math.min(FIELD_H, worldY));
        this._isMoving = true;
    }
    update(dt, enemies) {
        this._glowT += dt;
        // ── Movement ────────────────────────────────────────────────────────────
        if (this._isMoving) {
            const dx = this._targetX - this.x;
            const dy = this._targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 2) {
                this.x = this._targetX;
                this.y = this._targetY;
                this._isMoving = false;
            }
            else {
                const step = Math.min(this.MOVE_SPEED * dt, dist);
                this.x += (dx / dist) * step;
                this.y += (dy / dist) * step;
            }
        }
        // ── Cooldowns (all game-speed adjusted) ─────────────────────────────────
        this._attackCooldown = Math.max(0, this._attackCooldown - dt);
        this.skillQCooldown = Math.max(0, this.skillQCooldown - dt);
        this.skillWCooldown = Math.max(0, this.skillWCooldown - dt);
        this._flashTimer = Math.max(0, this._flashTimer - dt);
        // ── Auto-attack ─────────────────────────────────────────────────────────
        if (this._attackCooldown <= 0) {
            if (this._attackTarget &&
                (!this._attackTarget.isActive || this._attackTarget.isDead ||
                    this._dist(this._attackTarget) > this.ATTACK_RANGE)) {
                this._attackTarget = null;
            }
            if (!this._attackTarget) {
                this._attackTarget = this._findNearest(enemies);
            }
            if (this._attackTarget) {
                this._attackTarget.takeDamage(this.ATTACK_DAMAGE, this.DAMAGE_TYPE);
                this._attackCooldown = this.ATTACK_INTERVAL;
                this._flashTimer = 0.15;
            }
        }
    }
    // ── Skill Q — Ударная волна ────────────────────────────────────────────────
    useSkillQ(enemies) {
        if (this.skillQCooldown > 0)
            return false;
        let hitCount = 0;
        for (const enemy of enemies) {
            if (!enemy.isActive || enemy.isDead)
                continue;
            if (this._dist(enemy) <= this.Q_RADIUS) {
                enemy.takeDamage(this.Q_DAMAGE, 'chaos');
                // applyEffect omits 'remaining' — Enemy fills it from duration
                enemy.applyEffect({
                    type: 'slow', value: this.Q_SLOW,
                    duration: this.Q_SLOW_DUR, sourceId: 'hero_q',
                });
                hitCount++;
            }
        }
        this.skillQCooldown = this.SKILL_Q_MAX_CD;
        EventBus.emit(GameEvents.HERO_SKILL_Q, this.x, this.y, this.Q_RADIUS, hitCount);
        return true;
    }
    // ── Skill W — Янтарный щит ────────────────────────────────────────────────
    useSkillW(towers) {
        if (this.skillWCooldown > 0)
            return false;
        let buffCount = 0;
        for (const tower of towers) {
            const dx = tower.x - this.x;
            const dy = tower.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.W_RADIUS) {
                tower.applyBuff({
                    type: 'attack_speed',
                    value: this.W_BUFF_VAL,
                    duration: this.W_BUFF_DUR,
                    remaining: this.W_BUFF_DUR,
                });
                buffCount++;
            }
        }
        this.skillWCooldown = this.SKILL_W_MAX_CD;
        EventBus.emit(GameEvents.HERO_SKILL_W, this.x, this.y, this.W_RADIUS, buffCount);
        return true;
    }
    // ── Rendering ──────────────────────────────────────────────────────────────
    drawTo(g) {
        const cx = this.x;
        const cy = this.y;
        // Ambient glow
        const pulse = 0.08 + Math.sin(this._glowT * Math.PI) * 0.035;
        g.fillStyle(COLORS.amberGlow, pulse);
        g.fillCircle(cx, cy, 20);
        // Body triangle
        g.fillStyle(COLORS.amberGlow, 1);
        g.fillTriangle(cx, cy - 12, cx - 8, cy + 6, cx + 8, cy + 6);
        g.lineStyle(2, COLORS.amberDeep, 1);
        g.strokeTriangle(cx, cy - 12, cx - 8, cy + 6, cx + 8, cy + 6);
        // Attack flash line
        if (this._flashTimer > 0 && this._attackTarget?.isActive && !this._attackTarget.isDead) {
            const alpha = this._flashTimer / 0.15;
            g.lineStyle(1.5, COLORS.amberGlow, alpha * 0.65);
            g.lineBetween(cx, cy, this._attackTarget.x, this._attackTarget.y);
            g.fillStyle(COLORS.amberBright, alpha * 0.8);
            g.fillCircle(this._attackTarget.x, this._attackTarget.y, 4);
        }
        // Movement destination dot + line
        if (this._isMoving) {
            g.lineStyle(1, COLORS.amberPale, 0.35);
            g.lineBetween(cx, cy, this._targetX, this._targetY);
            g.fillStyle(COLORS.amberPale, 0.45);
            g.fillCircle(this._targetX, this._targetY, 3);
        }
    }
    // ── Private ────────────────────────────────────────────────────────────────
    _findNearest(enemies) {
        let best = null;
        let minDist = this.ATTACK_RANGE;
        for (const e of enemies) {
            if (!e.isActive || e.isDead)
                continue;
            const d = this._dist(e);
            if (d < minDist) {
                minDist = d;
                best = e;
            }
        }
        return best;
    }
    _dist(e) {
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
