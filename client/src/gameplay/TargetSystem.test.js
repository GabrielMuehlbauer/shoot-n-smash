import assert from 'node:assert/strict';
import test from 'node:test';

import { Scene, Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { TargetSystem } from './TargetSystem.js';

function createTarget(options = {}) {
  const scene = new Scene();
  const target = new TargetSystem({ scene, ...options });
  return { scene, target };
}

test('cria um único alvo low-poly estático com esfera de colisão exposta', () => {
  const { scene, target } = createTarget();

  assert.deepEqual(GAMEPLAY_CONFIG.target.position, {
    x: 4,
    y: 2.15,
    z: -11,
  });
  assert.equal(GAMEPLAY_CONFIG.target.radius, 1.25);
  assert.equal(GAMEPLAY_CONFIG.target.damagePerHit, 25);
  assert.equal(target.parent, scene);
  assert.equal(target.children.length, 1);
  assert.equal(target.mesh.name, 'practice-target-core');
  assert.deepEqual(target.getCenter().toArray(), [4, 2.15, -11]);
  assert.deepEqual(target.state, {
    alive: true,
    health: 100,
    maxHealth: 100,
    ratio: 1,
  });
  target.dispose();
});

test('permanece estático durante a Fase 6 e saneia deltas', () => {
  const { target } = createTarget();
  const initialPosition = target.position.clone();

  assert.equal(target.update(1), true);
  assert.equal(target.update(-10), true);
  assert.equal(target.update(Number.NaN), true);
  assert.equal(target.position.equals(initialPosition), true);
  target.dispose();
});

test('aplica quatro danos, limita a vida a zero e destrói uma única vez', () => {
  const healthChanges = [];
  const destructions = [];
  const { target } = createTarget({
    onDestroy: (state) => destructions.push(state),
    onHealthChange: (state) => healthChanges.push(state),
  });

  for (let hit = 0; hit < 4; hit += 1) {
    assert.equal(target.applyDamage(), true);
  }

  assert.deepEqual(
    healthChanges.map(({ health }) => health),
    [75, 50, 25, 0],
  );
  assert.equal(destructions.length, 1);
  assert.deepEqual(target.state, {
    alive: false,
    health: 0,
    maxHealth: 100,
    ratio: 0,
  });
  assert.equal(target.applyDamage(), false);
  assert.equal(healthChanges.length, 4);
  assert.equal(destructions.length, 1);
  assert.equal(
    target.material.color.getHex(),
    GAMEPLAY_CONFIG.target.colors.destroyed,
  );
  target.dispose();
});

test('reset restaura a vida e o visual sem emitir evento de dano', () => {
  const healthChanges = [];
  const { target } = createTarget({
    onHealthChange: (state) => healthChanges.push(state),
  });

  assert.equal(target.reset(), false);
  target.applyDamage(40);
  assert.equal(target.reset(), true);
  assert.equal(target.health, 100);
  assert.equal(target.alive, true);
  assert.equal(target.mesh.scale.equals(new Vector3(1, 1, 1)), true);
  assert.equal(
    target.material.color.getHex(),
    GAMEPLAY_CONFIG.target.colors.active,
  );
  assert.equal(healthChanges.length, 1);
  target.dispose();
});

test('valida configuração, callbacks, dano e vetor de saída', () => {
  const scene = new Scene();
  const baseConfig = GAMEPLAY_CONFIG.target;

  assert.throws(() => new TargetSystem(), /cena Three\.js válida/);
  assert.throws(
    () =>
      new TargetSystem({
        scene,
        config: { ...baseConfig, radius: 0 },
      }),
    /target\.radius.*maior que zero/,
  );
  assert.throws(
    () => new TargetSystem({ scene, onHealthChange: null }),
    /onHealthChange como função/,
  );

  const target = new TargetSystem({ scene });
  assert.throws(() => target.applyDamage(0), /dano.*maior que zero/i);
  assert.throws(() => target.getCenter({}), /Vector3/);
  target.dispose();
});

test('mantém a transição de estado se um observador falhar', () => {
  const failure = new Error('falha do observador');
  const destructions = [];
  const { target } = createTarget({
    onHealthChange: () => {
      throw failure;
    },
    onDestroy: (state) => destructions.push(state),
  });

  assert.throws(() => target.applyDamage(100), failure);
  assert.equal(target.health, 0);
  assert.equal(target.alive, false);
  assert.equal(destructions.length, 1);
  target.dispose();
});

test('dispose remove o alvo e os recursos uma única vez', () => {
  const { scene, target } = createTarget();
  let geometryDisposals = 0;
  let materialDisposals = 0;
  const disposeGeometry = target.geometry.dispose.bind(target.geometry);
  const disposeMaterial = target.material.dispose.bind(target.material);

  target.geometry.dispose = () => {
    geometryDisposals += 1;
    disposeGeometry();
  };
  target.material.dispose = () => {
    materialDisposals += 1;
    disposeMaterial();
  };

  assert.equal(target.dispose(), true);
  assert.equal(target.dispose(), false);
  assert.equal(target.parent, null);
  assert.equal(scene.getObjectByName('practice-target'), undefined);
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.equal(target.update(1), false);
  assert.equal(target.reset(), false);
});
