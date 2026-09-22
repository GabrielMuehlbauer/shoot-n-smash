import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  Vector3,
} from 'three';

import { FLYING_ENEMY_STATES } from './FlyingEnemyController.js';

const UP = new Vector3(0, 1, 0);

function createMembraneGeometry(side) {
  const points = [
    [0.2 * side, 0.35, 0],
    [1.05 * side, 0.75, -0.02],
    [2.1 * side, 0.35, -0.08],
    [1.55 * side, -0.42, 0.02],
    [0.65 * side, -0.18, 0.08],
  ];
  const vertices = [];
  for (const triangle of [[0, 1, 4], [1, 3, 4], [1, 2, 3]]) {
    for (const index of triangle) vertices.push(...points[index]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class FlyingIceEnemyVisual {
  constructor({ scale = 1 } = {}) {
    this.geometries = new Set();
    this.materials = new Set();
    this.root = new Group();
    this.root.name = 'flying-ice-gargoyle';
    this.root.scale.setScalar(scale);

    this.material = this.createMaterial('Ice_Base', {
      color: 0x79ddff,
      emissive: 0x0b3d55,
      emissiveIntensity: 0.26,
      metalness: 0.08,
      roughness: 0.42,
      flatShading: true,
    });
    this.darkMaterial = this.createMaterial('Ice_Dark', {
      color: 0x17445f,
      emissive: 0x071d2c,
      emissiveIntensity: 0.18,
      metalness: 0.04,
      roughness: 0.72,
      side: DoubleSide,
    });
    this.crystalMaterial = this.createMaterial('Ice_Crystal', {
      color: 0xcaf7ff,
      emissive: 0x195b75,
      emissiveIntensity: 0.35,
      metalness: 0.12,
      roughness: 0.28,
      flatShading: true,
    });
    this.emissionMaterial = this.createMaterial('Ice_Emission', {
      color: 0x42efff,
      emissive: 0x1de9ff,
      emissiveIntensity: 1.55,
      metalness: 0,
      roughness: 0.2,
    });

    const bodyGeometry = this.createGeometry(new DodecahedronGeometry(0.72, 0));
    const headGeometry = this.createGeometry(new IcosahedronGeometry(0.43, 1));
    const eyeGeometry = this.createGeometry(new SphereGeometry(0.075, 8, 6));
    const crystalGeometry = this.createGeometry(new ConeGeometry(0.13, 0.56, 5));
    const clawGeometry = this.createGeometry(new ConeGeometry(0.065, 0.32, 5));
    const boneGeometry = this.createGeometry(new CylinderGeometry(0.035, 0.055, 1, 6));

    this.body = new Mesh(bodyGeometry, this.material);
    this.body.name = 'flying-ice-body';
    this.body.scale.set(0.8, 1.04, 0.7);
    this.head = new Mesh(headGeometry, this.material);
    this.head.name = 'flying-ice-head';
    this.head.position.set(0, 0.62, 0.12);
    this.head.scale.set(1.05, 0.82, 0.94);
    this.root.add(this.body, this.head);

    for (const side of [-1, 1]) {
      const eye = new Mesh(eyeGeometry, this.emissionMaterial);
      eye.name = side < 0 ? 'flying-ice-left-eye' : 'flying-ice-right-eye';
      eye.position.set(side * 0.16, 0.67, 0.42);
      const horn = new Mesh(crystalGeometry, this.crystalMaterial);
      horn.position.set(side * 0.24, 1.02, 0);
      horn.rotation.z = side * -0.28;
      const leg = new Mesh(boneGeometry, this.darkMaterial);
      leg.position.set(side * 0.3, -0.68, 0.03);
      leg.scale.set(1.35, 0.62, 1.35);
      leg.rotation.z = side * 0.22;
      this.root.add(eye, horn, leg);

      for (const offset of [-0.085, 0, 0.085]) {
        const claw = new Mesh(clawGeometry, this.crystalMaterial);
        claw.position.set(side * 0.31 + offset, -1.05, 0.22);
        claw.rotation.x = Math.PI / 2.8;
        this.root.add(claw);
      }
    }

    this.fissures = new Group();
    this.fissures.name = 'flying-ice-emissive-fissures';
    for (const [x, y, rotation] of [
      [0, 0.18, 0.1],
      [-0.18, -0.02, -0.48],
      [0.19, -0.17, 0.52],
    ]) {
      const fissure = new Mesh(crystalGeometry, this.emissionMaterial);
      fissure.position.set(x, y, 0.57);
      fissure.rotation.set(Math.PI / 2, 0, rotation);
      fissure.scale.set(0.18, 0.64, 0.12);
      this.fissures.add(fissure);
    }
    this.root.add(this.fissures);

    this.leftWing = this.createWing(-1, boneGeometry);
    this.rightWing = this.createWing(1, boneGeometry);
    this.root.add(this.leftWing, this.rightWing);

    for (const [side, x, y, z, size] of [
      [-1, -0.42, 0.3, -0.45, 1.1],
      [1, 0.42, 0.3, -0.45, 1.1],
      [0, 0, 0.04, -0.58, 1.35],
    ]) {
      const backCrystal = new Mesh(crystalGeometry, this.crystalMaterial);
      backCrystal.position.set(x, y, z);
      backCrystal.rotation.x = -0.28;
      backCrystal.rotation.z = side * -0.2;
      backCrystal.scale.setScalar(size);
      this.root.add(backCrystal);
    }

    this.projectileGeometry = this.createGeometry(new OctahedronGeometry(0.22, 0));
  }

  createGeometry(geometry) {
    this.geometries.add(geometry);
    return geometry;
  }

  createMaterial(name, options) {
    const material = new MeshStandardMaterial(options);
    material.name = name;
    this.materials.add(material);
    return material;
  }

  createWing(side, boneGeometry) {
    const wing = new Group();
    wing.name = side < 0 ? 'flying-ice-left-wing' : 'flying-ice-right-wing';
    const membraneGeometry = this.createGeometry(createMembraneGeometry(side));
    const membrane = new Mesh(membraneGeometry, this.darkMaterial);
    membrane.name = `${wing.name}-membrane`;
    wing.add(membrane);

    for (const [from, to] of [
      [[0.16 * side, 0.28, 0], [1.05 * side, 0.75, -0.02]],
      [[1.05 * side, 0.75, -0.02], [2.1 * side, 0.35, -0.08]],
      [[0.16 * side, 0.28, 0], [1.55 * side, -0.42, 0.02]],
    ]) {
      const start = new Vector3(...from);
      const end = new Vector3(...to);
      const direction = end.clone().sub(start);
      const bone = new Mesh(boneGeometry, this.crystalMaterial);
      bone.position.copy(start).add(end).multiplyScalar(0.5);
      bone.scale.set(1, direction.length(), 1);
      bone.quaternion.setFromUnitVectors(UP, direction.normalize());
      wing.add(bone);
    }
    return wing;
  }

  createProjectile() {
    const projectile = new Mesh(this.projectileGeometry, this.emissionMaterial);
    projectile.name = 'flying-ice-projectile';
    projectile.visible = false;
    return projectile;
  }

  update({
    elapsed = 0,
    stateElapsed = 0,
    state = FLYING_ENEMY_STATES.HOVER,
    hitRatio = 0,
  } = {}) {
    const fast = state === FLYING_ENEMY_STATES.DIVE || state === FLYING_ENEMY_STATES.RETREAT;
    const flapSpeed = fast ? 13 : 7.5;
    const flapAmount = fast ? 0.62 : 0.42;
    const flap = Math.sin(elapsed * flapSpeed) * flapAmount;
    this.leftWing.rotation.x = flap;
    this.rightWing.rotation.x = -flap;
    this.leftWing.rotation.z = -0.08;
    this.rightWing.rotation.z = 0.08;
    this.root.rotation.x = state === FLYING_ENEMY_STATES.DIVE
      ? -0.5
      : state === FLYING_ENEMY_STATES.HIT
        ? 0.2
        : 0;
    this.root.rotation.z = state === FLYING_ENEMY_STATES.DEATH
      ? Math.min(stateElapsed * 4.5, Math.PI * 1.8)
      : state === FLYING_ENEMY_STATES.PATROL
        ? Math.sin(elapsed * 1.4) * 0.1
        : 0;
    this.emissionMaterial.emissiveIntensity = 1.55 + hitRatio * 1.8;
    this.material.emissiveIntensity = 0.26 + hitRatio * 0.52;
  }

  dispose() {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
