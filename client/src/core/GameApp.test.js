import assert from 'node:assert/strict';
import test from 'node:test';

import { GameApp } from './GameApp.js';

function createFixture() {
  const animationLoops = [];
  const updates = [];
  const lookCalls = {
    connect: 0,
    disconnect: 0,
    dispose: 0,
    unlock: 0,
  };
  const documentCalls = {
    add: 0,
    remove: 0,
  };
  const documentListeners = new Map();
  const renderContext = {
    disposeCalls: 0,
    renderCalls: 0,
    setAnimationLoop: (callback) => animationLoops.push(callback),
    update: (deltaSeconds) => updates.push(deltaSeconds),
    render() {
      this.renderCalls += 1;
    },
    dispose() {
      this.disposeCalls += 1;
    },
  };
  const lookController = {
    connect: () => {
      lookCalls.connect += 1;
      return true;
    },
    disconnect: () => {
      lookCalls.disconnect += 1;
      return true;
    },
    dispose: () => {
      lookCalls.dispose += 1;
      return true;
    },
    unlock: () => {
      lookCalls.unlock += 1;
      return true;
    },
  };
  const documentRef = {
    hidden: false,
    addEventListener: (name, listener) => {
      documentCalls.add += 1;
      documentListeners.set(name, listener);
    },
    removeEventListener: (name, listener) => {
      documentCalls.remove += 1;
      if (documentListeners.get(name) === listener) {
        documentListeners.delete(name);
      }
    },
  };

  return {
    animationLoops,
    documentCalls,
    documentListeners,
    documentRef,
    lookCalls,
    lookController,
    renderContext,
    updates,
  };
}

test('start é idempotente e registra apenas um loop', () => {
  const fixture = createFixture();
  const app = new GameApp(fixture);

  assert.equal(app.start(), true);
  assert.equal(app.start(), false);
  assert.equal(app.isRunning, true);
  assert.equal(fixture.animationLoops.length, 1);
  assert.equal(fixture.documentListeners.size, 1);
  assert.deepEqual(fixture.documentCalls, { add: 1, remove: 0 });
});

test('limita o delta após uma pausa longa', () => {
  const fixture = createFixture();
  const app = new GameApp({ ...fixture, maxDeltaSeconds: 0.05 });

  app.start();
  const frame = fixture.animationLoops[0];
  frame(1000);
  frame(2000);

  assert.deepEqual(fixture.updates, [0, 0.05]);
  assert.equal(fixture.renderContext.renderCalls, 2);
});

test('não atualiza a cena enquanto o documento está oculto', () => {
  const fixture = createFixture();
  const app = new GameApp(fixture);

  app.start();
  fixture.documentRef.hidden = true;
  fixture.animationLoops[0](1000);

  assert.deepEqual(fixture.updates, []);
  assert.equal(fixture.renderContext.renderCalls, 0);
  assert.equal(fixture.lookCalls.unlock, 1);
});

test('stop e dispose removem loop e listeners sem duplicação', () => {
  const fixture = createFixture();
  const app = new GameApp(fixture);

  app.start();
  assert.equal(app.stop(), true);
  assert.equal(app.stop(), false);
  assert.equal(fixture.animationLoops.at(-1), null);
  assert.equal(fixture.documentListeners.size, 0);
  assert.deepEqual(fixture.documentCalls, { add: 1, remove: 1 });

  assert.equal(app.dispose(), true);
  assert.equal(app.dispose(), false);
  assert.equal(fixture.renderContext.disposeCalls, 1);
  assert.equal(fixture.lookCalls.connect, 1);
  assert.equal(fixture.lookCalls.disconnect, 1);
  assert.equal(fixture.lookCalls.dispose, 1);
  assert.throws(() => app.start(), /GameApp descartada/);
});

test('desfaz o controle de visão quando o loop falha ao iniciar', () => {
  const fixture = createFixture();
  fixture.renderContext.setAnimationLoop = () => {
    throw new Error('falha simulada no loop');
  };
  const app = new GameApp(fixture);

  assert.throws(() => app.start(), /falha simulada/);
  assert.equal(fixture.lookCalls.connect, 1);
  assert.equal(fixture.lookCalls.disconnect, 1);
  assert.equal(app.isRunning, false);
});

test('desfaz o loop já instalado quando um passo posterior falha', () => {
  const fixture = createFixture();
  const originalError = new Error('falha simulada ao registrar listener');
  fixture.documentRef.addEventListener = () => {
    throw originalError;
  };
  const app = new GameApp(fixture);

  assert.throws(
    () => app.start(),
    (error) => error === originalError,
  );
  assert.equal(fixture.animationLoops.length, 2);
  assert.equal(typeof fixture.animationLoops[0], 'function');
  assert.equal(fixture.animationLoops[1], null);
  assert.equal(fixture.lookCalls.disconnect, 1);
  assert.equal(app.isRunning, false);
});

test('rollback tenta toda a limpeza sem mascarar o erro original', () => {
  const fixture = createFixture();
  const originalError = new Error('falha original de inicialização');
  fixture.documentRef.addEventListener = () => {
    throw originalError;
  };
  fixture.renderContext.setAnimationLoop = (callback) => {
    fixture.animationLoops.push(callback);

    if (callback === null) {
      throw new Error('falha secundária ao remover loop');
    }
  };
  fixture.lookController.disconnect = () => {
    fixture.lookCalls.disconnect += 1;
    throw new Error('falha secundária ao desconectar visão');
  };
  const app = new GameApp(fixture);

  assert.throws(
    () => app.start(),
    (error) => error === originalError,
  );
  assert.deepEqual(fixture.animationLoops, [app.animationFrame, null]);
  assert.equal(fixture.lookCalls.disconnect, 1);
  assert.equal(app.isRunning, false);
});
