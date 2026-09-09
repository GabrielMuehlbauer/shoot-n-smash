import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PerspectiveCamera, Scene, Vector3 } from 'three';

import { GameSession } from './core/GameSession.js';
import { intersectMovingSpheres } from './gameplay/CollisionSystem.js';

const [indexHtml, mainSource, arenaSource] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('./main.js', import.meta.url), 'utf8'),
  readFile(new URL('./world/SnowArena.js', import.meta.url), 'utf8'),
]);

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

test('quarenta ciclos de partida não deixam objetos residuais na cena', () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();

  for (let cycle = 0; cycle < 40; cycle += 1) {
    const session = new GameSession({
      camera,
      scene,
      enemyRandom: () => 0,
      enemyTypeRandom: () => 0,
      itemRandom: () => 0.99,
    });

    session.beginCharge();
    session.update(0.05);
    session.cancelCharge();
    assert.ok(scene.children.length > 0);
    assert.equal(session.dispose(), true);
    assert.equal(session.dispose(), false);
    assert.equal(scene.children.length, 0);
    assert.equal(camera.children.length, 0);
  }
});

test('colisão móvel preserva o resultado sob translação em casos variados', () => {
  const random = createSeededRandom(0x25c0111d);

  for (let sample = 0; sample < 400; sample += 1) {
    const vectors = Array.from({ length: 5 }, () => new Vector3(
      random() * 20 - 10,
      random() * 8,
      random() * 20 - 10,
    ));
    const [projectileStart, projectileEnd, targetStart, targetEnd, offset] = vectors;
    const projectileRadius = 0.05 + random() * 0.5;
    const targetRadius = 0.2 + random() * 2;
    const original = intersectMovingSpheres(
      projectileStart,
      projectileEnd,
      projectileRadius,
      targetStart,
      targetEnd,
      targetRadius,
    );
    const translated = intersectMovingSpheres(
      projectileStart.clone().add(offset),
      projectileEnd.clone().add(offset),
      projectileRadius,
      targetStart.clone().add(offset),
      targetEnd.clone().add(offset),
      targetRadius,
    );

    assert.equal(translated.hit, original.hit);
    assert.equal(translated.startedInside, original.startedInside);
    if (original.hit) {
      assert.ok(Math.abs(translated.t - original.t) < 1e-10);
      assert.ok(
        translated.projectileCenter.distanceTo(
          original.projectileCenter.clone().add(offset),
        ) < 1e-9,
      );
    }
  }
});

test('carrega o motor sob demanda e instancia os elementos repetidos', () => {
  assert.match(indexHtml, /Fase 25 em validação/);
  assert.match(indexHtml, /id="xr-diagnostics-memory"/);
  assert.match(mainSource, /function loadGameplayModules\(\)/);
  assert.match(mainSource, /import\('\.\/core\/RenderContext\.js'\)/);
  assert.match(mainSource, /prototypeLoadId/);
  assert.doesNotMatch(mainSource, /^import .*RenderContext/m);
  assert.match(arenaSource, /new InstancedMesh\(/);
  assert.match(arenaSource, /mountain-body-instances/);
});
