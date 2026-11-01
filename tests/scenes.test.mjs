import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModules } from './support/load-source.mjs';

// A browser run (v0.27.0) found that "В меню" after a defeat left the game on a black screen: MenuScene keeps its difficulty buttons in
// class fields, `create()` did not empty them, and the second `create()` called setColor on the destroyed labels of the first run.
// Phaser reuses the scene instance, so a scene must rebuild every list it fills in `create()`.
globalThis.window = { location: { search: '' } };
const { MenuScene } = loadModules('src/scenes/MenuScene.ts');

// A stand-in for the Phaser surface a scene touches: every factory returns a chainable object, and once an object is destroyed
// any call on it throws, as Phaser's Text does when its canvas texture is gone.
function createStage() {
  const objects = [];
  // `track` false: the camera, input and the like belong to the scene system and outlive one run; only game objects are destroyed.
  const make = (track = true) => {
    const state = { destroyed: false };
    const object = new Proxy(function () {}, {
      get: (_, key) => {
        if (key === 'then') return undefined;
        if (key === 'destroyed') return state.destroyed;
        if (key === 'destroy') return () => { state.destroyed = true; return object; };
        return (...args) => {
          if (state.destroyed) throw new TypeError(`Cannot read properties of null (reading 'glTexture') [${String(key)} on a destroyed object]`);
          return object;
        };
      },
      apply: () => object,
    });
    if (track) objects.push(object);
    return object;
  };
  const factory = new Proxy({}, { get: () => () => make() });
  const scene = new MenuScene();
  scene.add = factory;
  scene.cameras = { main: make(false) };
  scene.tweens = factory;
  scene.input = make(false);
  scene.sound = make(false);
  scene.scene = make(false);
  scene.time = make(false);
  return { scene, shutDown: () => objects.forEach((object) => object.destroy()) };
}

test('MenuScene can be created again after it was shut down (menu after a defeat, restart from the menu)', () => {
  const { scene, shutDown } = createStage();
  scene.create();
  shutDown();
  assert.doesNotThrow(() => scene.create(), 'the second create() must not touch objects of the first run');
  shutDown();
  assert.doesNotThrow(() => scene.create(), 'and the third');
});

test('MenuScene keeps exactly one difficulty button per difficulty after any number of runs', () => {
  const { scene, shutDown } = createStage();
  for (let run = 0; run < 3; run++) { scene.create(); shutDown(); }
  assert.equal(scene._difficultyGfx.length, 4);
  assert.equal(scene._difficultyLbl.length, 4);
});
