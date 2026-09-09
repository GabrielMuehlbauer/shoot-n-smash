import { RENDER_CONFIG } from '../config/render-config.js';

export class GameApp {
  constructor({
    renderContext,
    lookController = null,
    fireController = null,
    xrController = null,
    xrHud = null,
    performanceMonitor = null,
    audioSystem = null,
    gameSession = null,
    documentRef = document,
    maxDeltaSeconds = RENDER_CONFIG.loop.maxDeltaSeconds,
  }) {
    if (!renderContext) {
      throw new Error('GameApp requer um RenderContext.');
    }

    this.renderContext = renderContext;
    this.lookController = lookController;
    this.fireController = fireController;
    this.xrController = xrController;
    this.xrHud = xrHud;
    this.performanceMonitor = performanceMonitor;
    this.audioSystem = audioSystem;
    this.gameSession = gameSession;
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
    let connectedFireController = false;
    let connectedXRController = false;
    let animationLoopInstalled = false;

    try {
      connectedLookController = this.lookController?.connect?.() ?? false;
      connectedFireController = this.fireController?.connect?.() ?? false;
      connectedXRController = this.xrController?.connect?.() ?? false;
      this.previousTimestamp = null;
      this.renderContext.setAnimationLoop(this.animationFrame);
      animationLoopInstalled = true;
      this.documentRef?.addEventListener?.(
        'visibilitychange',
        this.handleVisibilityChange,
      );
      this.running = true;
    } catch (error) {
      try {
        this.documentRef?.removeEventListener?.(
          'visibilitychange',
          this.handleVisibilityChange,
        );
      } catch {
        // A limpeza é best-effort; o erro original de inicialização prevalece.
      }

      if (animationLoopInstalled) {
        try {
          this.renderContext.setAnimationLoop(null);
        } catch {
          // A limpeza é best-effort; o erro original de inicialização prevalece.
        }
      }

      if (connectedFireController) {
        try {
          this.fireController?.disconnect?.();
        } catch {
          // A limpeza é best-effort; o erro original de inicialização prevalece.
        }
      }

      if (connectedXRController) {
        try {
          this.xrController?.disconnect?.();
        } catch {
          // A limpeza é best-effort; o erro original de inicialização prevalece.
        }
      }

      if (connectedLookController) {
        try {
          this.lookController?.disconnect?.();
        } catch {
          // A limpeza é best-effort; o erro original de inicialização prevalece.
        }
      }

      this.previousTimestamp = null;
      this.running = false;
      throw error;
    }

    return true;
  }

  stop() {
    if (!this.running) {
      return false;
    }

    let stopError = null;
    const cleanup = (callback) => {
      try {
        callback();
      } catch (error) {
        stopError ??= error;
      }
    };

    cleanup(() => this.renderContext.setAnimationLoop(null));
    cleanup(() => this.fireController?.disconnect?.());
    cleanup(() => this.xrController?.disconnect?.());
    cleanup(() => this.gameSession?.cancelCharge?.());
    cleanup(() => this.lookController?.disconnect?.());
    cleanup(() =>
      this.documentRef?.removeEventListener?.(
        'visibilitychange',
        this.handleVisibilityChange,
      ),
    );
    this.previousTimestamp = null;
    this.running = false;

    if (stopError) {
      throw stopError;
    }

    return true;
  }

  animationFrame(timestamp) {
    if (!this.running) {
      return;
    }

    if (this.documentRef?.hidden && !this.renderContext.isXRPresenting) {
      this.previousTimestamp = null;
      this.fireController?.cancelCharge?.('document-hidden');
      this.gameSession?.cancelCharge?.();
      this.lookController?.unlock?.();
      return;
    }

    const frameDeltaSeconds =
      this.previousTimestamp === null
        ? 0
        : Math.max((timestamp - this.previousTimestamp) / 1000, 0);
    const deltaSeconds = Math.min(frameDeltaSeconds, this.maxDeltaSeconds);

    this.previousTimestamp = timestamp;
    this.xrController?.update?.(deltaSeconds);
    this.gameSession?.update?.(deltaSeconds);
    this.renderContext.update(deltaSeconds);
    this.xrHud?.update?.(deltaSeconds);
    this.renderContext.render();
    this.performanceMonitor?.sample?.(frameDeltaSeconds);
  }

  handleVisibilityChange() {
    if (this.documentRef?.hidden && !this.renderContext.isXRPresenting) {
      this.previousTimestamp = null;
      this.fireController?.cancelCharge?.('document-hidden');
      this.gameSession?.cancelCharge?.();
      this.lookController?.unlock?.();
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    let disposalError = null;
    const cleanup = (callback) => {
      try {
        callback();
      } catch (error) {
        disposalError ??= error;
      }
    };

    cleanup(() => this.stop());
    cleanup(() => this.fireController?.dispose?.());
    cleanup(() => this.xrController?.dispose?.());
    cleanup(() => this.xrHud?.dispose?.());
    cleanup(() => this.performanceMonitor?.dispose?.());
    cleanup(() => this.audioSystem?.dispose?.());
    cleanup(() => this.gameSession?.dispose?.());
    cleanup(() => this.lookController?.dispose?.());
    cleanup(() => this.renderContext.dispose());
    this.disposed = true;

    if (disposalError) {
      throw disposalError;
    }

    return true;
  }
}
