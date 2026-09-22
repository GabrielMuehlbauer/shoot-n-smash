import {
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
import {
  BOSS_GOLEM_GAME_HEIGHT,
  BOSS_GOLEM_SOURCE_HEIGHT,
  createCachedBossGolemAsset,
  createBossGolemRig,
  disposeBossGolemAsset,
  loadBossGolemAsset,
  preloadBossGolemAsset,
  updateBossGolemPose,
} from './BossGolemAsset.js';
import { selectEnemyType, validateEnemyTypes } from './EnemyTypes.js';
import { FlyingEnemyController } from './FlyingEnemyController.js';
import { FlyingIceEnemyVisual } from './FlyingIceEnemyVisual.js';
import {
  createCachedMediumGolemAsset,
  createMediumGolemRig,
  disposeMediumGolemAsset,
  loadMediumGolemAsset,
  MEDIUM_GOLEM_GAME_HEIGHT,
  MEDIUM_GOLEM_SOURCE_HEIGHT,
  preloadMediumGolemAsset,
} from './MediumGolemAsset.js';
import {
  createCachedResistantGolemAsset,
  createResistantGolemRig,
  disposeResistantGolemAsset,
  loadResistantGolemAsset,
  preloadResistantGolemAsset,
  RESISTANT_GOLEM_GAME_HEIGHT,
  RESISTANT_GOLEM_SOURCE_HEIGHT,
} from './ResistantGolemAsset.js';
import {
  createCachedWeakGolemAsset,
  createWeakGolemRig,
  disposeWeakGolemAsset,
  loadWeakGolemAsset,
  preloadWeakGolemAsset,
  WEAK_GOLEM_GAME_HEIGHT,
  WEAK_GOLEM_SOURCE_HEIGHT,
} from './WeakGolemAsset.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FULL_CIRCLE = Math.PI * 2;

export async function preloadEnemyAssets({
  bossAssetLoader = new GLTFLoader(),
  weakAssetLoader = new GLTFLoader(),
  mediumAssetLoader = new GLTFLoader(),
  resistantAssetLoader = new GLTFLoader(),
} = {}) {
  const requests = [
    [bossAssetLoader, preloadBossGolemAsset],
    [weakAssetLoader, preloadWeakGolemAsset],
    [mediumAssetLoader, preloadMediumGolemAsset],
    [resistantAssetLoader, preloadResistantGolemAsset],
  ]
    .filter(([loader]) => loader)
    .map(([loader, preload]) => preload({ loader }));
  const results = await Promise.allSettled(requests);
  return results.every(({ status }) => status === 'fulfilled');
}

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
    ['collisionRadius', config.flying?.collisionRadius],
    ['spawnHeight', config.flying?.spawnHeight],
    ['projectileSpeed', config.flying?.projectileSpeed],
    ['projectileLifetimeSeconds', config.flying?.projectileLifetimeSeconds],
    ['projectileRadius', config.flying?.projectileRadius],
  ]) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`enemy.flying.${name} deve ser maior que zero.`);
    }
  }

  if (!Number.isInteger(config.flying?.projectileDamage) || config.flying.projectileDamage <= 0) {
    throw new RangeError('enemy.flying.projectileDamage deve ser um inteiro positivo.');
  }

  for (const [name, value] of [
    ['bobAmplitude', config.animation?.bobAmplitude],
    ['bobAngularSpeed', config.animation?.bobAngularSpeed],
    ['limbSwingAmplitude', config.animation?.limbSwingAmplitude],
    ['hitPulseDurationSeconds', config.animation?.hitPulseDurationSeconds],
    ['hitPulseScale', config.animation?.hitPulseScale],
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

function resolveTypePool(types, typeIds = null) {
  validateEnemyTypes(types);

  if (typeIds === null) {
    return types;
  }

  if (
    !Array.isArray(typeIds) ||
    typeIds.length === 0 ||
    typeIds.some((id) => typeof id !== 'string' || id.length === 0) ||
    new Set(typeIds).size !== typeIds.length
  ) {
    throw new TypeError('EnemySystem requer typeIds únicos e não vazios.');
  }

  const descriptorsById = new Map(types.map((type) => [type.id, type]));
  const typePool = typeIds.map((id) => descriptorsById.get(id));

  if (typePool.some((type) => !type)) {
    throw new RangeError('EnemySystem recebeu um typeId desconhecido.');
  }

  return typePool;
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
    typeIds = null,
    moveSpeed = config.moveSpeed,
    onEliminate = () => {},
    onAttack = () => {},
    onPlayerContact = () => {},
    onResistanceChange = () => {},
    bossAssetLoader = globalThis.document ? new GLTFLoader() : null,
    weakAssetLoader = globalThis.document ? new GLTFLoader() : null,
    mediumAssetLoader = globalThis.document ? new GLTFLoader() : null,
    resistantAssetLoader = globalThis.document ? new GLTFLoader() : null,
  } = {}) {
    super();

    if (!scene?.add || !scene?.remove) {
      throw new Error('EnemySystem requer uma cena Three.js válida.');
    }

    validateConfig(config);
    assertCallback('random', random);
    assertCallback('typeRandom', typeRandom);
    assertCallback('onEliminate', onEliminate);
    assertCallback('onAttack', onAttack);
    assertCallback('onPlayerContact', onPlayerContact);
    assertCallback('onResistanceChange', onResistanceChange);

    this.name = 'ice-enemy';
    this.scene = scene;
    this.config = config;
    this.random = random;
    this.typeRandom = typeRandom;
    this.currentMoveSpeed = this.validateMoveSpeed(moveSpeed);
    this.currentRadius = config.radius;
    this.currentVisualScale = 1;
    this.currentSpawnHeight = config.spawn.height;
    this.typeIds = null;
    this.selectType(typeIds);
    this.syncSpatialConfig();
    this.currentVisualScale = this.enemyType.visualScale ?? 1;
    this.onEliminate = onEliminate;
    this.onAttack = onAttack;
    this.onPlayerContact = onPlayerContact;
    this.onResistanceChange = onResistanceChange;
    this.currentResistance = this.enemyType.maxResistance;
    this.outcome = null;
    this.pendingPlayerContact = false;
    this.pendingContactFrameRatio = null;
    this.disposed = false;
    this.elapsedMovementSeconds = 0;
    this.previousElapsedMovementSeconds = 0;
    this.hitPulseRemainingSeconds = 0;
    this.previousPosition = new Vector3();
    this.initialPosition = new Vector3();
    this.toPlayer = new Vector3();
    this.projectilePreviousPosition = new Vector3();
    this.projectileDirection = new Vector3();
    this.projectileToPlayer = new Vector3();
    this.projectileClosestPoint = new Vector3();
    this.geometries = new Set();
    this.materials = new Set();
    this.bossAssetLoader = bossAssetLoader;
    this.bossAssetPromise = null;
    this.bossAsset = null;
    this.bossRig = null;
    this.bossAssetError = null;
    this.weakAssetLoader = weakAssetLoader;
    this.weakAssetPromise = null;
    this.weakAsset = null;
    this.weakRig = null;
    this.weakAssetError = null;
    this.mediumAssetLoader = mediumAssetLoader;
    this.mediumAssetPromise = null;
    this.mediumAsset = null;
    this.mediumRig = null;
    this.mediumAssetError = null;
    this.resistantAssetLoader = resistantAssetLoader;
    this.resistantAssetPromise = null;
    this.resistantAsset = null;
    this.resistantRig = null;
    this.resistantAssetError = null;
    this.flyingController = new FlyingEnemyController(config.flying);
    this.flyingVisual = null;
    this.flyingProjectile = null;
    this.flyingProjectileActive = false;
    this.flyingProjectileRemainingSeconds = 0;
    this.flyingEliminationNotified = false;

    this.createVisual();
    this.flyingVisual = new FlyingIceEnemyVisual();
    this.add(this.flyingVisual.root);
    this.flyingProjectile = this.flyingVisual.createProjectile();
    this.syncModelAssets();
    this.placeAtSpawn();
    this.scene.add(this);
  }

  createMaterial(options) {
    const material = new MeshStandardMaterial(options);
    this.materials.add(material);
    return material;
  }

  validateMoveSpeed(moveSpeed) {
    if (!Number.isFinite(moveSpeed) || moveSpeed <= 0) {
      throw new RangeError('EnemySystem requer moveSpeed maior que zero.');
    }

    return moveSpeed;
  }

  get isFlying() {
    return this.enemyType?.id === 'flying';
  }

  syncSpatialConfig() {
    this.currentRadius = this.isFlying
      ? this.config.flying.collisionRadius
      : this.config.radius;
    this.currentSpawnHeight = this.isFlying
      ? this.config.flying.spawnHeight
      : this.config.spawn.height;
  }

  selectType(typeIds = this.typeIds) {
    const typePool = resolveTypePool(this.config.types, typeIds);
    this.enemyType = selectEnemyType({
      types: typePool,
      random: this.typeRandom,
    });
    this.typeIds = typeIds === null ? null : Object.freeze([...typeIds]);
    this.typeState = Object.freeze({
      id: this.enemyType.id,
      label: this.enemyType.label,
      damage: this.enemyType.damage,
    });
  }

  selectExactType(type) {
    validateEnemyTypes([type]);
    this.enemyType = selectEnemyType({
      types: [type],
      random: () => 0,
    });
    this.typeIds = null;
    this.typeState = Object.freeze({
      id: this.enemyType.id,
      label: this.enemyType.label,
      damage: this.enemyType.damage,
    });
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
    const eyeMaterial = this.createMaterial({
      color: this.config.colors.eyes,
      emissive: this.config.colors.eyes,
      emissiveIntensity: 1.25,
      metalness: 0,
      roughness: 0.3,
    });
    const shadowMaterial = this.createMaterial({
      color: 0x102f43,
      emissive: 0x06121c,
      emissiveIntensity: 0.16,
      metalness: 0,
      roughness: 0.78,
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
      new DodecahedronGeometry(radius * 0.34, 0),
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

    this.head = new Mesh(headGeometry, this.iceMaterial);
    this.head.name = 'ice-enemy-head';
    this.head.position.set(0, radius * 0.56, radius * 0.02);
    this.head.scale.set(1, 0.9, 0.92);

    this.faceDetails = new Group();
    this.faceDetails.name = 'ice-enemy-face-details';
    this.jaw = new Mesh(headGeometry, this.iceMaterial);
    this.jaw.name = 'ice-enemy-jaw';
    this.mouth = new Mesh(headGeometry, shadowMaterial);
    this.mouth.name = 'ice-enemy-mouth';
    this.leftBrow = new Mesh(hornGeometry, hornMaterial);
    this.rightBrow = new Mesh(hornGeometry, hornMaterial);
    this.leftFang = new Mesh(hornGeometry, hornMaterial);
    this.rightFang = new Mesh(hornGeometry, hornMaterial);
    this.faceDetails.add(
      this.jaw,
      this.mouth,
      this.leftBrow,
      this.rightBrow,
      this.leftFang,
      this.rightFang,
    );

    this.leftArm = new Mesh(limbGeometry, this.iceMaterial);
    this.leftArm.name = 'ice-enemy-left-arm';
    this.leftArm.position.set(-radius * 0.65, -radius * 0.02, 0);
    this.leftArm.rotation.z = -0.24;

    this.rightArm = new Mesh(limbGeometry, this.iceMaterial);
    this.rightArm.name = 'ice-enemy-right-arm';
    this.rightArm.position.set(radius * 0.65, -radius * 0.02, 0);
    this.rightArm.rotation.z = 0.24;

    this.leftLeg = new Mesh(limbGeometry, this.iceMaterial);
    this.leftLeg.name = 'ice-enemy-left-leg';
    this.rightLeg = new Mesh(limbGeometry, this.iceMaterial);
    this.rightLeg.name = 'ice-enemy-right-leg';
    this.leftFoot = new Mesh(limbGeometry, this.iceMaterial);
    this.leftFoot.name = 'ice-enemy-left-foot';
    this.rightFoot = new Mesh(limbGeometry, this.iceMaterial);
    this.rightFoot.name = 'ice-enemy-right-foot';
    this.leftHand = new Mesh(limbGeometry, this.iceMaterial);
    this.leftHand.name = 'ice-enemy-left-hand';
    this.rightHand = new Mesh(limbGeometry, this.iceMaterial);
    this.rightHand.name = 'ice-enemy-right-hand';

    this.clawDetails = new Group();
    this.clawDetails.name = 'ice-enemy-claws';
    this.claws = [];
    for (const side of [-1, 1]) {
      for (const offset of [-1, 0, 1]) {
        const claw = new Mesh(hornGeometry, hornMaterial);
        claw.rotation.z = Math.PI;
        this.claws.push({ claw, offset, side });
        this.clawDetails.add(claw);
      }
    }

    this.leftEye = new Mesh(eyeGeometry, eyeMaterial);
    this.leftEye.position.set(-radius * 0.15, radius * 0.6, radius * 0.39);
    this.rightEye = new Mesh(eyeGeometry, eyeMaterial);
    this.rightEye.position.set(radius * 0.15, radius * 0.6, radius * 0.39);

    this.leftHorn = new Mesh(hornGeometry, hornMaterial);
    this.leftHorn.position.set(-radius * 0.24, radius * 0.96, 0);
    this.leftHorn.rotation.z = -0.18;
    this.rightHorn = new Mesh(hornGeometry, hornMaterial);
    this.rightHorn.position.set(radius * 0.24, radius * 0.96, 0);
    this.rightHorn.rotation.z = 0.18;

    this.typeDetails = new Group();
    this.typeDetails.name = 'ice-enemy-type-details';
    this.weakAdornment = new Group();
    this.weakAdornment.name = 'ice-enemy-weak-spikes';
    this.mediumAdornment = new Group();
    this.mediumAdornment.name = 'ice-enemy-medium-crystals';
    this.resistantAdornment = new Group();
    this.resistantAdornment.name = 'ice-enemy-resistant-armor';
    this.bossAdornment = new Group();
    this.bossAdornment.name = 'ice-enemy-boss-crown';

    for (const side of [-1, 1]) {
      const iceEar = new Mesh(hornGeometry, hornMaterial);
      iceEar.position.set(side * radius * 0.52, radius * 0.58, 0);
      iceEar.rotation.z = side * -1.18;
      iceEar.scale.set(0.82, 1.28, 0.82);
      this.weakAdornment.add(iceEar);

      const shoulderCrystal = new Mesh(hornGeometry, hornMaterial);
      shoulderCrystal.position.set(side * radius * 0.67, radius * 0.25, 0);
      shoulderCrystal.rotation.z = side * -0.78;
      shoulderCrystal.scale.setScalar(0.85);
      this.mediumAdornment.add(shoulderCrystal);

      const elbowCrystal = new Mesh(hornGeometry, hornMaterial);
      elbowCrystal.position.set(side * radius * 0.82, -radius * 0.06, 0);
      elbowCrystal.rotation.z = side * -1.12;
      elbowCrystal.scale.set(0.72, 1.15, 0.72);
      this.mediumAdornment.add(elbowCrystal);

      const shoulderArmor = new Mesh(bodyGeometry, this.iceMaterial);
      shoulderArmor.position.set(side * radius * 0.7, radius * 0.16, 0);
      shoulderArmor.scale.set(0.28, 0.24, 0.42);
      this.resistantAdornment.add(shoulderArmor);

      const forearmArmor = new Mesh(bodyGeometry, hornMaterial);
      forearmArmor.position.set(side * radius * 0.82, -radius * 0.27, 0);
      forearmArmor.scale.set(0.27, 0.38, 0.38);
      this.resistantAdornment.add(forearmArmor);

      const backCrystal = new Mesh(hornGeometry, hornMaterial);
      backCrystal.position.set(
        side * radius * 0.48,
        radius * 0.48,
        -radius * 0.3,
      );
      backCrystal.rotation.z = side * -0.42;
      backCrystal.scale.set(1.15, 1.75, 1.15);
      this.resistantAdornment.add(backCrystal);

      const crownSide = new Mesh(hornGeometry, hornMaterial);
      crownSide.position.set(side * radius * 0.34, radius * 1.13, -radius * 0.02);
      crownSide.rotation.z = side * -0.28;
      crownSide.scale.setScalar(1.12);
      this.bossAdornment.add(crownSide);

      const titanShoulder = new Mesh(hornGeometry, hornMaterial);
      titanShoulder.position.set(
        side * radius * 0.82,
        radius * 0.38,
        -radius * 0.05,
      );
      titanShoulder.rotation.z = side * -0.82;
      titanShoulder.scale.set(1.5, 2.4, 1.5);
      this.bossAdornment.add(titanShoulder);

      const titanForearm = new Mesh(hornGeometry, hornMaterial);
      titanForearm.position.set(
        side * radius * 0.92,
        -radius * 0.23,
        radius * 0.04,
      );
      titanForearm.rotation.z = side * -1.04;
      titanForearm.scale.set(1.35, 2.05, 1.35);
      this.bossAdornment.add(titanForearm);
    }

    const impCrest = new Mesh(hornGeometry, hornMaterial);
    impCrest.position.set(0, radius * 1.02, 0);
    impCrest.scale.set(0.92, 1.32, 0.92);
    this.weakAdornment.add(impCrest);

    const mediumChestCrystal = new Mesh(hornGeometry, hornMaterial);
    mediumChestCrystal.position.set(0, radius * 0.08, radius * 0.58);
    mediumChestCrystal.rotation.x = Math.PI / 2;
    mediumChestCrystal.scale.set(0.82, 1.28, 0.82);
    this.mediumAdornment.add(mediumChestCrystal);

    const chestArmor = new Mesh(limbGeometry, hornMaterial);
    chestArmor.position.set(0, radius * 0.1, radius * 0.52);
    chestArmor.rotation.z = Math.PI / 2;
    chestArmor.scale.set(0.72, 1.45, 0.42);
    this.resistantAdornment.add(chestArmor);

    const helmetCrest = new Mesh(hornGeometry, hornMaterial);
    helmetCrest.position.set(0, radius * 1.03, 0);
    helmetCrest.scale.set(1.18, 1.65, 1.18);
    this.resistantAdornment.add(helmetCrest);

    const crownCenter = new Mesh(hornGeometry, hornMaterial);
    crownCenter.position.set(0, radius * 1.2, -radius * 0.04);
    crownCenter.scale.setScalar(1.45);
    this.bossAdornment.add(crownCenter);

    const titanBeard = new Mesh(hornGeometry, this.iceMaterial);
    titanBeard.position.set(0, radius * 0.27, radius * 0.38);
    titanBeard.rotation.z = Math.PI;
    titanBeard.scale.set(1.3, 2.25, 1.3);
    this.bossAdornment.add(titanBeard);

    const titanCore = new Mesh(eyeGeometry, eyeMaterial);
    titanCore.position.set(0, radius * 0.08, radius * 0.66);
    titanCore.scale.setScalar(2.8);
    this.bossAdornment.add(titanCore);
    this.typeDetails.add(
      this.weakAdornment,
      this.mediumAdornment,
      this.resistantAdornment,
      this.bossAdornment,
    );

    this.visual.add(
      this.body,
      this.head,
      this.leftArm,
      this.rightArm,
      this.leftHand,
      this.rightHand,
      this.leftLeg,
      this.rightLeg,
      this.leftFoot,
      this.rightFoot,
      this.leftEye,
      this.rightEye,
      this.leftHorn,
      this.rightHorn,
      this.faceDetails,
      this.clawDetails,
      this.typeDetails,
    );
    this.proceduralParts = [...this.visual.children];
    this.add(this.visual);
    this.syncTypeVisual();
  }

  requestBossAsset() {
    if (!this.bossAssetLoader) return null;
    if (this.bossAssetPromise) return this.bossAssetPromise;
    const cachedAsset = createCachedBossGolemAsset();
    if (cachedAsset) {
      this.bossAssetPromise = Promise.resolve(cachedAsset);
      try {
        this.attachBossAsset(cachedAsset);
      } catch (error) {
        this.bossAssetError = error;
        this.bossAssetPromise = Promise.resolve();
        console.warn('Falha ao preparar o modelo do chefão:', error);
      }
      return this.bossAssetPromise;
    }
    this.bossAssetPromise = loadBossGolemAsset({ loader: this.bossAssetLoader })
      .then((asset) => {
        if (this.disposed) {
          disposeBossGolemAsset(asset);
          return;
        }
        this.attachBossAsset(asset);
      })
      .catch((error) => {
        this.bossAssetError = error;
        console.warn('Falha ao carregar o modelo do chefão:', error);
      });
    return this.bossAssetPromise;
  }

  attachBossAsset(asset) {
    try {
      this.bossRig = createBossGolemRig(asset);
    } catch (error) {
      disposeBossGolemAsset(asset);
      throw error;
    }
    this.bossAsset = asset;
    this.visual.add(asset);
    this.syncModelAssets();
    this.updateMotionVisual();
  }

  preloadBossAsset() {
    if (this.disposed) {
      return false;
    }

    this.requestBossAsset();
    return Boolean(this.bossAssetPromise);
  }

  preloadModelAssets() {
    if (this.disposed) return false;
    this.requestWeakAsset();
    this.requestMediumAsset();
    this.requestResistantAsset();
    this.requestBossAsset();
    return true;
  }

  requestWeakAsset() {
    if (!this.weakAssetLoader || this.weakAssetPromise) return;
    const cachedAsset = createCachedWeakGolemAsset();
    if (cachedAsset) {
      this.weakAssetPromise = Promise.resolve(cachedAsset);
      try {
        this.attachWeakAsset(cachedAsset);
      } catch (error) {
        this.weakAssetError = error;
        this.weakAssetPromise = Promise.resolve();
        console.warn('Falha ao preparar o modelo do golem fraco:', error);
      }
      return;
    }
    this.weakAssetPromise = loadWeakGolemAsset({ loader: this.weakAssetLoader })
      .then((asset) => {
        if (this.disposed) {
          disposeWeakGolemAsset(asset);
          return;
        }
        this.attachWeakAsset(asset);
      })
      .catch((error) => {
        this.weakAssetError = error;
        console.warn('Falha ao carregar o modelo do golem fraco:', error);
      });
  }

  attachWeakAsset(asset) {
    try {
      this.weakRig = createWeakGolemRig(asset);
    } catch (error) {
      disposeWeakGolemAsset(asset);
      throw error;
    }
    this.weakAsset = asset;
    this.visual.add(asset);
    this.syncModelAssets();
    this.updateMotionVisual();
  }

  requestMediumAsset() {
    if (!this.mediumAssetLoader || this.mediumAssetPromise) return;
    const cachedAsset = createCachedMediumGolemAsset();
    if (cachedAsset) {
      this.mediumAssetPromise = Promise.resolve(cachedAsset);
      try {
        this.attachMediumAsset(cachedAsset);
      } catch (error) {
        this.mediumAssetError = error;
        this.mediumAssetPromise = Promise.resolve();
        console.warn('Falha ao preparar o modelo do golem médio:', error);
      }
      return;
    }
    this.mediumAssetPromise = loadMediumGolemAsset({ loader: this.mediumAssetLoader })
      .then((asset) => {
        if (this.disposed) {
          disposeMediumGolemAsset(asset);
          return;
        }
        this.attachMediumAsset(asset);
      })
      .catch((error) => {
        this.mediumAssetError = error;
        console.warn('Falha ao carregar o modelo do golem médio:', error);
      });
  }

  attachMediumAsset(asset) {
    try {
      this.mediumRig = createMediumGolemRig(asset);
    } catch (error) {
      disposeMediumGolemAsset(asset);
      throw error;
    }
    this.mediumAsset = asset;
    this.visual.add(asset);
    this.syncModelAssets();
    this.updateMotionVisual();
  }

  requestResistantAsset() {
    if (!this.resistantAssetLoader || this.resistantAssetPromise) return;
    const cachedAsset = createCachedResistantGolemAsset();
    if (cachedAsset) {
      this.resistantAssetPromise = Promise.resolve(cachedAsset);
      try {
        this.attachResistantAsset(cachedAsset);
      } catch (error) {
        this.resistantAssetError = error;
        this.resistantAssetPromise = Promise.resolve();
        console.warn('Falha ao preparar o modelo do golem resistente:', error);
      }
      return;
    }
    this.resistantAssetPromise = loadResistantGolemAsset({ loader: this.resistantAssetLoader })
      .then((asset) => {
        if (this.disposed) {
          disposeResistantGolemAsset(asset);
          return;
        }
        this.attachResistantAsset(asset);
      })
      .catch((error) => {
        this.resistantAssetError = error;
        console.warn('Falha ao carregar o modelo do golem resistente:', error);
      });
  }

  attachResistantAsset(asset) {
    try {
      this.resistantRig = createResistantGolemRig(asset);
    } catch (error) {
      disposeResistantGolemAsset(asset);
      throw error;
    }
    this.resistantAsset = asset;
    this.visual.add(asset);
    this.syncModelAssets();
    this.updateMotionVisual();
  }

  syncModelAssets() {
    const boss = this.enemyType.id === 'boss';
    const weak = this.enemyType.id === 'weak';
    const medium = this.enemyType.id === 'medium';
    const resistant = this.enemyType.id === 'resistant';
    const flying = this.isFlying;
    if (boss) this.requestBossAsset();
    if (weak) this.requestWeakAsset();
    if (medium) this.requestMediumAsset();
    if (resistant) this.requestResistantAsset();
    const externalAssetVisible =
      flying ||
      (boss && this.bossAsset) ||
      (weak && this.weakAsset) ||
      (medium && this.mediumAsset) ||
      (resistant && this.resistantAsset);
    for (const part of this.proceduralParts) {
      if (externalAssetVisible) {
        if (part.parent === this.visual) this.visual.remove(part);
      } else if (part.parent !== this.visual) {
        this.visual.add(part);
      }
    }
    if (this.flyingVisual) {
      this.flyingVisual.root.visible = flying;
    }
    if (this.bossAsset) {
      this.bossAsset.visible = boss;
      this.bossAsset.position.set(0, -this.config.radius, 0);
      this.bossAsset.scale.setScalar(
        BOSS_GOLEM_GAME_HEIGHT / (BOSS_GOLEM_SOURCE_HEIGHT * this.currentVisualScale),
      );
    }
    if (this.weakAsset) {
      this.weakAsset.visible = weak;
      this.weakAsset.position.set(0, -this.config.radius, 0);
      this.weakAsset.scale.setScalar(
        WEAK_GOLEM_GAME_HEIGHT / (WEAK_GOLEM_SOURCE_HEIGHT * this.currentVisualScale),
      );
    }
    if (this.mediumAsset) {
      this.mediumAsset.visible = medium;
      this.mediumAsset.position.set(0, -this.config.radius, 0);
      this.mediumAsset.scale.setScalar(
        MEDIUM_GOLEM_GAME_HEIGHT /
          (MEDIUM_GOLEM_SOURCE_HEIGHT * this.currentVisualScale),
      );
    }
    if (this.resistantAsset) {
      this.resistantAsset.visible = resistant;
      this.resistantAsset.position.set(0, -this.config.radius, 0);
      this.resistantAsset.scale.setScalar(
        RESISTANT_GOLEM_GAME_HEIGHT /
          (RESISTANT_GOLEM_SOURCE_HEIGHT * this.currentVisualScale),
      );
    }
  }

  syncTypeVisual() {
    const typeId = this.enemyType.id;
    const radius = this.config.radius;
    const profiles = {
      weak: {
        body: [0.92, 0.92, 0.86],
        head: [1.22, 1.12, 1.08],
        headY: 0.52,
        arm: [0.58, 0.9, 0.62],
        armX: 0.58,
        armY: -0.08,
        hand: [0.48, 0.52, 0.58],
        leg: [0.58, 0.72, 0.62],
        foot: [0.72, 0.4, 0.96],
        eye: 1.45,
        jaw: [0.76, 0.42, 0.62],
        feature: 0.82,
      },
      medium: {
        body: [1.18, 1.18, 0.92],
        head: [1, 0.92, 0.96],
        headY: 0.62,
        arm: [0.96, 1.5, 0.86],
        armX: 0.76,
        armY: 0,
        hand: [0.68, 0.62, 0.72],
        leg: [0.72, 0.9, 0.72],
        foot: [0.9, 0.48, 1.12],
        eye: 1,
        jaw: [0.78, 0.46, 0.64],
        feature: 1,
      },
      resistant: {
        body: [1.14, 1.2, 0.96],
        head: [0.96, 0.9, 0.96],
        headY: 0.64,
        arm: [0.96, 1.5, 0.9],
        armX: 0.78,
        armY: 0.02,
        hand: [0.78, 0.72, 0.82],
        leg: [0.86, 1.02, 0.84],
        foot: [1.02, 0.54, 1.22],
        eye: 0.86,
        jaw: [0.82, 0.48, 0.68],
        feature: 1.12,
      },
      boss: {
        body: [1.2, 1.25, 1],
        head: [0.94, 0.92, 0.96],
        headY: 0.68,
        arm: [1.05, 1.65, 0.96],
        armX: 0.84,
        armY: 0.04,
        hand: [0.86, 0.8, 0.9],
        leg: [0.94, 1.12, 0.9],
        foot: [1.12, 0.58, 1.3],
        eye: 0.82,
        jaw: [0.86, 0.52, 0.72],
        feature: 1.25,
      },
    };
    const profile = profiles[typeId] ?? profiles.medium;

    this.body.scale.set(...profile.body);
    this.head.position.set(0, radius * profile.headY, radius * 0.02);
    this.head.scale.set(...profile.head);
    this.jaw.position.set(
      0,
      radius * (profile.headY - 0.18),
      radius * 0.31,
    );
    this.jaw.scale.set(...profile.jaw);
    this.mouth.position.set(
      0,
      radius * (profile.headY - 0.2),
      radius * 0.48,
    );
    this.mouth.scale.set(0.44, 0.1, 0.2);

    for (const [side, brow, fang] of [
      [-1, this.leftBrow, this.leftFang],
      [1, this.rightBrow, this.rightFang],
    ]) {
      brow.position.set(
        side * radius * 0.16,
        radius * (profile.headY + 0.17),
        radius * 0.43,
      );
      brow.rotation.set(0, 0, side * 1.02);
      brow.scale.set(
        profile.feature * 0.32,
        profile.feature * 0.62,
        profile.feature * 0.26,
      );
      fang.position.set(
        side * radius * 0.14,
        radius * (profile.headY - 0.27),
        radius * 0.52,
      );
      fang.rotation.set(0, 0, Math.PI);
      fang.scale.setScalar(profile.feature * 0.34);
    }

    for (const [side, arm, leg, foot, eye, horn] of [
      [
        -1,
        this.leftArm,
        this.leftLeg,
        this.leftFoot,
        this.leftEye,
        this.leftHorn,
      ],
      [
        1,
        this.rightArm,
        this.rightLeg,
        this.rightFoot,
        this.rightEye,
        this.rightHorn,
      ],
    ]) {
      arm.position.set(
        side * radius * profile.armX,
        radius * profile.armY,
        0,
      );
      arm.rotation.set(0, 0, side * 0.24);
      arm.scale.set(...profile.arm);
      const hand = side < 0 ? this.leftHand : this.rightHand;
      hand.position.set(
        side * radius * (profile.armX + 0.02),
        radius * (profile.armY - 0.4),
        radius * 0.04,
      );
      hand.scale.set(...profile.hand);
      leg.position.set(side * radius * 0.28, -radius * 0.55, 0);
      leg.scale.set(...profile.leg);
      foot.position.set(
        side * radius * 0.3,
        -radius * 0.82,
        radius * 0.18,
      );
      foot.scale.set(...profile.foot);
      eye.position.set(
        side * radius * 0.15,
        radius * (profile.headY + 0.04),
        radius * 0.4,
      );
      eye.scale.setScalar(profile.eye);
      horn.visible = typeId !== 'resistant';
      horn.position.set(
        side * radius * (typeId === 'weak' ? 0.31 : 0.25),
        radius * (profile.headY + 0.4),
        0,
      );
      horn.rotation.set(0, 0, side * 0.22);
      horn.scale.setScalar(typeId === 'boss' ? 1.35 : 1);
    }

    for (const { claw, offset, side } of this.claws) {
      claw.position.set(
        side * radius * (profile.armX + 0.02) + offset * radius * 0.08,
        radius * (profile.armY - 0.63),
        radius * 0.18,
      );
      claw.scale.set(
        profile.feature * 0.24,
        profile.feature * 0.48,
        profile.feature * 0.24,
      );
    }

    this.weakAdornment.visible = typeId === 'weak';
    this.mediumAdornment.visible = typeId === 'medium';
    this.resistantAdornment.visible =
      typeId === 'resistant' || typeId === 'boss';
    this.bossAdornment.visible = typeId === 'boss';
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
    return this.currentRadius;
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
    const state = {
      active: this.active,
      outcome: this.outcome,
      resistance: this.currentResistance,
      maxResistance: this.maxResistance,
      ratio: this.currentResistance / this.maxResistance,
      type: this.typeState,
      distanceToPlayer: this.distanceToPlayer,
    };
    if (this.isFlying) state.flightState = this.flyingController.state;
    return Object.freeze(state);
  }

  placeAtSpawn() {
    createEnemySpawnPosition({
      config: this.config,
      random: this.random,
      target: this.initialPosition,
    });
    this.initialPosition.y = this.currentSpawnHeight;
    this.position.copy(this.initialPosition);
    this.previousPosition.copy(this.initialPosition);
    if (this.isFlying) {
      this.flyingController.reset(this.position, this.config.playerPosition);
    }
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

    if (delta === 0) {
      return true;
    }

    this.hitPulseRemainingSeconds = Math.max(
      0,
      this.hitPulseRemainingSeconds - delta,
    );

    if (this.isFlying) {
      this.elapsedMovementSeconds += delta;
      this.updateFlyingProjectile(delta);
      this.flyingController.update(delta, {
        position: this.position,
        playerPosition: this.config.playerPosition,
        moveSpeed: this.currentMoveSpeed,
        onDiveImpact: () => this.emitFlyingAttack(
          'dive',
          this.enemyType.damage,
        ),
        onRangedFire: () => this.launchFlyingProjectile(),
        onDeathComplete: () => this.completeFlyingElimination(),
      });
      if (this.flyingController.state !== 'death') this.facePlayer();
      this.updateMotionVisual();
      return true;
    }

    if (!this.isMoving) {
      this.updateMotionVisual();
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
    const travelDistance = this.currentMoveSpeed * delta;

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

  emitFlyingAttack(attackKind, damage) {
    if (!this.active || !this.isFlying) return false;
    this.onAttack(Object.freeze({
      ...this.state,
      attackKind,
      damage,
    }));
    return true;
  }

  launchFlyingProjectile() {
    if (!this.active || !this.isFlying || this.flyingProjectileActive) {
      return false;
    }

    this.flyingProjectile.position.copy(this.position);
    this.flyingProjectile.position.y += 0.1;
    this.projectileDirection.set(
      this.config.playerPosition.x - this.flyingProjectile.position.x,
      this.config.playerPosition.y - this.flyingProjectile.position.y,
      this.config.playerPosition.z - this.flyingProjectile.position.z,
    ).normalize();
    this.flyingProjectile.visible = true;
    this.flyingProjectileActive = true;
    this.flyingProjectileRemainingSeconds =
      this.config.flying.projectileLifetimeSeconds;
    this.scene.add(this.flyingProjectile);
    return true;
  }

  updateFlyingProjectile(delta) {
    if (!this.flyingProjectileActive) return false;

    this.projectilePreviousPosition.copy(this.flyingProjectile.position);
    this.flyingProjectile.position.addScaledVector(
      this.projectileDirection,
      this.config.flying.projectileSpeed * delta,
    );
    this.flyingProjectile.rotation.x += delta * 8;
    this.flyingProjectile.rotation.y += delta * 11;
    this.flyingProjectileRemainingSeconds -= delta;

    const segment = this.projectileClosestPoint.subVectors(
      this.flyingProjectile.position,
      this.projectilePreviousPosition,
    );
    const segmentLengthSq = segment.lengthSq();
    this.projectileToPlayer.set(
      this.config.playerPosition.x - this.projectilePreviousPosition.x,
      this.config.playerPosition.y - this.projectilePreviousPosition.y,
      this.config.playerPosition.z - this.projectilePreviousPosition.z,
    );
    const ratio = segmentLengthSq > 0
      ? Math.min(Math.max(this.projectileToPlayer.dot(segment) / segmentLengthSq, 0), 1)
      : 0;
    segment.multiplyScalar(ratio).add(this.projectilePreviousPosition);
    const hitDistance =
      this.config.playerContactRadius + this.config.flying.projectileRadius;
    const hit = segment.distanceToSquared(this.config.playerPosition) <= hitDistance ** 2;

    if (hit) {
      this.clearFlyingProjectile();
      this.emitFlyingAttack(
        'ice-projectile',
        this.config.flying.projectileDamage,
      );
      return true;
    }

    if (this.flyingProjectileRemainingSeconds <= 0) {
      this.clearFlyingProjectile();
    }
    return true;
  }

  clearFlyingProjectile() {
    if (!this.flyingProjectile) return false;
    this.scene.remove(this.flyingProjectile);
    this.flyingProjectile.visible = false;
    this.flyingProjectileActive = false;
    this.flyingProjectileRemainingSeconds = 0;
    return true;
  }

  completeFlyingElimination() {
    if (this.flyingEliminationNotified || this.outcome !== 'eliminated') {
      return false;
    }
    this.flyingEliminationNotified = true;
    this.clearFlyingProjectile();
    this.scene.remove(this);
    this.onEliminate(this.state);
    return true;
  }

  updateMotionVisual() {
    if (this.isFlying && this.flyingVisual) {
      const duration = this.config.animation.hitPulseDurationSeconds;
      const hitRatio = duration > 0
        ? this.hitPulseRemainingSeconds / duration
        : 0;
      this.visual.position.y = 0;
      this.flyingVisual.root.scale.setScalar(
        this.currentVisualScale * (1 + hitRatio * this.config.animation.hitPulseScale),
      );
      this.flyingVisual.update({
        elapsed: this.elapsedMovementSeconds,
        stateElapsed: this.flyingController.elapsed,
        state: this.flyingController.state,
        hitRatio,
      });
      return;
    }

    const { animation } = this.config;
    const phase = this.elapsedMovementSeconds * animation.bobAngularSpeed;
    const motion = this.isMoving ? Math.sin(phase) : 0;
    const groundOffset =
      this.enemyType.id === 'boss'
        ? this.currentVisualScale * this.config.radius - this.currentSpawnHeight
        : (this.currentVisualScale - 1) * this.config.radius;
    let verticalMotion = motion * animation.bobAmplitude;
    if (this.enemyType.id === 'boss' && this.bossRig) {
      const bossPose = updateBossGolemPose(this.bossRig, {
        phase: phase * 0.58,
        moving: this.isMoving,
      });
      verticalMotion = bossPose.verticalOffset;
    } else if (this.enemyType.id === 'weak' && this.weakRig) {
      const weakPose = updateBossGolemPose(this.weakRig, {
        phase: phase * 0.9,
        moving: this.isMoving,
      });
      verticalMotion = weakPose.verticalOffset * 0.65;
    } else if (this.enemyType.id === 'medium' && this.mediumRig) {
      const mediumPose = updateBossGolemPose(this.mediumRig, {
        phase: phase * 0.72,
        moving: this.isMoving,
      });
      verticalMotion = mediumPose.verticalOffset * 0.82;
    } else if (this.enemyType.id === 'resistant' && this.resistantRig) {
      const resistantPose = updateBossGolemPose(this.resistantRig, {
        phase: phase * 0.62,
        moving: this.isMoving,
      });
      verticalMotion = resistantPose.verticalOffset * 0.9;
    }
    this.visual.position.y = groundOffset + verticalMotion;
    this.leftArm.rotation.x = motion * animation.limbSwingAmplitude;
    this.rightArm.rotation.x = -motion * animation.limbSwingAmplitude;
    this.leftLeg.rotation.x = -motion * animation.limbSwingAmplitude * 0.28;
    this.rightLeg.rotation.x = motion * animation.limbSwingAmplitude * 0.28;

    if (this.currentResistance > 0) {
      const duration = animation.hitPulseDurationSeconds;
      const pulseProgress = duration > 0
        ? 1 - this.hitPulseRemainingSeconds / duration
        : 1;
      const pulse = this.hitPulseRemainingSeconds > 0
        ? Math.sin(pulseProgress * Math.PI) * animation.hitPulseScale
        : 0;
      this.visual.scale.setScalar(this.currentVisualScale * (1 + pulse));
    }
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
      this.hitPulseRemainingSeconds = 0;
      this.outcome = 'eliminated';
      this.pendingPlayerContact = false;
      this.pendingContactFrameRatio = null;
      if (this.isFlying) {
        this.clearFlyingProjectile();
        this.flyingController.beginDeath();
      }
    }

    if (this.currentResistance > 0) {
      this.hitPulseRemainingSeconds =
        this.config.animation.hitPulseDurationSeconds;
      if (this.isFlying) this.flyingController.registerHit();
    }

    this.updateVisualState();
    const state = this.state;
    let callbackError = null;

    try {
      this.onResistanceChange(state);
    } catch (error) {
      callbackError = error;
    }

    if (this.outcome === 'eliminated' && !this.isFlying) {
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
    this.syncTypeVisual();
    this.syncModelAssets();

    if (this.isFlying) {
      this.flyingVisual.root.scale.setScalar(this.currentVisualScale);
      this.visual.rotation.z = 0;
      return;
    }

    if (this.currentResistance === 0) {
      this.iceMaterial.color.setHex(this.config.colors.destroyed);
      this.iceMaterial.emissive.setHex(0x000000);
      this.iceMaterial.emissiveIntensity = 0;
      this.visual.scale.setScalar(this.currentVisualScale * 0.72);
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
    this.visual.scale.setScalar(this.currentVisualScale);
    this.visual.rotation.z = 0;
  }

  reset({
    rerollType = false,
    typeIds = this.typeIds,
    enemyType = null,
    moveSpeed = this.currentMoveSpeed,
    radius = this.currentRadius,
    visualScale = null,
    spawnHeight = this.currentSpawnHeight,
  } = {}) {
    if (this.disposed) {
      return false;
    }

    if (typeof rerollType !== 'boolean') {
      throw new TypeError('EnemySystem requer rerollType booleano.');
    }

    const nextMoveSpeed = this.validateMoveSpeed(moveSpeed);

    for (const [name, value] of [['radius', radius]]) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`EnemySystem requer ${name} maior que zero.`);
      }
    }

    if (!Number.isFinite(spawnHeight) || spawnHeight < 0) {
      throw new RangeError('EnemySystem requer spawnHeight não negativo.');
    }

    if (enemyType !== null && rerollType) {
      throw new TypeError('EnemySystem não combina enemyType com rerollType.');
    }

    if (enemyType !== null) {
      this.selectExactType(enemyType);
    } else if (rerollType) {
      this.selectType(typeIds);
    }

    const nextVisualScale = visualScale ?? this.enemyType.visualScale ?? 1;

    if (!Number.isFinite(nextVisualScale) || nextVisualScale <= 0) {
      throw new RangeError('EnemySystem requer visualScale maior que zero.');
    }

    this.currentMoveSpeed = nextMoveSpeed;
    this.currentRadius = this.isFlying
      ? this.config.flying.collisionRadius
      : radius;
    this.currentVisualScale = nextVisualScale;
    this.currentSpawnHeight = this.isFlying
      ? this.config.flying.spawnHeight
      : spawnHeight;

    this.currentResistance = this.maxResistance;
    this.outcome = null;
    this.pendingPlayerContact = false;
    this.pendingContactFrameRatio = null;
    this.elapsedMovementSeconds = 0;
    this.previousElapsedMovementSeconds = 0;
    this.hitPulseRemainingSeconds = 0;
    this.flyingEliminationNotified = false;
    this.clearFlyingProjectile();
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
    this.clearFlyingProjectile();

    if (this.bossAsset) {
      disposeBossGolemAsset(this.bossAsset);
      this.visual.remove(this.bossAsset);
      this.bossAsset = null;
      this.bossRig = null;
    }
    if (this.weakAsset) {
      disposeWeakGolemAsset(this.weakAsset);
      this.visual.remove(this.weakAsset);
      this.weakAsset = null;
      this.weakRig = null;
    }
    if (this.mediumAsset) {
      disposeMediumGolemAsset(this.mediumAsset);
      this.visual.remove(this.mediumAsset);
      this.mediumAsset = null;
      this.mediumRig = null;
    }
    if (this.resistantAsset) {
      disposeResistantGolemAsset(this.resistantAsset);
      this.visual.remove(this.resistantAsset);
      this.resistantAsset = null;
      this.resistantRig = null;
    }

    for (const geometry of this.geometries) {
      geometry.dispose();
    }

    for (const material of this.materials) {
      material.dispose();
    }

    this.flyingVisual?.dispose();

    this.onEliminate = () => {};
    this.onAttack = () => {};
    this.onPlayerContact = () => {};
    this.onResistanceChange = () => {};
    this.disposed = true;
    return true;
  }
}
