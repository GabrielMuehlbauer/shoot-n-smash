import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineSegments,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { calculateBallisticPoint } from '../gameplay/Ballistics.js';

const CONTROLLER_COUNT = 2;
const SLINGSHOT_HAND = 'left';
const PROJECTILE_HAND = 'right';
const WORLD_UP = new Vector3(0, 1, 0);
const LOCAL_Z = new Vector3(0, 0, 1);

function validateConfig(config, projectileConfig) {
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

  for (const [name, value] of [
    ['visual.handleLength', config?.visual?.handleLength],
    ['visual.handleRadius', config?.visual?.handleRadius],
    ['visual.forkTipX', config?.visual?.forkTipX],
    ['visual.forkTipY', config?.visual?.forkTipY],
    ['visual.forkRadius', config?.visual?.forkRadius],
    ['visual.projectileRadius', config?.visual?.projectileRadius],
    ['aim.markerDistance', config?.aim?.markerDistance],
    ['aim.markerInnerRadius', config?.aim?.markerInnerRadius],
    ['aim.markerOuterRadius', config?.aim?.markerOuterRadius],
    ['aim.trajectoryStepSeconds', config?.aim?.trajectoryStepSeconds],
    ['aim.trajectoryPointSize', config?.aim?.trajectoryPointSize],
    ['projectile.minSpeed', projectileConfig?.minSpeed],
    ['projectile.maxSpeed', projectileConfig?.maxSpeed],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`xr.${name} deve ser maior que zero.`);
    }
  }

  if (
    config.aim.markerOuterRadius <= config.aim.markerInnerRadius ||
    !Number.isInteger(config.aim.trajectoryPointCount) ||
    config.aim.trajectoryPointCount < 2
  ) {
    throw new RangeError('A configuração da mira XR é inválida.');
  }

  if (!Number.isFinite(projectileConfig.gravity)) {
    throw new TypeError('A gravidade dos projéteis deve ser finita.');
  }
}

