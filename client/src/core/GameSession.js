import { Vector3 } from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import {
  intersectMovingSpheres,
  intersectSegmentSphere,
} from '../gameplay/CollisionSystem.js';
import { EnemySystem } from '../gameplay/EnemySystem.js';
import { validateEnemyTypes } from '../gameplay/EnemyTypes.js';
import { GameStateManager } from '../gameplay/GameStateManager.js';
import { ImpactFeedbackSystem } from '../gameplay/ImpactFeedbackSystem.js';
import { ItemSystem } from '../gameplay/ItemSystem.js';
import { PlayerHealthSystem } from '../gameplay/PlayerHealthSystem.js';
import { ProjectileSystem } from '../gameplay/ProjectileSystem.js';
import { ScoreManager } from '../gameplay/ScoreManager.js';
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
    onGameStateChange = () => {},
    onItemCollected = () => {},
    onItemStateChange = () => {},
    onWaveChange = () => {},
    onPlayerHealthChange = () => {},
    onScoreChange = () => {},
    onShot = () => {},
    onSpecialAmmoChange = () => {},
    config = GAMEPLAY_CONFIG,
    encounterActive = true,
    enemyRandom = Math.random,
    enemyTypeRandom = Math.random,
    itemRandom = Math.random,
    enemySystem = null,
    gameStateManager = null,
    impactFeedbackSystem = null,
    itemSystem = null,
    playerHealthSystem = null,
    projectileSystem = null,
    scoreManager = null,
    slingshotSystem = null,
    waveManager = null,
  } = {}) {
    for (const [name, callback] of [
      ['onEnemyHit', onEnemyHit],
      ['onEnemyPlayerContact', onEnemyPlayerContact],
      ['onEnemyEliminate', onEnemyEliminate],
      ['onGameStateChange', onGameStateChange],
      ['onItemCollected', onItemCollected],
      ['onItemStateChange', onItemStateChange],
      ['onWaveChange', onWaveChange],
      ['onPlayerHealthChange', onPlayerHealthChange],
      ['onScoreChange', onScoreChange],
      ['onShot', onShot],
      ['onSpecialAmmoChange', onSpecialAmmoChange],
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
    const ownsGameStateManager = !gameStateManager;
    const ownsImpactFeedbackSystem = !impactFeedbackSystem;
    const ownsItemSystem = !itemSystem;
    const ownsPlayerHealthSystem = !playerHealthSystem;
    const ownsScoreManager = !scoreManager;

    validateBossConfig(config?.boss);
    this.config = config;
    this.encounterActive = encounterActive;
    this.onEnemyHit = onEnemyHit;
    this.onEnemyEliminate = onEnemyEliminate;
    this.onEnemyPlayerContact = onEnemyPlayerContact;
    this.onItemCollected = onItemCollected;
    this.onShot = onShot;
    this.onSpecialAmmoChange = onSpecialAmmoChange;
    this.onWaveChange = onWaveChange;
    this.specialAmmoRemainingShots = 0;
    this.specialAmmoConfig = config?.items?.types?.find(
      (type) => type.effect?.kind === 'special-ammo',
    )?.effect;

    if (!this.specialAmmoConfig) {
      throw new TypeError('GameSession requer uma configuração de munição especial.');
    }
    this.waveManager =
      waveManager ??
      new WaveManager({
        config: config.waves,
        bossDelaySeconds: config.boss.spawnDelaySeconds,
      });
    this.currentEncounter = this.createEncounterIdentity('enemy');
    this.enemyPreviousCenter = new Vector3();
    this.enemyCenter = new Vector3();
    this.projectileContactCenter = new Vector3();
    this.itemCenter = new Vector3();
    this.pendingProjectileImpacts = [];
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
          scene,
          projectileSystem: this.projectileSystem,
          config,
          onChargeChange,
          onShot: (shot) => this.handleShot(shot),
        });
      this.playerHealthSystem =
        playerHealthSystem ??
        new PlayerHealthSystem({
          config: config.player,
          onHealthChange: onPlayerHealthChange,
        });
      this.scoreManager =
        scoreManager ??
        new ScoreManager({
          config: config.score,
          onScoreChange,
        });
      this.gameStateManager =
        gameStateManager ??
        new GameStateManager({
          onStateChange: onGameStateChange,
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
      this.itemSystem =
        itemSystem ??
        new ItemSystem({
          scene,
          config: config.items,
          random: itemRandom,
          onStateChange: onItemStateChange,
        });
      this.itemSystem.trySpawn({ wave: this.waveState.wave });
    } catch (error) {
      if (ownsItemSystem) {
        try {
          this.itemSystem?.dispose?.();
        } catch {
          // Preserva o erro original de construção.
        }
      }

      if (ownsGameStateManager) {
        try {
          this.gameStateManager?.dispose?.();
        } catch {
          // Preserva o erro original de construção.
        }
      }

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

      if (ownsScoreManager) {
        try {
          this.scoreManager?.dispose?.();
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

  get scoreState() {
    return this.scoreManager.state;
  }

  get itemState() {
    return this.itemSystem.state;
  }

  get specialAmmoState() {
    return Object.freeze({
      active: this.specialAmmoRemainingShots > 0,
      remainingShots: this.specialAmmoRemainingShots,
      maxShots: this.specialAmmoConfig.maxShots,
      hitStrength: this.specialAmmoConfig.hitStrength,
    });
  }

  get gameState() {
    return this.gameStateManager.state;
  }

  get isTerminal() {
    return this.gameStateManager.isTerminal;
  }

  beginCharge({ mode = 'time' } = {}) {
    this.assertNotDisposed();

    if (this.isTerminal) {
      return false;
    }

    return this.slingshotSystem.beginCharge({
      ammoType: this.specialAmmoRemainingShots > 0 ? 'special' : 'normal',
      mode,
    });
  }

  releaseShot({ origin = null, direction = null } = {}) {
    this.assertNotDisposed();

    if (this.isTerminal) {
      return false;
    }

    const special = this.specialAmmoRemainingShots > 0;

    return this.slingshotSystem.releaseShot({
      hitStrength: special
        ? this.specialAmmoConfig.hitStrength
        : this.config.projectile.hitStrength,
      ammoType: special ? 'special' : 'normal',
      origin,
      direction,
    });
  }

  setChargeRatio(ratio) {
    this.assertNotDisposed();

    if (this.isTerminal) {
      return false;
    }

    return this.slingshotSystem.setChargeRatio(ratio);
  }

  setDesktopSlingshotVisible(visible) {
    if (this.disposed) {
      return false;
    }

    return this.slingshotSystem.setVisualVisible(visible);
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
    if (this.disposed || this.isTerminal) {
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
          try {
            this.itemSystem.clear();
          } catch (error) {
            this.queueObserverError(error);
          }
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
          try {
            this.itemSystem.trySpawn({ wave: this.waveState.wave });
          } catch (error) {
            this.queueObserverError(error);
          }
        }

        this.currentEncounter = this.createEncounterIdentity(
          waveUpdate.spawnKind,
        );
        this.publishWaveChange();

        try {
          this.syncGameState();
        } catch (error) {
          this.queueObserverError(error);
        }
      }

      this.enemySystem.update(waveUpdate.enemyDelta);
      this.impactFeedbackSystem.update(delta);
      try {
        this.itemSystem.update(delta);
      } catch (error) {
        this.queueObserverError(error);
      }
      this.pendingProjectileImpacts.length = 0;
      this.projectileSystem.update(delta, this.handleProjectileStep);
      this.resolveProjectileImpacts();

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

  finishCurrentEncounter({ outcome = 'eliminated' } = {}) {
    if (
      this.currentEncounter.kind === 'boss' &&
      outcome === 'player-contact'
    ) {
      return this.playerState.health > 0
        ? this.waveManager.retryBoss()
        : false;
    }

    return this.waveManager.completeEnemy();
  }

  publishWaveChange() {
    try {
      this.onWaveChange(this.waveState);
    } catch (error) {
      this.queueObserverError(error);
    }
  }

  createEncounterIdentity(kind) {
    const state = this.waveState;

    return Object.freeze({
      kind,
      wave: state.wave,
      enemy: state.enemy,
      enemiesInWave: state.enemiesInWave,
    });
  }

  handleEnemyEliminate(enemyState) {
    const encounterState = this.currentEncounter;
    this.finishCurrentEncounter({ outcome: enemyState.outcome });
    let observerError = null;

    try {
      this.recordScoreForOutcome(enemyState, encounterState);
    } catch (error) {
      observerError = error;
    }

    try {
      this.onEnemyEliminate(enemyState);
    } catch (error) {
      observerError = error;
    }

    this.publishWaveChange();

    try {
      this.syncGameState();
    } catch (error) {
      observerError ??= error;
    }

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
    let nearestImpact = null;

    if (this.enemySystem.active) {
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

      if (collision.hit) {
        nearestImpact = {
          kind: 'enemy',
          collision,
          impactRatio:
            contactRatio === null ? collision.t : collision.t * contactRatio,
          mesh,
          projectile,
        };
      }
    }

    if (this.itemSystem.state.active) {
      this.itemSystem.getCenter(this.itemCenter);
      const itemCollision = intersectSegmentSphere(
        previousPosition,
        currentPosition,
        this.itemCenter,
        radius + this.itemSystem.radius,
      );

      if (
        itemCollision.hit &&
        (!nearestImpact || itemCollision.t < nearestImpact.impactRatio)
      ) {
        nearestImpact = {
          kind: 'item',
          collision: {
            ...itemCollision,
            projectileCenter: itemCollision.point,
          },
          impactRatio: itemCollision.t,
          mesh,
          projectile,
        };
      }
    }

    if (nearestImpact) {
      this.pendingProjectileImpacts.push(nearestImpact);
    }

    return false;
  }

  resolveProjectileImpacts() {
    this.pendingProjectileImpacts.sort(
      (left, right) => left.impactRatio - right.impactRatio,
    );

    for (const {
      kind,
      collision,
      impactRatio,
      mesh,
      projectile,
    } of this.pendingProjectileImpacts) {
      if (kind === 'item') {
        this.resolveItemImpact({ collision, impactRatio, mesh, projectile });
        continue;
      }

      if (!this.enemySystem.active) {
        continue;
      }

      const resistanceBeforeImpact = this.enemySystem.state.resistance;
      const hitStrength =
        projectile.hitStrength ?? this.config.projectile.hitStrength;
      const lethalImpact = resistanceBeforeImpact <= hitStrength;
      let hitApplied = false;

      if (lethalImpact) {
        this.enemySystem.pauseAtFrameRatio(collision.t);
      }

      try {
        hitApplied = this.enemySystem.applyHit(hitStrength);
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
          hitStrength,
          impactPoint: collision.projectileCenter.clone(),
          impactRatio,
          projectile: mesh,
        });
      } catch (error) {
        this.queueObserverError(error);
      }
    }

    this.pendingProjectileImpacts.length = 0;
  }

  resolveItemImpact({ collision, impactRatio, mesh, projectile }) {
    if (!this.itemSystem.state.active) {
      return false;
    }

    if (!this.projectileSystem.removeProjectile(projectile)) {
      return false;
    }

    let itemState;

    try {
      itemState = this.itemSystem.collect();
    } catch (error) {
      this.queueObserverError(error);
      itemState = this.itemSystem.state;
    }

    const effect = this.applyItemEffect(itemState.type.effect);

    try {
      this.impactFeedbackSystem.spawn(collision.projectileCenter);
    } catch (error) {
      this.queueObserverError(error);
    }

    const collection = Object.freeze({
      item: itemState,
      effect,
      impactPoint: collision.projectileCenter.clone(),
      impactRatio,
      projectile: mesh,
    });

    try {
      this.onItemCollected(collection);
    } catch (error) {
      this.queueObserverError(error);
    }

    return collection;
  }

  applyItemEffect(effect) {
    if (effect.kind === 'heal') {
      const previousHealth = this.playerState.health;
      let change = null;

      try {
        change = this.playerHealthSystem.heal(effect.amount);
      } catch (error) {
        this.queueObserverError(error);
      }

      return Object.freeze({
        kind: effect.kind,
        requestedAmount: effect.amount,
        appliedAmount: change?.healing ??
          Math.max(0, this.playerState.health - previousHealth),
        health: this.playerState.health,
      });
    }

    const previousShots = this.specialAmmoRemainingShots;
    this.specialAmmoRemainingShots = Math.min(
      effect.maxShots,
      previousShots + effect.shots,
    );
    const change = Object.freeze({
      ...this.specialAmmoState,
      reason: 'collected',
      addedShots: this.specialAmmoRemainingShots - previousShots,
    });
    try {
      this.onSpecialAmmoChange(change);
    } catch (error) {
      this.queueObserverError(error);
    }

    return Object.freeze({
      kind: effect.kind,
      addedShots: change.addedShots,
      remainingShots: change.remainingShots,
      hitStrength: change.hitStrength,
    });
  }

  handleShot(shot) {
    let observerError = null;

    if (shot.ammoType === 'special' && this.specialAmmoRemainingShots > 0) {
      this.specialAmmoRemainingShots -= 1;

      try {
        this.onSpecialAmmoChange(Object.freeze({
          ...this.specialAmmoState,
          reason: 'shot',
          addedShots: 0,
        }));
      } catch (error) {
        observerError = error;
      }
    }

    try {
      this.onShot(shot);
    } catch (error) {
      observerError ??= error;
    }

    if (observerError) {
      throw observerError;
    }
  }

  handleEnemyPlayerContact(enemyState) {
    const encounterState = this.currentEncounter;
    let observerError = null;

    try {
      this.playerHealthSystem.applyDamage(enemyState.type.damage);
    } catch (error) {
      observerError = error;
    }

    this.finishCurrentEncounter({ outcome: enemyState.outcome });

    try {
      this.recordScoreForOutcome(enemyState, encounterState);
    } catch (error) {
      observerError ??= error;
    }

    try {
      this.onEnemyPlayerContact(enemyState);
    } catch (error) {
      observerError ??= error;
    }

    this.publishWaveChange();

    try {
      this.syncGameState();
    } catch (error) {
      observerError ??= error;
    }

    if (observerError) {
      throw observerError;
    }
  }

  recordScoreForOutcome(enemyState, encounterState) {
    let scoreError = null;
    const record = (operation) => {
      try {
        operation();
      } catch (error) {
        scoreError ??= error;
      }
    };

    if (enemyState.outcome === 'eliminated') {
      const eventId =
        encounterState.kind === 'boss'
          ? 'boss:eliminated'
          : `enemy:${encounterState.wave}:${encounterState.enemy}`;

      record(() =>
        this.scoreManager.recordEnemyEliminated({
          eventId,
          typeId: enemyState.type.id,
        }),
      );
    }

    if (
      encounterState.kind !== 'boss' &&
      encounterState.enemy === encounterState.enemiesInWave
    ) {
      record(() =>
        this.scoreManager.recordWaveCompleted({
          eventId: `wave:${encounterState.wave}:completed`,
        }),
      );
    }

    if (
      encounterState.kind === 'boss' &&
      enemyState.outcome === 'eliminated'
    ) {
      record(() =>
        this.scoreManager.recordPhaseCompleted({
          eventId: 'phase:completed',
        }),
      );
    }

    if (scoreError) {
      throw scoreError;
    }
  }

  syncGameState() {
    return this.gameStateManager.sync({
      enemyState: this.enemyState,
      playerState: this.playerState,
      waveState: this.waveState,
    });
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
      this.scoreManager.dispose();
    } catch (error) {
      disposalError ??= error;
    }

    try {
      this.gameStateManager.dispose();
    } catch (error) {
      disposalError ??= error;
    }

    try {
      this.impactFeedbackSystem.dispose();
    } catch (error) {
      disposalError ??= error;
    }

    try {
      this.itemSystem.dispose();
    } catch (error) {
      disposalError ??= error;
    }

    this.onEnemyHit = () => {};
    this.onEnemyEliminate = () => {};
    this.onEnemyPlayerContact = () => {};
    this.onItemCollected = () => {};
    this.onShot = () => {};
    this.onSpecialAmmoChange = () => {};
    this.onWaveChange = () => {};
    this.disposed = true;

    if (disposalError) {
      throw disposalError;
    }

    return true;
  }
}
