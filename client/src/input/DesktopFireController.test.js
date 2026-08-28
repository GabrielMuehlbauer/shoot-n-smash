import assert from 'node:assert/strict';
import test from 'node:test';

import { DesktopFireController } from './DesktopFireController.js';

function createEventTarget() {
  const listeners = new Map();

  return {
    listeners,
    addEventListener(name, listener) {
      const group = listeners.get(name) ?? new Set();
      group.add(listener);
      listeners.set(name, group);
    },
    removeEventListener(name, listener) {
      listeners.get(name)?.delete(listener);
    },
    dispatch(name, init = {}) {
      const event = {
        type: name,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...init,
      };

      for (const listener of [...(listeners.get(name) ?? [])]) {
        listener(event);
      }

      return event;
    },
  };
}

function createFixture() {
  const windowRef = createEventTarget();
  const documentRef = {
    ...createEventTarget(),
    pointerLockElement: null,
    defaultView: windowRef,
  };
  const canvas = {
    ...createEventTarget(),
    ownerDocument: documentRef,
  };
  const calls = [];
  const controller = new DesktopFireController({
    canvas,
    documentRef,
    windowRef,
    onChargeStart: () => calls.push('start'),
    onChargeRelease: () => calls.push('release'),
    onChargeCancel: ({ reason }) => calls.push(`cancel:${reason}`),
  });

  return { calls, canvas, controller, documentRef, windowRef };
}

test('carrega e solta apenas com o botão esquerdo durante Pointer Lock', () => {
  const fixture = createFixture();
  fixture.controller.connect();

  fixture.canvas.dispatch('mousedown', { button: 0 });
  fixture.documentRef.pointerLockElement = fixture.canvas;
  fixture.canvas.dispatch('mousedown', { button: 2 });
  const downEvent = fixture.canvas.dispatch('mousedown', { button: 0 });
  fixture.canvas.dispatch('mousedown', { button: 0 });
  const upEvent = fixture.documentRef.dispatch('mouseup', { button: 0 });

  assert.deepEqual(fixture.calls, ['start', 'release']);
  assert.equal(downEvent.defaultPrevented, true);
  assert.equal(upEvent.defaultPrevented, true);
  assert.equal(fixture.controller.isPressed, false);
  fixture.controller.dispose();
});

test('não arma o disparo quando o início da carga é recusado', () => {
  const fixture = createFixture();
  fixture.controller.onChargeStart = () => false;
  fixture.controller.connect();
  fixture.documentRef.pointerLockElement = fixture.canvas;

  fixture.canvas.dispatch('mousedown', { button: 0 });
  fixture.documentRef.dispatch('mouseup', { button: 0 });

  assert.equal(fixture.controller.isPressed, false);
  assert.deepEqual(fixture.calls, []);
  fixture.controller.dispose();
});

test('perder Pointer Lock cancela a carga e impede o disparo tardio', () => {
  const fixture = createFixture();
  fixture.controller.connect();
  fixture.documentRef.pointerLockElement = fixture.canvas;
  fixture.canvas.dispatch('mousedown', { button: 0 });

  fixture.documentRef.pointerLockElement = null;
  fixture.documentRef.dispatch('pointerlockchange');
  fixture.documentRef.dispatch('mouseup', { button: 0 });

  assert.deepEqual(fixture.calls, ['start', 'cancel:pointer-lock-lost']);
  assert.equal(fixture.controller.isPressed, false);
  fixture.controller.dispose();
});

test('blur e menu de contexto cancelam a carga ativa', () => {
  const fixture = createFixture();
  fixture.controller.connect();
  fixture.documentRef.pointerLockElement = fixture.canvas;

  fixture.canvas.dispatch('mousedown', { button: 0 });
  fixture.windowRef.dispatch('blur');
  fixture.canvas.dispatch('mousedown', { button: 0 });
  const contextEvent = fixture.documentRef.dispatch('contextmenu');

  assert.deepEqual(fixture.calls, [
    'start',
    'cancel:window-blur',
    'start',
    'cancel:context-menu',
  ]);
  assert.equal(contextEvent.defaultPrevented, true);
  fixture.controller.dispose();
});

