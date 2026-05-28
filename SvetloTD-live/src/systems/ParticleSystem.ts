// ─────────────────────────────────────────────────────────────────────────────
// ParticleSystem.ts — Lightweight pooled death-burst particles (Phase 5).
//
// No Phaser ParticleEmitter — we draw manually into the batch Graphics pass.
// Each burst: 6–10 dots, randomised velocity, 0.35s lifetime, fades + shrinks.
//
// Usage:
//   particleSystem.burst(x, y, color, count)  // on enemy death
//   particleSystem.update(dt)                  // in GameScene.update()
//   particleSystem.drawTo(g)                   // inside _drawAll() pass
// ─────────────────────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;    // remaining seconds
  maxLife: number;
  r: number;       // starting radius
  color: number;
}

const LIFE  = 0.38;   // seconds
const SPEED = 90;     // pixels / s

export class ParticleSystem {
  private _pool: Particle[] = [];

  burst(x: number, y: number, color: number, count = 8): void {
    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const speed  = SPEED * (0.4 + Math.random() * 0.8);
      const p: Particle = {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: LIFE * (0.7 + Math.random() * 0.5),
        maxLife: LIFE,
        r: 2.5 + Math.random() * 2,
        color,
      };
      this._pool.push(p);
    }
  }

  update(dt: number): void {
    for (let i = this._pool.length - 1; i >= 0; i--) {
      const p = this._pool[i];
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 60 * dt;   // subtle gravity
      p.life -= dt;
      if (p.life <= 0) this._pool.splice(i, 1);
    }
  }

  drawTo(g: Phaser.GameObjects.Graphics): void {
    for (const p of this._pool) {
      const t     = p.life / p.maxLife;   // 1 → 0
      const alpha = t * t;                // quadratic fade
      const r     = p.r * (0.4 + t * 0.6);
      g.fillStyle(p.color, alpha);
      g.fillCircle(p.x, p.y, r);
    }
  }

  get count(): number { return this._pool.length; }
}