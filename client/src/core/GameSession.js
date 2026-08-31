import { Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { intersectSegmentSphere } from '../gameplay/CollisionSystem.js';
import { ProjectileSystem } from '../gameplay/ProjectileSystem.js';
import { SlingshotSystem } from '../gameplay/SlingshotSystem.js';
import { TargetSystem } from '../gameplay/TargetSystem.js';

export class GameSession {
  constructor({
    camera,
    scene,
    onChargeChange = () => {},
    onShot = () => {},
    onTargetDestroy = () => {},
    onTargetHealthChange = () => {},
    onTargetHit = () => {},
    config = GAMEPLAY_CONFIG,
    projectileSystem = null,
    slingshotSystem = null,
    targetSystem = null,
  } = {}) {
    if (typeof onTargetHit !== 'function') {
      throw new TypeError('GameSession requer onTargetHit como função.');
    }

    const ownsProjectileSystem = !projectileSystem;
    const ownsSlingshotSystem = !slingshotSystem;
    const ownsTargetSystem = !targetSystem;

    this.config = config;
    this.onTargetHit = onTargetHit;
    this.targetCenter = new Vector3();
    this.disposed = false;

    try {
      this.projectileSystem =
        projectileSystem ??
        new ProjectileSystem({ scene, config: config.projectile });
      this.slingshotSystem =
        slingshotSystem ??
        new SlingshotSystem({
          camera,
          projectileSystem: this.projectileSystem,
          config,
          onChargeChange,
          onShot,
        });
      this.targetSystem =
        targetSystem ??
        new TargetSystem({
          scene,
          config: config.target,
          onDestroy: onTargetDestroy,
          onHealthChange: onTargetHealthChange,
        });
    } catch (error) {
      if (ownsTargetSystem) {
        try {
          this.targetSystem?.dispose?.();
        } catch {
          // Preserva o erro original de construção.
        }
      }

      if (ownsSlingshotSystem) {
        try {
          this.slingshotSystem?.dispose?.();
        } catch {
          // Preserva o erro original de construção.
        }
      }

      if (ownsProjectileSystem) {
        try {
          this.projectileSystem?.dispose?.();
        } catch {
          // Preserva o erro original de construção.
        }
      }

      throw error;
    }

    this.handleProjectileStep = this.handleProjectileStep.bind(this);
  }

  get activeProjectileCount() {
    return this.projectileSystem.activeProjectileCount;
  }

  get isCharging() {
    return this.slingshotSystem.isCharging;
  }

  get targetState() {
    return this.targetSystem.state;
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
    this.projectileSystem.update(delta, this.handleProjectileStep);
    return true;
  }

  handleProjectileStep({
    currentPosition,
    mesh,
    previousPosition,
    radius,
  }) {
    if (!this.targetSystem.alive) {
      return false;
    }

    const collision = intersectSegmentSphere(
      previousPosition,
      currentPosition,
      this.targetSystem.getCenter(this.targetCenter),
      this.targetSystem.radius + radius,
    );

    if (!collision.hit || !this.targetSystem.applyDamage()) {
      return false;
    }

    this.onTargetHit({
      ...this.targetSystem.state,
      damage: this.config.target.damagePerHit,
      impactPoint: collision.point.clone(),
      impactRatio: collision.t,
      projectile: mesh,
    });
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

    try {
      this.targetSystem.dispose();
    } catch (error) {
      disposalError ??= error;
    }

    this.onTargetHit = () => {};
    this.disposed = true;

    if (disposalError) {
      throw disposalError;
    }

    return true;
  }
}
