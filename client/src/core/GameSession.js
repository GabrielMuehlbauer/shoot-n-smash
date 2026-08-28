import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { ProjectileSystem } from '../gameplay/ProjectileSystem.js';
import { SlingshotSystem } from '../gameplay/SlingshotSystem.js';

export class GameSession {
  constructor({
    camera,
    scene,
    onChargeChange = () => {},
    onShot = () => {},
    config = GAMEPLAY_CONFIG,
    projectileSystem = null,
    slingshotSystem = null,
  } = {}) {
    const ownsProjectileSystem = !projectileSystem;

    this.projectileSystem =
      projectileSystem ??
      new ProjectileSystem({ scene, config: config.projectile });

    try {
      this.slingshotSystem =
        slingshotSystem ??
        new SlingshotSystem({
          camera,
          projectileSystem: this.projectileSystem,
          config,
          onChargeChange,
          onShot,
        });
    } catch (error) {
      if (ownsProjectileSystem) {
        try {
          this.projectileSystem.dispose();
        } catch {
          // Preserva o erro original de construção.
        }
      }

      throw error;
    }

    this.disposed = false;
  }

  get activeProjectileCount() {
    return this.projectileSystem.activeProjectileCount;
  }

  get isCharging() {
    return this.slingshotSystem.isCharging;
  }

  beginCharge() {
    this.assertNotDisposed();
    return this.slingshotSystem.beginCharge();
  }

  releaseShot() {
    this.assertNotDisposed();
    return this.slingshotSystem.releaseShot();
  }

  cancelCharge() {
    if (this.disposed) {
      return false;
    }

    return this.slingshotSystem.cancelCharge();
  }

  update(deltaSeconds) {
    if (this.disposed) {
      return false;
    }

    const delta = Math.max(0, Number(deltaSeconds) || 0);
    this.slingshotSystem.update(delta);
    this.projectileSystem.update(delta);
    return true;
  }

  assertNotDisposed() {
    if (this.disposed) {
      throw new Error('Não é possível usar uma GameSession descartada.');
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    let disposalError = null;

    try {
      this.slingshotSystem.dispose();
    } catch (error) {
      disposalError = error;
    }

    try {
      this.projectileSystem.dispose();
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
