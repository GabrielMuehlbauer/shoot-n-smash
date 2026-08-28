export class DesktopFireController {
  constructor({
    canvas,
    onChargeStart = () => {},
    onChargeRelease = () => {},
    onChargeCancel = () => {},
    documentRef = null,
    windowRef = null,
  }) {
    if (!canvas?.addEventListener || !canvas?.removeEventListener) {
      throw new Error('DesktopFireController requer um canvas válido.');
    }

    this.canvas = canvas;
    this.documentRef =
      documentRef ?? canvas.ownerDocument ?? globalThis.document;
    this.windowRef =
      windowRef ?? this.documentRef?.defaultView ?? globalThis.window;
    this.onChargeStart = onChargeStart;
    this.onChargeRelease = onChargeRelease;
    this.onChargeCancel = onChargeCancel;
    this.connected = false;
    this.pressed = false;
    this.disposed = false;

    if (
      !this.documentRef?.addEventListener ||
      !this.documentRef?.removeEventListener
    ) {
      throw new Error('DesktopFireController requer um documento válido.');
    }

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
  }

  get isConnected() {
    return this.connected;
  }

  get isPressed() {
    return this.pressed;
  }

  get isPointerLocked() {
    return this.documentRef.pointerLockElement === this.canvas;
  }

  connect() {
    if (this.disposed) {
      throw new Error('Não é possível reconectar um controle descartado.');
    }

    if (this.connected) {
      return false;
    }

    const bindings = this.getListenerBindings();
    const attachedBindings = [];

    try {
      for (const [target, name, listener] of bindings) {
        target.addEventListener(name, listener);
        attachedBindings.push([target, name, listener]);
      }
    } catch (error) {
      for (const [target, name, listener] of attachedBindings.reverse()) {
        target.removeEventListener(name, listener);
      }

      throw error;
    }

    this.connected = true;

    return true;
  }

  handleMouseDown(event) {
    if (event.button !== 0 || !this.connected || !this.isPointerLocked) {
      return;
    }

    event.preventDefault?.();

    if (this.pressed) {
      return;
    }

    this.pressed = true;

    try {
      if (this.onChargeStart() === false) {
        this.pressed = false;
      }
    } catch (error) {
      this.pressed = false;
      throw error;
    }
  }

  handleMouseUp(event) {
    if (event.button !== 0 || !this.pressed) {
      return;
    }

    event.preventDefault?.();
    this.pressed = false;

    if (this.isPointerLocked) {
      this.onChargeRelease();
    } else {
      this.onChargeCancel({ reason: 'pointer-lock-lost' });
    }
  }

  handleContextMenu(event) {
    if (this.isPointerLocked) {
      event.preventDefault?.();
    }

    this.cancelCharge('context-menu');
  }

  handlePointerLockChange() {
    if (!this.isPointerLocked) {
      this.cancelCharge('pointer-lock-lost');
    }
  }

  handleWindowBlur() {
    this.cancelCharge('window-blur');
  }

  cancelCharge(reason = 'manual') {
    if (!this.pressed) {
      return false;
    }

    this.pressed = false;
    this.onChargeCancel({ reason });
    return true;
  }

  getListenerBindings() {
    const bindings = [
      [this.canvas, 'mousedown', this.handleMouseDown],
      [this.documentRef, 'mouseup', this.handleMouseUp],
      [this.documentRef, 'contextmenu', this.handleContextMenu],
      [
        this.documentRef,
        'pointerlockchange',
        this.handlePointerLockChange,
      ],
    ];

    if (this.windowRef?.addEventListener && this.windowRef?.removeEventListener) {
      bindings.push([this.windowRef, 'blur', this.handleWindowBlur]);
    }

    return bindings;
  }

  disconnect() {
    if (!this.connected) {
      return false;
    }

    const shouldCancel = this.pressed;
    this.pressed = false;

    for (const [target, name, listener] of this.getListenerBindings()) {
      target.removeEventListener(name, listener);
    }

    this.connected = false;

    if (shouldCancel) {
      this.onChargeCancel({ reason: 'disconnect' });
    }

    return true;
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    try {
      this.disconnect();
    } finally {
      this.disposed = true;
    }

    return true;
  }
}
