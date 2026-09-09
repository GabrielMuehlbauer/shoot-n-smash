import assert from 'node:assert/strict';
import test from 'node:test';

import { Scene, Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import {
  createImpactParticlePositions,
  ImpactFeedbackSystem,
} from './ImpactFeedbackSystem.js';

function createSystem(overrides = {}) {
  const scene = new Scene();
  const config = { ...GAMEPLAY_CONFIG.impactFeedback, ...overrides };
  const system = new ImpactFeedbackSystem({ scene, config });
  return { config, scene, system };
}

test('cria um burst 3D no centro do projétil no primeiro contato', () => {
  const { config, scene, system } = createSystem();
  const position = new Vector3(1, 2, -3);
  const mesh = system.spawn(position);

  assert.equal(system.parent, scene);
  assert.equal(system.activeCount, 1);
  assert.equal(mesh.name, 'impact-burst');
  assert.equal(mesh.isPoints, true);
  assert.equal(
    mesh.geometry.getAttribute('position').count,
    config.particleCount,
  );
  assert.deepEqual(mesh.position.toArray(), position.toArray());
  assert.deepEqual(mesh.scale.toArray(), [
    config.startScale,
    config.startScale,
    config.startScale,
  ]);
  assert.notEqual(mesh.position, position);
  system.dispose();
});

test('expande, desvanece e remove o burst após 0,32 segundo', () => {
  const { config, system } = createSystem();
  const mesh = system.spawn(new Vector3());
  const initialOpacity = mesh.material.opacity;
  let materialDisposals = 0;
  const disposeMaterial = mesh.material.dispose.bind(mesh.material);
  mesh.material.dispose = () => {
    materialDisposals += 1;
    disposeMaterial();
  };

  assert.equal(system.update(config.lifetimeSeconds / 2), true);
  assert.ok(
    Math.abs(
      mesh.scale.x - (config.startScale + config.endScale) / 2,
    ) < 1e-12,
  );
  assert.ok(mesh.material.opacity < initialOpacity);
  assert.equal(system.update(config.lifetimeSeconds / 2), true);
  assert.equal(system.activeCount, 0);
  assert.equal(mesh.parent, null);
  assert.equal(materialDisposals, 1);
  system.dispose();
});

test('mantém no máximo 12 bursts removendo o mais antigo', () => {
  const { config, system } = createSystem();
  const first = system.spawn(new Vector3(0, 0, 0));
  let firstMaterialDisposals = 0;
  const disposeFirstMaterial = first.material.dispose.bind(first.material);
  first.material.dispose = () => {
    firstMaterialDisposals += 1;
    disposeFirstMaterial();
  };

  for (let index = 1; index <= config.maxActive; index += 1) {
    system.spawn(new Vector3(index, 0, 0));
  }

  assert.equal(system.activeCount, config.maxActive);
  assert.equal(first.parent, null);
  assert.equal(firstMaterialDisposals, 1);
  assert.equal(system.children[0].position.x, 1);
  system.dispose();
});

test('saneia deltas sem regredir a animação', () => {
  const { system } = createSystem();
  const mesh = system.spawn(new Vector3());
  const scale = mesh.scale.clone();

  system.update(-1);
  system.update(Number.NaN);
  assert.equal(mesh.scale.equals(scale), true);
  system.dispose();
});

test('valida configuração e posição do impacto', () => {
  const scene = new Scene();

  assert.throws(() => new ImpactFeedbackSystem(), /cena Three\.js válida/);
  assert.throws(
    () =>
      new ImpactFeedbackSystem({
        scene,
        config: { ...GAMEPLAY_CONFIG.impactFeedback, lifetimeSeconds: 0 },
      }),
    /lifetimeSeconds.*maior que zero/,
  );
  assert.throws(
    () =>
      new ImpactFeedbackSystem({
        scene,
        config: { ...GAMEPLAY_CONFIG.impactFeedback, maxActive: 1.5 },
      }),
    /maxActive.*inteiro/,
  );
  assert.throws(() => createImpactParticlePositions(0), /inteiro positivo/);

  const system = new ImpactFeedbackSystem({ scene });
  assert.throws(() => system.spawn({ x: 0, y: Number.NaN, z: 0 }), /vetor/);
  system.dispose();
});

test('dispose remove cena, bursts e recursos uma única vez', () => {
  const { scene, system } = createSystem();
  const mesh = system.spawn(new Vector3());
  let geometryDisposals = 0;
  let materialDisposals = 0;
  const disposeGeometry = system.geometry.dispose.bind(system.geometry);
  const disposeMaterial = mesh.material.dispose.bind(mesh.material);
  system.geometry.dispose = () => {
    geometryDisposals += 1;
    disposeGeometry();
  };
  mesh.material.dispose = () => {
    materialDisposals += 1;
    disposeMaterial();
  };

  assert.equal(system.dispose(), true);
  assert.equal(system.dispose(), false);
  assert.equal(system.parent, null);
  assert.equal(scene.getObjectByName('impact-feedback'), undefined);
  assert.equal(mesh.parent, null);
  assert.equal(system.activeCount, 0);
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.equal(system.update(0.1), false);
  assert.throws(() => system.spawn(new Vector3()), /descartado/);
});
