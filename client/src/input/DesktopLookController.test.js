import assert from 'node:assert/strict';
import test from 'node:test';

import { Euler, PerspectiveCamera } from 'three';

import { DESKTOP_LOOK_CONFIG } from '../config/desktop-look-config.js';
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

test('limita a observação vertical a 85 graus e mantém yaw livre', () => {
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
    movementX: 800,
    movementY: -100000,
  });
  let rotation = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  assertAlmostEqual(
    rotation.x,
    Math.PI / 2 - DESKTOP_LOOK_CONFIG.minPolarAngle,
  );
  assert.ok(Math.abs(rotation.y) > 1.5);

  fixture.documentRef.dispatch('mousemove', {
    movementX: 0,
    movementY: 200000,
  });
  rotation = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  assertAlmostEqual(
    rotation.x,
    Math.PI / 2 - DESKTOP_LOOK_CONFIG.maxPolarAngle,
  );
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
