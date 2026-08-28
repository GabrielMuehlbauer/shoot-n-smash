import assert from 'node:assert/strict';
import test from 'node:test';

import { PerspectiveCamera, Scene } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { GameSession } from './GameSession.js';

function createCamera() {
  const camera = new PerspectiveCamera(65, 1, 0.1, 120);
  camera.position.set(1, 1.65, 2);
  camera.lookAt(1, 1.65, -1);
  return camera;
}

function createProjectileSystem() {
  const spawnCalls = [];
  const updateCalls = [];

  return {
    activeProjectileCount: 0,
    disposeCalls: 0,
    spawnCalls,
    updateCalls,
    spawn(payload) {
      spawnCalls.push({
        origin: payload.origin.clone(),
        direction: payload.direction.clone(),
        speed: payload.speed,
        charge: payload.charge,
      });
      this.activeProjectileCount += 1;
      return {};
    },
    update(deltaSeconds) {
      updateCalls.push(deltaSeconds);
      return true;
    },
    dispose() {
      this.disposeCalls += 1;
      this.activeProjectileCount = 0;
      return true;
    },
  };
}

function assertAlmostEqual(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperado ${expected}, recebido ${actual}`,
  );
}

test('carrega de 0 a 1 e dispara na direção mundial da câmera', () => {
  const chargeStates = [];
  const shots = [];
  const projectileSystem = createProjectileSystem();
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    projectileSystem,
    onChargeChange: (state) => chargeStates.push(state),
    onShot: (shot) => shots.push(shot),
  });

  assert.equal(session.beginCharge(), true);
  assert.equal(session.beginCharge(), false);
  session.update(0.6);
  session.update(10);

  assert.equal(session.isCharging, true);
  assert.deepEqual(
    chargeStates.map(({ charging, ratio }) => [charging, ratio]),
    [
      [true, 0],
      [true, 0.5],
      [true, 1],
    ],
  );

  const shot = session.releaseShot();
  const spawn = projectileSystem.spawnCalls[0];

  assert.equal(session.isCharging, false);
  assert.equal(session.activeProjectileCount, 1);
  assert.equal(shot.charge, 1);
  assert.equal(shot.ratio, 1);
  assert.equal(shot.speed, GAMEPLAY_CONFIG.projectile.maxSpeed);
  assert.equal(shot.activeProjectileCount, 1);
  assert.deepEqual(shots, [shot]);
  assertAlmostEqual(spawn.origin.x, 1);
  assertAlmostEqual(spawn.origin.y, 1.65);
  assertAlmostEqual(
    spawn.origin.z,
    2 - GAMEPLAY_CONFIG.projectile.spawnDistance,
  );
  assertAlmostEqual(spawn.direction.x, 0);
  assertAlmostEqual(spawn.direction.y, 0);
  assertAlmostEqual(spawn.direction.z, -1);
  assert.equal(spawn.charge, 1);
  assert.deepEqual(chargeStates.at(-1), { charging: false, ratio: 0 });
  session.dispose();
});

test('um clique rápido usa a velocidade mínima', () => {
  const projectileSystem = createProjectileSystem();
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    projectileSystem,
  });

  session.beginCharge();
  const shot = session.releaseShot();

  assert.equal(shot.charge, 0);
  assert.equal(shot.speed, GAMEPLAY_CONFIG.projectile.minSpeed);
  assert.equal(projectileSystem.spawnCalls.length, 1);
  session.dispose();
});

test('cancelamento zera a carga sem criar projétil', () => {
  const chargeStates = [];
  const projectileSystem = createProjectileSystem();
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    projectileSystem,
    onChargeChange: (state) => chargeStates.push(state),
  });

  assert.equal(session.releaseShot(), false);
  assert.equal(session.cancelCharge(), false);
  session.beginCharge();
  session.update(0.3);
  assert.equal(session.cancelCharge(), true);

  assert.equal(session.isCharging, false);
  assert.equal(projectileSystem.spawnCalls.length, 0);
  assert.deepEqual(chargeStates.at(-1), { charging: false, ratio: 0 });
  session.dispose();
});

test('update saneia deltas e dispose é idempotente', () => {
  const chargeStates = [];
  const projectileSystem = createProjectileSystem();
  const session = new GameSession({
    camera: createCamera(),
    scene: new Scene(),
    projectileSystem,
    onChargeChange: (state) => chargeStates.push(state),
  });

  session.beginCharge();
  session.update(-2);
  session.update(Number.NaN);

  assert.deepEqual(projectileSystem.updateCalls, [0, 0]);
  assert.equal(session.dispose(), true);
  assert.equal(session.dispose(), false);
  assert.equal(projectileSystem.disposeCalls, 1);
  assert.equal(session.activeProjectileCount, 0);
  assert.deepEqual(chargeStates.at(-1), { charging: false, ratio: 0 });
  assert.equal(session.update(0.1), false);
  assert.throws(() => session.beginCharge(), /GameSession descartada/);
  assert.throws(() => session.releaseShot(), /GameSession descartada/);
});

test('coordena o estilingue antes dos projéteis e delega intenções', () => {
  const calls = [];
  const projectileSystem = {
    activeProjectileCount: 3,
    update: (delta) => calls.push(['projectiles.update', delta]),
    dispose: () => calls.push(['projectiles.dispose']),
  };
  const slingshotSystem = {
    isCharging: false,
    beginCharge: () => {
      calls.push(['charge.begin']);
      return true;
    },
    releaseShot: () => {
      calls.push(['charge.release']);
      return { ratio: 0.5 };
    },
    cancelCharge: () => {
      calls.push(['charge.cancel']);
      return true;
    },
    update: (delta) => calls.push(['slingshot.update', delta]),
    dispose: () => calls.push(['slingshot.dispose']),
  };
  const session = new GameSession({ projectileSystem, slingshotSystem });

  assert.equal(session.beginCharge(), true);
  assert.deepEqual(session.releaseShot(), { ratio: 0.5 });
  assert.equal(session.cancelCharge(), true);
  session.update(0.016);
  assert.equal(session.activeProjectileCount, 3);
  assert.equal(session.dispose(), true);
  assert.equal(session.dispose(), false);

  assert.deepEqual(calls, [
    ['charge.begin'],
    ['charge.release'],
    ['charge.cancel'],
    ['slingshot.update', 0.016],
    ['projectiles.update', 0.016],
    ['slingshot.dispose'],
    ['projectiles.dispose'],
  ]);
});

test('remove recursos criados quando a construção do estilingue falha', () => {
  const scene = new Scene();

  assert.throws(
    () => new GameSession({ camera: null, scene }),
    /SlingshotSystem requer uma câmera/,
  );
  assert.equal(scene.getObjectByName('snowball-projectiles'), undefined);
});
