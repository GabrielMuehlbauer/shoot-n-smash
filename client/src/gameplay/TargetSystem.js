import {
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';

function assertCallback(name, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError(`TargetSystem requer ${name} como função.`);
  }
}

function validateConfig(config) {
  if (
    !config?.position ||
    !Number.isFinite(config.position.x) ||
    !Number.isFinite(config.position.y) ||
    !Number.isFinite(config.position.z)
  ) {
    throw new TypeError('TargetSystem requer posição tridimensional finita.');
  }

  for (const [name, value] of [
    ['radius', config.radius],
    ['maxHealth', config.maxHealth],
    ['damagePerHit', config.damagePerHit],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`target.${name} deve ser maior que zero.`);
    }
  }

  for (const name of ['active', 'damaged', 'destroyed', 'emissive']) {
    if (!Number.isInteger(config.colors?.[name])) {
      throw new TypeError(`target.colors.${name} deve ser uma cor inteira.`);
    }
  }
}

export class TargetSystem extends Group {
  constructor({
    scene,
    config = GAMEPLAY_CONFIG.target,
    onDestroy = () => {},
    onHealthChange = () => {},
  } = {}) {
    super();

    if (!scene?.add || !scene?.remove) {
      throw new Error('TargetSystem requer uma cena Three.js válida.');
    }

    validateConfig(config);
    assertCallback('onDestroy', onDestroy);
    assertCallback('onHealthChange', onHealthChange);

    this.name = 'practice-target';
    this.scene = scene;
    this.config = config;
    this.onDestroy = onDestroy;
    this.onHealthChange = onHealthChange;
    this.currentHealth = config.maxHealth;
    this.disposed = false;

    this.position.set(
      config.position.x,
      config.position.y,
      config.position.z,
    );

    this.geometry = new IcosahedronGeometry(config.radius, 1);
    this.material = new MeshStandardMaterial({
      color: config.colors.active,
      emissive: config.colors.emissive,
      emissiveIntensity: 0.34,
      metalness: 0.08,
      roughness: 0.42,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'practice-target-core';
    this.add(this.mesh);
    this.scene.add(this);
  }

  get alive() {
    return !this.disposed && this.currentHealth > 0;
  }

  get health() {
    return this.currentHealth;
  }

  get maxHealth() {
    return this.config.maxHealth;
  }

  get radius() {
    return this.config.radius;
  }

  get state() {
    return {
      alive: this.alive,
      health: this.currentHealth,
      maxHealth: this.config.maxHealth,
      ratio: this.currentHealth / this.config.maxHealth,
    };
  }

  getCenter(target = new Vector3()) {
    if (!target?.setFromMatrixPosition) {
      throw new TypeError('TargetSystem requer um Vector3 para o centro.');
    }

    this.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(this.matrixWorld);
  }

  update(deltaSeconds) {
    if (this.disposed) {
      return false;
    }

    Math.max(0, Number(deltaSeconds) || 0);
    return true;
  }

  applyDamage(amount = this.config.damagePerHit) {
    if (this.disposed || !this.alive) {
      return false;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError('O dano do alvo deve ser maior que zero.');
    }

    this.currentHealth = Math.max(0, this.currentHealth - amount);
    this.updateVisualState();

    const state = this.state;
    let callbackError = null;

    try {
      this.onHealthChange(state);
    } catch (error) {
      callbackError = error;
    }

    if (!state.alive) {
      try {
        this.onDestroy(state);
      } catch (error) {
        callbackError ??= error;
      }
    }

    if (callbackError) {
      throw callbackError;
    }

    return true;
  }

  updateVisualState() {
    if (this.currentHealth === 0) {
      this.material.color.setHex(this.config.colors.destroyed);
      this.material.emissive.setHex(0x000000);
      this.material.emissiveIntensity = 0;
      this.mesh.scale.setScalar(0.76);
      this.mesh.rotation.z = Math.PI / 9;
      return;
    }

    const damaged = this.currentHealth < this.config.maxHealth;
    this.material.color.setHex(
      damaged ? this.config.colors.damaged : this.config.colors.active,
    );
    this.material.emissive.setHex(this.config.colors.emissive);
    this.material.emissiveIntensity = damaged ? 0.18 : 0.34;
    this.mesh.scale.setScalar(1);
    this.mesh.rotation.z = 0;
  }

  reset() {
    if (this.disposed || this.currentHealth === this.config.maxHealth) {
      return false;
    }

    this.currentHealth = this.config.maxHealth;
    this.updateVisualState();
    return true;
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.scene.remove(this);
    this.geometry.dispose();
    this.material.dispose();
    this.onDestroy = () => {};
    this.onHealthChange = () => {};
    this.disposed = true;
    return true;
  }
}
