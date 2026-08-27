import assert from 'node:assert/strict';
import test from 'node:test';

import { Euler, PerspectiveCamera, Quaternion } from 'three';

import { DesktopLookController } from './DesktopLookController.js';

function createDocumentFixture({ supported = true } = {}) {
  const listeners = new Map();
  const documentRef = {
    pointerLockElement: null,
    addEventListener(name, listener) {
      const group = listeners.get(name) ?? new Set();
      group.add(listener);
      listeners.set(name, group);
    },
    removeEventListener(name, listener) {
      listeners.get(name)?.delete(listener);
    },
    dispatch(name, event = {}) {
      for (const listener of listeners.get(name) ?? []) {
        listener({ type: name, ...event });
      }
    },
  };
  const domElement = {
    ownerDocument: documentRef,
  };

  if (supported) {
    documentRef.exitPointerLock = () => {
      documentRef.pointerLockElement = null;
      documentRef.dispatch('pointerlockchange');
    };
    domElement.requestPointerLock = () => {
      documentRef.pointerLockElement = domElement;
      documentRef.dispatch('pointerlockchange');
      return Promise.resolve();
    };
  }

  return { documentRef, domElement, listeners };
}

function createCamera() {
  const camera = new PerspectiveCamera(65, 1, 0.1, 120);
  camera.position.set(0, 1.65, 0);
  camera.lookAt(0, 1.65, -1);
  return camera;
}

