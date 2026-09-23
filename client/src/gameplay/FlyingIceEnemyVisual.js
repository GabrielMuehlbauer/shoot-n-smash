import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  Vector3,
} from 'three';

import { FLYING_ENEMY_STATES } from './FlyingEnemyController.js';

const UP = new Vector3(0, 1, 0);

function createTriangleGeometry(points, triangles) {
  const vertices = [];
  for (const triangle of triangles) {
    for (const index of triangle) vertices.push(...points[index]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createFacetedHull(rings, segments = 8) {
  const points = [];
  for (const ring of rings) {
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      points.push([
        Math.cos(angle) * ring.radiusX,
        ring.y,
        ring.centerZ + Math.sin(angle) * ring.radiusZ,
      ]);
    }
  }
  const triangles = [];
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      const lower = ring * segments;
      const upper = (ring + 1) * segments;
      triangles.push(
        [lower + index, lower + next, upper + index],
        [lower + next, upper + next, upper + index],
      );
    }
  }
  const bottomCenter = points.push([0, rings[0].y, rings[0].centerZ]) - 1;
  const topRing = (rings.length - 1) * segments;
  const topCenter = points.push([
    0,
    rings.at(-1).y,
    rings.at(-1).centerZ,
  ]) - 1;
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    triangles.push(
      [bottomCenter, next, index],
      [topCenter, topRing + index, topRing + next],
    );
  }
  return createTriangleGeometry(points, triangles);
}

function createTaperedPlate(width, height, notch = 0) {
  return createTriangleGeometry([
    [-width * 0.5, -height * 0.5, 0],
    [width * 0.5, -height * 0.36, 0],
    [width * 0.42, height * 0.5, 0],
    [-width * 0.36, height * (0.5 - notch), 0],
  ], [[0, 1, 2], [0, 2, 3]]);
}

function addSegment(parent, geometry, material, from, to, name) {
  const start = new Vector3(...from);
  const end = new Vector3(...to);
  const direction = end.clone().sub(start);
  const segment = new Mesh(geometry, material);
  segment.name = name;
  segment.position.copy(start).add(end).multiplyScalar(0.5);
  segment.scale.set(1, direction.length(), 1);
  segment.quaternion.setFromUnitVectors(UP, direction.normalize());
  parent.add(segment);
  return segment;
}

