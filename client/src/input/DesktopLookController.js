import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import { DESKTOP_LOOK_CONFIG } from '../config/desktop-look-config.js';

function createPointerLockControls(camera) {
  return new PointerLockControls(camera);
}

export class DesktopLookController {
  constructor({
    camera,
    domElement,
    documentRef = null,
    onLockChange = () => {},
    onError = () => {},
    controlsFactory = createPointerLockControls,
  }) {
    if (!camera) {
      throw new Error('DesktopLookController requer uma câmera.');
    }

    if (!domElement) {
      throw new Error('DesktopLookController requer um elemento HTML.');
    }

    this.camera = camera;
    this.domElement = domElement;
    this.documentRef =
      documentRef ?? domElement.ownerDocument ?? globalThis.document;
    this.onLockChange = onLockChange;
    this.onError = onError;
    this.connected = false;
    this.disposed = false;

    if (!this.documentRef?.addEventListener) {
      throw new Error('DesktopLookController requer um documento válido.');
    }

    this.controls = controlsFactory(camera);
    this.controls.pointerSpeed = DESKTOP_LOOK_CONFIG.pointerSpeed;
    this.controls.minPolarAngle = DESKTOP_LOOK_CONFIG.minPolarAngle;
    this.controls.maxPolarAngle = DESKTOP_LOOK_CONFIG.maxPolarAngle;

    this.handleLock = this.handleLock.bind(this);
    this.handleUnlock = this.handleUnlock.bind(this);
    this.handlePointerLockError = this.handlePointerLockError.bind(this);
  }

  get isConnected() {
    return this.connected;
  }

  get isLocked() {
    return this.documentRef.pointerLockElement === this.domElement;
  }

  get isSupported() {
    return (
      typeof this.domElement.requestPointerLock === 'function' &&
      typeof this.documentRef.exitPointerLock === 'function'
    );
  }

  connect() {
    if (this.disposed) {
      throw new Error('Não é possível reconectar um controle descartado.');
    }

    if (this.connected) {
      return false;
    }

    this.controls.addEventListener('lock', this.handleLock);
    this.controls.addEventListener('unlock', this.handleUnlock);
    this.documentRef.addEventListener(
      'pointerlockerror',
      this.handlePointerLockError,
    );

    try {
      this.controls.connect(this.domElement);
    } catch (error) {
      this.controls.removeEventListener('lock', this.handleLock);
      this.controls.removeEventListener('unlock', this.handleUnlock);
      this.documentRef.removeEventListener(
        'pointerlockerror',
        this.handlePointerLockError,
      );
      this.controls.disconnect?.();
      throw error;
    }

    this.connected = true;
    this.onLockChange({ locked: this.isLocked, supported: this.isSupported });

    return true;
  }

  requestLock() {
    if (this.disposed || !this.connected) {
      this.reportError(
        'not-connected',
        'O controle de visão ainda não está disponível.',
      );
      return false;
    }

    if (!this.isSupported) {
      this.reportError(
        'unsupported',
        'Este navegador não oferece suporte ao Pointer Lock.',
      );
      return false;
    }

    try {
      const request = this.domElement.requestPointerLock({
        unadjustedMovement: DESKTOP_LOOK_CONFIG.unadjustedMovement,
      });

      request?.catch?.((error) => {
        this.reportError(
          'request-rejected',
          'O navegador recusou a captura do ponteiro.',
          error,
        );
      });
    } catch (error) {
      this.reportError(
        'request-failed',
        'Não foi possível capturar o ponteiro.',
        error,
      );
      return false;
    }

    return true;
  }

  unlock() {
    if (!this.isLocked) {
      return false;
    }

    this.documentRef.exitPointerLock();
    return true;
  }

  handleLock() {
    this.onLockChange({ locked: true, supported: this.isSupported });
  }

  handleUnlock() {
    this.onLockChange({ locked: false, supported: this.isSupported });
  }

  handlePointerLockError(event) {
    this.reportError(
      'pointer-lock-error',
      'O navegador informou uma falha ao capturar o ponteiro.',
      event,
    );
  }

  reportError(code, message, cause = null) {
    this.onError({ code, message, cause });
  }

  disconnect() {
    if (!this.connected) {
      return false;
    }

    this.unlock();
    this.controls.removeEventListener('lock', this.handleLock);
    this.controls.removeEventListener('unlock', this.handleUnlock);
    this.documentRef.removeEventListener(
      'pointerlockerror',
      this.handlePointerLockError,
    );
    this.controls.disconnect();
    this.connected = false;

    return true;
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.disconnect();
    this.controls.dispose();
    this.disposed = true;

    return true;
  }
}
