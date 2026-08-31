import {
  AdditiveBlending,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
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
  for (const [name, value] of [
    ['lifetimeSeconds', config?.lifetimeSeconds],
    ['maxActive', config?.maxActive],
    ['startScale', config?.startScale],
    ['endScale', config?.endScale],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`impactFeedback.${name} deve ser maior que zero.`);
    }
  }

  if (!Number.isInteger(config.maxActive)) {
    throw new TypeError('impactFeedback.maxActive deve ser um inteiro.');
  }

  if (config.endScale < config.startScale) {
    throw new RangeError(
      'impactFeedback.endScale não pode ser menor que startScale.',
    );
  }

  if (!Number.isInteger(config.color)) {
    throw new TypeError('impactFeedback.color deve ser uma cor inteira.');
  }
}

export class ImpactFeedbackSystem extends Group {
  constructor({
    scene,
    config = GAMEPLAY_CONFIG.impactFeedback,
  } = {}) {
    super();

    if (!scene?.add || !scene?.remove) {
      throw new Error(
        'ImpactFeedbackSystem requer uma cena Three.js válida.',
      );
    }

    validateConfig(config);

    this.name = 'impact-feedback';
    this.scene = scene;
    this.config = config;
    this.bursts = [];
    this.disposed = false;
    this.geometry = new IcosahedronGeometry(1, 1);
    this.scene.add(this);
  }

  get activeCount() {
    return this.bursts.length;
  }

  spawn(position) {
    if (this.disposed) {
      throw new Error(
        'Não é possível usar um ImpactFeedbackSystem descartado.',
      );
    }

    assertFiniteVector('position', position);

    while (this.bursts.length >= this.config.maxActive) {
      this.removeBurst(this.bursts[0]);
    }

    const material = new MeshBasicMaterial({
      color: this.config.color,
      transparent: true,
      opacity: 0.92,
      wireframe: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(this.geometry, material);
    mesh.name = 'impact-burst';
    mesh.position.copy(position);
    mesh.scale.setScalar(this.config.startScale);

    const burst = { ageSeconds: 0, material, mesh };
    this.bursts.push(burst);
    this.add(mesh);
    return mesh;
  }

  update(deltaSeconds) {
    if (this.disposed) {
      return false;
    }

    const safeDelta = Math.max(0, Number(deltaSeconds) || 0);

    if (safeDelta === 0) {
      return true;
    }

    for (let index = this.bursts.length - 1; index >= 0; index -= 1) {
      const burst = this.bursts[index];
      burst.ageSeconds += safeDelta;

      if (burst.ageSeconds >= this.config.lifetimeSeconds) {
        this.removeBurst(burst);
        continue;
      }

      const ratio = burst.ageSeconds / this.config.lifetimeSeconds;
      const scale =
        this.config.startScale +
        (this.config.endScale - this.config.startScale) * ratio;
      burst.mesh.scale.setScalar(scale);
      burst.mesh.rotation.x = ratio * Math.PI;
      burst.mesh.rotation.y = ratio * Math.PI * 1.5;
      burst.material.opacity = 0.92 * (1 - ratio) ** 2;
    }

    return true;
  }

  removeBurst(burst) {
    const index = this.bursts.indexOf(burst);

    if (index === -1) {
      return false;
    }

    this.remove(burst.mesh);
    burst.material.dispose();
    this.bursts.splice(index, 1);
    return true;
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    for (const burst of [...this.bursts]) {
      this.removeBurst(burst);
    }

    this.scene.remove(this);
    this.geometry.dispose();
    this.disposed = true;
    return true;
  }
}
