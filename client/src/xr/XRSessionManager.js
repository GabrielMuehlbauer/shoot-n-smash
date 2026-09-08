const SESSION_MODE = 'immersive-vr';

function frozenState(state, details = {}) {
  return Object.freeze({ state, ...details });
}

async function endSilently(session) {
  try {
    await session?.end?.();
  } catch {
    // O descarte da sessão é best-effort e não deve gerar rejeição órfã.
  }
}

export class XRSessionManager {
  constructor({
    renderer,
    navigatorRef = globalThis.navigator,
    onStateChange = () => {},
  } = {}) {
    if (!renderer?.xr?.setSession) {
      throw new Error('XRSessionManager requer um renderer com WebXR habilitado.');
    }

    if (typeof onStateChange !== 'function') {
      throw new TypeError('onStateChange deve ser uma função.');
    }

    this.renderer = renderer;
    this.navigatorRef = navigatorRef;
    this.onStateChange = onStateChange;
    this.session = null;
    this.starting = false;
    this.supported = false;
    this.checkId = 0;
    this.disposed = false;
    this.handleSessionEnd = this.handleSessionEnd.bind(this);
  }

  get isPresenting() {
    return Boolean(this.session);
  }

  get currentSession() {
    return this.session;
  }

  publish(state, details = {}) {
    const snapshot = frozenState(state, {
      supported: this.supported,
      presenting: this.isPresenting,
      ...details,
    });
    this.onStateChange(snapshot);
    return snapshot;
  }

  async checkSupport() {
    this.assertNotDisposed();
    const requestId = ++this.checkId;
    const xr = this.navigatorRef?.xr;

    if (!xr?.isSessionSupported) {
      this.supported = false;
      return this.publish('unsupported');
    }

    this.publish('checking');

    try {
      const supported = await xr.isSessionSupported(SESSION_MODE);

      if (requestId !== this.checkId || this.disposed) {
        return null;
      }

      this.supported = Boolean(supported);
      return this.publish(this.supported ? 'ready' : 'unsupported');
    } catch (error) {
      if (requestId !== this.checkId || this.disposed) {
        return null;
      }

      this.supported = false;
      return this.publish('error', { error });
    }
  }

  async startSession() {
    this.assertNotDisposed();

    if (this.session || this.starting) {
      return false;
    }

    const xr = this.navigatorRef?.xr;

    if (!this.supported || !xr?.requestSession) {
      return false;
    }

    this.starting = true;
    this.publish('starting');

    try {
      const session = await xr.requestSession(SESSION_MODE, {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor'],
      });

      if (this.disposed) {
        this.starting = false;
        await endSilently(session);
        return false;
      }

      session.addEventListener?.('end', this.handleSessionEnd);
      this.session = session;
      await this.renderer.xr.setSession(session);

      if (this.disposed || this.session !== session) {
        this.starting = false;
        session.removeEventListener?.('end', this.handleSessionEnd);
        await endSilently(session);
        return false;
      }

      this.starting = false;
      this.publish('presenting');
      return true;
    } catch (error) {
      const session = this.session;
      this.starting = false;
      session?.removeEventListener?.('end', this.handleSessionEnd);
      this.session = null;
      await endSilently(session);
      this.publish('error', { error });
      return false;
    }
  }

  async endSession() {
    if (!this.session) {
      return false;
    }

    const session = this.session;
    await session.end?.();

    if (this.session === session) {
      this.handleSessionEnd();
    }

    return true;
  }

  handleSessionEnd() {
    const session = this.session;
    session?.removeEventListener?.('end', this.handleSessionEnd);
    this.session = null;

    if (!this.disposed) {
      this.publish(this.supported ? 'ready' : 'unsupported');
    }
  }

  assertNotDisposed() {
    if (this.disposed) {
      throw new Error('XRSessionManager descartado.');
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.disposed = true;
    this.starting = false;
    this.checkId += 1;
    const session = this.session;
    session?.removeEventListener?.('end', this.handleSessionEnd);
    this.session = null;

    if (session) {
      void endSilently(session);
    }

    return true;
  }
}
