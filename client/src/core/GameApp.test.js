import assert from 'node:assert/strict';
import test from 'node:test';

import { GameApp } from './GameApp.js';

function createFixture() {
  const animationLoops = [];
  const updates = [];
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
  const documentRef = {
    hidden: false,
    addEventListener: (name, listener) => documentListeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (documentListeners.get(name) === listener) {
        documentListeners.delete(name);
      }
    },
  };

  return {
    animationLoops,
    documentListeners,
    documentRef,
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
});

test('stop e dispose removem loop e listeners sem duplicação', () => {
  const fixture = createFixture();
  const app = new GameApp(fixture);

  app.start();
  assert.equal(app.stop(), true);
  assert.equal(app.stop(), false);
  assert.equal(fixture.animationLoops.at(-1), null);
  assert.equal(fixture.documentListeners.size, 0);

  assert.equal(app.dispose(), true);
  assert.equal(app.dispose(), false);
  assert.equal(fixture.renderContext.disposeCalls, 1);
  assert.throws(() => app.start(), /GameApp descartada/);
});
