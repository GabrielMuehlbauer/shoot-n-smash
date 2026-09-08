import { RENDER_CONFIG } from '../config/render-config.js';

function finiteMetric(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function describeDevice(userAgent) {
  const value = typeof userAgent === 'string' ? userAgent : '';

  if (/Quest 3/i.test(value)) {
    return 'Meta Quest 3';
  }

  if (/OculusBrowser|Quest/i.test(value)) {
    return 'Headset Meta Quest';
  }

  return value ? 'Dispositivo WebXR' : 'Dispositivo não identificado';
}

function freezeControllers(inputSources = []) {
  return Object.freeze(
    Array.from(inputSources, (source) =>
      Object.freeze({
        handedness: source?.handedness || 'none',
        targetRayMode: source?.targetRayMode || 'unknown',
        profiles: Object.freeze(
          Array.isArray(source?.profiles) ? [...source.profiles] : [],
        ),
      }),
    ),
  );
}

export class XRPerformanceMonitor {
  constructor({
    renderer,
    navigatorRef = globalThis.navigator,
    now = () => globalThis.performance?.now?.() ?? Date.now(),
    onUpdate = () => {},
    config = RENDER_CONFIG.xr.diagnostics,
  } = {}) {
    if (!renderer?.info?.render) {
      throw new Error('XRPerformanceMonitor requer as métricas do renderer.');
    }

    if (typeof now !== 'function' || typeof onUpdate !== 'function') {
      throw new TypeError('Relógio e observador do diagnóstico devem ser funções.');
    }

    if (
      !Number.isFinite(config?.slowFrameThresholdMs) ||
      config.slowFrameThresholdMs <= 0 ||
      !Number.isFinite(config?.publishIntervalSeconds) ||
      config.publishIntervalSeconds <= 0
    ) {
      throw new RangeError('A configuração do diagnóstico XR é inválida.');
    }

    this.renderer = renderer;
    this.navigatorRef = navigatorRef;
    this.now = now;
    this.onUpdate = onUpdate;
    this.config = config;
    this.active = false;
    this.disposed = false;
    this.lastReport = null;
    this.resetMetrics();
  }

  resetMetrics() {
    this.session = null;
    this.startedAt = 0;
    this.frameCount = 0;
    this.totalFrameSeconds = 0;
    this.windowFrames = 0;
    this.windowSeconds = 0;
    this.currentFps = 0;
    this.minimumFps = Number.POSITIVE_INFINITY;
    this.maxFrameMs = 0;
    this.slowFrameCount = 0;
    this.maxDrawCalls = 0;
    this.maxTriangles = 0;
  }

  start({ session } = {}) {
    this.assertNotDisposed();

    if (!session || this.active) {
      return false;
    }

    this.resetMetrics();
    this.session = session;
    this.startedAt = this.now();
    this.active = true;
    this.publish('active');
    return true;
  }

  sample(deltaSeconds) {
    if (!this.active || this.disposed) {
      return false;
    }

    const delta = Number(deltaSeconds);

    if (!Number.isFinite(delta) || delta <= 0) {
      return false;
    }

    const frameMs = delta * 1000;
    this.frameCount += 1;
    this.totalFrameSeconds += delta;
    this.windowFrames += 1;
    this.windowSeconds += delta;
    this.maxFrameMs = Math.max(this.maxFrameMs, frameMs);

    if (frameMs > this.config.slowFrameThresholdMs) {
      this.slowFrameCount += 1;
    }

    const render = this.renderer.info.render;
    this.maxDrawCalls = Math.max(this.maxDrawCalls, finiteMetric(render.calls));
    this.maxTriangles = Math.max(
      this.maxTriangles,
      finiteMetric(render.triangles),
    );

    if (this.windowSeconds >= this.config.publishIntervalSeconds) {
      this.flushWindow();
      this.publish('active');
    }

    return true;
  }

  flushWindow() {
    if (this.windowFrames === 0 || this.windowSeconds <= 0) {
      return false;
    }

    this.currentFps = this.windowFrames / this.windowSeconds;
    this.minimumFps = Math.min(this.minimumFps, this.currentFps);
    this.windowFrames = 0;
    this.windowSeconds = 0;
    return true;
  }

  createReport(state, reason = null) {
    const elapsedSeconds = this.active
      ? Math.max((this.now() - this.startedAt) / 1000, this.totalFrameSeconds)
      : this.totalFrameSeconds;
    const averageFps =
      this.totalFrameSeconds > 0
        ? this.frameCount / this.totalFrameSeconds
        : 0;
    const slowFramePercent =
      this.frameCount > 0
        ? (this.slowFrameCount / this.frameCount) * 100
        : 0;

    return Object.freeze({
      state,
      reason,
      device: describeDevice(this.navigatorRef?.userAgent),
      visibilityState: this.session?.visibilityState ?? 'unknown',
      durationSeconds: round(elapsedSeconds),
      frameCount: this.frameCount,
      averageFps: round(averageFps),
      currentFps: round(this.currentFps),
      minimumFps: Number.isFinite(this.minimumFps)
        ? round(this.minimumFps)
        : 0,
      maxFrameMs: round(this.maxFrameMs, 2),
      slowFramePercent: round(slowFramePercent),
      slowFrameThresholdMs: this.config.slowFrameThresholdMs,
      maxDrawCalls: this.maxDrawCalls,
      maxTriangles: this.maxTriangles,
      controllers: freezeControllers(this.session?.inputSources),
    });
  }

  publish(state, reason = null) {
    const report = this.createReport(state, reason);
    this.lastReport = report;
    this.onUpdate(report);
    return report;
  }

  stop({ reason = 'session-ended' } = {}) {
    if (!this.active) {
      return false;
    }

    this.flushWindow();
    const report = this.publish('complete', reason);
    this.active = false;
    this.session = null;
    this.lastReport = report;
    return report;
  }

  assertNotDisposed() {
    if (this.disposed) {
      throw new Error('XRPerformanceMonitor descartado.');
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    if (this.active) {
      this.stop({ reason: 'disposed' });
    }

    this.disposed = true;
    return true;
  }
}
