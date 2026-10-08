// A single, deterministic non-stacking watchtower aura pass.
import type { Tower } from '../entities/Tower';

const SCAN_INTERVAL_MS = 250;

export class AuraSystem {
  private elapsed = SCAN_INTERVAL_MS;
  constructor(private readonly getTowers: () => Tower[]) {}

  update(deltaMs: number): void {
    this.elapsed += deltaMs;
    if (this.elapsed < SCAN_INTERVAL_MS) return;
    this.elapsed %= SCAN_INTERVAL_MS;
    this.scan();
  }

  private scan(): void {
    const towers = this.getTowers();
    // Always clear first: selling the last watchtower must remove its buff.
    for (const tower of towers) tower.clearAuraBuff();
    const sources = towers.filter(tower => tower.data.auraRadius > 0);
    for (const source of sources) {
      const radiusSq = source.data.auraRadius ** 2;
      for (const target of towers) {
        if (target === source || target.data.auraRadius > 0) continue;
        const dx = source.x - target.x;
        const dy = source.y - target.y;
        if (dx * dx + dy * dy <= radiusSq) {
          target.applyAuraBuff(source.data.auraBuff);
        }
      }
    }
  }
}
