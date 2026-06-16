// BezierPath.ts — Catmull-Rom smooth path from raw tile waypoints.
import type { Waypoint } from './pathData';

const SAMPLES = 8;

function catmullRom(t: number, p0: Waypoint, p1: Waypoint, p2: Waypoint, p3: Waypoint): Waypoint {
  const t2 = t*t, t3 = t2*t;
  return {
    x: 0.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
  };
}

function smoothPath(pts: Waypoint[]): Waypoint[] {
  if (pts.length < 2) return [...pts];
  const out: Waypoint[] = [{ ...pts[0] }];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i-1)];
    const p1 = pts[i];
    const p2 = pts[i+1];
    const p3 = pts[Math.min(pts.length-1, i+2)];
    for (let s = 1; s <= SAMPLES; s++) out.push(catmullRom(s/SAMPLES, p0, p1, p2, p3));
  }
  return out;
}

const _cache = new WeakMap<Waypoint[], Waypoint[]>();
export function getSmoothedPath(raw: Waypoint[]): Waypoint[] {
  if (_cache.has(raw)) return _cache.get(raw)!;
  const s = smoothPath(raw);
  _cache.set(raw, s);
  return s;
}
