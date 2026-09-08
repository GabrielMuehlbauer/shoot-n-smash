import assert from 'node:assert/strict';
import test from 'node:test';

import { GameApp } from './GameApp.js';

function createFixture() {
  const animationLoops = [];
  const frameOrder = [];
  const updates = [];
  const gameSessionCalls = {
    cancelCharge: 0,
    dispose: 0,
    updates: [],
  };
  const fireCalls = {
    cancelCharge: [],
    connect: 0,
    disconnect: 0,
    dispose: 0,
  };
  const lookCalls = {
    connect: 0,
    disconnect: 0,
    dispose: 0,
    unlock: 0,
  };
  const xrCalls = {
    connect: 0,
    disconnect: 0,
    dispose: 0,
    updates: [],
  };
  const documentCalls = {
    add: 0,
    remove: 0,
  };
  const documentListeners = new Map();
  const renderContext = {
    disposeCalls: 0,
    renderCalls: 0,
    isXRPresenting: false,
    setAnimationLoop: (callback) => animationLoops.push(callback),
    update: (deltaSeconds) => {
      updates.push(deltaSeconds);
      frameOrder.push('world');
    },
    render() {
      this.renderCalls += 1;
      frameOrder.push('render');
    },
    dispose() {
      this.disposeCalls += 1;
    },
  };
  const fireController = {
    connect: () => {
      fireCalls.connect += 1;
      return true;
    },
    disconnect: () => {
      fireCalls.disconnect += 1;
      return true;
    },
    cancelCharge: (reason) => {
      fireCalls.cancelCharge.push(reason);
      return true;
    },
    dispose: () => {
      fireCalls.dispose += 1;
      return true;
    },
  };
  const gameSession = {
    update: (deltaSeconds) => {
      gameSessionCalls.updates.push(deltaSeconds);
      frameOrder.push('gameplay');
    },
    cancelCharge: () => {
      gameSessionCalls.cancelCharge += 1;
      return true;
    },
    dispose: () => {
      gameSessionCalls.dispose += 1;
      return true;
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
  const xrController = {
    connect: () => {
      xrCalls.connect += 1;
      return true;
    },
    disconnect: () => {
      xrCalls.disconnect += 1;
      return true;
    },
    update: (deltaSeconds) => {
      xrCalls.updates.push(deltaSeconds);
      frameOrder.push('xr');
    },
    dispose: () => {
      xrCalls.dispose += 1;
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
    fireCalls,
    fireController,
    frameOrder,
    gameSession,
    gameSessionCalls,
    lookCalls,
    lookController,
    renderContext,
    updates,
    xrCalls,
    xrController,
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
  assert.equal(fixture.fireCalls.connect, 1);
});

test('limita o delta após uma pausa longa', () => {
  const fixture = createFixture();
  const app = new GameApp({ ...fixture, maxDeltaSeconds: 0.05 });

  app.start();
  const frame = fixture.animationLoops[0];
  frame(1000);
  frame(2000);

  assert.deepEqual(fixture.updates, [0, 0.05]);
  assert.deepEqual(fixture.gameSessionCalls.updates, [0, 0.05]);
  assert.deepEqual(fixture.frameOrder, [
    'xr',
    'gameplay',
    'world',
    'render',
    'xr',
    'gameplay',
    'world',
    'render',
  ]);
  assert.equal(fixture.renderContext.renderCalls, 2);
});

test('mantém o loop ativo quando o headset está apresentando', () => {
  const fixture = createFixture();
  const app = new GameApp(fixture);

  app.start();
  fixture.documentRef.hidden = true;
  fixture.renderContext.isXRPresenting = true;
  fixture.animationLoops[0](1000);

  assert.deepEqual(fixture.xrCalls.updates, [0]);
  assert.deepEqual(fixture.gameSessionCalls.updates, [0]);
  assert.equal(fixture.renderContext.renderCalls, 1);
  app.dispose();
});

test('coleta métricas depois de renderizar o frame', () => {
  const fixture = createFixture();
  const samples = [];
  const performanceMonitor = {
    sample(deltaSeconds) {
      samples.push({
        deltaSeconds,
        renderCalls: fixture.renderContext.renderCalls,
      });
    },
    dispose() {},
  };
  const app = new GameApp({ ...fixture, performanceMonitor });

  app.start();
  fixture.animationLoops[0](1000);
  fixture.animationLoops[0](2000);

  assert.deepEqual(samples, [
    { deltaSeconds: 0, renderCalls: 1 },
    { deltaSeconds: 1, renderCalls: 2 },
  ]);
  app.dispose();
});

test('atualiza e descarta o HUD XR junto com o loop principal', () => {
  const fixture = createFixture();
  const updates = [];
  let disposeCalls = 0;
  const xrHud = {
    update(deltaSeconds) {
      updates.push(deltaSeconds);
      fixture.frameOrder.push('xr-hud');
    },
    dispose() {
      disposeCalls += 1;
    },
  };
  const app = new GameApp({ ...fixture, xrHud });

  app.start();
  fixture.animationLoops[0](1000);

  assert.deepEqual(updates, [0]);
  assert.ok(
    fixture.frameOrder.indexOf('xr-hud') < fixture.frameOrder.indexOf('render'),
  );
  app.dispose();
  assert.equal(disposeCalls, 1);
});

test('não atualiza a cena enquanto o documento está oculto', () => {
  const fixture = createFixture();
  const app = new GameApp(fixture);

  app.start();
  fixture.documentRef.hidden = true;
  fixture.animationLoops[0](1000);

  assert.deepEqual(fixture.updates, []);
  assert.deepEqual(fixture.gameSessionCalls.updates, []);
  assert.equal(fixture.renderContext.renderCalls, 0);
  assert.deepEqual(fixture.fireCalls.cancelCharge, ['document-hidden']);
  assert.equal(fixture.gameSessionCalls.cancelCharge, 1);
  assert.equal(fixture.lookCalls.unlock, 1);
});

test('visibilitychange cancela a carga antes de liberar a mira', () => {
  const fixture = createFixture();
  const app = new GameApp(fixture);

  app.start();
  fixture.documentRef.hidden = true;
  fixture.documentListeners.get('visibilitychange')();

  assert.deepEqual(fixture.fireCalls.cancelCharge, ['document-hidden']);
  assert.equal(fixture.gameSessionCalls.cancelCharge, 1);
  assert.equal(fixture.lookCalls.unlock, 1);
  assert.deepEqual(fixture.gameSessionCalls.updates, []);
  app.dispose();
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
  assert.equal(fixture.fireCalls.connect, 1);
  assert.equal(fixture.fireCalls.disconnect, 1);
  assert.equal(fixture.fireCalls.dispose, 1);
  assert.equal(fixture.gameSessionCalls.cancelCharge, 1);
  assert.equal(fixture.gameSessionCalls.dispose, 1);
  assert.equal(fixture.xrCalls.connect, 1);
  assert.equal(fixture.xrCalls.disconnect, 1);
  assert.equal(fixture.xrCalls.dispose, 1);
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
  assert.equal(fixture.fireCalls.connect, 1);
  assert.equal(fixture.fireCalls.disconnect, 1);
  assert.equal(app.isRunning, false);
});

test('desfaz o controle de visão quando a entrada de disparo falha', () => {
  const fixture = createFixture();
  fixture.fireController.connect = () => {
    fixture.fireCalls.connect += 1;
    throw new Error('falha simulada na entrada de disparo');
  };
  const app = new GameApp(fixture);

  assert.throws(() => app.start(), /falha simulada na entrada de disparo/);
  assert.equal(fixture.lookCalls.connect, 1);
  assert.equal(fixture.lookCalls.disconnect, 1);
  assert.equal(fixture.fireCalls.connect, 1);
  assert.equal(fixture.fireCalls.disconnect, 0);
  assert.deepEqual(fixture.animationLoops, []);
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
  assert.equal(fixture.fireCalls.disconnect, 1);
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
  fixture.fireController.disconnect = () => {
    fixture.fireCalls.disconnect += 1;
    throw new Error('falha secundária ao desconectar disparo');
  };
  const app = new GameApp(fixture);

  assert.throws(
    () => app.start(),
    (error) => error === originalError,
  );
  assert.deepEqual(fixture.animationLoops, [app.animationFrame, null]);
  assert.equal(fixture.fireCalls.disconnect, 1);
  assert.equal(fixture.lookCalls.disconnect, 1);
  assert.equal(app.isRunning, false);
});

test('stop tenta toda a limpeza e preserva o primeiro erro', () => {
  const fixture = createFixture();
  const originalError = new Error('falha simulada ao remover loop');
  fixture.renderContext.setAnimationLoop = (callback) => {
    fixture.animationLoops.push(callback);

    if (callback === null) {
      throw originalError;
    }
  };
  fixture.fireController.disconnect = () => {
    fixture.fireCalls.disconnect += 1;
    throw new Error('falha secundária ao desconectar disparo');
  };
  const app = new GameApp(fixture);

  app.start();
  assert.throws(
    () => app.stop(),
    (error) => error === originalError,
  );

  assert.equal(app.isRunning, false);
  assert.equal(fixture.fireCalls.disconnect, 1);
  assert.equal(fixture.gameSessionCalls.cancelCharge, 1);
  assert.equal(fixture.lookCalls.disconnect, 1);
  assert.equal(fixture.documentListeners.size, 0);
});

test('dispose continua após falhas e deixa a aplicação terminal', () => {
  const fixture = createFixture();
  const originalError = new Error('falha simulada ao descartar disparo');
  fixture.fireController.dispose = () => {
    fixture.fireCalls.dispose += 1;
    throw originalError;
  };
  fixture.gameSession.dispose = () => {
    fixture.gameSessionCalls.dispose += 1;
    throw new Error('falha secundária ao descartar sessão');
  };
  const app = new GameApp(fixture);

  app.start();
  assert.throws(
    () => app.dispose(),
    (error) => error === originalError,
  );

  assert.equal(fixture.fireCalls.dispose, 1);
  assert.equal(fixture.gameSessionCalls.dispose, 1);
  assert.equal(fixture.lookCalls.dispose, 1);
  assert.equal(fixture.renderContext.disposeCalls, 1);
  assert.equal(app.dispose(), false);
  assert.throws(() => app.start(), /GameApp descartada/);
});
