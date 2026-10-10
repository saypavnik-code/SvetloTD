import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

const game = loadModules(
  'src/data/enemies.ts',
  'src/data/towers.ts',
  'src/data/waves.ts',
  'src/data/damageMatrix.ts',
);

test('every wave references a defined enemy, a valid lane and positive rewards', () => {
  for (const wave of game.WAVES) {
    assert(game.ENEMY_DEFS[wave.enemyType], `wave ${wave.wave}: unknown enemy ${wave.enemyType}`);
    assert([-1, 0, 1, 2, 3].includes(wave.paths), `wave ${wave.wave}: invalid lane ${wave.paths}`);
    assert(wave.bonusGold > 0, `wave ${wave.wave}: bonusGold must be positive`);
    assert.equal(wave.isBoss, Boolean(game.ENEMY_DEFS[wave.enemyType].isBoss),
      `wave ${wave.wave}: isBoss flag must match the enemy definition`);
  }
});

test('enemy definitions are playable and covered by the damage matrix', () => {
  const armorTypes = Object.keys(game.DAMAGE_MATRIX.normal);
  for (const enemy of Object.values(game.ENEMY_DEFS)) {
    assert(enemy.hp > 0 && enemy.speed > 0 && enemy.radius > 0, `${enemy.id}: non-positive stat`);
    assert(enemy.bounty > 0 && enemy.livesCost > 0, `${enemy.id}: non-positive reward or cost`);
    assert(armorTypes.includes(enemy.armorType), `${enemy.id}: armor type missing from matrix`);
  }
  for (const [damageType, row] of Object.entries(game.DAMAGE_MATRIX)) {
    for (const armor of armorTypes) {
      assert(row[armor] > 0, `${damageType} vs ${armor}: multiplier must be positive`);
    }
  }
});

test('tower definitions are consistent: upgrades exist, specials are well formed', () => {
  for (const tower of Object.values(game.TOWER_DEFS)) {
    assert(tower.cost > 0, `${tower.id}: cost must be positive`);
    for (const next of tower.upgradeTo) {
      assert(game.TOWER_DEFS[next], `${tower.id}: upgrade target ${next} is undefined`);
    }
    for (const special of tower.special) {
      assert(special.value > 0 && special.duration > 0, `${tower.id}: ${special.type} needs value and duration`);
      if (special.type === 'aoe_slow') {
        assert(special.radius > 0, `${tower.id}: aoe_slow needs a positive radius`);
      }
    }
    if (tower.auraRadius === 0) {
      assert(tower.damage > 0 && tower.attackSpeed > 0 && tower.range > 0, `${tower.id}: attacker needs offence stats`);
    }
  }
  for (const id of game.BUILDABLE_TOWER_IDS) {
    assert(game.TOWER_DEFS[id], `buildable tower ${id} is undefined`);
  }
});