test('cancelCharge aceita um motivo externo e não libera depois do cancelamento', () => {
  const fixture = createFixture();
  fixture.controller.connect();
  fixture.documentRef.pointerLockElement = fixture.canvas;
  fixture.canvas.dispatch('mousedown', { button: 0 });

  assert.equal(fixture.controller.cancelCharge('document-hidden'), true);
  assert.equal(fixture.controller.cancelCharge('document-hidden'), false);
  fixture.documentRef.dispatch('mouseup', { button: 0 });

  assert.deepEqual(fixture.calls, ['start', 'cancel:document-hidden']);
  fixture.controller.dispose();
});

test('reverte todos os listeners quando connect falha parcialmente', () => {
  const fixture = createFixture();
  const originalAddEventListener =
    fixture.documentRef.addEventListener.bind(fixture.documentRef);
  fixture.documentRef.addEventListener = (name, listener) => {
    if (name === 'contextmenu') {
      throw new Error('falha simulada ao registrar contextmenu');
    }

    originalAddEventListener(name, listener);
  };

  assert.throws(() => fixture.controller.connect(), /falha simulada/);
  assert.equal(fixture.controller.isConnected, false);
  assert.equal(fixture.canvas.listeners.get('mousedown').size, 0);
  assert.equal(fixture.documentRef.listeners.get('mouseup').size, 0);
  assert.equal(fixture.documentRef.listeners.get('contextmenu'), undefined);
  assert.equal(fixture.windowRef.listeners.get('blur'), undefined);
  fixture.controller.dispose();
});

test('três ciclos de conexão não deixam listeners residuais', () => {
  const fixture = createFixture();

  for (let cycle = 0; cycle < 3; cycle += 1) {
    assert.equal(fixture.controller.connect(), true);
    fixture.documentRef.pointerLockElement = fixture.canvas;
    fixture.canvas.dispatch('mousedown', { button: 0 });
    fixture.documentRef.dispatch('mouseup', { button: 0 });
    assert.equal(fixture.controller.disconnect(), true);

    assert.equal(fixture.canvas.listeners.get('mousedown').size, 0);
    assert.equal(fixture.documentRef.listeners.get('mouseup').size, 0);
    assert.equal(fixture.documentRef.listeners.get('contextmenu').size, 0);
    assert.equal(
      fixture.documentRef.listeners.get('pointerlockchange').size,
      0,
    );
    assert.equal(fixture.windowRef.listeners.get('blur').size, 0);
  }

  assert.deepEqual(fixture.calls, [
    'start',
    'release',
    'start',
    'release',
    'start',
    'release',
  ]);
  fixture.canvas.dispatch('mousedown', { button: 0 });
  assert.equal(fixture.calls.length, 6);
  fixture.controller.dispose();
});

test('connect, disconnect e dispose são idempotentes e limpam listeners', () => {
  const fixture = createFixture();

  assert.equal(fixture.controller.connect(), true);
  assert.equal(fixture.controller.connect(), false);
  fixture.documentRef.pointerLockElement = fixture.canvas;
  fixture.canvas.dispatch('mousedown', { button: 0 });

  assert.equal(fixture.controller.disconnect(), true);
  assert.equal(fixture.controller.disconnect(), false);
  assert.deepEqual(fixture.calls, ['start', 'cancel:disconnect']);
  assert.equal(fixture.controller.isConnected, false);
  assert.equal(fixture.canvas.listeners.get('mousedown').size, 0);
  assert.equal(fixture.documentRef.listeners.get('mouseup').size, 0);
  assert.equal(fixture.windowRef.listeners.get('blur').size, 0);

  assert.equal(fixture.controller.dispose(), true);
  assert.equal(fixture.controller.dispose(), false);
  assert.throws(() => fixture.controller.connect(), /controle descartado/);
});
