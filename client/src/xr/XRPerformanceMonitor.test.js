import assert from 'node:assert/strict';
import test from 'node:test';

import { XRPerformanceMonitor } from './XRPerformanceMonitor.js';

function createFixture() {
  let time = 1000;
  const reports = [];
  const renderer = {
    info: {
      render: { calls: 8, triangles: 1200 },
    },
  };
  const session = {
    visibilityState: 'visible',
    inputSources: [
      {
        handedness: 'left',
        targetRayMode: 'tracked-pointer',
        profiles: ['meta-quest-touch-plus'],
      },
      {
        handedness: 'right',
        targetRayMode: 'tracked-pointer',
        profiles: ['meta-quest-touch-plus'],
      },
    ],
  };
  const monitor = new XRPerformanceMonitor({
    renderer,
    navigatorRef: { userAgent: 'OculusBrowser Quest 3' },
    now: () => time,
    onUpdate: (report) => reports.push(report),
    config: {
      slowFrameThresholdMs: 20,
      publishIntervalSeconds: 0.05,
    },
  });

  return {
    advance(milliseconds) {
      time += milliseconds;
    },
    monitor,
    renderer,
    reports,
    session,
  };
}

test('mede frames, renderer e controles durante uma sessão XR', () => {
  const fixture = createFixture();

  assert.equal(fixture.monitor.start({ session: fixture.session }), true);
  assert.equal(fixture.monitor.start({ session: fixture.session }), false);
  fixture.monitor.sample(0.01);
  fixture.renderer.info.render.calls = 12;
  fixture.renderer.info.render.triangles = 1800;
  fixture.monitor.sample(0.02);
  fixture.monitor.sample(0.03);
  fixture.advance(60);
  const report = fixture.monitor.stop({ reason: 'manual-exit' });

  assert.equal(report.state, 'complete');
  assert.equal(report.reason, 'manual-exit');
  assert.equal(report.device, 'Meta Quest 3');
  assert.equal(report.frameCount, 3);
  assert.equal(report.averageFps, 50);
  assert.equal(report.minimumFps, 50);
  assert.equal(report.maxFrameMs, 30);
  assert.equal(report.slowFramePercent, 33.3);
  assert.equal(report.maxDrawCalls, 12);
  assert.equal(report.maxTriangles, 1800);
  assert.equal(report.controllers.length, 2);
  assert.equal(report.controllers[0].handedness, 'left');
  assert.equal(Object.isFrozen(report.controllers), true);
  assert.equal(fixture.reports.at(-1), report);
});

test('ignora amostras fora da sessão e encerra o ciclo de vida', () => {
  const fixture = createFixture();

  assert.equal(fixture.monitor.sample(0.016), false);
  assert.equal(fixture.monitor.stop(), false);
  fixture.monitor.start({ session: fixture.session });
  assert.equal(fixture.monitor.sample(Number.NaN), false);
  assert.equal(fixture.monitor.dispose(), true);
  assert.equal(fixture.monitor.dispose(), false);
  assert.equal(fixture.monitor.lastReport.reason, 'disposed');
  assert.throws(
    () => fixture.monitor.start({ session: fixture.session }),
    /descartado/i,
  );
});

test('rejeita dependências e limites inválidos', () => {
  assert.throws(() => new XRPerformanceMonitor(), /renderer/i);
  assert.throws(
    () =>
      new XRPerformanceMonitor({
        renderer: { info: { render: {} } },
        config: { slowFrameThresholdMs: 0, publishIntervalSeconds: 1 },
      }),
    /configuração/i,
  );
});
