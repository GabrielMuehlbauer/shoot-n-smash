import assert from 'node:assert/strict';
import test from 'node:test';

import { Group } from 'three';

import { RenderContext } from './RenderContext.js';

function createFixture() {
  const counters = {
    animationLoops: [],
    append: 0,
    canvasRemove: 0,
    geometryDispose: 0,
    materialDispose: 0,
    observerDisconnect: 0,
    observerObserve: 0,
    rendererDispose: 0,
    xrReferenceSpaceTypes: [],
    worldUpdates: [],
    windowAdd: 0,
    windowRemove: 0,
  };
  const renderer = {
    domElement: {
      dataset: {},
      remove: () => {
        counters.canvasRemove += 1;
      },
      setAttribute() {},
    },
    dispose: () => {
      counters.rendererDispose += 1;
    },
    render() {},
    setAnimationLoop: (callback) => counters.animationLoops.push(callback),
    setPixelRatio() {},
    setSize() {},
    xr: {
      enabled: false,
      isPresenting: false,
      setReferenceSpaceType: (type) => counters.xrReferenceSpaceTypes.push(type),
    },
  };
  const container = {
    append: () => {
      counters.append += 1;
    },
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
  };
  const windowRef = {
    devicePixelRatio: 2,
    addEventListener: () => {
      counters.windowAdd += 1;
    },
    removeEventListener: () => {
      counters.windowRemove += 1;
    },
  };
  class ResizeObserverFake {
    observe() {
      counters.observerObserve += 1;
    }

    disconnect() {
      counters.observerDisconnect += 1;
    }
  }

  return {
    container,
    counters,
    renderer,
    ResizeObserverFake,
    windowRef,
  };
}

function createRenderContextClass(fixture) {
  return class TestRenderContext extends RenderContext {
    createRenderer() {
      return fixture.renderer;
    }

    createLights() {}

    createGround() {
      this.snowArena = {
        update: (deltaSeconds) => {
          fixture.counters.worldUpdates.push(deltaSeconds);
        },
      };
      const geometry = {
        dispose: () => {
          fixture.counters.geometryDispose += 1;
        },
      };
      const material = {
        dispose: () => {
          fixture.counters.materialDispose += 1;
        },
      };
      const firstResource = new Group();
      const secondResource = new Group();
      firstResource.geometry = geometry;
      secondResource.geometry = geometry;
      firstResource.material = material;
      secondResource.material = material;
      this.scene.add(firstResource, secondResource);
    }

    createIceBeacon() {
      return { rotation: { y: 0 } };
    }

  };
}

test('repassa o delta ao cenário e ao farol de gelo', () => {
  const fixture = createFixture();
  const TestRenderContext = createRenderContextClass(fixture);
  const context = new TestRenderContext(fixture.container, {
    windowRef: fixture.windowRef,
    ResizeObserverClass: fixture.ResizeObserverFake,
  });

  context.update(0.5);

  assert.deepEqual(fixture.counters.worldUpdates, [0.5]);
  assert.ok(context.iceBeacon.rotation.y > 0);
  assert.equal(fixture.renderer.xr.enabled, true);
  assert.deepEqual(fixture.counters.xrReferenceSpaceTypes, ['local-floor']);
  assert.equal(context.isXRPresenting, false);
  context.dispose();
});

test('dispose libera recursos compartilhados, renderer e canvas uma única vez', () => {
  const fixture = createFixture();
  const TestRenderContext = createRenderContextClass(fixture);
  const context = new TestRenderContext(fixture.container, {
    windowRef: fixture.windowRef,
    ResizeObserverClass: fixture.ResizeObserverFake,
  });

  context.setAnimationLoop(() => {});

  assert.equal(context.dispose(), true);
  assert.equal(context.dispose(), false);
  assert.equal(fixture.counters.append, 1);
  assert.equal(fixture.counters.windowAdd, 1);
  assert.equal(fixture.counters.windowRemove, 1);
  assert.equal(fixture.counters.observerObserve, 1);
  assert.equal(fixture.counters.observerDisconnect, 1);
  assert.equal(fixture.counters.geometryDispose, 1);
  assert.equal(fixture.counters.materialDispose, 1);
  assert.equal(fixture.counters.rendererDispose, 1);
  assert.equal(fixture.counters.canvasRemove, 1);
  assert.equal(fixture.counters.animationLoops.at(-1), null);
});

test('falha parcial de inicialização descarta os recursos já criados', () => {
  const fixture = createFixture();
  const TestRenderContext = createRenderContextClass(fixture);
  class ThrowingResizeObserver extends fixture.ResizeObserverFake {
    observe() {
      super.observe();
      throw new Error('falha de inicialização simulada');
    }
  }

  assert.throws(
    () =>
      new TestRenderContext(fixture.container, {
        windowRef: fixture.windowRef,
        ResizeObserverClass: ThrowingResizeObserver,
      }),
    /falha de inicialização simulada/,
  );

  assert.equal(fixture.counters.geometryDispose, 1);
  assert.equal(fixture.counters.materialDispose, 1);
  assert.equal(fixture.counters.rendererDispose, 1);
  assert.equal(fixture.counters.canvasRemove, 1);
  assert.equal(fixture.counters.windowAdd, 1);
  assert.equal(fixture.counters.windowRemove, 1);
  assert.equal(fixture.counters.observerDisconnect, 1);
});

test('cache do animation loop só muda depois que o renderer aceita o callback', () => {
  const fixture = createFixture();
  const TestRenderContext = createRenderContextClass(fixture);
  const context = new TestRenderContext(fixture.container, {
    windowRef: fixture.windowRef,
    ResizeObserverClass: fixture.ResizeObserverFake,
  });

  fixture.renderer.setAnimationLoop = () => {
    throw new Error('renderer recusou o loop');
  };

  assert.throws(() => context.setAnimationLoop(() => {}), /recusou o loop/);
  assert.equal(context.animationLoop, null);

  fixture.renderer.setAnimationLoop = () => {};
  context.dispose();
});
