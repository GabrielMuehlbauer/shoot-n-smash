import assert from 'node:assert/strict';
import test from 'node:test';

import { Scene, Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { ProjectileSystem } from './ProjectileSystem.js';

function createSystem(overrides = {}) {
  const scene = new Scene();
  const config = { ...GAMEPLAY_CONFIG.projectile, ...overrides };
  const system = new ProjectileSystem({ scene, config });

  return { config, scene, system };
}

function assertAlmostEqual(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperado ${expected}, recebido ${actual}`,
  );
}

test('cria uma esfera e integra a trajetória balística', () => {
  const { system } = createSystem({ groundY: -100 });
  const mesh = system.spawn({
    origin: new Vector3(0, 2, 0),
    direction: new Vector3(0, 0, -2),
    speed: 10,
    charge: 0.5,
  });

  assert.equal(system.activeProjectileCount, 1);
  assert.equal(mesh.name, 'snowball-projectile');
  assert.equal(mesh.userData.charge, 0.5);

  system.update(0.5);

  assert.deepEqual(system.projectiles[0].previousPosition.toArray(), [0, 2, 0]);
  assert.deepEqual(system.projectiles[0].spawnPosition.toArray(), [0, 2, 0]);
  assertAlmostEqual(mesh.position.x, 0);
  assertAlmostEqual(mesh.position.y, 0.775);
  assertAlmostEqual(mesh.position.z, -5);
  assertAlmostEqual(system.projectiles[0].velocity.y, -4.9);
  system.dispose();
});

test('expõe o segmento varrido e consome o projétil antes do descarte ambiental', () => {
  const { system } = createSystem({
    gravity: 0,
    groundY: 10,
    lifetimeSeconds: 0.1,
  });
  const origin = new Vector3(0, 2, 0);
  const segments = [];

  system.spawn({
    origin,
    direction: new Vector3(0, 0, -1),
    speed: 24,
  });

  assert.equal(
    system.update(0.5, (step) => {
      segments.push({
        current: step.currentPosition.clone(),
        previous: step.previousPosition.clone(),
        radius: step.radius,
      });
      return true;
    }),
    true,
  );

  assert.equal(system.activeProjectileCount, 0);
  assert.deepEqual(segments[0].previous.toArray(), origin.toArray());
  assert.deepEqual(segments[0].current.toArray(), [0, 2, -12]);
  assert.equal(segments[0].radius, GAMEPLAY_CONFIG.projectile.radius);
  assert.throws(() => system.update(0.1, 'invalid'), /callback de passo/);
  system.dispose();
});

test('preserva força e tipo de munição em cada projétil', () => {
  const { system } = createSystem({ gravity: 0, groundY: -100 });

  const mesh = system.spawn({
    origin: new Vector3(0, 2, 0),
    direction: new Vector3(0, 0, -1),
    speed: 10,
    hitStrength: 2,
    ammoType: 'special',
  });

  assert.equal(system.projectiles[0].hitStrength, 2);
  assert.equal(system.projectiles[0].ammoType, 'special');
  assert.equal(mesh.material, system.specialMaterial);
  system.dispose();
});

test('remove projéteis ao tocar o solo, expirar ou sair do limite horizontal', () => {
  const groundFixture = createSystem();
  groundFixture.system.spawn({
    origin: new Vector3(0, 1, 0),
    direction: new Vector3(1, 0, 0),
    speed: 1,
  });
  groundFixture.system.update(0.4);
  assert.equal(groundFixture.system.activeProjectileCount, 0);
  groundFixture.system.dispose();

  const lifetimeFixture = createSystem({
    gravity: 0,
    groundY: -100,
    lifetimeSeconds: 0.5,
  });
  lifetimeFixture.system.spawn({
    origin: new Vector3(0, 2, 0),
    direction: new Vector3(0, 1, 0),
    speed: 1,
  });
  lifetimeFixture.system.update(0.5);
  assert.equal(lifetimeFixture.system.activeProjectileCount, 0);
  lifetimeFixture.system.dispose();

  const limitFixture = createSystem({
    gravity: 0,
    groundY: -100,
    horizontalLimit: 1,
  });
  limitFixture.system.spawn({
    origin: new Vector3(0, 2, 0),
    direction: new Vector3(1, 0, 0),
    speed: 10,
  });
  limitFixture.system.update(0.2);
  assert.equal(limitFixture.system.activeProjectileCount, 0);
  limitFixture.system.dispose();
});

test('mantém no máximo 24 projéteis descartando o mais antigo', () => {
  const { config, system } = createSystem({
    gravity: 0,
    groundY: -100,
    maxActive: 24,
  });

  for (let index = 0; index < config.maxActive + 1; index += 1) {
    system.spawn({
      origin: new Vector3(index, 2, 0),
      direction: new Vector3(0, 1, 0),
      speed: 1,
    });
  }

  assert.equal(system.activeProjectileCount, 24);
  assert.equal(system.group.children.length, 24);
  assert.equal(system.group.children[0].position.x, 1);
  assert.equal(system.group.children.at(-1).position.x, 24);
  system.dispose();
});

test('rejeita dados inválidos e direções nulas', () => {
  const { system } = createSystem();

  assert.throws(
    () =>
      system.spawn({
        origin: new Vector3(),
        direction: new Vector3(),
        speed: 10,
      }),
    /direção.*nula/i,
  );
  assert.throws(
    () =>
      system.spawn({
        origin: { x: Number.NaN, y: 0, z: 0 },
        direction: new Vector3(0, 0, -1),
        speed: 10,
      }),
    /vetor tridimensional finito/i,
  );
  assert.throws(
    () =>
      system.spawn({
        origin: new Vector3(),
        direction: new Vector3(0, 0, -1),
        speed: 0,
      }),
    /velocidade.*maior que zero/i,
  );
  assert.throws(
    () =>
      system.spawn({
        origin: new Vector3(),
        direction: new Vector3(0, 0, -1),
        speed: 10,
        hitStrength: 0,
      }),
    /força.*inteiro positivo/i,
  );
  system.dispose();
});

test('dispose remove o grupo e os recursos apenas uma vez', () => {
  const { scene, system } = createSystem({ groundY: -100 });
  system.spawn({
    origin: new Vector3(0, 2, 0),
    direction: new Vector3(0, 1, 0),
    speed: 1,
  });

  assert.equal(scene.children.includes(system.group), true);
  assert.equal(system.dispose(), true);
  assert.equal(system.dispose(), false);
  assert.equal(scene.children.includes(system.group), false);
  assert.equal(system.activeProjectileCount, 0);
  assert.equal(system.update(0.1), false);
  assert.throws(
    () =>
      system.spawn({
        origin: new Vector3(),
        direction: new Vector3(0, 0, -1),
        speed: 1,
      }),
    /ProjectileSystem descartado/,
  );
});
