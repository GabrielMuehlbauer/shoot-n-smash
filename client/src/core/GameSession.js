import { Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { intersectMovingSpheres } from '../gameplay/CollisionSystem.js';
import { ImpactFeedbackSystem } from '../gameplay/ImpactFeedbackSystem.js';
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
    impactFeedbackSystem = null,
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
    const ownsImpactFeedbackSystem = !impactFeedbackSystem;

    this.config = config;
    this.onTargetHit = onTargetHit;
    this.targetPreviousCenter = new Vector3();
    this.targetCenter = new Vector3();
    this.pendingObserverError = null;
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
      this.impactFeedbackSystem =
        impactFeedbackSystem ??
        new ImpactFeedbackSystem({
          scene,
          config: config.impactFeedback,
        });
    } catch (error) {
      if (ownsImpactFeedbackSystem) {
        try {
          this.impactFeedbackSystem?.dispose?.();
        } catch {
          // Preserva o erro original de construção.
        }
      }

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

  get activeImpactFeedbackCount() {
    return this.impactFeedbackSystem.activeCount;
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

    const numericDelta = Number(deltaSeconds);
    const delta = Number.isFinite(numericDelta)
      ? Math.max(0, numericDelta)
      : 0;
    this.pendingObserverError = null;
    let updateError = null;

    try {
      this.slingshotSystem.update(delta);
      this.targetSystem.update(delta);
      this.impactFeedbackSystem.update(delta);
      this.projectileSystem.update(delta, this.handleProjectileStep);
    } catch (error) {
      updateError = error;
    }

    const observerError = this.pendingObserverError;
    this.pendingObserverError = null;

    if (updateError) {
      throw updateError;
    }

    if (observerError) {
      throw observerError;
    }

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

    this.targetSystem.getPreviousCenter(this.targetPreviousCenter);
    this.targetSystem.getCenter(this.targetCenter);
    const collision = intersectMovingSpheres(
      previousPosition,
      currentPosition,
      radius,
      this.targetPreviousCenter,
      this.targetCenter,
      this.targetSystem.radius,
    );

    if (!collision.hit) {
      return false;
    }

    const healthBeforeImpact = this.targetSystem.state.health;
    let damageApplied = false;

    try {
      damageApplied = this.targetSystem.applyDamage();
    } catch (error) {
      this.queueObserverError(error);
      damageApplied = this.targetSystem.state.health < healthBeforeImpact;
    }

    if (!damageApplied) {
      return false;
    }

    if (!this.targetSystem.alive) {
      this.targetSystem.pauseAtFrameRatio(collision.t);
    }

    this.impactFeedbackSystem.spawn(collision.projectileCenter);

    try {
      this.onTargetHit({
        ...this.targetSystem.state,
        damage: this.config.target.damagePerHit,
        impactPoint: collision.projectileCenter.clone(),
        impactRatio: collision.t,
        projectile: mesh,
      });
    } catch (error) {
      this.queueObserverError(error);
    }

    return true;
  }

  queueObserverError(error) {
    this.pendingObserverError ??=
      error ?? new Error('Um observador da partida falhou.');
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

    try {
      this.impactFeedbackSystem.dispose();
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
