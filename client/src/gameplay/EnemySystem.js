import {
  BoxGeometry,
  ConeGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { selectEnemyType, validateEnemyTypes } from './EnemyTypes.js';

const FULL_CIRCLE = Math.PI * 2;

function assertCallback(name, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError(`EnemySystem requer ${name} como função.`);
  }
}

function assertFinitePosition(name, position) {
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    throw new TypeError(`${name} deve ser uma posição tridimensional finita.`);
  }
}

function validateConfig(config) {
  for (const [name, value] of [
    ['radius', config?.radius],
    ['moveSpeed', config?.moveSpeed],
    ['playerContactRadius', config?.playerContactRadius],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`enemy.${name} deve ser maior que zero.`);
    }
  }

  validateEnemyTypes(config.types);

  assertFinitePosition('enemy.playerPosition', config.playerPosition);

  const spawn = config.spawn;

  if (
    !Number.isFinite(spawn?.minRadius) ||
    !Number.isFinite(spawn?.maxRadius) ||
    spawn.minRadius <= config.playerContactRadius ||
    spawn.minRadius > spawn.maxRadius
  ) {
    throw new RangeError('EnemySystem requer um anel de spawn válido.');
  }

  if (!Number.isFinite(spawn.height) || spawn.height < 0) {
    throw new RangeError('enemy.spawn.height não pode ser negativo.');
  }

  for (const [name, value] of [
    ['bobAmplitude', config.animation?.bobAmplitude],
    ['bobAngularSpeed', config.animation?.bobAngularSpeed],
    ['limbSwingAmplitude', config.animation?.limbSwingAmplitude],
  ]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`enemy.animation.${name} não pode ser negativo.`);
    }
  }

  for (const name of [
    'damaged',
    'destroyed',
    'emissive',
    'eyes',
    'horns',
  ]) {
    if (!Number.isInteger(config.colors?.[name])) {
      throw new TypeError(`enemy.colors.${name} deve ser uma cor inteira.`);
    }
  }
}

function readRandomUnit(random, label) {
  const value = random();

  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(`${label} deve retornar um número entre 0 e 1.`);
  }

  return value;
}

export function createEnemySpawnPosition({
  config = GAMEPLAY_CONFIG.enemy,
  random = Math.random,
  target = new Vector3(),
} = {}) {
  validateConfig(config);
  assertCallback('random', random);

  if (!target?.set) {
    throw new TypeError('EnemySystem requer um Vector3 para o spawn.');
  }

  const angle = readRandomUnit(random, 'EnemySystem.random') * FULL_CIRCLE;
  const radiusRatio = readRandomUnit(random, 'EnemySystem.random');
  const radius =
    config.spawn.minRadius +
    (config.spawn.maxRadius - config.spawn.minRadius) * radiusRatio;

  return target.set(
    config.playerPosition.x + Math.cos(angle) * radius,
    config.spawn.height,
    config.playerPosition.z + Math.sin(angle) * radius,
  );
}

export class EnemySystem extends Group {
  constructor({
    scene,
    config = GAMEPLAY_CONFIG.enemy,
    random = Math.random,
    typeRandom = Math.random,
    onEliminate = () => {},
    onPlayerContact = () => {},
    onResistanceChange = () => {},
  } = {}) {
    super();

    if (!scene?.add || !scene?.remove) {
      throw new Error('EnemySystem requer uma cena Three.js válida.');
    }

    validateConfig(config);
    assertCallback('random', random);
    assertCallback('typeRandom', typeRandom);
    assertCallback('onEliminate', onEliminate);
    assertCallback('onPlayerContact', onPlayerContact);
    assertCallback('onResistanceChange', onResistanceChange);

    this.name = 'ice-enemy';
    this.scene = scene;
    this.config = config;
    this.random = random;
    this.enemyType = selectEnemyType({
      types: config.types,
      random: typeRandom,
    });
    this.typeState = Object.freeze({
      id: this.enemyType.id,
      label: this.enemyType.label,
      damage: this.enemyType.damage,
    });
    this.onEliminate = onEliminate;
    this.onPlayerContact = onPlayerContact;
    this.onResistanceChange = onResistanceChange;
    this.currentResistance = this.enemyType.maxResistance;
    this.outcome = null;
    this.pendingPlayerContact = false;
    this.pendingContactFrameRatio = null;
    this.disposed = false;
    this.elapsedMovementSeconds = 0;
    this.previousElapsedMovementSeconds = 0;
    this.previousPosition = new Vector3();
    this.initialPosition = new Vector3();
    this.toPlayer = new Vector3();
    this.geometries = new Set();
    this.materials = new Set();

    this.createVisual();
    this.placeAtSpawn();
    this.scene.add(this);
  }

