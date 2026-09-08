import assert from 'node:assert/strict';
import test from 'node:test';

import { XRSessionManager } from './XRSessionManager.js';

function createSession() {
  const listeners = new Map();
  return {
    endCalls: 0,
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },
    removeEventListener(name, callback) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
    async end() {
      this.endCalls += 1;
      listeners.get('end')?.();
    },
    listeners,
  };
}

function createFixture({ supported = true } = {}) {
  const states = [];
  const requested = [];
  const rendererSessions = [];
  const session = createSession();
  const navigatorRef = {
    xr: {
      async isSessionSupported(mode) {
        assert.equal(mode, 'immersive-vr');
        return supported;
      },
      async requestSession(mode, options) {
        requested.push({ mode, options });
        return session;
      },
    },
  };
  const renderer = {
    xr: {
      async setSession(value) {
        rendererSessions.push(value);
      },
    },
  };
  const manager = new XRSessionManager({
    renderer,
    navigatorRef,
    onStateChange: (state) => states.push(state),
  });
  return { manager, rendererSessions, requested, session, states };
}

test('detecta immersive-vr antes de liberar a entrada', async () => {
  const fixture = createFixture();
  const state = await fixture.manager.checkSupport();

  assert.equal(state.state, 'ready');
  assert.equal(state.supported, true);
  assert.deepEqual(fixture.states.map((entry) => entry.state), ['checking', 'ready']);
  assert.equal(Object.isFrozen(state), true);
  fixture.manager.dispose();
});

test('inicia e encerra sessão local-floor sem duplicação', async () => {
  const fixture = createFixture();
  await fixture.manager.checkSupport();

  assert.equal(await fixture.manager.startSession(), true);
  assert.equal(await fixture.manager.startSession(), false);
  assert.equal(fixture.manager.isPresenting, true);
  assert.equal(fixture.requested[0].mode, 'immersive-vr');
  assert.deepEqual(fixture.requested[0].options, {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['bounded-floor'],
  });
  assert.deepEqual(fixture.rendererSessions, [fixture.session]);
  assert.equal(fixture.states.at(-1).state, 'presenting');

  assert.equal(await fixture.manager.endSession(), true);
  assert.equal(await fixture.manager.endSession(), false);
  assert.equal(fixture.manager.isPresenting, false);
  assert.equal(fixture.session.endCalls, 1);
  assert.equal(fixture.states.at(-1).state, 'ready');
  fixture.manager.dispose();
});

test('mantém o modo convencional quando WebXR não existe', async () => {
  const states = [];
  const manager = new XRSessionManager({
    renderer: { xr: { setSession() {} } },
    navigatorRef: {},
    onStateChange: (state) => states.push(state),
  });

  assert.equal((await manager.checkSupport()).state, 'unsupported');
  assert.equal(await manager.startSession(), false);
  assert.equal(states.at(-1).supported, false);
  assert.equal(manager.dispose(), true);
  assert.equal(manager.dispose(), false);
  await assert.rejects(() => manager.checkSupport(), /descartado/i);
});
