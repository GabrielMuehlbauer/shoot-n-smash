import { RENDER_CONFIG } from '../config/render-config.js';

export class GameApp {
  constructor({
    renderContext,
    lookController = null,
    documentRef = document,
    maxDeltaSeconds = RENDER_CONFIG.loop.maxDeltaSeconds,
  }) {
    if (!renderContext) {
      throw new Error('GameApp requer um RenderContext.');
    }

    this.renderContext = renderContext;
    this.lookController = lookController;
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

    let connectedLookController = false;

    try {
      connectedLookController = this.lookController?.connect?.() ?? false;
      this.previousTimestamp = null;
      this.renderContext.setAnimationLoop(this.animationFrame);
      this.documentRef?.addEventListener?.(
        'visibilitychange',
        this.handleVisibilityChange,
      );
      this.running = true;
    } catch (error) {
      if (connectedLookController) {
        this.lookController?.disconnect?.();
      }

      throw error;
    }

    return true;
  }

  stop() {
    if (!this.running) {
      return false;
    }

    this.renderContext.setAnimationLoop(null);
    this.lookController?.disconnect?.();
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
      this.lookController?.unlock?.();
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
      this.lookController?.unlock?.();
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.stop();
    this.lookController?.dispose?.();
    this.renderContext.dispose();
    this.disposed = true;

    return true;
  }
}
