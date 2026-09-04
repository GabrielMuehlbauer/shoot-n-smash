import {
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  TorusGeometry,
  Vector3,
} from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';

const ITEM_OUTCOMES = new Set([null, 'collected', 'expired', 'cleared']);

function assertRandomValue(value) {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('O gerador de itens deve retornar um valor entre 0 e 1.');
  }

  return value;
}

function validateEffect(effect) {
  if (effect?.kind === 'heal') {
    if (!Number.isInteger(effect.amount) || effect.amount <= 0) {
      throw new RangeError('O item de vida requer uma cura inteira positiva.');
    }

    return;
  }

  if (effect?.kind === 'special-ammo') {
    for (const name of ['shots', 'maxShots', 'hitStrength']) {
      if (!Number.isInteger(effect[name]) || effect[name] <= 0) {
        throw new RangeError(`A munição especial requer ${name} inteiro positivo.`);
      }
    }

    if (effect.shots > effect.maxShots) {
      throw new RangeError('A carga de munição não pode superar seu limite.');
    }

    return;
  }

  throw new TypeError('O item requer um efeito conhecido.');
}

function validateConfig(config) {
  for (const [name, value] of [
    ['radius', config?.radius],
    ['lifetimeSeconds', config?.lifetimeSeconds],
    ['spawn.minRadius', config?.spawn?.minRadius],
    ['spawn.maxRadius', config?.spawn?.maxRadius],
    ['animation.bobAngularSpeed', config?.animation?.bobAngularSpeed],
    ['animation.rotationSpeed', config?.animation?.rotationSpeed],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`items.${name} deve ser maior que zero.`);
    }
  }

  if (config.spawn.maxRadius < config.spawn.minRadius) {
    throw new RangeError('items.spawn.maxRadius deve alcançar o raio mínimo.');
  }

  if (!Number.isFinite(config.spawn.height) || config.spawn.height < 0) {
    throw new RangeError('items.spawn.height não pode ser negativo.');
  }

  if (
    !Number.isFinite(config.animation.bobAmplitude) ||
    config.animation.bobAmplitude < 0
  ) {
    throw new RangeError('items.animation.bobAmplitude não pode ser negativo.');
  }

  if (
    !Array.isArray(config.spawnChanceByWave) ||
    config.spawnChanceByWave.length === 0 ||
    config.spawnChanceByWave.some(
      (chance) => !Number.isFinite(chance) || chance < 0 || chance > 1,
    )
  ) {
    throw new RangeError('items.spawnChanceByWave requer probabilidades entre 0 e 1.');
  }

  if (!Array.isArray(config.types) || config.types.length === 0) {
    throw new TypeError('items.types requer ao menos um tipo.');
  }

  const ids = new Set();

  for (const type of config.types) {
    if (
      typeof type?.id !== 'string' ||
      type.id.trim() === '' ||
      typeof type.label !== 'string' ||
      type.label.trim() === ''
    ) {
      throw new TypeError('Cada item requer id e rótulo preenchidos.');
    }

    if (ids.has(type.id)) {
      throw new RangeError(`O tipo de item ${type.id} está duplicado.`);
    }

    ids.add(type.id);

    if (!Number.isFinite(type.weight) || type.weight <= 0) {
      throw new RangeError(`O peso do item ${type.id} deve ser positivo.`);
    }

    for (const name of ['color', 'emissiveColor']) {
      if (!Number.isInteger(type[name]) || type[name] < 0 || type[name] > 0xffffff) {
        throw new RangeError(`A cor ${name} do item ${type.id} é inválida.`);
      }
    }

    validateEffect(type.effect);
  }
}

function copyType(type) {
  return Object.freeze({
    id: type.id,
    label: type.label,
    weight: type.weight,
    color: type.color,
    emissiveColor: type.emissiveColor,
    effect: Object.freeze({ ...type.effect }),
  });
}

export class ItemSystem {
  constructor({
    scene,
    config = GAMEPLAY_CONFIG.items,
    random = Math.random,
    onStateChange = () => {},
  } = {}) {
    if (!scene?.add || !scene?.remove) {
      throw new Error('ItemSystem requer uma cena Three.js válida.');
    }

    validateConfig(config);

    if (typeof random !== 'function') {
      throw new TypeError('ItemSystem requer um gerador aleatório.');
    }

    if (typeof onStateChange !== 'function') {
      throw new TypeError('ItemSystem requer onStateChange como função.');
    }

    this.scene = scene;
    this.config = config;
    this.random = random;
    this.onStateChange = onStateChange;
    this.types = config.types.map(copyType);
    this.totalWeight = this.types.reduce((total, type) => total + type.weight, 0);
    this.currentType = null;
    this.currentWave = null;
    this.remainingSeconds = 0;
    this.elapsedSeconds = 0;
    this.active = false;
    this.outcome = null;
    this.disposed = false;

    this.container = new Group();
    this.container.name = 'collectible-items';
    this.itemRoot = new Group();
    this.itemRoot.name = 'collectible-item';
    this.itemRoot.visible = false;
    this.model = new Group();
    this.model.name = 'collectible-item-model';
    this.itemRoot.add(this.model);
    this.container.add(this.itemRoot);

    this.coreGeometry = new OctahedronGeometry(config.radius * 0.72, 0);
    this.ringGeometry = new TorusGeometry(
      config.radius * 0.72,
      config.radius * 0.08,
      8,
      20,
    );
    this.materials = new Map(
      this.types.map((type) => [
        type.id,
        new MeshStandardMaterial({
          color: type.color,
          emissive: type.emissiveColor,
          emissiveIntensity: 0.75,
          metalness: 0.08,
          roughness: 0.42,
        }),
      ]),
    );
    this.core = new Mesh(this.coreGeometry, this.materials.get(this.types[0].id));
    this.core.name = 'collectible-item-core';
    this.ring = new Mesh(this.ringGeometry, this.materials.get(this.types[0].id));
    this.ring.name = 'collectible-item-ring';
    this.ring.rotation.x = Math.PI / 2;
    this.model.add(this.core, this.ring);
    this.scene.add(this.container);
  }

