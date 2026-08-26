import { RENDER_CONFIG } from '../config/render-config.js';

export class GameApp {
  constructor({
    renderContext,
    documentRef = document,
    maxDeltaSeconds = RENDER_CONFIG.loop.maxDeltaSeconds,
  }) {
    if (!renderContext) {
      throw new Error('GameApp requer um RenderContext.');
    }

    this.renderContext = renderContext;
    this.documentRef = documentRef;
    this.maxDeltaSeconds = maxDeltaSeconds;
    this.previousTimestamp = null;
    this.running = false;
    this.disposed = false;

    this.animationFrame = this.animationFrame.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  get isRunning() {
    return this.running;
  }

  start() {
    if (this.disposed) {
      throw new Error('Não é possível reiniciar uma GameApp descartada.');
    }

    if (this.running) {
      return false;
    }

    this.previousTimestamp = null;
    this.renderContext.setAnimationLoop(this.animationFrame);
    this.documentRef?.addEventListener?.(
      'visibilitychange',
      this.handleVisibilityChange,
    );
    this.running = true;

    return true;
  }

  stop() {
    if (!this.running) {
      return false;
    }

    this.renderContext.setAnimationLoop(null);
    this.documentRef?.removeEventListener?.(
      'visibilitychange',
      this.handleVisibilityChange,
    );
    this.previousTimestamp = null;
    this.running = false;

    return true;
  }

  animationFrame(timestamp) {
    if (!this.running) {
      return;
    }

    if (this.documentRef?.hidden) {
      this.previousTimestamp = null;
      return;
    }

    const deltaSeconds =
      this.previousTimestamp === null
        ? 0
        : Math.min(
            Math.max((timestamp - this.previousTimestamp) / 1000, 0),
            this.maxDeltaSeconds,
          );

    this.previousTimestamp = timestamp;
    this.renderContext.update(deltaSeconds);
    this.renderContext.render();
  }

  handleVisibilityChange() {
    if (this.documentRef?.hidden) {
      this.previousTimestamp = null;
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.stop();
    this.renderContext.dispose();
    this.disposed = true;

    return true;
  }
}
