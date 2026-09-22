import { MathUtils, Vector3 } from 'three';

export const FLYING_ENEMY_STATES = Object.freeze({
  HOVER: 'hover',
  PATROL: 'patrol',
  CHASE: 'chase',
  DIVE: 'dive',
  RANGED: 'ranged',
  RETREAT: 'retreat',
  HIT: 'hit',
  DEATH: 'death',
});

const REQUIRED_POSITIVE_VALUES = [
  'minAltitude',
  'maxAltitude',
  'hoverAngularSpeed',
  'chaseSpeedMultiplier',
  'diveSpeedMultiplier',
  'patrolRadius',
  'maxArenaRadius',
  'hoverDurationSeconds',
  'rangedDurationSeconds',
  'retreatDurationSeconds',
  'hitDurationSeconds',
  'deathDurationSeconds',
  'attackCooldownSeconds',
];

function validateConfig(config) {
  for (const name of REQUIRED_POSITIVE_VALUES) {
    if (!Number.isFinite(config?.[name]) || config[name] <= 0) {
      throw new RangeError(`enemy.flying.${name} deve ser maior que zero.`);
    }
  }

  if (config.maxAltitude <= config.minAltitude) {
    throw new RangeError('enemy.flying.maxAltitude deve superar minAltitude.');
  }
}

export class FlyingEnemyController {
  constructor(config) {
    validateConfig(config);
    this.config = config;
    this.state = FLYING_ENEMY_STATES.HOVER;
    this.elapsed = 0;
    this.totalElapsed = 0;
    this.attackCooldown = config.attackCooldownSeconds * 0.65;
    this.nextAttack = FLYING_ENEMY_STATES.DIVE;
    this.actionTriggered = false;
    this.deathComplete = false;
    this.orbitDirection = 1;
    this.diveDuration = 1;
    this.diveStart = new Vector3();
    this.diveTarget = new Vector3();
    this.direction = new Vector3();
    this.tangent = new Vector3();
  }

  reset(position, playerPosition) {
    this.state = FLYING_ENEMY_STATES.HOVER;
    this.elapsed = 0;
    this.totalElapsed = 0;
    this.attackCooldown = this.config.attackCooldownSeconds * 0.65;
    this.nextAttack = FLYING_ENEMY_STATES.DIVE;
    this.actionTriggered = false;
    this.deathComplete = false;
    this.orbitDirection = position.x - playerPosition.x >= 0 ? 1 : -1;
  }

  transition(state) {
    this.state = state;
    this.elapsed = 0;
    this.actionTriggered = false;
  }

  registerHit() {
    if (this.state === FLYING_ENEMY_STATES.DEATH) return false;
    this.transition(FLYING_ENEMY_STATES.HIT);
    return true;
  }

  beginDeath() {
    if (this.state === FLYING_ENEMY_STATES.DEATH) return false;
    this.transition(FLYING_ENEMY_STATES.DEATH);
    this.deathComplete = false;
    return true;
  }

  beginAttack(position, playerPosition, moveSpeed) {
    if (this.nextAttack === FLYING_ENEMY_STATES.DIVE) {
      this.diveStart.copy(position);
      this.diveTarget.set(
        playerPosition.x,
        playerPosition.y + 0.85,
        playerPosition.z,
      );
      const distance = this.diveStart.distanceTo(this.diveTarget);
      this.diveDuration = MathUtils.clamp(
        distance / (moveSpeed * this.config.diveSpeedMultiplier),
        0.55,
        1.5,
      );
      this.transition(FLYING_ENEMY_STATES.DIVE);
      this.nextAttack = FLYING_ENEMY_STATES.RANGED;
      return;
    }

    this.transition(FLYING_ENEMY_STATES.RANGED);
    this.nextAttack = FLYING_ENEMY_STATES.DIVE;
  }

