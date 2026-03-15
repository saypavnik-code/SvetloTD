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

import Phaser from 'phaser';
import type { Enemy } from './Enemy';
import type { Tower } from './Tower';
import { COLORS, GRID_COLS, GRID_ROWS, TILE_SIZE } from '../config';
import { BASE_CENTER_X, BASE_CENTER_Y } from '../data/mapData';
import { EventBus, GameEvents } from '../utils/EventBus';

const FIELD_W = GRID_COLS * TILE_SIZE;   // 720
const FIELD_H = GRID_ROWS * TILE_SIZE;   // 720

export class Hero {
  x: number;
  y: number;

  // ── Movement ──────────────────────────────────────────────────────────────
  private _targetX:  number;
  private _targetY:  number;
  private _isMoving = false;

  private readonly MOVE_SPEED = 150;   // px/s, game-speed adjusted

  // ── Auto-attack ───────────────────────────────────────────────────────────
  private _attackCooldown = 0;
  private _attackTarget: Enemy | null = null;

  private readonly ATTACK_INTERVAL = 0.83;
  private readonly ATTACK_DAMAGE   = 15;
  private readonly ATTACK_RANGE    = 80;
  private readonly DAMAGE_TYPE     = 'chaos' as const;

  // ── Skill Q — Shockwave ───────────────────────────────────────────────────
  skillQCooldown = 0;
  readonly SKILL_Q_MAX_CD = 12;

  private readonly Q_RADIUS   = 90;
  private readonly Q_DAMAGE   = 40;
  private readonly Q_SLOW     = 0.4;
  private readonly Q_SLOW_DUR = 2.5;

  // ── Skill W — Amber Shield ────────────────────────────────────────────────
  skillWCooldown = 0;
  readonly SKILL_W_MAX_CD = 25;

  private readonly W_RADIUS    = 130;
  private readonly W_BUFF_VAL  = 0.25;   // +25 % attack speed
  private readonly W_BUFF_DUR  = 6;

  // ── Visual ────────────────────────────────────────────────────────────────
  private _flashTimer = 0;
  private _glowT      = 0;

  // ─────────────────────────────────────────────────────────────────────────

  constructor(startX = BASE_CENTER_X, startY = BASE_CENTER_Y) {
    this.x        = startX;
    this.y        = startY;
    this._targetX = startX;
    this._targetY = startY;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  moveTo(worldX: number, worldY: number): void {
    this._targetX = Math.max(0, Math.min(FIELD_W, worldX));
    this._targetY = Math.max(0, Math.min(FIELD_H, worldY));
    this._isMoving = true;
  }

  update(dt: number, enemies: Enemy[]): void {
    this._glowT += dt;

    // ── Movement ────────────────────────────────────────────────────────────
    if (this._isMoving) {
      const dx   = this._targetX - this.x;
      const dy   = this._targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) {
        this.x = this._targetX; this.y = this._targetY;
        this._isMoving = false;
      } else {
        const step = Math.min(this.MOVE_SPEED * dt, dist);
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
      }
    }

    // ── Cooldowns (all game-speed adjusted) ─────────────────────────────────
    this._attackCooldown = Math.max(0, this._attackCooldown - dt);
    this.skillQCooldown  = Math.max(0, this.skillQCooldown  - dt);
    this.skillWCooldown  = Math.max(0, this.skillWCooldown  - dt);
    this._flashTimer     = Math.max(0, this._flashTimer     - dt);

    // ── Auto-attack ─────────────────────────────────────────────────────────
    if (this._attackCooldown <= 0) {
      if (
        this._attackTarget &&
        (!this._attackTarget.isActive || this._attackTarget.isDead ||
          this._dist(this._attackTarget) > this.ATTACK_RANGE)
      ) {
        this._attackTarget = null;
      }
      if (!this._attackTarget) {
        this._attackTarget = this._findNearest(enemies);
      }
      if (this._attackTarget) {
        this._attackTarget.takeDamage(this.ATTACK_DAMAGE, this.DAMAGE_TYPE);
        this._attackCooldown = this.ATTACK_INTERVAL;
        this._flashTimer     = 0.15;
      }
    }
  }

  // ── Skill Q — Ударная волна ────────────────────────────────────────────────
  useSkillQ(enemies: Enemy[]): boolean {
    if (this.skillQCooldown > 0) return false;

    let hitCount = 0;
    for (const enemy of enemies) {
      if (!enemy.isActive || enemy.isDead) continue;
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
  useSkillW(towers: Tower[]): boolean {
    if (this.skillWCooldown > 0) return false;

    let buffCount = 0;
    for (const tower of towers) {
      const dx   = tower.x - this.x;
      const dy   = tower.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.W_RADIUS) {
        tower.applyBuff({
          type: 'attack_speed',
          value:     this.W_BUFF_VAL,
          duration:  this.W_BUFF_DUR,
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

  drawTo(g: Phaser.GameObjects.Graphics): void {
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

  private _findNearest(enemies: Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let minDist = this.ATTACK_RANGE;
    for (const e of enemies) {
      if (!e.isActive || e.isDead) continue;
      const d = this._dist(e);
      if (d < minDist) { minDist = d; best = e; }
    }
    return best;
  }

  private _dist(e: { x: number; y: number }): number {
    const dx = e.x - this.x;
    const dy = e.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
