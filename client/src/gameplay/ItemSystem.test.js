import assert from 'node:assert/strict';
import test from 'node:test';

import { Scene, Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { ItemSystem } from './ItemSystem.js';

function createConfig(overrides = {}) {
  return {
    ...GAMEPLAY_CONFIG.items,
    ...overrides,
    spawn: {
      ...GAMEPLAY_CONFIG.items.spawn,
      ...overrides.spawn,
    },
    animation: {
      ...GAMEPLAY_CONFIG.items.animation,
      ...overrides.animation,
    },
    types: overrides.types ?? GAMEPLAY_CONFIG.items.types,
  };
}

function sequence(values) {
  let index = 0;
  return () => values[index++] ?? 0;
}

test('sorteia um item dentro da arena usando a chance da onda atual', () => {
  const changes = [];
  const scene = new Scene();
  const system = new ItemSystem({
    scene,
    config: createConfig({ spawnChanceByWave: [1, 1, 1, 1] }),
    random: sequence([0, 0, 0, 0]),
    onStateChange: (state) => changes.push(state),
  });

  const spawn = system.trySpawn({ wave: 1 });
  const center = system.getCenter(new Vector3());

  assert.equal(spawn.active, true);
  assert.equal(spawn.type.id, 'health');
  assert.equal(spawn.wave, 1);
  assert.equal(spawn.remainingSeconds, 12);
  assert.equal(Object.isFrozen(spawn), true);
  assert.equal(Object.isFrozen(spawn.type.effect), true);
  assert.equal(center.x, 0);
  assert.equal(center.y, GAMEPLAY_CONFIG.items.spawn.height);
  assert.equal(center.z, GAMEPLAY_CONFIG.items.spawn.minRadius);
  assert.equal(system.itemRoot.visible, true);
  assert.equal(changes.length, 1);
  system.dispose();
});

test('respeita probabilidades por onda e mantém somente um item ativo', () => {
  let randomCalls = 0;
  const system = new ItemSystem({
    scene: new Scene(),
    random: () => {
      randomCalls += 1;
      return 0.5;
    },
  });

  assert.equal(system.trySpawn({ wave: 1 }), false);
  assert.equal(randomCalls, 1);

  system.random = sequence([0.1, 0.99, 0.25, 0.5]);
  const spawn = system.trySpawn({ wave: 2 });
  assert.equal(spawn.type.id, 'special-ammo');
  assert.equal(system.trySpawn({ wave: 4 }), false);
  system.dispose();
});

test('coleta e expiração publicam um único desfecho e ocultam o item', () => {
  const changes = [];
  const system = new ItemSystem({
    scene: new Scene(),
    config: createConfig({
      lifetimeSeconds: 0.5,
      spawnChanceByWave: [1, 1, 1, 1],
    }),
    random: () => 0,
    onStateChange: (state) => changes.push(state),
  });

  system.trySpawn({ wave: 1 });
  const collected = system.collect();
  assert.equal(collected.active, false);
  assert.equal(collected.outcome, 'collected');
  assert.equal(system.collect(), false);
  assert.equal(system.itemRoot.visible, false);

  system.trySpawn({ wave: 2 });
  assert.equal(system.update(0.49), true);
  const expired = system.update(0.02);
  assert.equal(expired.outcome, 'expired');
  assert.equal(system.state.active, false);
  assert.deepEqual(
    changes.map(({ active, outcome }) => ({ active, outcome })),
    [
      { active: true, outcome: null },
      { active: false, outcome: 'collected' },
      { active: true, outcome: null },
      { active: false, outcome: 'expired' },
    ],
  );
  system.dispose();
});

test('anima o modelo sem deslocar o centro do collider', () => {
  const system = new ItemSystem({
    scene: new Scene(),
    config: createConfig({ spawnChanceByWave: [1, 1, 1, 1] }),
    random: () => 0,
  });

  system.trySpawn({ wave: 3 });
  const before = system.getCenter(new Vector3()).clone();
  system.update(0.25);

  assert.notEqual(system.model.position.y, 0);
  assert.notEqual(system.model.rotation.y, 0);
  assert.deepEqual(system.getCenter(new Vector3()).toArray(), before.toArray());
  system.dispose();
});

test('valida configuração, ondas, RNG e descarte de recursos', () => {
  assert.throws(
    () =>
      new ItemSystem({
        scene: new Scene(),
        config: createConfig({ radius: 0 }),
      }),
    /items\.radius/,
  );
  assert.throws(
    () => new ItemSystem({ scene: new Scene(), random: null }),
    /gerador aleatório/,
  );

  const scene = new Scene();
  const system = new ItemSystem({
    scene,
    config: createConfig({ spawnChanceByWave: [1, 1, 1, 1] }),
    random: () => 1,
  });

  assert.throws(() => system.trySpawn({ wave: 0 }), /onda configurada/);
  assert.throws(() => system.trySpawn({ wave: 1 }), /entre 0 e 1/);
  assert.equal(scene.children.includes(system.container), true);
  assert.equal(system.dispose(), true);
  assert.equal(system.dispose(), false);
  assert.equal(scene.children.includes(system.container), false);
  assert.equal(system.update(1), false);
  assert.throws(() => system.trySpawn({ wave: 1 }), /descartado/);
});