  update(delta, {
    position,
    playerPosition,
    moveSpeed,
    onDiveImpact = () => {},
    onRangedFire = () => {},
    onDeathComplete = () => {},
  }) {
    if (!Number.isFinite(delta) || delta <= 0) return this.state;

    this.elapsed += delta;
    this.totalElapsed += delta;

    if (this.state === FLYING_ENEMY_STATES.DEATH) {
      const progress = Math.min(this.elapsed / this.config.deathDurationSeconds, 1);
      position.y = Math.max(0.3, position.y - (2.4 + progress * 9) * delta);
      if (progress >= 1 && !this.deathComplete) {
        this.deathComplete = true;
        onDeathComplete();
      }
      return this.state;
    }

    if (this.state === FLYING_ENEMY_STATES.HIT) {
      position.y = Math.max(position.y, this.config.minAltitude);
      if (this.elapsed >= this.config.hitDurationSeconds) {
        this.transition(FLYING_ENEMY_STATES.RETREAT);
      }
      return this.state;
    }

    if (this.state === FLYING_ENEMY_STATES.DIVE) {
      const progress = Math.min(this.elapsed / this.diveDuration, 1);
      const eased = progress * progress * (3 - 2 * progress);
      position.lerpVectors(this.diveStart, this.diveTarget, eased);
      if (progress >= 0.82 && !this.actionTriggered) {
        this.actionTriggered = true;
        onDiveImpact();
      }
      if (progress >= 1) this.transition(FLYING_ENEMY_STATES.RETREAT);
      return this.state;
    }

    if (this.state === FLYING_ENEMY_STATES.RANGED) {
      this.applyHover(position, delta);
      if (
        this.elapsed >= this.config.rangedFireDelaySeconds &&
        !this.actionTriggered
      ) {
        this.actionTriggered = true;
        onRangedFire();
      }
      if (this.elapsed >= this.config.rangedDurationSeconds) {
        this.transition(FLYING_ENEMY_STATES.RETREAT);
      }
      return this.state;
    }

    if (this.state === FLYING_ENEMY_STATES.RETREAT) {
      this.direction.set(
        position.x - playerPosition.x,
        0,
        position.z - playerPosition.z,
      );
      if (this.direction.lengthSq() < Number.EPSILON) this.direction.set(1, 0, 0);
      this.direction.normalize();
      position.addScaledVector(this.direction, moveSpeed * 0.75 * delta);
      position.y += (this.config.maxAltitude - position.y) * Math.min(1, delta * 3.5);
      this.keepInsideArena(position, playerPosition);
      if (this.elapsed >= this.config.retreatDurationSeconds) {
        this.attackCooldown = this.config.attackCooldownSeconds;
        this.transition(FLYING_ENEMY_STATES.PATROL);
      }
      return this.state;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.direction.set(
      playerPosition.x - position.x,
      0,
      playerPosition.z - position.z,
    );
    const distance = this.direction.length();

    if (this.state === FLYING_ENEMY_STATES.HOVER) {
      this.applyHover(position, delta);
      if (this.elapsed >= this.config.hoverDurationSeconds) {
        this.transition(
          distance > this.config.patrolRadius * 1.35
            ? FLYING_ENEMY_STATES.CHASE
            : FLYING_ENEMY_STATES.PATROL,
        );
      }
      return this.state;
    }

    const desiredState = distance > this.config.patrolRadius * 1.35
      ? FLYING_ENEMY_STATES.CHASE
      : FLYING_ENEMY_STATES.PATROL;
    if (this.state !== desiredState) this.transition(desiredState);

    if (distance > Number.EPSILON) this.direction.multiplyScalar(1 / distance);
    if (this.state === FLYING_ENEMY_STATES.CHASE) {
      position.addScaledVector(
        this.direction,
        moveSpeed * this.config.chaseSpeedMultiplier * delta,
      );
    } else {
      this.tangent.set(
        -this.direction.z * this.orbitDirection,
        0,
        this.direction.x * this.orbitDirection,
      );
      const radialCorrection = MathUtils.clamp(
        (distance - this.config.patrolRadius) / this.config.patrolRadius,
        -0.45,
        0.45,
      );
      this.tangent.addScaledVector(this.direction, radialCorrection).normalize();
      position.addScaledVector(this.tangent, moveSpeed * 0.68 * delta);
    }

    this.applyHover(position, delta);
    this.keepInsideArena(position, playerPosition);
    if (this.attackCooldown <= 0) {
      this.beginAttack(position, playerPosition, moveSpeed);
    }
    return this.state;
  }

  applyHover(position, delta) {
    const middleAltitude =
      (this.config.minAltitude + this.config.maxAltitude) * 0.5;
    const targetAltitude = MathUtils.clamp(
      middleAltitude +
        Math.sin(this.totalElapsed * this.config.hoverAngularSpeed) *
          this.config.hoverAmplitude,
      this.config.minAltitude,
      this.config.maxAltitude,
    );
    position.y += (targetAltitude - position.y) * Math.min(1, delta * 3.2);
  }

  keepInsideArena(position, playerPosition) {
    this.direction.set(
      position.x - playerPosition.x,
      0,
      position.z - playerPosition.z,
    );
    const distance = this.direction.length();
    if (distance <= this.config.maxArenaRadius || distance === 0) return;
    this.direction.multiplyScalar(this.config.maxArenaRadius / distance);
    position.x = playerPosition.x + this.direction.x;
    position.z = playerPosition.z + this.direction.z;
  }
}