  createMaterial(options) {
    const material = new MeshStandardMaterial(options);
    this.materials.add(material);
    return material;
  }

  createGeometry(geometry) {
    this.geometries.add(geometry);
    return geometry;
  }

  createVisual() {
    const radius = this.config.radius;
    this.visual = new Group();
    this.visual.name = 'ice-enemy-visual';

    this.iceMaterial = this.createMaterial({
      color: this.enemyType.color,
      emissive: this.config.colors.emissive,
      emissiveIntensity: 0.28,
      metalness: 0.1,
      roughness: 0.46,
      flatShading: true,
    });
    const darkMaterial = this.createMaterial({
      color: this.config.colors.eyes,
      emissive: this.config.colors.eyes,
      emissiveIntensity: 0.42,
      metalness: 0,
      roughness: 0.8,
    });
    const hornMaterial = this.createMaterial({
      color: this.config.colors.horns,
      emissive: 0x315b6d,
      emissiveIntensity: 0.12,
      metalness: 0.04,
      roughness: 0.36,
      flatShading: true,
    });

    const bodyGeometry = this.createGeometry(
      new DodecahedronGeometry(radius * 0.62, 0),
    );
    const headGeometry = this.createGeometry(
      new IcosahedronGeometry(radius * 0.43, 1),
    );
    const limbGeometry = this.createGeometry(
      new BoxGeometry(radius * 0.22, radius * 0.7, radius * 0.24),
    );
    const eyeGeometry = this.createGeometry(
      new SphereGeometry(radius * 0.075, 10, 8),
    );
    const hornGeometry = this.createGeometry(
      new ConeGeometry(radius * 0.12, radius * 0.42, 5),
    );

    this.body = new Mesh(bodyGeometry, this.iceMaterial);
    this.body.name = 'ice-enemy-body';
    this.body.position.y = -radius * 0.08;
    this.body.scale.set(0.88, 1.08, 0.76);

    const head = new Mesh(headGeometry, this.iceMaterial);
    head.name = 'ice-enemy-head';
    head.position.set(0, radius * 0.56, radius * 0.02);
    head.scale.set(1, 0.9, 0.92);

    this.leftArm = new Mesh(limbGeometry, this.iceMaterial);
    this.leftArm.name = 'ice-enemy-left-arm';
    this.leftArm.position.set(-radius * 0.65, -radius * 0.02, 0);
    this.leftArm.rotation.z = -0.24;

    this.rightArm = new Mesh(limbGeometry, this.iceMaterial);
    this.rightArm.name = 'ice-enemy-right-arm';
    this.rightArm.position.set(radius * 0.65, -radius * 0.02, 0);
    this.rightArm.rotation.z = 0.24;

    const leftEye = new Mesh(eyeGeometry, darkMaterial);
    leftEye.position.set(-radius * 0.15, radius * 0.6, radius * 0.39);
    const rightEye = new Mesh(eyeGeometry, darkMaterial);
    rightEye.position.set(radius * 0.15, radius * 0.6, radius * 0.39);

    const leftHorn = new Mesh(hornGeometry, hornMaterial);
    leftHorn.position.set(-radius * 0.24, radius * 0.96, 0);
    leftHorn.rotation.z = -0.18;
    const rightHorn = new Mesh(hornGeometry, hornMaterial);
    rightHorn.position.set(radius * 0.24, radius * 0.96, 0);
    rightHorn.rotation.z = 0.18;

    this.visual.add(
      this.body,
      head,
      this.leftArm,
      this.rightArm,
      leftEye,
      rightEye,
      leftHorn,
      rightHorn,
    );
    this.add(this.visual);
  }

