import { Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { intersectMovingSpheres } from '../gameplay/CollisionSystem.js';
import { EnemySystem } from '../gameplay/EnemySystem.js';
import { validateEnemyTypes } from '../gameplay/EnemyTypes.js';
import { ImpactFeedbackSystem } from '../gameplay/ImpactFeedbackSystem.js';
import { PlayerHealthSystem } from '../gameplay/PlayerHealthSystem.js';
import { ProjectileSystem } from '../gameplay/ProjectileSystem.js';
import { SlingshotSystem } from '../gameplay/SlingshotSystem.js';
import { WaveManager } from '../gameplay/WaveManager.js';

function validateBossConfig(config) {
  validateEnemyTypes([config?.type]);

  for (const [name, value] of [
    ['moveSpeed', config.moveSpeed],
    ['radius', config.radius],
    ['visualScale', config.visualScale],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`boss.${name} deve ser maior que zero.`);
    }
  }

  if (!Number.isFinite(config.spawnHeight) || config.spawnHeight < 0) {
    throw new RangeError('boss.spawnHeight não pode ser negativo.');
  }
}

export class GameSession {
  constructor({
    camera,
    scene,
    onChargeChange = () => {},
    onEnemyEliminate = () => {},
    onEnemyHit = () => {},
    onEnemyPlayerContact = () => {},
    onEnemyResistanceChange = () => {},
    onWaveChange = () => {},
    onPlayerHealthChange = () => {},
    onShot = () => {},
    config = GAMEPLAY_CONFIG,
    encounterActive = true,
    enemyRandom = Math.random,
    enemyTypeRandom = Math.random,
    enemySystem = null,
    impactFeedbackSystem = null,
    playerHealthSystem = null,
    projectileSystem = null,
    slingshotSystem = null,
    waveManager = null,
  } = {}) {
    for (const [name, callback] of [
      ['onEnemyHit', onEnemyHit],
      ['onEnemyPlayerContact', onEnemyPlayerContact],
      ['onEnemyEliminate', onEnemyEliminate],
      ['onWaveChange', onWaveChange],
      ['onPlayerHealthChange', onPlayerHealthChange],
    ]) {
      if (typeof callback !== 'function') {
        throw new TypeError(`GameSession requer ${name} como função.`);
      }
    }

    if (typeof encounterActive !== 'boolean') {
      throw new TypeError('GameSession requer encounterActive booleano.');
    }

    const ownsProjectileSystem = !projectileSystem;
    const ownsSlingshotSystem = !slingshotSystem;
    const ownsEnemySystem = !enemySystem;
    const ownsImpactFeedbackSystem = !impactFeedbackSystem;
    const ownsPlayerHealthSystem = !playerHealthSystem;

    validateBossConfig(config?.boss);
    this.config = config;
    this.encounterActive = encounterActive;
    this.onEnemyHit = onEnemyHit;
    this.onEnemyEliminate = onEnemyEliminate;
    this.onEnemyPlayerContact = onEnemyPlayerContact;
    this.onWaveChange = onWaveChange;
    this.waveManager =
      waveManager ??
      new WaveManager({
        config: config.waves,
        bossDelaySeconds: config.boss.spawnDelaySeconds,
      });
    this.enemyPreviousCenter = new Vector3();
    this.enemyCenter = new Vector3();
    this.projectileContactCenter = new Vector3();
    this.pendingEnemyImpacts = [];
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
      this.playerHealthSystem =
        playerHealthSystem ??
        new PlayerHealthSystem({
          config: config.player,
          onHealthChange: onPlayerHealthChange,
        });
      this.enemySystem =
        enemySystem ??
        new EnemySystem({
          scene,
          config: config.enemy,
          random: enemyRandom,
          typeRandom: enemyTypeRandom,
          typeIds: this.waveManager.spawnSettings.typeIds,
          moveSpeed: this.waveManager.spawnSettings.moveSpeed,
          onEliminate: (state) => this.handleEnemyEliminate(state),
          onPlayerContact: (state) => this.handleEnemyPlayerContact(state),
          onResistanceChange: onEnemyResistanceChange,
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

      if (ownsEnemySystem) {
        try {
          this.enemySystem?.dispose?.();
        } catch {
          // Preserva o erro original de construção.
        }
      }

      if (ownsPlayerHealthSystem) {
        try {
          this.playerHealthSystem?.dispose?.();
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

  get isEncounterActive() {
    return this.encounterActive;
  }

  get enemyState() {
    return this.enemySystem.state;
  }

  get playerState() {
    return this.playerHealthSystem.state;
  }

  get activeImpactFeedbackCount() {
    return this.impactFeedbackSystem.activeCount;
  }

  get waveState() {
    return this.waveManager.state;
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

  setEncounterActive(active) {
    this.assertNotDisposed();

    if (typeof active !== 'boolean') {
      throw new TypeError('O estado do encontro deve ser booleano.');
    }

    if (this.encounterActive === active) {
      return false;
    }

    this.encounterActive = active;
    return true;
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
      const waveUpdate = this.waveManager.update(delta, {
        active: this.encounterActive,
      });

      if (waveUpdate.spawnKind) {
        if (waveUpdate.spawnKind === 'boss') {
          const boss = this.config.boss;
          this.enemySystem.reset({
            enemyType: boss.type,
            moveSpeed: boss.moveSpeed,
            radius: boss.radius,
            visualScale: boss.visualScale,
            spawnHeight: boss.spawnHeight,
          });
        } else {
          const { moveSpeed, typeIds } = this.waveManager.spawnSettings;
          this.enemySystem.reset({
            rerollType: true,
            moveSpeed,
            typeIds,
          });
        }

        this.publishWaveChange();
      }

      this.enemySystem.update(waveUpdate.enemyDelta);
      this.impactFeedbackSystem.update(delta);
      this.pendingEnemyImpacts.length = 0;
      this.projectileSystem.update(delta, this.handleProjectileStep);
      this.resolveEnemyImpacts();

      try {
        this.enemySystem.resolvePlayerContact();
      } catch (error) {
        this.queueObserverError(error);
      }
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

  finishCurrentEncounter() {
    return this.waveManager.completeEnemy();
  }

  publishWaveChange() {
    try {
      this.onWaveChange(this.waveState);
    } catch (error) {
      this.queueObserverError(error);
    }
  }

  handleEnemyEliminate(enemyState) {
    this.finishCurrentEncounter();
    let observerError = null;

    try {
      this.onEnemyEliminate(enemyState);
    } catch (error) {
      observerError = error;
    }

    this.publishWaveChange();

    if (observerError) {
      throw observerError;
    }
  }

  handleProjectileStep({
    currentPosition,
    mesh,
    previousPosition,
    projectile,
    radius,
  }) {
    if (!this.enemySystem.active) {
      return false;
    }

    this.enemySystem.getPreviousCenter(this.enemyPreviousCenter);
    this.enemySystem.getCenter(this.enemyCenter);
    const contactRatio = this.enemySystem.playerContactFrameRatio;
    const projectileEnd =
      contactRatio === null
        ? currentPosition
        : this.projectileContactCenter
            .copy(previousPosition)
            .lerp(currentPosition, contactRatio);
    const collision = intersectMovingSpheres(
      previousPosition,
      projectileEnd,
      radius,
      this.enemyPreviousCenter,
      this.enemyCenter,
      this.enemySystem.radius,
    );

    if (!collision.hit) {
      return false;
    }

    this.pendingEnemyImpacts.push({
      collision,
      impactRatio:
        contactRatio === null ? collision.t : collision.t * contactRatio,
      mesh,
      projectile,
    });

    return false;
  }

  resolveEnemyImpacts() {
    this.pendingEnemyImpacts.sort(
      (left, right) => left.impactRatio - right.impactRatio,
    );

    for (const {
      collision,
      impactRatio,
      mesh,
      projectile,
    } of this.pendingEnemyImpacts) {
      if (!this.enemySystem.active) {
        break;
      }

      const resistanceBeforeImpact = this.enemySystem.state.resistance;
      const lethalImpact =
        resistanceBeforeImpact <= this.config.projectile.hitStrength;
      let hitApplied = false;

      if (lethalImpact) {
        this.enemySystem.pauseAtFrameRatio(collision.t);
      }

      try {
        hitApplied = this.enemySystem.applyHit(
          this.config.projectile.hitStrength,
        );
      } catch (error) {
        this.queueObserverError(error);
        hitApplied =
          this.enemySystem.state.resistance < resistanceBeforeImpact;
      }

      if (!hitApplied) {
        continue;
      }

      this.projectileSystem.removeProjectile(projectile);

      try {
        this.impactFeedbackSystem.spawn(collision.projectileCenter);
      } catch (error) {
        this.queueObserverError(error);
      }

      try {
        this.onEnemyHit({
          ...this.enemySystem.state,
          hitStrength: this.config.projectile.hitStrength,
          impactPoint: collision.projectileCenter.clone(),
          impactRatio,
          projectile: mesh,
        });
      } catch (error) {
        this.queueObserverError(error);
      }
    }

    this.pendingEnemyImpacts.length = 0;
  }

  handleEnemyPlayerContact(enemyState) {
    let observerError = null;

    try {
      this.playerHealthSystem.applyDamage(enemyState.type.damage);
    } catch (error) {
      observerError = error;
    }

    this.finishCurrentEncounter();

    try {
      this.onEnemyPlayerContact(enemyState);
    } catch (error) {
      observerError ??= error;
    }

    this.publishWaveChange();

    if (observerError) {
      throw observerError;
    }
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
      this.enemySystem.dispose();
    } catch (error) {
      disposalError ??= error;
    }

    try {
      this.playerHealthSystem.dispose();
    } catch (error) {
      disposalError ??= error;
    }

    try {
      this.impactFeedbackSystem.dispose();
    } catch (error) {
      disposalError ??= error;
    }

    this.onEnemyHit = () => {};
    this.onEnemyEliminate = () => {};
    this.onEnemyPlayerContact = () => {};
    this.onWaveChange = () => {};
    this.disposed = true;

    if (disposalError) {
      throw disposalError;
    }

    return true;
  }
}