  get radius() {
    return this.config.radius;
  }

  get state() {
    const position = this.itemRoot.position;

    return Object.freeze({
      active: this.active,
      type: this.currentType,
      wave: this.currentWave,
      remainingSeconds: this.remainingSeconds,
      outcome: this.outcome,
      position: Object.freeze({ x: position.x, y: position.y, z: position.z }),
    });
  }

  selectType(randomValue) {
    let cursor = assertRandomValue(randomValue) * this.totalWeight;

    for (const type of this.types) {
      cursor -= type.weight;

      if (cursor < 0) {
        return type;
      }
    }

    return this.types.at(-1);
  }

  trySpawn({ wave } = {}) {
    this.assertNotDisposed();

    if (!Number.isInteger(wave) || wave < 1 || wave > this.config.spawnChanceByWave.length) {
      throw new RangeError('O spawn de item requer uma onda configurada.');
    }

    if (this.active) {
      return false;
    }

    const chance = this.config.spawnChanceByWave[wave - 1];

    if (assertRandomValue(this.random()) >= chance) {
      return false;
    }

    const type = this.selectType(this.random());
    const angle = assertRandomValue(this.random()) * Math.PI * 2;
    const radiusRatio = assertRandomValue(this.random());
    const spawnRadius =
      this.config.spawn.minRadius +
      (this.config.spawn.maxRadius - this.config.spawn.minRadius) * radiusRatio;
    const material = this.materials.get(type.id);

    this.currentType = type;
    this.currentWave = wave;
    this.remainingSeconds = this.config.lifetimeSeconds;
    this.elapsedSeconds = 0;
    this.active = true;
    this.outcome = null;
    this.itemRoot.position.set(
      Math.sin(angle) * spawnRadius,
      this.config.spawn.height,
      Math.cos(angle) * spawnRadius,
    );
    this.model.position.y = 0;
    this.model.rotation.set(0, 0, 0);
    this.core.material = material;
    this.ring.material = material;
    this.itemRoot.visible = true;

    const state = this.state;
    this.onStateChange(state);
    return state;
  }

  getCenter(target = new Vector3()) {
    if (!target?.copy) {
      throw new TypeError('ItemSystem requer um Vector3 de destino.');
    }

    return target.copy(this.itemRoot.position);
  }

  update(deltaSeconds) {
    if (this.disposed || !this.active) {
      return false;
    }

    const delta = Math.max(0, Number(deltaSeconds) || 0);
    this.elapsedSeconds += delta;
    this.remainingSeconds = Math.max(0, this.remainingSeconds - delta);
    this.model.position.y =
      Math.sin(this.elapsedSeconds * this.config.animation.bobAngularSpeed) *
      this.config.animation.bobAmplitude;
    this.model.rotation.y += this.config.animation.rotationSpeed * delta;

    if (this.remainingSeconds === 0) {
      return this.finish('expired');
    }

    return true;
  }

  collect() {
    this.assertNotDisposed();
    return this.finish('collected');
  }

  clear() {
    if (this.disposed || !this.active) {
      return false;
    }

    return this.finish('cleared');
  }

  finish(outcome) {
    if (!this.active) {
      return false;
    }

    if (!ITEM_OUTCOMES.has(outcome) || outcome === null) {
      throw new RangeError('O desfecho do item é inválido.');
    }

    this.active = false;
    this.outcome = outcome;
    this.itemRoot.visible = false;
    const state = this.state;
    this.onStateChange(state);
    return state;
  }

  assertNotDisposed() {
    if (this.disposed) {
      throw new Error('O sistema de itens foi descartado.');
    }
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.itemRoot.visible = false;
    this.active = false;
    this.scene.remove(this.container);
    this.coreGeometry.dispose();
    this.ringGeometry.dispose();

    for (const material of this.materials.values()) {
      material.dispose();
    }

    this.onStateChange = () => {};
    this.disposed = true;
    return true;
  }
}