function createCylinderBetween({ geometry, material, start, end, name }) {
  const direction = new Vector3().subVectors(end, start);
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = direction.length();
  mesh.quaternion.setFromUnitVectors(WORLD_UP, direction.normalize());
  return mesh;
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
    projectileConfig = GAMEPLAY_CONFIG.projectile,
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

    validateConfig(config, projectileConfig);
    this.renderer = renderer;
    this.scene = scene;
    this.config = config;
    this.projectileConfig = projectileConfig;
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
    this.poseValid = false;
    this.ammoType = 'normal';
    this.controllerPosition = new Vector3();
    this.slingPosition = new Vector3();
    this.projectilePosition = new Vector3();
    this.shotDirection = new Vector3();
    this.trajectoryVelocity = new Vector3();
    this.trajectoryPoint = new Vector3();
    this.aimPosition = new Vector3();
    this.localLeftTip = new Vector3(
      -config.visual.forkTipX,
      config.visual.forkTipY,
      0,
    );
    this.localRightTip = new Vector3(
      config.visual.forkTipX,
      config.visual.forkTipY,
      0,
    );
    this.worldLeftTip = new Vector3();
    this.worldRightTip = new Vector3();
    this.visualXAxis = new Vector3();
    this.visualYAxis = new Vector3();
    this.visualMatrix = new Matrix4();
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
    const { aim, visual } = this.config;
    const colors = GAMEPLAY_CONFIG.slingshotVisual.colors;
    const woodMaterial = new MeshStandardMaterial({
      color: colors.wood,
      roughness: 0.72,
    });
    const ballMaterial = new MeshStandardMaterial({
      color: colors.snowball,
      emissive: colors.snowballEmissive,
      emissiveIntensity: 0.2,
      roughness: 0.9,
    });
    const specialBallMaterial = new MeshStandardMaterial({
      color: colors.specialBall,
      emissive: colors.specialBallEmissive,
      emissiveIntensity: 0.85,
      roughness: 0.72,
    });
    const handleGeometry = new CylinderGeometry(
      visual.handleRadius * 0.82,
      visual.handleRadius,
      visual.handleLength,
      8,
    );
    const forkGeometry = new CylinderGeometry(
      visual.forkRadius,
      visual.forkRadius * 1.08,
      1,
      8,
    );
    const ballGeometry = new SphereGeometry(visual.projectileRadius, 12, 9);
    const bandGeometry = new BufferGeometry();
    bandGeometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(12), 3),
    );
    const bandMaterial = new LineBasicMaterial({ color: colors.band });
    const trajectoryGeometry = new BufferGeometry();
    trajectoryGeometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        new Float32Array(aim.trajectoryPointCount * 3),
        3,
      ),
    );
    trajectoryGeometry.setDrawRange(0, 0);
    const trajectoryMaterial = new PointsMaterial({
      color: colors.trajectory,
      size: aim.trajectoryPointSize,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const specialTrajectoryMaterial = new PointsMaterial({
      color: colors.specialTrajectory,
      size: aim.trajectoryPointSize * 1.18,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const aimGeometry = new RingGeometry(
      aim.markerInnerRadius,
      aim.markerOuterRadius,
      24,
    );
    const aimMaterial = new MeshBasicMaterial({
      color: colors.trajectory,
      transparent: true,
      opacity: 0.86,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });

    for (const resource of [
      woodMaterial,
      ballMaterial,
      specialBallMaterial,
      handleGeometry,
      forkGeometry,
      ballGeometry,
      bandGeometry,
      bandMaterial,
      trajectoryGeometry,
      trajectoryMaterial,
      specialTrajectoryMaterial,
      aimGeometry,
      aimMaterial,
    ]) {
      this.resources.add(resource);
    }

    this.slingshotVisual = new Group();
    this.slingshotVisual.name = 'xr-slingshot-complete';
    this.handleVisual = new Mesh(handleGeometry, woodMaterial);
    this.handleVisual.name = 'xr-slingshot-handle';
    this.handleVisual.position.y = -visual.handleLength / 2;
    const forkBase = new Vector3();
    const leftArm = createCylinderBetween({
      geometry: forkGeometry,
      material: woodMaterial,
      start: forkBase,
      end: this.localLeftTip,
      name: 'xr-slingshot-left-arm',
    });
    const rightArm = createCylinderBetween({
      geometry: forkGeometry,
      material: woodMaterial,
      start: forkBase,
      end: this.localRightTip,
      name: 'xr-slingshot-right-arm',
    });
    this.slingshotVisual.add(this.handleVisual, leftArm, rightArm);
    this.projectileVisual = new Mesh(ballGeometry, ballMaterial);
    this.projectileVisual.name = 'xr-slingshot-projectile';
    this.projectileMaterials = {
      normal: ballMaterial,
      special: specialBallMaterial,
    };
    this.bandVisual = new LineSegments(bandGeometry, bandMaterial);
    this.bandVisual.name = 'xr-slingshot-bands';
    this.bandVisual.frustumCulled = false;
    this.trajectoryVisual = new Points(
      trajectoryGeometry,
      trajectoryMaterial,
    );
    this.trajectoryVisual.name = 'xr-slingshot-trajectory';
    this.trajectoryVisual.frustumCulled = false;
    this.trajectoryMaterials = {
      normal: trajectoryMaterial,
      special: specialTrajectoryMaterial,
    };
    this.aimMarker = new Mesh(aimGeometry, aimMaterial);
    this.aimMarker.name = 'xr-slingshot-aim-marker';
    this.aimMarker.frustumCulled = false;
    this.aimMarker.renderOrder = 900;
    root.add(
      this.slingshotVisual,
      this.projectileVisual,
      this.bandVisual,
      this.trajectoryVisual,
      this.aimMarker,
    );
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
      this.poseValid = false;
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
    this.poseValid = false;
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
    slingshot.object.getWorldPosition(this.controllerPosition);
    projectile.object.getWorldPosition(this.projectilePosition);
    this.shotDirection
      .subVectors(this.controllerPosition, this.projectilePosition);

    if (this.shotDirection.lengthSq() <= Number.EPSILON) {
      this.poseValid = false;
      return false;
    }

    this.shotDirection.normalize();
    this.orientSlingshot();
    this.updateForkWorldPositions();
    this.slingPosition
      .copy(this.worldLeftTip)
      .add(this.worldRightTip)
      .multiplyScalar(0.5);
    this.shotDirection
      .subVectors(this.slingPosition, this.projectilePosition);
    const distance = this.shotDirection.length();

    if (distance <= Number.EPSILON) {
      this.poseValid = false;
      return false;
    }

    this.shotDirection.normalize();
    this.orientSlingshot();
    this.updateForkWorldPositions();
    this.slingPosition
      .copy(this.worldLeftTip)
      .add(this.worldRightTip)
      .multiplyScalar(0.5);
    this.lastRatio = calculateXRChargeRatio(distance, this.config.pullDistance);
    this.poseValid = true;
    return true;
  }

  orientSlingshot() {
    this.visualXAxis.crossVectors(WORLD_UP, this.shotDirection);

    if (this.visualXAxis.lengthSq() <= Number.EPSILON) {
      this.visualXAxis.set(1, 0, 0);
    } else {
      this.visualXAxis.normalize();
    }

    this.visualYAxis
      .crossVectors(this.shotDirection, this.visualXAxis)
      .normalize();
    this.visualMatrix.makeBasis(
      this.visualXAxis,
      this.visualYAxis,
      this.shotDirection,
    );
    this.slingshotVisual.position.copy(this.controllerPosition);
    this.slingshotVisual.quaternion.setFromRotationMatrix(this.visualMatrix);
  }

  updateForkWorldPositions() {
    this.worldLeftTip
      .copy(this.localLeftTip)
      .applyQuaternion(this.slingshotVisual.quaternion)
      .add(this.controllerPosition);
    this.worldRightTip
      .copy(this.localRightTip)
      .applyQuaternion(this.slingshotVisual.quaternion)
      .add(this.controllerPosition);
  }

  update() {
    if (this.disposed || !this.active || !this.connected) {
      return false;
    }

    const poseValid = this.updatePose();

    if (poseValid) {
      this.updateVisuals();
    }
    this.syncVisibility();

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
    this.projectileVisual.position.copy(this.projectilePosition);
    this.projectileVisual.material = this.projectileMaterials[this.ammoType];
    const positions = this.bandVisual.geometry.getAttribute('position');
    positions.setXYZ(
      0,
      this.worldLeftTip.x,
      this.worldLeftTip.y,
      this.worldLeftTip.z,
    );
    positions.setXYZ(
      1,
      this.projectilePosition.x,
      this.projectilePosition.y,
      this.projectilePosition.z,
    );
    positions.setXYZ(
      2,
      this.worldRightTip.x,
      this.worldRightTip.y,
      this.worldRightTip.z,
    );
    positions.setXYZ(
      3,
      this.projectilePosition.x,
      this.projectilePosition.y,
      this.projectilePosition.z,
    );
    positions.needsUpdate = true;
    this.updateAimMarker();
    this.updateTrajectory();
  }

  updateAimMarker() {
    this.aimPosition
      .copy(this.shotDirection)
      .multiplyScalar(this.config.aim.markerDistance)
      .add(this.slingPosition);
    this.aimMarker.position.copy(this.aimPosition);
    this.aimMarker.quaternion.setFromUnitVectors(LOCAL_Z, this.shotDirection);
  }

  calculateSpeed() {
    return (
      this.projectileConfig.minSpeed +
      (this.projectileConfig.maxSpeed - this.projectileConfig.minSpeed) *
        this.lastRatio
    );
  }

  updateTrajectory() {
    const geometry = this.trajectoryVisual.geometry;

    if (!this.charging) {
      geometry.setDrawRange(0, 0);
      return false;
    }

    const positions = geometry.getAttribute('position');
    const { trajectoryPointCount, trajectoryStepSeconds } = this.config.aim;
    this.trajectoryVelocity
      .copy(this.shotDirection)
      .multiplyScalar(this.calculateSpeed());
    this.trajectoryVisual.material = this.trajectoryMaterials[this.ammoType];
    let visiblePoints = 0;

    for (let index = 0; index < trajectoryPointCount; index += 1) {
      calculateBallisticPoint({
        origin: this.slingPosition,
        velocity: this.trajectoryVelocity,
        gravity: this.projectileConfig.gravity,
        timeSeconds: (index + 1) * trajectoryStepSeconds,
        target: this.trajectoryPoint,
      });

      if (
        this.trajectoryPoint.y - this.projectileConfig.radius <=
        this.projectileConfig.groundY
      ) {
        break;
      }

      positions.setXYZ(
        index,
        this.trajectoryPoint.x,
        this.trajectoryPoint.y,
        this.trajectoryPoint.z,
      );
      visiblePoints += 1;
    }

    positions.needsUpdate = true;
    geometry.setDrawRange(0, visiblePoints);
    return visiblePoints > 0;
  }

  setChargeState({ ammoType = 'normal' } = {}) {
    if (this.disposed) {
      return false;
    }

    this.ammoType = ammoType === 'special' ? 'special' : 'normal';
    return true;
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
      this.active && this.poseValid && this.charging;
    this.bandVisual.visible =
      this.active && this.poseValid && this.charging;
    this.trajectoryVisual.visible =
      this.active && this.poseValid && this.charging;
    this.aimMarker.visible = this.active && this.poseValid;
    this.slingshotVisual.visible =
      this.active && Boolean(this.slingshotController);

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