function assertAlmostEqual(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperado ${expected}, recebido ${actual}`,
  );
}

test('conecta, desconecta e descarta sem duplicar listeners', () => {
  const fixture = createDocumentFixture();
  const states = [];
  const controller = new DesktopLookController({
    camera: createCamera(),
    domElement: fixture.domElement,
    documentRef: fixture.documentRef,
    onLockChange: (state) => states.push(state.locked),
  });

  assert.equal(controller.connect(), true);
  assert.equal(controller.connect(), false);
  assert.equal(controller.isConnected, true);
  assert.equal(controller.requestLock(), true);
  assert.equal(controller.isLocked, true);
  assert.deepEqual(states, [false, true]);

  assert.equal(controller.disconnect(), true);
  assert.equal(controller.disconnect(), false);
  assert.equal(controller.isLocked, false);
  assert.equal(controller.isConnected, false);
  assert.equal(controller.dispose(), true);
  assert.equal(controller.dispose(), false);
  assert.throws(() => controller.connect(), /controle descartado/);
});

test('mantém os listeners isolados por três ciclos completos', () => {
  const fixture = createDocumentFixture();
  const lockedStates = [];

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const controller = new DesktopLookController({
      camera: createCamera(),
      domElement: fixture.domElement,
      documentRef: fixture.documentRef,
      onLockChange: ({ locked }) => lockedStates.push({ cycle, locked }),
    });

    controller.connect();
    assert.equal(fixture.listeners.get('mousemove')?.size, 1);
    assert.equal(fixture.listeners.get('pointerlockchange')?.size, 1);
    assert.equal(fixture.listeners.get('pointerlockerror')?.size, 2);

    controller.requestLock();
    assert.equal(controller.isLocked, true);
    controller.dispose();

    for (const listeners of fixture.listeners.values()) {
      assert.equal(listeners.size, 0);
    }
  }

  assert.deepEqual(
    lockedStates.map(({ locked }) => locked),
    [false, true, false, false, true, false, false, true, false],
  );
});

test('gira a câmera somente durante Pointer Lock sem mover o jogador', () => {
  const fixture = createDocumentFixture();
  const camera = createCamera();
  const initialPosition = camera.position.toArray();
  const controller = new DesktopLookController({
    camera,
    domElement: fixture.domElement,
    documentRef: fixture.documentRef,
  });
  controller.connect();

  fixture.documentRef.dispatch('mousemove', { movementX: 100, movementY: 0 });
  let rotation = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  assertAlmostEqual(rotation.y, 0);

  controller.requestLock();
  fixture.documentRef.dispatch('mousemove', { movementX: 100, movementY: -25 });
  rotation = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');

  assertAlmostEqual(rotation.y, -0.2);
  assertAlmostEqual(rotation.x, 0.05);
  assert.deepEqual(camera.position.toArray(), initialPosition);
  controller.dispose();
});

test('mantém yaw livre mesmo após ultrapassar uma volta completa', () => {
  const fixture = createDocumentFixture();
  const camera = createCamera();
  const controller = new DesktopLookController({
    camera,
    domElement: fixture.domElement,
    documentRef: fixture.documentRef,
  });
  controller.connect();
  controller.requestLock();

  for (let step = 0; step < 4; step += 1) {
    fixture.documentRef.dispatch('mousemove', {
      movementX: 1000,
      movementY: 0,
    });
  }

  const expected = new Quaternion().setFromEuler(
    new Euler(0, -8, 0, 'YXZ'),
  );
  assertAlmostEqual(Math.abs(camera.quaternion.dot(expected)), 1);
  controller.dispose();
});

test('limita o pitch superior ao valor literal de +85 graus', () => {
  const fixture = createDocumentFixture();
  const camera = createCamera();
  const controller = new DesktopLookController({
    camera,
    domElement: fixture.domElement,
    documentRef: fixture.documentRef,
  });
  controller.connect();
  controller.requestLock();

  fixture.documentRef.dispatch('mousemove', {
    movementX: 0,
    movementY: -100000,
  });
  const rotation = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');

  assertAlmostEqual(rotation.x, (85 * Math.PI) / 180);
  controller.dispose();
});

test('limita o pitch inferior ao valor literal de -85 graus', () => {
  const fixture = createDocumentFixture();
  const camera = createCamera();
  const controller = new DesktopLookController({
    camera,
    domElement: fixture.domElement,
    documentRef: fixture.documentRef,
  });
  controller.connect();
  controller.requestLock();

  fixture.documentRef.dispatch('mousemove', {
    movementX: 0,
    movementY: 100000,
  });
  const rotation = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');

  assertAlmostEqual(rotation.x, (-85 * Math.PI) / 180);
  controller.dispose();
});

test('ignora rejeição assíncrona pertencente a uma sessão anterior', async () => {
  const fixture = createDocumentFixture();
  const errors = [];
  let rejectOldRequest;
  let requestCount = 0;
  fixture.domElement.requestPointerLock = () => {
    requestCount += 1;

    if (requestCount === 1) {
      return new Promise((resolve, reject) => {
        rejectOldRequest = reject;
      });
    }

    fixture.documentRef.pointerLockElement = fixture.domElement;
    fixture.documentRef.dispatch('pointerlockchange');
    return Promise.resolve();
  };
  const controller = new DesktopLookController({
    camera: createCamera(),
    domElement: fixture.domElement,
    documentRef: fixture.documentRef,
    onError: (error) => errors.push(error),
  });

  controller.connect();
  controller.requestLock();
  controller.disconnect();
  controller.connect();
  controller.requestLock();
  rejectOldRequest(new Error('rejeição antiga'));
  await Promise.resolve();

  assert.equal(controller.isLocked, true);
  assert.deepEqual(errors, []);
  controller.dispose();
});

test('relata rejeição assíncrona da sessão ativa', async () => {
  const fixture = createDocumentFixture();
  const errors = [];
  fixture.domElement.requestPointerLock = () =>
    Promise.reject(new Error('rejeição atual'));
  const controller = new DesktopLookController({
    camera: createCamera(),
    domElement: fixture.domElement,
    documentRef: fixture.documentRef,
    onError: (error) => errors.push(error),
  });

  controller.connect();
  controller.requestLock();
  await Promise.resolve();

  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'request-rejected');
  assert.match(errors[0].cause.message, /rejeição atual/);
  controller.dispose();
});

test('informa fallback quando Pointer Lock não é suportado', () => {
  const fixture = createDocumentFixture({ supported: false });
  const errors = [];
  const controller = new DesktopLookController({
    camera: createCamera(),
    domElement: fixture.domElement,
    documentRef: fixture.documentRef,
    onError: (error) => errors.push(error),
  });

  controller.connect();

  assert.equal(controller.isSupported, false);
  assert.equal(controller.requestLock(), false);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'unsupported');
  controller.dispose();
});
