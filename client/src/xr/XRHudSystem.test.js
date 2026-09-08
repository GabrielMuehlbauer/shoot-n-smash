import assert from 'node:assert/strict';
import test from 'node:test';

import { PerspectiveCamera, Scene } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { XRHudSystem } from './XRHudSystem.js';

function createCanvasFixture() {
  const texts = [];
  const context = {
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    fillText(value) {
      texts.push(value);
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  };
  return { canvas, context, texts };
}

function createFixture() {
  const canvasFixture = createCanvasFixture();
  const camera = new PerspectiveCamera();
  camera.position.set(0, 1.65, 0);
  camera.updateMatrixWorld(true);
  const scene = new Scene();
  const hud = new XRHudSystem({
    renderer: { xr: { getCamera: () => camera } },
    scene,
    camera,
    canvasFactory: () => canvasFixture.canvas,
  });

  return { ...canvasFixture, camera, hud, scene };
}

test('mostra vida, inimigo, onda e pontos dentro da cena XR', () => {
  const fixture = createFixture();
  const enemyType = GAMEPLAY_CONFIG.enemy.types[1];

  fixture.hud.setPlayerState({ health: 75, maxHealth: 100 });
  fixture.hud.setEnemyState({
    active: true,
    maxResistance: enemyType.maxResistance,
    outcome: null,
    resistance: 1,
    type: enemyType,
  });
  fixture.hud.setWaveState({
    status: 'active',
    wave: 2,
    totalWaves: 4,
    enemy: 3,
    enemiesInWave: 4,
  });
  fixture.hud.setScoreState({
    score: 250,
    eventCount: 1,
    lastEvent: { points: 250, type: 'enemy-eliminated:medium' },
  });
  assert.equal(fixture.hud.setActive(true), true);
  assert.equal(fixture.hud.update(), true);

  assert.equal(fixture.hud.panel.visible, true);
  assert.deepEqual(
    fixture.hud.panel.position.toArray().map((value) => Number(value.toFixed(3))),
    [0, 1.29, -1.35],
  );
  assert.ok(fixture.texts.includes('75 / 100'));
  assert.ok(fixture.texts.includes('1 / 2'));
  assert.ok(fixture.texts.includes('Onda 2 de 4'));
  assert.ok(fixture.texts.includes('PONTOS 250'));
  assert.equal(fixture.hud.setActive(false), true);
  assert.equal(fixture.hud.panel.visible, false);
  assert.equal(fixture.hud.dispose(), true);
  assert.equal(fixture.scene.getObjectByName('xr-gameplay-hud'), undefined);
  assert.equal(fixture.hud.dispose(), false);
});

test('valida renderer, canvas e configuração antes de montar o HUD', () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();

  assert.throws(() => new XRHudSystem({ scene, camera }), /renderer/i);
  assert.throws(
    () =>
      new XRHudSystem({
        renderer: { xr: { getCamera: () => camera } },
        scene,
        camera,
        canvasFactory: () => ({ getContext: () => null }),
      }),
    /contexto 2D/i,
  );
  assert.throws(
    () =>
      new XRHudSystem({
        renderer: { xr: { getCamera: () => camera } },
        scene,
        camera,
        config: {
          ...GAMEPLAY_CONFIG.xr.hud,
          widthMeters: 0,
        },
      }),
    /widthMeters/i,
  );
});