  get alive() {
    return this.active;
  }

  get active() {
    return (
      !this.disposed &&
      this.outcome === null &&
      this.currentResistance > 0
    );
  }

  get resistance() {
    return this.currentResistance;
  }

  get maxResistance() {
    return this.enemyType.maxResistance;
  }

  get radius() {
    return this.config.radius;
  }

  get isMoving() {
    return this.active && !this.pendingPlayerContact;
  }

  get playerContactFrameRatio() {
    return this.pendingPlayerContact
      ? this.pendingContactFrameRatio
      : null;
  }

  get distanceToPlayer() {
    const deltaX = this.position.x - this.config.playerPosition.x;
    const deltaZ = this.position.z - this.config.playerPosition.z;
    return Math.hypot(deltaX, deltaZ);
  }

  get state() {
    return Object.freeze({
      active: this.active,
      outcome: this.outcome,
      resistance: this.currentResistance,
      maxResistance: this.maxResistance,
      ratio: this.currentResistance / this.maxResistance,
      type: this.typeState,
      distanceToPlayer: this.distanceToPlayer,
    });
  }

  placeAtSpawn() {
    createEnemySpawnPosition({
      config: this.config,
      random: this.random,
      target: this.initialPosition,
    });
    this.position.copy(this.initialPosition);
    this.previousPosition.copy(this.initialPosition);
    this.facePlayer();
    this.updateMotionVisual();
  }

  facePlayer() {
    this.lookAt(
      this.config.playerPosition.x,
      this.position.y,
      this.config.playerPosition.z,
    );
  }

  getCenter(target = new Vector3()) {
    if (!target?.setFromMatrixPosition) {
      throw new TypeError('EnemySystem requer um Vector3 para o centro.');
    }

    this.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(this.matrixWorld);
  }

  getPreviousCenter(target = new Vector3()) {
    if (!target?.copy || !target?.applyMatrix4) {
      throw new TypeError(
        'EnemySystem requer um Vector3 para o centro anterior.',
      );
    }

    target.copy(this.previousPosition);

    if (this.parent) {
      this.parent.updateWorldMatrix(true, false);
      target.applyMatrix4(this.parent.matrixWorld);
    }

    return target;
  }

  update(deltaSeconds) {
    if (this.disposed) {
      return false;
    }

    this.previousPosition.copy(this.position);
    this.previousElapsedMovementSeconds = this.elapsedMovementSeconds;
    const numericDelta = Number(deltaSeconds);
    const delta = Number.isFinite(numericDelta)
      ? Math.max(0, numericDelta)
      : 0;

    if (delta === 0 || !this.isMoving) {
      return true;
    }

    this.elapsedMovementSeconds += delta;
    this.toPlayer.set(
      this.config.playerPosition.x - this.position.x,
      0,
      this.config.playerPosition.z - this.position.z,
    );
    const distance = this.toPlayer.length();
    const remainingDistance = Math.max(
      0,
      distance - this.config.playerContactRadius,
    );
    const travelDistance = this.config.moveSpeed * delta;

    if (distance > 0 && remainingDistance > 0) {
      this.position.addScaledVector(
        this.toPlayer,
        Math.min(travelDistance, remainingDistance) / distance,
      );
    }

    if (travelDistance >= remainingDistance) {
      this.pendingPlayerContact = true;
      this.pendingContactFrameRatio =
        travelDistance === 0
          ? 0
          : Math.min(Math.max(remainingDistance / travelDistance, 0), 1);
    }

    this.facePlayer();
    this.updateMotionVisual();
    return true;
  }