export class FlyingIceEnemyVisual {
  constructor({ scale = 1 } = {}) {
    this.geometries = new Set();
    this.materials = new Set();
    this.root = new Group();
    this.root.name = 'flying-ice-gargoyle';
    this.root.scale.setScalar(scale);

    this.material = this.createMaterial('Ice_Base', {
      color: 0x68c7e5,
      emissive: 0x0a3447,
      emissiveIntensity: 0.22,
      metalness: 0.08,
      roughness: 0.48,
      flatShading: true,
    });
    this.darkMaterial = this.createMaterial('Ice_Dark', {
      color: 0x12384f,
      emissive: 0x061822,
      emissiveIntensity: 0.14,
      metalness: 0.06,
      roughness: 0.7,
      flatShading: true,
      side: DoubleSide,
    });
    this.membraneMaterial = this.createMaterial('Ice_Dark', {
      color: 0x174a68,
      emissive: 0x071e2b,
      emissiveIntensity: 0.12,
      metalness: 0.02,
      roughness: 0.82,
      flatShading: true,
      side: DoubleSide,
    });
    this.crystalMaterial = this.createMaterial('Ice_Crystal', {
      color: 0xbcefff,
      emissive: 0x16536c,
      emissiveIntensity: 0.34,
      metalness: 0.12,
      roughness: 0.26,
      flatShading: true,
    });
    this.emissionMaterial = this.createMaterial('Ice_Emission', {
      color: 0x18bfd8,
      emissive: 0x00cfe8,
      emissiveIntensity: 1.25,
      metalness: 0,
      roughness: 0.18,
      side: DoubleSide,
    });

    const bodyGeometry = this.createGeometry(createFacetedHull([
      { y: -0.64, radiusX: 0.15, radiusZ: 0.17, centerZ: -0.03 },
      { y: -0.42, radiusX: 0.3, radiusZ: 0.28, centerZ: -0.01 },
      { y: -0.08, radiusX: 0.39, radiusZ: 0.34, centerZ: 0.03 },
      { y: 0.24, radiusX: 0.47, radiusZ: 0.41, centerZ: 0.09 },
      { y: 0.46, radiusX: 0.31, radiusZ: 0.3, centerZ: 0.02 },
    ]));
    const headGeometry = this.createGeometry(createFacetedHull([
      { y: -0.26, radiusX: 0.24, radiusZ: 0.2, centerZ: 0.09 },
      { y: -0.08, radiusX: 0.38, radiusZ: 0.31, centerZ: 0.06 },
      { y: 0.16, radiusX: 0.34, radiusZ: 0.29, centerZ: -0.01 },
      { y: 0.29, radiusX: 0.22, radiusZ: 0.2, centerZ: -0.09 },
    ]));
    const jawGeometry = this.createGeometry(createFacetedHull([
      { y: -0.12, radiusX: 0.18, radiusZ: 0.13, centerZ: 0.02 },
      { y: 0.08, radiusX: 0.28, radiusZ: 0.19, centerZ: 0 },
    ], 6));
    const socketGeometry = this.createGeometry(createTaperedPlate(0.25, 0.13, 0.12));
    const eyeGeometry = this.createGeometry(createTaperedPlate(0.17, 0.032, 0.08));
    const mouthGeometry = this.createGeometry(createTaperedPlate(0.31, 0.065));
    const fissureGeometry = this.createGeometry(createTaperedPlate(0.055, 0.27, 0.18));
    const earGeometry = this.createGeometry(new ConeGeometry(0.18, 0.62, 4));
    const hornGeometry = this.createGeometry(new ConeGeometry(0.075, 0.31, 4));
    const crystalGeometry = this.createGeometry(new ConeGeometry(0.105, 0.43, 5));
    const toothGeometry = this.createGeometry(new ConeGeometry(0.025, 0.13, 4));
    const clawGeometry = this.createGeometry(new ConeGeometry(0.045, 0.27, 5));
    const boneGeometry = this.createGeometry(new CylinderGeometry(0.045, 0.064, 1, 6));
    const thinBoneGeometry = this.createGeometry(new CylinderGeometry(0.025, 0.042, 1, 5));

    this.body = new Mesh(bodyGeometry, this.material);
    this.body.name = 'flying-ice-body';
    this.root.add(this.body);

    this.head = new Mesh(headGeometry, this.material);
    this.head.name = 'flying-ice-head';
    this.head.position.set(0, 0.61, 0.09);
    this.head.rotation.x = -0.08;
    this.root.add(this.head);

    const jaw = new Mesh(jawGeometry, this.darkMaterial);
    jaw.name = 'flying-ice-short-jaw';
    jaw.position.set(0, 0.43, 0.35);
    jaw.rotation.x = Math.PI * 0.5;
    jaw.scale.set(1, 0.72, 0.72);
    this.root.add(jaw);

    const mouth = new Mesh(mouthGeometry, this.darkMaterial);
    mouth.name = 'flying-ice-mouth';
    mouth.position.set(0, 0.42, 0.503);
    mouth.rotation.z = Math.PI * 0.5;
    this.root.add(mouth);

    for (const side of [-1, 1]) {
      const sideName = side < 0 ? 'left' : 'right';
      const socket = new Mesh(socketGeometry, this.darkMaterial);
      socket.name = `flying-ice-${sideName}-eye-socket`;
      socket.position.set(side * 0.18, 0.69, 0.421);
      socket.scale.x = side;
      socket.rotation.z = side * -0.28;
      this.root.add(socket);

      const eye = new Mesh(eyeGeometry, this.emissionMaterial);
      eye.name = `flying-ice-${sideName}-eye`;
      eye.position.set(side * 0.18, 0.69, 0.427);
      eye.scale.x = side;
      eye.rotation.z = side * -0.28;
      this.root.add(eye);

      const ear = new Mesh(earGeometry, this.material);
      ear.name = `flying-ice-${sideName}-ear`;
      ear.position.set(side * 0.29, 1.03, 0.01);
      ear.rotation.z = side * -0.34;
      ear.rotation.x = -0.12;
      ear.scale.set(0.82, 1, 0.65);
      this.root.add(ear);

      const horn = new Mesh(hornGeometry, this.crystalMaterial);
      horn.name = `flying-ice-${sideName}-brow-horn`;
      horn.position.set(side * 0.19, 0.95, 0.08);
      horn.rotation.z = side * -0.22;
      horn.rotation.x = -0.18;
      this.root.add(horn);

      for (const xOffset of [-0.055, 0.055]) {
        const tooth = new Mesh(toothGeometry, this.crystalMaterial);
        tooth.name = `flying-ice-${sideName}-tooth`;
        tooth.position.set(side * 0.085 + xOffset, 0.39, 0.515);
        tooth.rotation.z = Math.PI;
        this.root.add(tooth);
      }
      this.createLeg(side, boneGeometry, thinBoneGeometry, clawGeometry);
    }

    const nose = new Mesh(hornGeometry, this.darkMaterial);
    nose.name = 'flying-ice-bat-nose';
    nose.position.set(0, 0.57, 0.45);
    nose.rotation.x = Math.PI * 0.5;
    nose.scale.set(1.15, 0.7, 0.85);
    this.root.add(nose);

    const chestCore = new Mesh(
      this.createGeometry(new OctahedronGeometry(0.14, 0)),
      this.emissionMaterial,
    );
    chestCore.name = 'flying-ice-chest-core';
    chestCore.position.set(0, 0.12, 0.435);
    chestCore.scale.set(0.9, 1.15, 0.48);
    this.root.add(chestCore);

    this.fissures = new Group();
    this.fissures.name = 'flying-ice-emissive-fissures';
    for (const [x, y, rotation, fissureScale] of [
      [-0.14, 0.02, -0.45, 0.75],
      [0.16, -0.08, 0.52, 0.68],
      [-0.02, -0.23, 0.16, 0.55],
    ]) {
      const fissure = new Mesh(fissureGeometry, this.emissionMaterial);
      fissure.position.set(x, y, 0.37);
      fissure.rotation.z = rotation;
      fissure.scale.setScalar(fissureScale);
      this.fissures.add(fissure);
    }
    this.root.add(this.fissures);

    this.leftWing = this.createWing(-1, boneGeometry, thinBoneGeometry, crystalGeometry);
    this.rightWing = this.createWing(1, boneGeometry, thinBoneGeometry, crystalGeometry);
    this.root.add(this.leftWing, this.rightWing);

    for (const [side, x, y, z, crystalScale] of [
      [-1, -0.31, 0.25, -0.32, 0.92],
      [1, 0.31, 0.25, -0.32, 0.92],
      [0, 0, -0.03, -0.39, 1.08],
    ]) {
      const crystal = new Mesh(crystalGeometry, this.crystalMaterial);
      crystal.name = 'flying-ice-back-crystal';
      crystal.position.set(x, y, z);
      crystal.rotation.x = -0.36;
      crystal.rotation.z = side * -0.18;
      crystal.scale.setScalar(crystalScale);
      this.root.add(crystal);
    }

    this.projectileGeometry = this.createGeometry(new OctahedronGeometry(0.22, 0));
    this.update({ elapsed: 0, state: FLYING_ENEMY_STATES.HOVER });
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

  createLeg(side, boneGeometry, thinBoneGeometry, clawGeometry) {
    const leg = new Group();
    leg.name = side < 0 ? 'flying-ice-left-leg' : 'flying-ice-right-leg';
    leg.position.set(side * 0.25, -0.4, -0.02);
    addSegment(
      leg,
      boneGeometry,
      this.darkMaterial,
      [0, 0, 0],
      [side * 0.08, -0.28, -0.13],
      `${leg.name}-thigh`,
    );

    const ankle = new Group();
    ankle.name = `${leg.name}-ankle`;
    ankle.position.set(side * 0.08, -0.28, -0.13);
    addSegment(
      ankle,
      thinBoneGeometry,
      this.crystalMaterial,
      [0, 0, 0],
      [side * 0.035, -0.24, 0.13],
      `${leg.name}-shin`,
    );
    leg.add(ankle);

    const foot = new Group();
    foot.name = `${leg.name}-talons`;
    foot.position.set(side * 0.035, -0.24, 0.13);
    for (let index = -1; index <= 1; index += 1) {
      const claw = new Mesh(clawGeometry, this.crystalMaterial);
      claw.name = `${leg.name}-claw-${index + 2}`;
      claw.position.set(index * 0.075, -0.08, 0.09 - Math.abs(index) * 0.025);
      claw.rotation.x = Math.PI * 0.62;
      claw.rotation.z = index * -0.18;
      claw.scale.set(0.82, 0.78, 0.82);
      foot.add(claw);
    }
    ankle.add(foot);
    this.root.add(leg);
  }

  createWing(side, boneGeometry, fingerGeometry, crystalGeometry) {
    const sideName = side < 0 ? 'left' : 'right';
    const suffix = side < 0 ? 'L' : 'R';
    const wing = new Group();
    wing.name = `flying-ice-${sideName}-wing`;
    wing.position.set(side * 0.36, 0.29, -0.04);
    wing.scale.x = side;

    const shoulder = new Group();
    shoulder.name = `WingShoulder_${suffix}`;
    wing.add(shoulder);
    addSegment(
      shoulder,
      boneGeometry,
      this.darkMaterial,
      [0, 0, 0],
      [0.68, 0.31, -0.035],
      `flying-ice-${sideName}-upper-wing-arm`,
    );

    const innerMembrane = new Mesh(
      this.createGeometry(createTriangleGeometry([
        [0.05, -0.04, 0.025],
        [0.68, 0.31, -0.035],
        [0.35, -0.42, 0.035],
        [0.08, -0.52, 0.055],
      ], [[0, 1, 2], [0, 2, 3]])),
      this.membraneMaterial,
    );
    innerMembrane.name = `flying-ice-${sideName}-wing-inner-membrane`;
    shoulder.add(innerMembrane);

    const elbow = new Group();
    elbow.name = `WingElbow_${suffix}`;
    elbow.position.set(0.68, 0.31, -0.035);
    shoulder.add(elbow);
    addSegment(
      elbow,
      boneGeometry,
      this.darkMaterial,
      [0, 0, 0],
      [0.72, -0.16, -0.055],
      `flying-ice-${sideName}-wing-forearm`,
    );

    const forearmMembrane = new Mesh(
      this.createGeometry(createTriangleGeometry([
        [0, 0, 0.012],
        [0.72, -0.16, -0.045],
        [0.48, -0.48, 0.005],
        [-0.33, -0.73, 0.045],
      ], [[0, 1, 2], [0, 2, 3]])),
      this.membraneMaterial,
    );
    forearmMembrane.name = `flying-ice-${sideName}-wing-forearm-membrane`;
    elbow.add(forearmMembrane);

    const tip = new Group();
    tip.name = `WingTip_${suffix}`;
    tip.position.set(0.72, -0.16, -0.055);
    elbow.add(tip);

    const fingerEnds = [
      [0.58, -0.11, -0.025],
      [0.47, -0.47, 0.005],
      [0.25, -0.75, 0.035],
      [-0.08, -0.9, 0.06],
    ];
    fingerEnds.forEach((end, index) => {
      addSegment(
        tip,
        fingerGeometry,
        index === 0 ? this.darkMaterial : this.crystalMaterial,
        [0, 0, 0],
        end,
        `flying-ice-${sideName}-wing-finger-${index + 1}`,
      );
    });

    const membranePoints = [
      [0, 0, 0.018],
      ...fingerEnds.map(([x, y, z], index) => [
        x,
        y + (index === 1 ? 0.035 : 0),
        z + 0.014,
      ]),
    ];
    for (let index = 0; index < fingerEnds.length - 1; index += 1) {
      const panel = new Mesh(
        this.createGeometry(createTriangleGeometry(
          membranePoints,
          [[0, index + 1, index + 2]],
        )),
        this.membraneMaterial,
      );
      panel.name = `flying-ice-${sideName}-wing-membrane-panel-${index + 1}`;
      tip.add(panel);
    }

    const trailingPanel = new Mesh(
      this.createGeometry(createTriangleGeometry([
        [0, 0, 0.018],
        fingerEnds[3],
        [-0.22, -0.62, 0.06],
      ], [[0, 1, 2]])),
      this.membraneMaterial,
    );
    trailingPanel.name = `flying-ice-${sideName}-wing-membrane-panel-4`;
    tip.add(trailingPanel);

    for (const [x, y, z, crystalScale] of [
      [0.16, 0.08, -0.04, 0.55],
      [0.57, 0.22, -0.055, 0.42],
    ]) {
      const crystal = new Mesh(crystalGeometry, this.crystalMaterial);
      crystal.name = `flying-ice-${sideName}-wing-crystal`;
      crystal.position.set(x, y, z);
      crystal.rotation.z = -0.75;
      crystal.scale.setScalar(crystalScale);
      shoulder.add(crystal);
    }

    if (side < 0) {
      this.leftWingShoulder = shoulder;
      this.leftWingElbow = elbow;
      this.leftWingTip = tip;
    } else {
      this.rightWingShoulder = shoulder;
      this.rightWingElbow = elbow;
      this.rightWingTip = tip;
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
    const flapAmount = fast ? 0.48 : 0.34;
    const phase = elapsed * flapSpeed;
    const flap = Math.sin(phase) * flapAmount;
    const fold = Math.cos(phase) * (fast ? 0.13 : 0.09);

    this.leftWingShoulder.rotation.z = 0.18 + flap;
    this.rightWingShoulder.rotation.z = 0.18 + flap;
    this.leftWingShoulder.rotation.x = -0.07 + fold * 0.35;
    this.rightWingShoulder.rotation.x = -0.07 + fold * 0.35;
    this.leftWingElbow.rotation.z = 0.1 - fold;
    this.rightWingElbow.rotation.z = 0.1 - fold;
    this.leftWingElbow.rotation.y = 0.06 + fold * 0.4;
    this.rightWingElbow.rotation.y = 0.06 + fold * 0.4;
    this.leftWingTip.rotation.z = -0.18 - fold * 0.8;
    this.rightWingTip.rotation.z = -0.18 - fold * 0.8;
    this.leftWingTip.rotation.y = 0.08 - fold * 0.55;
    this.rightWingTip.rotation.y = 0.08 - fold * 0.55;

    // These legacy wing references remain animated for current integrations.
    this.leftWing.rotation.x = fold * 0.18;
    this.rightWing.rotation.x = fold * 0.18;
    this.root.position.y = Math.sin(elapsed * 2.4) * 0.045;
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
    this.emissionMaterial.emissiveIntensity = 1.25 + hitRatio * 1.8;
    this.material.emissiveIntensity = 0.22 + hitRatio * 0.52;
  }

  dispose() {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
