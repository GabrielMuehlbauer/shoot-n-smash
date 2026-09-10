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
    this.typeRandom = typeRandom;
    this.currentMoveSpeed = this.validateMoveSpeed(moveSpeed);
    this.currentRadius = config.radius;
    this.currentVisualScale = 1;
    this.currentSpawnHeight = config.spawn.height;
    this.typeIds = null;
    this.selectType(typeIds);
    this.currentVisualScale = this.enemyType.visualScale ?? 1;
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
    this.hitPulseRemainingSeconds = 0;
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

  validateMoveSpeed(moveSpeed) {
    if (!Number.isFinite(moveSpeed) || moveSpeed <= 0) {
      throw new RangeError('EnemySystem requer moveSpeed maior que zero.');
    }

    return moveSpeed;
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
    this.add(this.visual);
    this.syncTypeVisual();
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
    this.initialPosition.y = this.currentSpawnHeight;
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

    if (delta === 0) {
      return true;
    }

    this.hitPulseRemainingSeconds = Math.max(
      0,
      this.hitPulseRemainingSeconds - delta,
    );

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

  updateMotionVisual() {
    const { animation } = this.config;
    const phase = this.elapsedMovementSeconds * animation.bobAngularSpeed;
    const motion = this.isMoving ? Math.sin(phase) : 0;
    const groundOffset =
      this.enemyType.id === 'boss'
        ? this.currentVisualScale * this.config.radius - this.currentSpawnHeight
        : (this.currentVisualScale - 1) * this.config.radius;
    this.visual.position.y = groundOffset + motion * animation.bobAmplitude;
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
    }

    if (this.currentResistance > 0) {
      this.hitPulseRemainingSeconds =
        this.config.animation.hitPulseDurationSeconds;
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
    this.syncTypeVisual();

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
    this.currentRadius = radius;
    this.currentVisualScale = nextVisualScale;
    this.currentSpawnHeight = spawnHeight;

    this.currentResistance = this.maxResistance;
    this.outcome = null;
    this.pendingPlayerContact = false;
    this.pendingContactFrameRatio = null;
    this.elapsedMovementSeconds = 0;
    this.previousElapsedMovementSeconds = 0;
    this.hitPulseRemainingSeconds = 0;
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
