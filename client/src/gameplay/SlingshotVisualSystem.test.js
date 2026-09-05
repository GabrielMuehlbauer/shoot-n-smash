import assert from 'node:assert/strict';
import test from 'node:test';

import { PerspectiveCamera, Scene } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { SlingshotVisualSystem } from './SlingshotVisualSystem.js';

function createFixture() {
  const scene = new Scene();
  const camera = new PerspectiveCamera(65, 1, 0.1, 120);
  camera.position.set(1, 1.65, 2);
  camera.lookAt(1, 1.65, -1);
  const visual = new SlingshotVisualSystem({ scene, camera });
  return { camera, scene, visual };
}

function assertAlmostEqual(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperado ${expected}, recebido ${actual}`,
  );
}

test('cria estilingue em primeira pessoa com garfo, elásticos e projétil', () => {
  const { scene, visual } = createFixture();

  assert.equal(scene.getObjectByName('first-person-slingshot'), visual.root);
  assert.ok(scene.getObjectByName('slingshot-handle'));
  assert.ok(scene.getObjectByName('slingshot-left-arm'));
  assert.ok(scene.getObjectByName('slingshot-right-arm'));
  assert.ok(scene.getObjectByName('slingshot-left-band'));
  assert.ok(scene.getObjectByName('slingshot-right-band'));
  assert.equal(visual.loadedBall.visible, false);
  assert.equal(visual.trajectory.geometry.drawRange.count, 0);
  visual.dispose();
});

test('acompanha a câmera e puxa bolsa e elásticos conforme a tensão', () => {
  const { visual } = createFixture();
  const config = GAMEPLAY_CONFIG.slingshotVisual;

  visual.update({ charging: true, ratio: 0.5, speed: 17 });

  assertAlmostEqual(visual.root.position.x, 1 + config.position.x);
  assertAlmostEqual(visual.root.position.y, 1.65 + config.position.y);
  assertAlmostEqual(visual.root.position.z, 2 + config.position.z);
  assertAlmostEqual(
    visual.pouch.position.z,
    config.pouch.restZ + config.pouch.pullDistance * 0.5,
  );
  assert.equal(visual.loadedBall.visible, true);

  const leftBand = visual.leftBand.geometry.getAttribute('position');
  assertAlmostEqual(leftBand.getX(0), -config.fork.tipX);
  assertAlmostEqual(leftBand.getY(0), config.fork.tipY);
  assertAlmostEqual(leftBand.getZ(1), visual.pouch.position.z);
  visual.dispose();
});

test('prevê a mesma trajetória balística da bola de neve', () => {
  const { visual } = createFixture();
  const projectile = GAMEPLAY_CONFIG.projectile;
  const step = GAMEPLAY_CONFIG.slingshotVisual.trajectory.stepSeconds;
  const speed = 17;

  visual.update({ charging: true, ratio: 0.5, speed });

  const positions = visual.trajectory.geometry.getAttribute('position');
  const origin = {
    x: 1 + projectile.spawnOffset.x,
    y: 1.65 + projectile.spawnOffset.y,
    z: 2 + projectile.spawnOffset.z,
  };
  assert.ok(visual.trajectory.geometry.drawRange.count > 0);
  assertAlmostEqual(positions.getX(0), origin.x);
  assertAlmostEqual(
    positions.getY(0),
    origin.y + 0.5 * projectile.gravity * step * step,
  );
  assertAlmostEqual(positions.getZ(0), origin.z - speed * step);
  visual.dispose();
});

test('diferencia munição especial e oculta a previsão ao cancelar', () => {
  const { visual } = createFixture();

  visual.update({
    charging: true,
    ratio: 1,
    speed: GAMEPLAY_CONFIG.projectile.maxSpeed,
    ammoType: 'special',
  });
  assert.equal(visual.loadedBall.material, visual.loadedBallMaterials.special);
  assert.equal(visual.trajectory.material, visual.trajectoryMaterials.special);

  visual.update({ charging: false, ratio: 0, speed: 10 });
  assert.equal(visual.loadedBall.visible, false);
  assert.equal(visual.trajectory.geometry.drawRange.count, 0);
  visual.dispose();
});

test('descarta visual e recursos uma única vez', () => {
  const { scene, visual } = createFixture();
  let disposals = 0;
  for (const resource of visual.resources) {
    resource.addEventListener('dispose', () => {
      disposals += 1;
    });
  }
  const resourceCount = visual.resources.size;

  assert.equal(visual.dispose(), true);
  assert.equal(disposals, resourceCount);
  assert.equal(scene.getObjectByName('first-person-slingshot'), undefined);
  assert.equal(scene.getObjectByName('slingshot-trajectory-preview'), undefined);
  assert.equal(visual.dispose(), false);
});

test('rejeita configuração visual incompleta antes de anexar objetos', () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const config = {
    ...GAMEPLAY_CONFIG.slingshotVisual,
    trajectory: {
      ...GAMEPLAY_CONFIG.slingshotVisual.trajectory,
      pointCount: 1,
    },
  };

  assert.throws(
    () => new SlingshotVisualSystem({ scene, camera, config }),
    /pointCount/,
  );
  assert.equal(scene.children.length, 0);
});
