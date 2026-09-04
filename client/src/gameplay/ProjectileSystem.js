import {
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';

function assertFiniteVector(name, value) {
  if (
    !value ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  ) {
    throw new TypeError(`${name} deve ser um vetor tridimensional finito.`);
  }
}

function validateConfig(config) {
  const positiveValues = [
    ['radius', config.radius],
    ['widthSegments', config.widthSegments],
    ['heightSegments', config.heightSegments],
    ['lifetimeSeconds', config.lifetimeSeconds],
    ['horizontalLimit', config.horizontalLimit],
    ['maxActive', config.maxActive],
    ['hitStrength', config.hitStrength],
  ];

  for (const [name, value] of positiveValues) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`projectile.${name} deve ser maior que zero.`);
    }
  }

  if (!Number.isInteger(config.hitStrength)) {
    throw new TypeError('projectile.hitStrength deve ser um inteiro.');
  }

  if (!Number.isFinite(config.gravity)) {
    throw new TypeError('projectile.gravity deve ser finito.');
  }

  if (!Number.isFinite(config.groundY)) {
    throw new TypeError('projectile.groundY deve ser finito.');
  }
}

export class ProjectileSystem {
  constructor({ scene, config = GAMEPLAY_CONFIG.projectile }) {
    if (!scene?.add || !scene?.remove) {
      throw new Error('ProjectileSystem requer uma cena Three.js válida.');
    }

    validateConfig(config);

    this.scene = scene;
    this.config = config;
    this.projectiles = [];
    this.disposed = false;

    this.geometry = new SphereGeometry(
      config.radius,
      config.widthSegments,
      config.heightSegments,
    );
    this.material = new MeshStandardMaterial({
      color: config.color,
      emissive: config.emissiveColor,
      emissiveIntensity: config.emissiveIntensity,
      metalness: 0,
      roughness: config.roughness,
    });
    this.specialMaterial = new MeshStandardMaterial({
      color: config.specialColor,
      emissive: config.specialEmissiveColor,
      emissiveIntensity: config.specialEmissiveIntensity,
      metalness: 0.04,
      roughness: config.roughness,
    });
    this.group = new Group();
    this.group.name = 'snowball-projectiles';
    this.scene.add(this.group);
  }

  get activeProjectileCount() {
    return this.projectiles.length;
  }

  spawn({
    origin,
    direction,
    speed,
    charge = 0,
    hitStrength = this.config.hitStrength,
    ammoType = 'normal',
  }) {
    if (this.disposed) {
      throw new Error('Não é possível usar um ProjectileSystem descartado.');
    }

    assertFiniteVector('origin', origin);
    assertFiniteVector('direction', direction);

    if (!Number.isFinite(speed) || speed <= 0) {
      throw new RangeError('A velocidade do projétil deve ser maior que zero.');
    }

    if (!Number.isInteger(hitStrength) || hitStrength <= 0) {
      throw new RangeError('A força do projétil deve ser um inteiro positivo.');
    }

    if (!['normal', 'special'].includes(ammoType)) {
      throw new TypeError('O tipo de munição do projétil deve ser normal ou special.');
    }

    const normalizedDirection = new Vector3(
      direction.x,
      direction.y,
      direction.z,
    );

    if (normalizedDirection.lengthSq() === 0) {
      throw new RangeError('A direção do projétil não pode ser nula.');
    }

    normalizedDirection.normalize();

    while (this.projectiles.length >= this.config.maxActive) {
      this.removeProjectile(this.projectiles[0]);
    }

    const mesh = new Mesh(
      this.geometry,
      ammoType === 'special' ? this.specialMaterial : this.material,
    );
    mesh.name = 'snowball-projectile';
    mesh.position.set(origin.x, origin.y, origin.z);
    mesh.userData.charge = Math.min(Math.max(Number(charge) || 0, 0), 1);

    const projectile = {
      mesh,
      previousPosition: mesh.position.clone(),
      spawnPosition: mesh.position.clone(),
      velocity: normalizedDirection.multiplyScalar(speed),
      ageSeconds: 0,
      hitStrength,
      ammoType,
    };

    this.projectiles.push(projectile);
    this.group.add(mesh);

    return mesh;
  }

  update(deltaSeconds, onProjectileStep = null) {
    if (this.disposed) {
      return false;
    }

    if (onProjectileStep !== null && typeof onProjectileStep !== 'function') {
      throw new TypeError('ProjectileSystem requer callback de passo válido.');
    }

    const delta = Math.max(0, Number(deltaSeconds) || 0);

    if (delta === 0) {
      return true;
    }

    const accelerationY = this.config.gravity;
    const halfAccelerationStep = 0.5 * accelerationY * delta * delta;
    const horizontalLimitSquared = this.config.horizontalLimit ** 2;

    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      const { mesh, velocity } = projectile;

      projectile.previousPosition.copy(mesh.position);
      mesh.position.addScaledVector(velocity, delta);
      mesh.position.y += halfAccelerationStep;
      velocity.y += accelerationY * delta;
      projectile.ageSeconds += delta;

      const consumed =
        onProjectileStep?.({
          currentPosition: mesh.position,
          mesh,
          previousPosition: projectile.previousPosition,
          projectile,
          radius: this.config.radius,
        }) === true;

      if (consumed) {
        this.removeProjectile(projectile);
        continue;
      }

      const outsideHorizontalLimit =
        mesh.position.x ** 2 + mesh.position.z ** 2 > horizontalLimitSquared;
      const touchedGround =
        mesh.position.y - this.config.radius <= this.config.groundY;
      const expired = projectile.ageSeconds >= this.config.lifetimeSeconds;

      if (outsideHorizontalLimit || touchedGround || expired) {
        this.removeProjectile(projectile);
      }
    }

    return true;
  }

  removeProjectile(projectile) {
    const index = this.projectiles.indexOf(projectile);

    if (index === -1) {
      return false;
    }

    this.group.remove(projectile.mesh);
    this.projectiles.splice(index, 1);
    return true;
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    for (const projectile of [...this.projectiles]) {
      this.removeProjectile(projectile);
    }

    this.scene.remove(this.group);
    this.geometry.dispose();
    this.material.dispose();
    this.specialMaterial.dispose();
    this.disposed = true;

    return true;
  }
}
