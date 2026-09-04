import { Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';

export class SlingshotSystem {
  constructor({
    camera,
    projectileSystem,
    config = GAMEPLAY_CONFIG,
    onChargeChange = () => {},
    onShot = () => {},
  }) {
    if (!camera?.getWorldDirection || !camera?.getWorldPosition) {
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

    this.camera = camera;
    this.projectileSystem = projectileSystem;
    this.config = config;
    this.onChargeChange = onChargeChange;
    this.onShot = onShot;
    this.chargeElapsedSeconds = 0;
    this.charge = 0;
    this.charging = false;
    this.disposed = false;
    this.spawnOrigin = new Vector3();
    this.shotDirection = new Vector3();
  }

  get isCharging() {
    return this.charging;
  }

  beginCharge() {
    this.assertNotDisposed();

    if (this.charging) {
      return false;
    }

    this.charging = true;
    this.chargeElapsedSeconds = 0;
    this.charge = 0;
    this.emitChargeChange();

    return true;
  }

  releaseShot({
    hitStrength = this.config.projectile.hitStrength,
    ammoType = 'normal',
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

    const ratio = this.charge;
    const projectileConfig = this.config.projectile;
    const speed =
      projectileConfig.minSpeed +
      (projectileConfig.maxSpeed - projectileConfig.minSpeed) * ratio;

    this.camera.updateWorldMatrix?.(true, false);
    this.camera.getWorldDirection(this.shotDirection).normalize();
    this.camera.getWorldPosition(this.spawnOrigin);
    this.spawnOrigin.addScaledVector(
      this.shotDirection,
      projectileConfig.spawnDistance,
    );

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
    if (this.disposed || !this.charging) {
      return false;
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
    }

    return true;
  }

  resetCharge() {
    this.charging = false;
    this.chargeElapsedSeconds = 0;
    this.charge = 0;
    this.emitChargeChange();
  }

  emitChargeChange() {
    this.onChargeChange({
      charging: this.charging,
      ratio: this.charge,
    });
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

    try {
      this.cancelCharge();
    } finally {
      this.disposed = true;
    }

    return true;
  }
}
