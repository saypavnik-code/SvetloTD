// [3b:touch-test]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('touch placement: a tap previews, the green button builds, the red one cancels, the mouse path stays', () => {
  const s = read('src/systems/BuildSystem.ts');
  assert.ok(s.includes('_isTouchPtr(ptr)'), 'the touch branch exists');
  assert.ok(s.includes('ptr.button!==2'), 'right-click cancel stays for the mouse');
  const m = /const size = (\d+), gap = (\d+);/.exec(s);
  assert.ok(m, 'touch bar geometry is declared');
  assert.ok(Number(m[1]) >= 44, 'touch buttons are at least 44 px');
  const touchBranch = s.indexOf('[3b:tap-flow]');
  const mouseLine = s.indexOf('if (inGrid&&this._canPlace(col,row)) this._place(this._pendingId,col,row);');
  assert.ok(touchBranch > 0 && mouseLine > touchBranch, 'a finger never builds on the first tap');
  assert.ok(s.includes('this._bindTouch();'), 'the touch listener is bound');
  assert.ok(s.includes('this._hideTouchBar();'), 'the bar is hidden with the ghost');
});

test('touch targets: skill slots, upgrade buttons and priority arrows reach 44 px', () => {
  const layout = read('src/ui/layout.ts');
  const slot = /SKILL_SLOT = (\d+)/.exec(layout);
  assert.ok(slot);
  assert.ok(Number(slot[1]) + 6 >= 44, 'the slot zone grows by 3 px on every side');
  assert.ok(read('src/scenes/GameScene.ts').includes('this.add.zone(sx - 3, sy - 3, SLOT + 6, SLOT + 6)'));
  const t = read('src/ui/TowerPanel.ts');
  assert.ok(!t.includes('setSize(uw, 36)'), 'the refresh no longer shrinks the upgrade zone');
  assert.ok(t.includes('setSize(uw, 44)'));
  const arrows = t.match(/hitArea: \{ x: -15, y: -14, w: 44, h: 44 \}/g) || [];
  assert.equal(arrows.length, 2, 'both priority arrows have a 44 px hit area');
});
