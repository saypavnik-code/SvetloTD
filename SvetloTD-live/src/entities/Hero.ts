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
  private _isMoving  = false;
  private _facing    = -Math.PI / 2; // radians; -π/2 = facing up by default
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
        this._facing = Math.atan2(dy, dx); // track facing direction
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
    const cx = this.x, cy = this.y;
    const pulse = 0.06 + Math.sin(this._glowT * Math.PI) * 0.03;
    const facingX = Math.cos(this._facing);
    const facingY = Math.sin(this._facing);
    const perpX   = -facingY, perpY = facingX;

    // ── Ground shadow ────────────────────────────────────────────────────────
    g.fillStyle(0x000000, 0.25); g.fillEllipse(cx+3, cy+10, 22, 9);

    // ── Ambient aura glow ────────────────────────────────────────────────────
    g.fillStyle(COLORS.amberGlow, pulse * 2.0); g.fillCircle(cx, cy, 22);
    g.fillStyle(COLORS.amberWarm, pulse * 1.2); g.fillCircle(cx, cy, 16);

    // ── Cape / cloak (behind body) ───────────────────────────────────────────
    const capeBase: Phaser.Types.Math.Vector2Like[] = [
      {x: cx - perpX*7 - facingX*5, y: cy - perpY*7 - facingY*5},
      {x: cx + perpX*7 - facingX*5, y: cy + perpY*7 - facingY*5},
      {x: cx + perpX*9 + facingX*10, y: cy + perpY*9 + facingY*10},
      {x: cx - perpX*9 + facingX*10, y: cy - perpY*9 + facingY*10},
    ];
    g.fillStyle(0x2A1808, 0.80); g.fillPoints(capeBase, true);
    g.lineStyle(1, 0x4A2E12, 0.55); g.strokePoints(capeBase, true);

    // ── Body — teardrop torso facing movement direction ──────────────────────
    const shoulderW = 8, hipW = 6, torsoH = 13;
    const bodyPts: Phaser.Types.Math.Vector2Like[] = [
      {x: cx - facingX*torsoH/2 - perpX*shoulderW, y: cy - facingY*torsoH/2 - perpY*shoulderW},
      {x: cx + facingX*torsoH/2 - perpX*hipW,      y: cy + facingY*torsoH/2 - perpY*hipW},
      {x: cx + facingX*(torsoH/2+4),                y: cy + facingY*(torsoH/2+4)},
      {x: cx + facingX*torsoH/2 + perpX*hipW,      y: cy + facingY*torsoH/2 + perpY*hipW},
      {x: cx - facingX*torsoH/2 + perpX*shoulderW, y: cy - facingY*torsoH/2 + perpY*shoulderW},
    ];
    g.fillStyle(COLORS.amberDeep, 0.92); g.fillPoints(bodyPts, true);
    // Armour sheen
    g.fillStyle(COLORS.amberWarm, 0.18); g.fillPoints(bodyPts.slice(0, 3), true);
    g.lineStyle(2, COLORS.amberWarm, 0.80); g.strokePoints(bodyPts, true);

    // ── Head — circle with visor ─────────────────────────────────────────────
    const headX = cx - facingX*torsoH/2 + facingX*2;
    const headY = cy - facingY*torsoH/2 + facingY*2;
    g.fillStyle(COLORS.amberDeep, 0.95); g.fillCircle(headX, headY, 7);
    g.lineStyle(1.5, COLORS.amberBright, 0.70); g.strokeCircle(headX, headY, 7);
    // Visor slit
    g.lineStyle(2, COLORS.amberGlow, 0.85);
    const visorX = headX + facingX*3, visorY = headY + facingY*3;
    g.beginPath(); g.moveTo(visorX-perpX*3, visorY-perpY*3); g.lineTo(visorX+perpX*3, visorY+perpY*3); g.strokePath();
    // Crest plume
    g.lineStyle(1.5, 0x882222, 0.70);
    g.beginPath(); g.moveTo(headX, headY-7); g.lineTo(headX-facingX*2, headY-7-4); g.strokePath();

    // ── Shoulder pauldrons ───────────────────────────────────────────────────
    for (const side of [-1, 1]) {
      const px2 = cx - facingX*3 + perpX*side*9;
      const py2 = cy - facingY*3 + perpY*side*9;
      g.fillStyle(COLORS.amberWarm, 0.80); g.fillCircle(px2, py2, 4.5);
      g.lineStyle(1, COLORS.amberBright, 0.60); g.strokeCircle(px2, py2, 4.5);
    }

    // ── Weapon glow (on dominant hand) ──────────────────────────────────────
    const weapX = cx + facingX*8 - perpX*10;
    const weapY = cy + facingY*8 - perpY*10;
    g.fillStyle(COLORS.amberGlow, 0.75); g.fillCircle(weapX, weapY, 3.5);
    g.fillStyle(0xFFFFFF, 0.50); g.fillCircle(weapX, weapY, 1.5);

    // ── Attack flash beam ────────────────────────────────────────────────────
    if (this._flashTimer > 0 && this._attackTarget?.isActive && !this._attackTarget.isDead) {
      const alpha = this._flashTimer / 0.15;
      // Beam
      g.lineStyle(2.5, COLORS.amberGlow, alpha * 0.80);
      g.lineBetween(cx, cy, this._attackTarget.x, this._attackTarget.y);
      // Impact burst
      g.lineStyle(1.5, COLORS.amberBright, alpha * 0.60);
      for (let i=0;i<6;i++){
        const a = Phaser.Math.DegToRad(i*60);
        g.beginPath();
        g.moveTo(this._attackTarget.x+Math.cos(a)*3, this._attackTarget.y+Math.sin(a)*3);
        g.lineTo(this._attackTarget.x+Math.cos(a)*8, this._attackTarget.y+Math.sin(a)*8);
        g.strokePath();
      }
      g.fillStyle(COLORS.amberBright, alpha * 0.90); g.fillCircle(this._attackTarget.x, this._attackTarget.y, 4);
    }

    // ── Movement waypoint ────────────────────────────────────────────────────
    if (this._isMoving) {
      // Dashed line to target
      g.lineStyle(1, COLORS.amberPale, 0.30);
      g.lineBetween(cx, cy, this._targetX, this._targetY);
      // Chevron marker at target
      g.lineStyle(2, COLORS.amberWarm, 0.70);
      const dx = this._targetX - cx, dy = this._targetY - cy;
      const len = Math.sqrt(dx*dx+dy*dy) || 1;
      const nx2 = dx/len, ny2 = dy/len;
      const px3 = -ny2, py3 = nx2;
      g.beginPath(); g.moveTo(this._targetX-px3*5, this._targetY-py3*5);
      g.lineTo(this._targetX+nx2*7, this._targetY+ny2*7);
      g.lineTo(this._targetX+px3*5, this._targetY+py3*5); g.strokePath();
      g.fillStyle(COLORS.amberWarm, 0.35); g.fillCircle(this._targetX, this._targetY, 5);
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