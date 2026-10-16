// ─────────────────────────────────────────────────────────────────────────────
// SpriteViews.ts — Sprite layer for towers, enemies and the hero.
//
// The logic classes keep their state and their overlay drawing (range, buffs, health bars, status
// rings); this class only owns one Image per live entity, created lazily, moved every frame and
// destroyed when the entity is sold, dies or leaves. Entities are pooled, so an Enemy that is
// reused gets a fresh image.
// ─────────────────────────────────────────────────────────────────────────────

import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { Enemy } from '../entities/Enemy';
import type { Hero } from '../entities/Hero';
import type { Tower } from '../entities/Tower';

const TOWER_SIZE = 48;
const HERO_SIZE = 40;
const ENEMY_SIZE: Record<string, number> = { grunt: 32, runner: 28, golem: 44, wyvern: 42, boss_goliath: 70 };

interface TowerView { image: Phaser.GameObjects.Image; key: string }
interface EnemyView { image: Phaser.GameObjects.Image; lastX: number; lastY: number; flip: boolean; heading: number; phase: number }
interface HeroView { image: Phaser.GameObjects.Image; lastX: number; flip: boolean }

export class SpriteViews {
  private readonly _scene: Phaser.Scene;
  private readonly _towers = new Map<Tower, TowerView>();
  private readonly _enemies = new Map<Enemy, EnemyView>();
  private _hero: HeroView | null = null;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
  }

  /** Live image counts (tests and leak checks). */
  get counts(): { towers: number; enemies: number; hero: number } {
    return { towers: this._towers.size, enemies: this._enemies.size, hero: this._hero ? 1 : 0 };
  }

  update(towers: readonly Tower[], enemies: readonly Enemy[], hero: Hero, nowMs: number): void {
    this._syncTowers(towers);
    this._syncEnemies(enemies, nowMs);
    this._syncHero(hero, nowMs);
  }

  private _syncTowers(towers: readonly Tower[]): void {
    const live = new Set<Tower>(towers);
    for (const [tower, view] of this._towers) {
      if (!live.has(tower)) { view.image.destroy(); this._towers.delete(tower); }
    }
    for (const tower of towers) {
      const key = `spr_${tower.towerId}`;
      let view = this._towers.get(tower);
      if (!view) {
        view = { image: this._scene.add.image(tower.x, tower.y, key).setDepth(DEPTH.TOWER + 0.4), key };
        this._towers.set(tower, view);
      } else if (view.key !== key) {
        view.image.setTexture(key);
        view.key = key;
      }
      const size = TOWER_SIZE * tower.spawnBounce;
      view.image.setPosition(tower.x, tower.y - 4).setDisplaySize(size, size);
    }
  }

  private _syncEnemies(enemies: readonly Enemy[], nowMs: number): void {
    const live = new Set<Enemy>();
    for (const enemy of enemies) if (enemy.isActive) live.add(enemy);
    for (const [enemy, view] of this._enemies) {
      if (!live.has(enemy)) { view.image.destroy(); this._enemies.delete(enemy); }
    }
    for (const enemy of live) {
      let view = this._enemies.get(enemy);
      if (!view) {
        view = {
          image: this._scene.add.image(enemy.x, enemy.y, `spr_${enemy.def.id}`).setDepth(DEPTH.ENEMY + 0.4),
          lastX: enemy.x, lastY: enemy.y, flip: false, heading: 0, phase: (enemy.x * 7 + enemy.y * 3) % 6.28,
        };
        this._enemies.set(enemy, view);
      }
      const dx = enemy.x - view.lastX;
      const dy = enemy.y - view.lastY;
      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
        if (Math.abs(dx) > 0.05 && Math.abs(dx) >= Math.abs(dy) * 0.5) view.flip = dx < 0;
        view.heading = Math.atan2(dy, dx);
      }
      view.lastX = enemy.x;
      view.lastY = enemy.y;

      const base = ENEMY_SIZE[enemy.def.id] ?? 32;
      const fade = enemy.dyingFraction;
      const wobble = 1 + Math.sin(nowMs / (enemy.flying ? 180 : 90) + view.phase) * 0.05;
      const lift = enemy.flying ? -8 + Math.sin(nowMs / 220 + view.phase) * 2 : -4;
      view.image.setPosition(enemy.x, enemy.y + lift).setDisplaySize(base * fade * wobble, base * fade / wobble);
      view.image.setAlpha(fade);
      if (enemy.flying) view.image.setFlipX(false).setRotation(view.heading);
      else view.image.setFlipX(view.flip).setRotation(Math.sin(nowMs / 130 + view.phase) * 0.06);
      if (enemy.isFlashing) view.image.setTintFill(0xffffff); else view.image.clearTint();
    }
  }

  private _syncHero(hero: Hero, nowMs: number): void {
    if (!this._hero) {
      this._hero = { image: this._scene.add.image(hero.x, hero.y, 'spr_hero').setDepth(DEPTH.HERO + 0.4), lastX: hero.x, flip: false };
    }
    const view = this._hero;
    if (Math.abs(hero.x - view.lastX) > 0.05) view.flip = hero.x < view.lastX;
    view.lastX = hero.x;
    view.image.setPosition(hero.x, hero.y - 4 + Math.sin(nowMs / 260) * 1.2).setDisplaySize(HERO_SIZE, HERO_SIZE).setFlipX(view.flip);
  }

  destroy(): void {
    for (const view of this._towers.values()) view.image.destroy();
    for (const view of this._enemies.values()) view.image.destroy();
    this._hero?.image.destroy();
    this._towers.clear();
    this._enemies.clear();
    this._hero = null;
  }
}
