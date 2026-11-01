// [3b:touch-hero-test] v2
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('touch hero: a tap on bare ground sends the hero, a tower tap only selects, the mouse keeps the right button', () => {
  const b = read('src/systems/BuildSystem.ts');
  assert.ok(b.includes('onTouchGroundTap: ((x: number, y: number) => void) | null = null;'));
  assert.ok(b.includes('if (!hit && this._isTouchPtr(ptr) && this.onTouchGroundTap) this.onTouchGroundTap(ptr.x, ptr.y);'));
  const g = read('src/scenes/GameScene.ts');
  assert.ok(g.includes('this._buildSystem.onTouchGroundTap ='), 'the scene wires the hook');
  assert.ok(g.includes('if (!this._buildSystem.onTouchGroundTap) {'), 'the hook is wired once, lazily');
  assert.ok(g.includes('this._hero.moveTo(x, y);'));
  assert.ok(g.includes('ptr.rightButtonDown()'), 'the right button still moves the hero');
  const wired = g.indexOf('this._buildSystem.onTouchGroundTap =');
  const views = g.indexOf('this._views.update(');
  assert.ok(wired > 0 && views > wired, 'the wiring sits before the per-frame sprite update');
});

test('the tutorial speaks about touch on a touch device and keeps the mouse text otherwise', () => {
  const g = read('src/scenes/GameScene.ts');
  assert.ok(g.includes('Коснитесь земли'));
  assert.ok(g.includes('правой\\nкнопкой мыши'));
});

test('the sell button has a 44 px touch zone', () => {
  const t = read('src/ui/TowerPanel.ts');
  assert.ok(t.includes('sellY - 4, sellW, 44'));
  assert.ok(!t.includes('sellZone = s.add.zone(PX+PAD, sellY, sellW, 36)'));
});
