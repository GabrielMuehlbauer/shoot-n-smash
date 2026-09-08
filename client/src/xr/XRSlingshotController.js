import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';

const CONTROLLER_COUNT = 2;
const SLINGSHOT_HAND = 'left';
const PROJECTILE_HAND = 'right';

function validateConfig(config) {
  const minimum = config?.pullDistance?.minimum;
  const maximum = config?.pullDistance?.maximum;

  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    minimum < 0 ||
    maximum <= minimum
  ) {
    throw new RangeError('As distâncias de tensão XR devem ser finitas e crescentes.');
  }
}

export function calculateXRChargeRatio(distance, pullDistance) {
  const numericDistance = Number(distance);

  if (!Number.isFinite(numericDistance)) {
    return 0;
  }

  return Math.min(
    Math.max(
      (numericDistance - pullDistance.minimum) /
        (pullDistance.maximum - pullDistance.minimum),
      0,
    ),
    1,
  );
}

export class XRSlingshotController {
  constructor({
    renderer,
    scene,
    onChargeStart = () => false,
    onChargeChange = () => false,
    onChargeRelease = () => false,
    onChargeCancel = () => false,
    onInputStateChange = () => {},
    config = GAMEPLAY_CONFIG.xr,
  } = {}) {
    if (!renderer?.xr?.getController) {
      throw new Error('XRSlingshotController requer um renderer WebXR.');
    }

    if (!scene?.add || !scene?.remove) {
      throw new Error('XRSlingshotController requer uma cena Three.js válida.');
    }

    for (const [name, callback] of [
      ['onChargeStart', onChargeStart],
      ['onChargeChange', onChargeChange],
      ['onChargeRelease', onChargeRelease],
      ['onChargeCancel', onChargeCancel],
      ['onInputStateChange', onInputStateChange],
    ]) {
      if (typeof callback !== 'function') {
        throw new TypeError(`${name} deve ser uma função.`);
      }
    }

    validateConfig(config);
    this.renderer = renderer;
    this.scene = scene;
    this.config = config;
    this.onChargeStart = onChargeStart;
    this.onChargeChange = onChargeChange;
    this.onChargeRelease = onChargeRelease;
    this.onChargeCancel = onChargeCancel;
    this.onInputStateChange = onInputStateChange;
    this.controllers = [];
    this.resources = new Set();
    this.connected = false;
    this.active = false;
    this.charging = false;
    this.disposed = false;
    this.slingPosition = new Vector3();
    this.projectilePosition = new Vector3();
    this.shotDirection = new Vector3();
    this.lastRatio = 0;

    try {
      this.visualRoot = this.createVisualRoot();
      this.scene.add(this.visualRoot);
      this.createControllers();
      this.syncVisibility();
    } catch (error) {
      this.disposeResources();
      throw error;
    }
  }

