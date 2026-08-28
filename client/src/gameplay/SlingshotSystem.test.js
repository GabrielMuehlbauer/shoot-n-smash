import assert from 'node:assert/strict';
import test from 'node:test';

import { PerspectiveCamera } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { SlingshotSystem } from './SlingshotSystem.js';

function createFixture() {
  const camera = new PerspectiveCamera(65, 1, 0.1, 120);
  camera.position.set(1, 1.65, 2);
  camera.lookAt(1, 1.65, -1);
  const chargeStates = [];
  const shots = [];
  const spawnCalls = [];
  const projectileSystem = {
    activeProjectileCount: 0,
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
  };
  const slingshot = new SlingshotSystem({
    camera,
    projectileSystem,
    onChargeChange: (state) => chargeStates.push(state),
    onShot: (shot) => shots.push(shot),
  });

  return {
    camera,
    chargeStates,
    projectileSystem,
    shots,
    slingshot,
    spawnCalls,
  };
}

function assertAlmostEqual(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperado ${expected}, recebido ${actual}`,
  );
}

test('carrega de 0 a 1 sem ultrapassar a duração configurada', () => {
  const fixture = createFixture();

  assert.equal(fixture.slingshot.beginCharge(), true);
  assert.equal(fixture.slingshot.beginCharge(), false);
  fixture.slingshot.update(0.6);
  fixture.slingshot.update(10);

  assert.equal(fixture.slingshot.isCharging, true);
  assert.deepEqual(fixture.chargeStates, [
    { charging: true, ratio: 0 },
    { charging: true, ratio: 0.5 },
    { charging: true, ratio: 1 },
  ]);
});

test('dispara na direção mundial da câmera com velocidade proporcional', () => {
  const fixture = createFixture();

  fixture.slingshot.beginCharge();
  fixture.slingshot.update(0.6);
  const shot = fixture.slingshot.releaseShot();
  const spawn = fixture.spawnCalls[0];

  assert.equal(shot.ratio, 0.5);
  assert.equal(
    shot.speed,
    (GAMEPLAY_CONFIG.projectile.minSpeed +
      GAMEPLAY_CONFIG.projectile.maxSpeed) /
      2,
  );
  assert.equal(shot.activeProjectileCount, 1);
  assert.deepEqual(fixture.shots, [shot]);
  assertAlmostEqual(spawn.origin.x, 1);
  assertAlmostEqual(spawn.origin.y, 1.65);
  assertAlmostEqual(
    spawn.origin.z,
    2 - GAMEPLAY_CONFIG.projectile.spawnDistance,
  );
  assertAlmostEqual(spawn.direction.x, 0);
  assertAlmostEqual(spawn.direction.y, 0);
  assertAlmostEqual(spawn.direction.z, -1);
  assert.equal(spawn.charge, 0.5);
  assert.deepEqual(fixture.chargeStates.at(-1), {
    charging: false,
    ratio: 0,
  });
});

test('um clique rápido usa a velocidade mínima', () => {
  const fixture = createFixture();

  fixture.slingshot.beginCharge();
  const shot = fixture.slingshot.releaseShot();

  assert.equal(shot.ratio, 0);
  assert.equal(shot.speed, GAMEPLAY_CONFIG.projectile.minSpeed);
  assert.equal(fixture.spawnCalls.length, 1);
});

test('cancelamento zera a carga sem criar projétil', () => {
  const fixture = createFixture();

  assert.equal(fixture.slingshot.releaseShot(), false);
  assert.equal(fixture.slingshot.cancelCharge(), false);
  fixture.slingshot.beginCharge();
  fixture.slingshot.update(0.3);
  assert.equal(fixture.slingshot.cancelCharge(), true);

  assert.equal(fixture.slingshot.isCharging, false);
  assert.equal(fixture.spawnCalls.length, 0);
  assert.deepEqual(fixture.chargeStates.at(-1), {
    charging: false,
    ratio: 0,
  });
});

test('ignora deltas inválidos e dispose é idempotente', () => {
  const fixture = createFixture();

  fixture.slingshot.beginCharge();
  assert.equal(fixture.slingshot.update(-2), true);
  assert.equal(fixture.slingshot.update(Number.NaN), true);
  assert.equal(fixture.slingshot.dispose(), true);
  assert.equal(fixture.slingshot.dispose(), false);
  assert.equal(fixture.slingshot.update(0.1), false);
  assert.throws(
    () => fixture.slingshot.beginCharge(),
    /SlingshotSystem descartado/,
  );
  assert.throws(
    () => fixture.slingshot.releaseShot(),
    /SlingshotSystem descartado/,
  );
});

test('dispose mantém o estado terminal mesmo se o callback falhar', () => {
  const fixture = createFixture();
  fixture.slingshot.beginCharge();
  fixture.slingshot.onChargeChange = () => {
    throw new Error('falha simulada no HUD');
  };

  assert.throws(() => fixture.slingshot.dispose(), /falha simulada no HUD/);
  assert.equal(fixture.slingshot.disposed, true);
  assert.equal(fixture.slingshot.dispose(), false);
  assert.throws(
    () => fixture.slingshot.beginCharge(),
    /SlingshotSystem descartado/,
  );
});
