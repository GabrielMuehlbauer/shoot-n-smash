import { Quaternion, Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { SlingshotVisualSystem } from './SlingshotVisualSystem.js';

export class SlingshotSystem {
  constructor({
    camera,
    scene = null,
    projectileSystem,
    config = GAMEPLAY_CONFIG,
    onChargeChange = () => {},
    onShot = () => {},
    visualSystem = null,
  }) {
    if (
      !camera?.getWorldDirection ||
      !camera?.getWorldPosition ||
      !camera?.getWorldQuaternion
    ) {
      throw new Error('SlingshotSystem requer uma câmera Three.js válida.');
    }

    if (!projectileSystem?.spawn) {
      throw new Error('SlingshotSystem requer um ProjectileSystem.');
    }

    if (!Number.isFinite(config?.charge?.durationSeconds)) {
      throw new TypeError('A duração da carga deve ser finita.');
    }

    if (config.charge.durationSeconds <= 0) {
      throw new RangeError('A duração da carga deve ser maior que zero.');
    }

    if (
      !Number.isFinite(config?.projectile?.minSpeed) ||
      !Number.isFinite(config?.projectile?.maxSpeed) ||
      config.projectile.minSpeed <= 0 ||
      config.projectile.maxSpeed < config.projectile.minSpeed
    ) {
      throw new RangeError(
        'As velocidades do estilingue devem ser positivas e crescentes.',
      );
    }

    const spawnOffset = config?.projectile?.spawnOffset;
    if (
      !spawnOffset ||
      !Number.isFinite(spawnOffset.x) ||
      !Number.isFinite(spawnOffset.y) ||
      !Number.isFinite(spawnOffset.z)
    ) {
      throw new TypeError('A origem local do projétil deve ser finita.');
    }

    if (visualSystem !== null && typeof visualSystem?.update !== 'function') {
      throw new TypeError('O visual do estilingue requer update().');
    }

    this.camera = camera;
    this.projectileSystem = projectileSystem;
    this.config = config;
    this.onChargeChange = onChargeChange;
    this.onShot = onShot;
    this.chargeElapsedSeconds = 0;
    this.charge = 0;
    this.chargeMode = 'time';
    this.charging = false;
    this.preparedAmmoType = 'normal';
    this.disposed = false;
    this.spawnOrigin = new Vector3();
    this.shotDirection = new Vector3();
    this.cameraQuaternion = new Quaternion();
    this.localSpawnOffset = new Vector3(
      spawnOffset.x,
      spawnOffset.y,
      spawnOffset.z,
    );
    this.worldSpawnOffset = new Vector3();
    this.visualSystem =
      visualSystem ??
      (scene
        ? new SlingshotVisualSystem({
            scene,
            camera,
            config: config.slingshotVisual,
            projectileConfig: config.projectile,
          })
        : null);
  }

  get isCharging() {
    return this.charging;
  }

  beginCharge({ ammoType = 'normal', mode = 'time' } = {}) {
    this.assertNotDisposed();

    if (this.charging) {
      return false;
    }

    if (!['normal', 'special'].includes(ammoType)) {
      throw new TypeError('O tipo de munição preparado deve ser normal ou special.');
    }

    if (!['time', 'manual'].includes(mode)) {
      throw new TypeError('O modo de carga deve ser time ou manual.');
    }

    this.charging = true;
    this.chargeMode = mode;
    this.preparedAmmoType = ammoType;
    this.chargeElapsedSeconds = 0;
    this.charge = 0;
    this.emitChargeChange();

    return true;
  }

  releaseShot({
    hitStrength = this.config.projectile.hitStrength,
    ammoType = this.preparedAmmoType,
    origin = null,
    direction = null,
  } = {}) {
    this.assertNotDisposed();

    if (!this.charging) {
      return false;
    }

    if (!Number.isInteger(hitStrength) || hitStrength <= 0) {
      throw new RangeError('A força do disparo deve ser um inteiro positivo.');
    }

    if (!['normal', 'special'].includes(ammoType)) {
      throw new TypeError('O tipo de munição do disparo deve ser normal ou special.');
    }

    const usesExternalPose = origin !== null || direction !== null;

    if (
      usesExternalPose &&
      (!origin?.isVector3 ||
        !direction?.isVector3 ||
        !Number.isFinite(origin.x) ||
        !Number.isFinite(origin.y) ||
        !Number.isFinite(origin.z) ||
        !Number.isFinite(direction.x) ||
        !Number.isFinite(direction.y) ||
        !Number.isFinite(direction.z) ||
        direction.lengthSq() <= Number.EPSILON)
    ) {
      throw new TypeError('A pose externa do disparo requer origem e direção válidas.');
    }

    const ratio = this.charge;
    const projectileConfig = this.config.projectile;
    const speed = this.calculateSpeed(ratio);

    if (usesExternalPose) {
      this.spawnOrigin.copy(origin);
      this.shotDirection.copy(direction).normalize();
    } else {
      this.camera.updateWorldMatrix?.(true, false);
      this.camera.getWorldDirection(this.shotDirection).normalize();
      this.camera.getWorldPosition(this.spawnOrigin);
      this.camera.getWorldQuaternion(this.cameraQuaternion);
      this.worldSpawnOffset
        .copy(this.localSpawnOffset)
        .applyQuaternion(this.cameraQuaternion);
      this.spawnOrigin.add(this.worldSpawnOffset);
    }

    this.projectileSystem.spawn({
      origin: this.spawnOrigin,
      direction: this.shotDirection,
      speed,
      charge: ratio,
      hitStrength,
      ammoType,
    });

    this.resetCharge();

    const shot = {
      charge: ratio,
      ratio,
      speed,
      hitStrength,
      ammoType,
      activeProjectileCount: this.projectileSystem.activeProjectileCount,
    };

    this.onShot(shot);
    return shot;
  }

  cancelCharge() {
    if (this.disposed || !this.charging) {
      return false;
    }

    this.resetCharge();
    return true;
  }

  update(deltaSeconds) {
    if (this.disposed) {
      return false;
    }

    if (!this.charging) {
      this.syncVisual();
      return false;
    }

    if (this.chargeMode === 'manual') {
      this.syncVisual();
      return true;
    }

    const delta = Math.max(0, Number(deltaSeconds) || 0);
    this.chargeElapsedSeconds += delta;
    const nextCharge = Math.min(
      this.chargeElapsedSeconds / this.config.charge.durationSeconds,
      1,
    );

    if (nextCharge !== this.charge) {
      this.charge = nextCharge;
      this.emitChargeChange();
    } else {
      this.syncVisual();
    }

    return true;
  }

  resetCharge() {
    this.charging = false;
    this.chargeElapsedSeconds = 0;
    this.charge = 0;
    this.chargeMode = 'time';
    this.preparedAmmoType = 'normal';
    this.emitChargeChange();
  }

  calculateSpeed(ratio = this.charge) {
    const projectileConfig = this.config.projectile;
    return (
      projectileConfig.minSpeed +
      (projectileConfig.maxSpeed - projectileConfig.minSpeed) * ratio
    );
  }

  setChargeRatio(ratio) {
    this.assertNotDisposed();

    if (!this.charging || this.chargeMode !== 'manual') {
      return false;
    }

    const numericRatio = Number(ratio);

    if (!Number.isFinite(numericRatio)) {
      throw new TypeError('A tensão manual deve ser finita.');
    }

    const nextCharge = Math.min(Math.max(numericRatio, 0), 1);

    if (nextCharge === this.charge) {
      this.syncVisual();
      return false;
    }

    this.charge = nextCharge;
    this.emitChargeChange();
    return true;
  }

  setVisualVisible(visible) {
    if (this.disposed) {
      return false;
    }

    return this.visualSystem?.setVisible?.(Boolean(visible)) ?? false;
  }

  syncVisual() {
    this.visualSystem?.update({
      charging: this.charging,
      ratio: this.charge,
      speed: this.calculateSpeed(),
      ammoType: this.preparedAmmoType,
    });
  }

  emitChargeChange() {
    const state = Object.freeze({
      charging: this.charging,
      ratio: this.charge,
      speed: this.calculateSpeed(),
      maxSpeed: this.config.projectile.maxSpeed,
      ammoType: this.preparedAmmoType,
    });
    this.syncVisual();
    this.onChargeChange(state);
  }

  assertNotDisposed() {
    if (this.disposed) {
      throw new Error('Não é possível usar um SlingshotSystem descartado.');
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    let disposalError = null;

    try {
      this.cancelCharge();
    } catch (error) {
      disposalError = error;
    }

    try {
      this.visualSystem?.dispose?.();
    } catch (error) {
      disposalError ??= error;
    }

    this.disposed = true;

    if (disposalError) {
      throw disposalError;
    }

    return true;
  }
}