  updateMotionVisual() {
    const { animation } = this.config;
    const phase = this.elapsedMovementSeconds * animation.bobAngularSpeed;
    const motion = this.isMoving ? Math.sin(phase) : 0;
    this.visual.position.y = motion * animation.bobAmplitude;
    this.leftArm.rotation.x = motion * animation.limbSwingAmplitude;
    this.rightArm.rotation.x = -motion * animation.limbSwingAmplitude;
  }

  pauseAtFrameRatio(frameRatio) {
    if (
      this.disposed ||
      !Number.isFinite(frameRatio) ||
      frameRatio < 0 ||
      frameRatio > 1
    ) {
      return false;
    }

    this.position.lerpVectors(
      this.previousPosition,
      this.position,
      frameRatio,
    );
    this.elapsedMovementSeconds =
      this.previousElapsedMovementSeconds +
      (this.elapsedMovementSeconds - this.previousElapsedMovementSeconds) *
        frameRatio;
    this.previousPosition.copy(this.position);
    this.previousElapsedMovementSeconds = this.elapsedMovementSeconds;
    this.pendingPlayerContact = false;
    this.pendingContactFrameRatio = null;
    this.facePlayer();
    this.updateMotionVisual();
    return true;
  }

  applyHit(amount = 1) {
    if (!this.active) {
      return false;
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new RangeError('A força do acerto deve ser um inteiro positivo.');
    }

    this.currentResistance = Math.max(0, this.currentResistance - amount);

    if (this.currentResistance === 0) {
      this.outcome = 'eliminated';
      this.pendingPlayerContact = false;
      this.pendingContactFrameRatio = null;
    }

    this.updateVisualState();
    const state = this.state;
    let callbackError = null;

    try {
      this.onResistanceChange(state);
    } catch (error) {
      callbackError = error;
    }

    if (this.outcome === 'eliminated') {
      this.scene.remove(this);

      try {
        this.onEliminate(state);
      } catch (error) {
        callbackError ??= error;
      }
    }

    if (callbackError) {
      throw callbackError;
    }

    return true;
  }

  resolvePlayerContact() {
    if (!this.active || !this.pendingPlayerContact) {
      return false;
    }

    this.pendingPlayerContact = false;
    this.pendingContactFrameRatio = null;
    this.outcome = 'player-contact';
    this.updateMotionVisual();
    this.scene.remove(this);
    this.onPlayerContact(this.state);
    return true;
  }

  updateVisualState() {
    if (this.currentResistance === 0) {
      this.iceMaterial.color.setHex(this.config.colors.destroyed);
      this.iceMaterial.emissive.setHex(0x000000);
      this.iceMaterial.emissiveIntensity = 0;
      this.visual.scale.setScalar(0.72);
      this.visual.rotation.z = Math.PI / 8;
      return;
    }

    const damaged =
      this.currentResistance < this.maxResistance;
    this.iceMaterial.color.setHex(
      damaged ? this.config.colors.damaged : this.enemyType.color,
    );
    this.iceMaterial.emissive.setHex(this.config.colors.emissive);
    this.iceMaterial.emissiveIntensity = damaged ? 0.16 : 0.28;
    this.visual.scale.setScalar(1);
    this.visual.rotation.z = 0;
  }

  reset() {
    if (this.disposed) {
      return false;
    }

    this.currentResistance = this.maxResistance;
    this.outcome = null;
    this.pendingPlayerContact = false;
    this.pendingContactFrameRatio = null;
    this.elapsedMovementSeconds = 0;
    this.previousElapsedMovementSeconds = 0;
    this.updateVisualState();
    this.placeAtSpawn();

    if (this.parent !== this.scene) {
      this.scene.add(this);
    }

    return true;
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.scene.remove(this);

    for (const geometry of this.geometries) {
      geometry.dispose();
    }

    for (const material of this.materials) {
      material.dispose();
    }

    this.onEliminate = () => {};
    this.onPlayerContact = () => {};
    this.onResistanceChange = () => {};
    this.disposed = true;
    return true;
  }
}