  createVisualRoot() {
    const root = new Group();
    root.name = 'xr-slingshot-visuals';
    const woodMaterial = new MeshStandardMaterial({
      color: 0x8a4f2a,
      roughness: 0.72,
    });
    const ballMaterial = new MeshStandardMaterial({
      color: 0xf4fbff,
      emissive: 0x173845,
      emissiveIntensity: 0.2,
      roughness: 0.9,
    });
    const handleGeometry = new CylinderGeometry(0.025, 0.034, 0.22, 8);
    const ballGeometry = new SphereGeometry(0.065, 12, 9);
    const bandGeometry = new BufferGeometry();
    bandGeometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(12), 3),
    );
    const bandMaterial = new LineBasicMaterial({ color: 0xf1c27d });

    for (const resource of [
      woodMaterial,
      ballMaterial,
      handleGeometry,
      ballGeometry,
      bandGeometry,
      bandMaterial,
    ]) {
      this.resources.add(resource);
    }

    this.handleVisual = new Mesh(handleGeometry, woodMaterial);
    this.handleVisual.name = 'xr-slingshot-handle';
    this.projectileVisual = new Mesh(ballGeometry, ballMaterial);
    this.projectileVisual.name = 'xr-slingshot-projectile';
    this.bandVisual = new Line(bandGeometry, bandMaterial);
    this.bandVisual.name = 'xr-slingshot-bands';
    root.add(this.handleVisual, this.projectileVisual, this.bandVisual);
    return root;
  }

  createControllers() {
    for (let index = 0; index < CONTROLLER_COUNT; index += 1) {
      const object = this.renderer.xr.getController(index);
      const record = {
        index,
        object,
        connected: false,
        handedness: '',
        onConnected: (event) => this.handleConnected(record, event),
        onDisconnected: () => this.handleDisconnected(record),
        onSelectStart: () => this.handleSelectStart(record),
        onSelectEnd: () => this.handleSelectEnd(record),
      };
      object.addEventListener('connected', record.onConnected);
      object.addEventListener('disconnected', record.onDisconnected);
      object.addEventListener('selectstart', record.onSelectStart);
      object.addEventListener('selectend', record.onSelectEnd);
      object.visible = false;
      this.scene.add(object);
      this.controllers.push(record);
    }
  }

  connect() {
    if (this.disposed || this.connected) {
      return false;
    }

    this.connected = true;
    return true;
  }

  disconnect() {
    if (!this.connected) {
      return false;
    }

    this.cancelCharge('disconnect');
    this.connected = false;
    return true;
  }

  setActive(active) {
    if (this.disposed) {
      return false;
    }

    const nextActive = Boolean(active);

    if (this.active === nextActive) {
      return false;
    }

    if (!nextActive) {
      this.cancelCharge('xr-session-ended');
    }

    this.active = nextActive;
    this.syncVisibility();
    this.publishInputState();
    return true;
  }

  getControllerByHand(handedness) {
    return this.controllers.find(
      (controller) =>
        controller.connected && controller.handedness === handedness,
    );
  }

  get slingshotController() {
    return (
      this.getControllerByHand(SLINGSHOT_HAND) ??
      this.controllers.find((controller) => controller.connected) ??
      null
    );
  }

  get projectileController() {
    const rightController = this.getControllerByHand(PROJECTILE_HAND);

    if (rightController) {
      return rightController;
    }

    const slingshot = this.slingshotController;
    return (
      this.controllers.find(
        (controller) => controller.connected && controller !== slingshot,
      ) ?? null
    );
  }

  handleConnected(record, event) {
    record.connected = true;
    record.handedness = event?.data?.handedness ?? '';
    record.object.visible = this.active;
    this.syncVisibility();
    this.publishInputState();
  }

  handleDisconnected(record) {
    if (this.charging && record === this.projectileController) {
      this.cancelCharge('controller-disconnected');
    }

    record.connected = false;
    record.handedness = '';
    record.object.visible = false;
    this.syncVisibility();
    this.publishInputState();
  }

  handleSelectStart(record) {
    if (
      !this.active ||
      !this.connected ||
      record !== this.projectileController ||
      !this.slingshotController
    ) {
      return false;
    }

    this.charging = Boolean(this.onChargeStart({ mode: 'manual' }));
    this.lastRatio = 0;
    this.syncVisibility();
    return this.charging;
  }

  handleSelectEnd(record) {
    if (!this.charging || record !== this.projectileController) {
      return false;
    }

    if (!this.updatePose()) {
      return this.cancelCharge('invalid-controller-pose');
    }

    try {
      return this.onChargeRelease({
        origin: this.slingPosition.clone(),
        direction: this.shotDirection.clone(),
      });
    } finally {
      this.charging = false;
      this.lastRatio = 0;
      this.syncVisibility();
    }
  }

  updatePose() {
    const slingshot = this.slingshotController;
    const projectile = this.projectileController;

    if (!slingshot || !projectile) {
      return false;
    }

    slingshot.object.updateWorldMatrix?.(true, false);
    projectile.object.updateWorldMatrix?.(true, false);
    slingshot.object.getWorldPosition(this.slingPosition);
    projectile.object.getWorldPosition(this.projectilePosition);
    const distance = this.slingPosition.distanceTo(this.projectilePosition);

    if (distance <= Number.EPSILON) {
      return false;
    }

    this.shotDirection
      .subVectors(this.slingPosition, this.projectilePosition)
      .normalize();
    this.lastRatio = calculateXRChargeRatio(distance, this.config.pullDistance);
    return true;
  }

  update() {
    if (this.disposed || !this.active || !this.connected) {
      return false;
    }

    const poseValid = this.updatePose();

    if (poseValid) {
      this.updateVisuals();
    }

    if (this.charging) {
      if (!poseValid) {
        this.cancelCharge('invalid-controller-pose');
        return false;
      }

      this.onChargeChange(this.lastRatio);
    }

    return poseValid;
  }

  updateVisuals() {
    this.handleVisual.position.copy(this.slingPosition);
    this.projectileVisual.position.copy(this.projectilePosition);
    const positions = this.bandVisual.geometry.getAttribute('position');
    positions.setXYZ(
      0,
      this.slingPosition.x - 0.07,
      this.slingPosition.y + 0.09,
      this.slingPosition.z,
    );
    positions.setXYZ(
      1,
      this.projectilePosition.x,
      this.projectilePosition.y,
      this.projectilePosition.z,
    );
    positions.setXYZ(
      2,
      this.slingPosition.x + 0.07,
      this.slingPosition.y + 0.09,
      this.slingPosition.z,
    );
    positions.setXYZ(
      3,
      this.projectilePosition.x,
      this.projectilePosition.y,
      this.projectilePosition.z,
    );
    positions.needsUpdate = true;
    this.bandVisual.geometry.computeBoundingSphere();
  }

  cancelCharge(reason = 'manual') {
    if (!this.charging) {
      return false;
    }

    this.charging = false;
    this.lastRatio = 0;

    try {
      this.onChargeCancel({ reason });
      return true;
    } finally {
      this.syncVisibility();
    }
  }

  syncVisibility() {
    if (!this.visualRoot) {
      return;
    }

    this.visualRoot.visible = this.active;
    this.projectileVisual.visible =
      this.active && this.charging && Boolean(this.projectileController);
    this.bandVisual.visible =
      this.active && this.charging && Boolean(this.projectileController);
    this.handleVisual.visible = this.active && Boolean(this.slingshotController);

    for (const controller of this.controllers) {
      controller.object.visible = this.active && controller.connected;
    }
  }

  publishInputState() {
    const slingshotReady = Boolean(this.slingshotController);
    const projectileReady = Boolean(this.projectileController);
    this.onInputStateChange(
      Object.freeze({
        active: this.active,
        slingshotReady,
        projectileReady,
        ready: this.active && slingshotReady && projectileReady,
      }),
    );
  }

  disposeResources() {
    if (this.controllers) {
      for (const record of this.controllers) {
        record.object.removeEventListener?.('connected', record.onConnected);
        record.object.removeEventListener?.('disconnected', record.onDisconnected);
        record.object.removeEventListener?.('selectstart', record.onSelectStart);
        record.object.removeEventListener?.('selectend', record.onSelectEnd);
        this.scene?.remove?.(record.object);
      }
    }

    if (this.visualRoot) {
      this.scene?.remove?.(this.visualRoot);
    }

    for (const resource of this.resources ?? []) {
      resource.dispose?.();
    }
    this.resources?.clear?.();
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    let disposalError = null;

    try {
      this.cancelCharge('dispose');
    } catch (error) {
      disposalError = error;
    }

    try {
      this.disposeResources();
    } catch (error) {
      disposalError ??= error;
    }

    this.connected = false;
    this.active = false;
    this.disposed = true;

    if (disposalError) {
      throw disposalError;
    }

    return true;
  }
}
