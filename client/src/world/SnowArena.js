import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Points,
  PointsMaterial,
  TorusGeometry,
} from 'three';

import { SNOW_ARENA_CONFIG } from '../config/snow-arena-config.js';

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

export function createSnowflakePositions(config = SNOW_ARENA_CONFIG.snowfall) {
  const random = createSeededRandom(config.seed);
  const positions = new Float32Array(config.count * 3);

  for (let index = 0; index < config.count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * config.radius;
    const offset = index * 3;

    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] =
      config.minY + random() * (config.maxY - config.minY);
    positions[offset + 2] = Math.sin(angle) * radius;
  }

  return positions;
}

function createRidgedMountainGeometry({ snowCap = false } = {}) {
  const segments = 9;
  const rings = snowCap
    ? [
        { y: -0.5, radius: 1, x: -0.05, z: 0.04 },
        { y: -0.08, radius: 0.72, x: 0.08, z: -0.04 },
        { y: 0.24, radius: 0.4, x: -0.03, z: 0.08 },
        { y: 0.5, radius: 0.035, x: 0.08, z: -0.03 },
      ]
    : [
        { y: -0.5, radius: 1, x: 0, z: 0 },
        { y: -0.3, radius: 0.94, x: -0.07, z: 0.05 },
        { y: -0.06, radius: 0.73, x: 0.09, z: -0.05 },
        { y: 0.18, radius: 0.56, x: -0.04, z: 0.08 },
        { y: 0.37, radius: 0.29, x: 0.07, z: 0.01 },
        { y: 0.5, radius: 0.035, x: 0.1, z: -0.04 },
      ];
  const vertices = [];
  const uvs = [];
  const readPoint = (ring, segment) => {
    const angle = (segment / segments) * Math.PI * 2;
    const ridge = 1 + Math.sin(segment * 4.13 + ring.y * 7.2) * 0.1;
    return [
      ring.x + Math.cos(angle) * ring.radius * ridge,
      ring.y,
      ring.z + Math.sin(angle) * ring.radius * ridge,
    ];
  };

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const lower = rings[ringIndex];
    const upper = rings[ringIndex + 1];

    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const lowerLeft = readPoint(lower, segment);
      const lowerRight = readPoint(lower, next);
      const upperLeft = readPoint(upper, segment);
      const upperRight = readPoint(upper, next);
      vertices.push(
        ...lowerLeft,
        ...lowerRight,
        ...upperLeft,
        ...lowerRight,
        ...upperRight,
        ...upperLeft,
      );
      const leftU = segment / segments;
      const rightU = (segment + 1) / segments;
      const lowerV = lower.y + 0.5;
      const upperV = upper.y + 0.5;
      uvs.push(
        leftU,
        lowerV,
        rightU,
        lowerV,
        leftU,
        upperV,
        rightU,
        lowerV,
        rightU,
        upperV,
        leftU,
        upperV,
      );
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(new Float32Array(vertices), 3),
  );
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute(new Float32Array(uvs), 2),
  );
  geometry.computeVertexNormals();
  return geometry;
}

export class SnowArena extends Group {
  constructor(config = SNOW_ARENA_CONFIG) {
    super();
    this.name = 'snow-arena';
    this.config = config;

    this.add(
      this.createFrozenLake(),
      this.createIsland(),
      this.createCentralPlatform(),
      this.createIcePatches(),
      this.createRocks(),
      this.createCrystalClusters(),
      this.createPineForest(),
      this.createLanterns(),
      this.createMountains(),
    );

    this.snowfall = this.createSnowfall();
    this.add(this.snowfall);
  }

  createFrozenLake() {
    const { frozenLake } = this.config;
    this.frozenLakeMaterial = new MeshStandardMaterial({
      color: frozenLake.color,
      emissive: 0x2b86aa,
      emissiveIntensity: 0.28,
      metalness: 0.08,
      roughness: 0.35,
    });
    const lake = new Mesh(
      new CylinderGeometry(
        frozenLake.radius,
        frozenLake.radius,
        frozenLake.depth,
        64,
      ),
      this.frozenLakeMaterial,
    );
    lake.name = 'frozen-lake';
    lake.position.set(
      frozenLake.x,
      -frozenLake.depth / 2 - 0.02,
      frozenLake.z,
    );
    lake.scale.set(frozenLake.scaleX, 1, frozenLake.scaleZ);
    return lake;
  }

  createIsland() {
    const { island } = this.config;
    const group = new Group();
    group.name = 'ice-island';

    this.iceShelfMaterial = new MeshStandardMaterial({
      color: island.iceColor,
      metalness: 0.18,
      roughness: 0.58,
    });
    const iceShelf = new Mesh(
      new CylinderGeometry(
        island.radiusTop,
        island.radiusBottom,
        island.depth,
        island.segments,
      ),
      this.iceShelfMaterial,
    );
    iceShelf.name = 'ice-shelf';
    iceShelf.position.y = -island.depth / 2;

    this.snowMaterial = new MeshStandardMaterial({
      color: island.snowColor,
      metalness: 0.01,
      roughness: 0.92,
    });
    const snowSurface = new Mesh(
      new CylinderGeometry(
        island.radiusTop - 0.15,
        island.radiusTop,
        0.18,
        island.segments,
      ),
      this.snowMaterial,
    );
    snowSurface.name = 'snow-surface';
    snowSurface.position.y = 0.06;

    group.add(iceShelf, snowSurface);
    return group;
  }

  createCentralPlatform() {
    const { platform } = this.config;
    const group = new Group();
    group.name = 'central-arena';

    this.platformIceMaterial = new MeshStandardMaterial({
      color: platform.iceColor,
      metalness: 0.12,
      roughness: 0.64,
    });
    const base = new Mesh(
      new CylinderGeometry(
        platform.radius,
        platform.radius * 1.08,
        platform.depth,
        platform.segments,
      ),
      this.platformIceMaterial,
    );
    base.name = 'central-arena-base';
    base.position.y = platform.topHeight - platform.depth / 2;

    this.platformSnowMaterial = new MeshStandardMaterial({
      color: platform.snowColor,
      metalness: 0.01,
      roughness: 0.88,
    });
    const top = new Mesh(
      new CylinderGeometry(
        platform.radius - 0.18,
        platform.radius,
        0.14,
        platform.segments,
      ),
      this.platformSnowMaterial,
    );
    top.name = 'central-arena-snow';
    top.position.y = platform.topHeight + 0.04;

    this.platformRimMaterial = new MeshStandardMaterial({
      color: platform.rimColor,
      emissive: 0x174f73,
      emissiveIntensity: 0.16,
      metalness: 0.25,
      roughness: 0.34,
    });
    const rim = new Mesh(
      new TorusGeometry(platform.radius - 0.24, 0.12, 6, platform.segments),
      this.platformRimMaterial,
    );
    rim.name = 'central-arena-rim';
    rim.rotation.x = Math.PI / 2;
    rim.position.y = platform.topHeight + 0.14;

    const stepGeometry = new BoxGeometry(1, 0.24, 1);
    const steps = new InstancedMesh(
      stepGeometry,
      this.platformSnowMaterial,
      platform.steps.length,
    );
    steps.name = 'central-arena-step-instances';
    const transform = new Object3D();

    platform.steps.forEach((step, index) => {
      transform.position.set(step.x, step.y, step.z);
      transform.rotation.set(0, 0, 0);
      transform.scale.set(step.width, 1, step.depth);
      transform.updateMatrix();
      steps.setMatrixAt(index, transform.matrix);
    });
    steps.instanceMatrix.needsUpdate = true;
    steps.computeBoundingSphere();

    group.add(base, top, rim, steps);
    return group;
  }

  createIcePatches() {
    const group = new Group();
    group.name = 'ice-patches';

    const geometry = new CylinderGeometry(1, 1, 0.045, 28);
    this.icePatchMaterial = new MeshStandardMaterial({
      color: 0x9fe9f5,
      emissive: 0x174d62,
      emissiveIntensity: 0.1,
      metalness: 0.38,
      roughness: 0.24,
    });

    const instances = new InstancedMesh(
      geometry,
      this.icePatchMaterial,
      this.config.icePatches.length,
    );
    instances.name = 'ice-patch-instances';
    const transform = new Object3D();

    this.config.icePatches.forEach((patch, index) => {
      transform.position.set(patch.x, 0.175, patch.z);
      transform.rotation.set(0, patch.rotation, 0);
      transform.scale.set(
        patch.radius * patch.scaleX,
        1,
        patch.radius * patch.scaleZ,
      );
      transform.updateMatrix();
      instances.setMatrixAt(index, transform.matrix);
    });

    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
    group.add(instances);

    return group;
  }

  createRocks() {
    const group = new Group();
    group.name = 'rock-ring';

    const geometry = new DodecahedronGeometry(1, 0);
    this.rockMaterial = new MeshStandardMaterial({
      color: 0x526c7d,
      metalness: 0.04,
      roughness: 0.86,
    });

    const instances = new InstancedMesh(
      geometry,
      this.rockMaterial,
      this.config.rocks.length,
    );
    instances.name = 'rock-instances';
    const transform = new Object3D();

    this.config.rocks.forEach((rock, index) => {
      transform.position.set(rock.x, rock.scale * 0.62, rock.z);
      transform.rotation.set(
        rock.rotation * 0.45,
        rock.rotation,
        rock.rotation * 0.2,
      );
      transform.scale.set(rock.scale, rock.scale * 0.72, rock.scale * 1.18);
      transform.updateMatrix();
      instances.setMatrixAt(index, transform.matrix);
    });

    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
    group.add(instances);

    return group;
  }

  createCrystalClusters() {
    const group = new Group();
    group.name = 'crystal-gardens';
    const geometry = new ConeGeometry(0.38, 2.2, 5);
    this.crystalMaterial = new MeshStandardMaterial({
      color: 0x54d9ff,
      emissive: 0x087aa8,
      emissiveIntensity: 0.68,
      metalness: 0.28,
      roughness: 0.18,
      transparent: true,
      opacity: 0.9,
    });
    const shardsPerCluster = 3;
    const instances = new InstancedMesh(
      geometry,
      this.crystalMaterial,
      this.config.crystals.length * shardsPerCluster,
    );
    instances.name = 'crystal-shard-instances';
    const transform = new Object3D();

    this.config.crystals.forEach((crystal, clusterIndex) => {
      for (let shard = 0; shard < shardsPerCluster; shard += 1) {
        const angle = crystal.rotation + (shard - 1) * 0.72;
        const heightScale = crystal.scale * (1 - shard * 0.16);
        const offset = shard === 0 ? 0 : 0.52 * crystal.scale;
        transform.position.set(
          crystal.x + Math.cos(angle) * offset,
          heightScale * 1.08,
          crystal.z + Math.sin(angle) * offset,
        );
        transform.rotation.set(
          (shard - 1) * 0.09,
          angle,
          (1 - shard) * 0.13,
        );
        transform.scale.set(
          crystal.scale * (0.72 + shard * 0.08),
          heightScale,
          crystal.scale * (0.72 + shard * 0.08),
        );
        transform.updateMatrix();
        instances.setMatrixAt(
          clusterIndex * shardsPerCluster + shard,
          transform.matrix,
        );
      }
    });

    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
    group.add(instances);
    return group;
  }

  createPineForest() {
    const group = new Group();
    group.name = 'snowy-pine-forest';
    const treeCount = this.config.trees.length;
    const trunkGeometry = new CylinderGeometry(0.16, 0.24, 1.8, 6);
    const foliageGeometry = new ConeGeometry(1.05, 2.7, 8);
    this.treeTrunkMaterial = new MeshStandardMaterial({
      color: 0x3d5363,
      metalness: 0,
      roughness: 0.95,
    });
    this.treeFoliageMaterial = new MeshStandardMaterial({
      color: 0x173f58,
      metalness: 0,
      roughness: 0.9,
    });
    this.treeSnowMaterial = new MeshStandardMaterial({
      color: 0xeef9ff,
      metalness: 0.01,
      roughness: 0.92,
    });
    const trunks = new InstancedMesh(
      trunkGeometry,
      this.treeTrunkMaterial,
      treeCount,
    );
    const foliageLayers = 3;
    const foliage = new InstancedMesh(
      foliageGeometry,
      this.treeFoliageMaterial,
      treeCount * foliageLayers,
    );
    const snow = new InstancedMesh(
      foliageGeometry,
      this.treeSnowMaterial,
      treeCount * foliageLayers,
    );
    trunks.name = 'pine-trunk-instances';
    foliage.name = 'pine-foliage-instances';
    snow.name = 'pine-snow-instances';
    const transform = new Object3D();

    this.config.trees.forEach((tree, index) => {
      transform.position.set(tree.x, tree.scale * 0.9, tree.z);
      transform.rotation.set(0, tree.rotation, 0);
      transform.scale.set(tree.scale, tree.scale, tree.scale);
      transform.updateMatrix();
      trunks.setMatrixAt(index, transform.matrix);

      for (let layer = 0; layer < foliageLayers; layer += 1) {
        const layerScale = tree.scale * (1.08 - layer * 0.23);
        const instanceIndex = index * foliageLayers + layer;
        transform.position.set(
          tree.x,
          tree.scale * (1.72 + layer * 1.02),
          tree.z,
        );
        transform.rotation.set(0, tree.rotation + layer * 0.31, 0);
        transform.scale.set(layerScale, tree.scale, layerScale);
        transform.updateMatrix();
        foliage.setMatrixAt(instanceIndex, transform.matrix);

        transform.position.y += tree.scale * 0.16;
        transform.scale.set(
          layerScale * 0.86,
          tree.scale * 0.68,
          layerScale * 0.86,
        );
        transform.updateMatrix();
        snow.setMatrixAt(instanceIndex, transform.matrix);
      }
    });

    for (const instances of [trunks, foliage, snow]) {
      instances.instanceMatrix.needsUpdate = true;
      instances.computeBoundingSphere();
    }
    group.add(trunks, foliage, snow);
    return group;
  }

  createLanterns() {
    const group = new Group();
    group.name = 'arena-lanterns';
    const pedestalGeometry = new CylinderGeometry(0.42, 0.62, 0.72, 8);
    const flameGeometry = new ConeGeometry(0.13, 0.4, 8);
    this.lanternStoneMaterial = new MeshStandardMaterial({
      color: 0x58758d,
      metalness: 0.04,
      roughness: 0.82,
    });
    this.lanternFlameMaterial = new MeshStandardMaterial({
      color: 0xffd27a,
      emissive: 0xff7a1a,
      emissiveIntensity: 1.7,
      metalness: 0,
      roughness: 0.38,
    });
    const pedestals = new InstancedMesh(
      pedestalGeometry,
      this.lanternStoneMaterial,
      this.config.lanterns.length,
    );
    const flames = new InstancedMesh(
      flameGeometry,
      this.lanternFlameMaterial,
      this.config.lanterns.length,
    );
    pedestals.name = 'lantern-pedestal-instances';
    flames.name = 'lantern-flame-instances';
    const transform = new Object3D();

    this.config.lanterns.forEach((lantern, index) => {
      transform.position.set(lantern.x, 0.42, lantern.z);
      transform.rotation.set(0, lantern.rotation, 0);
      transform.scale.set(1, 1, 1);
      transform.updateMatrix();
      pedestals.setMatrixAt(index, transform.matrix);

      transform.position.set(lantern.x, 0.94, lantern.z);
      transform.rotation.set(0, lantern.rotation, 0);
      transform.scale.set(1, 1, 1);
      transform.updateMatrix();
      flames.setMatrixAt(index, transform.matrix);
    });

    pedestals.instanceMatrix.needsUpdate = true;
    flames.instanceMatrix.needsUpdate = true;
    pedestals.computeBoundingSphere();
    flames.computeBoundingSphere();
    group.add(pedestals, flames);
    return group;
  }

  createMountains() {
    const group = new Group();
    group.name = 'mountain-ring';

    const bodyGeometry = createRidgedMountainGeometry();
    const snowGeometry = createRidgedMountainGeometry({ snowCap: true });
    this.mountainRockMaterial = new MeshStandardMaterial({
      color: 0x536f83,
      metalness: 0.02,
      roughness: 0.9,
    });
    this.mountainSnowMaterial = new MeshStandardMaterial({
      color: 0xdceff4,
      metalness: 0.01,
      roughness: 0.95,
    });

    const mountainCount = this.config.mountains.length;
    const bodies = new InstancedMesh(
      bodyGeometry,
      this.mountainRockMaterial,
      mountainCount,
    );
    const snowCaps = new InstancedMesh(
      snowGeometry,
      this.mountainSnowMaterial,
      mountainCount,
    );
    bodies.name = 'mountain-body-instances';
    snowCaps.name = 'mountain-snow-instances';
    const transform = new Object3D();

    this.config.mountains.forEach((mountain, index) => {
      transform.position.set(
        mountain.x,
        mountain.height / 2 - 0.03,
        mountain.z,
      );
      transform.rotation.set(0, mountain.rotation, 0);
      transform.scale.set(mountain.radius, mountain.height, mountain.radius);
      transform.updateMatrix();
      bodies.setMatrixAt(index, transform.matrix);

      transform.position.set(
        mountain.x,
        mountain.height * 0.85,
        mountain.z,
      );
      transform.scale.set(
        mountain.radius * 0.52,
        mountain.height * 0.3,
        mountain.radius * 0.52,
      );
      transform.updateMatrix();
      snowCaps.setMatrixAt(index, transform.matrix);
    });

    bodies.instanceMatrix.needsUpdate = true;
    snowCaps.instanceMatrix.needsUpdate = true;
    bodies.computeBoundingSphere();
    snowCaps.computeBoundingSphere();
    group.add(bodies, snowCaps);

    return group;
  }

  createSnowfall() {
    const { snowfall } = this.config;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(createSnowflakePositions(snowfall), 3),
    );

    const points = new Points(
      geometry,
      new PointsMaterial({
        color: snowfall.color,
        size: snowfall.size,
        transparent: true,
        opacity: snowfall.opacity,
        depthWrite: false,
      }),
    );
    points.name = 'snowfall';
    points.frustumCulled = false;
    return points;
  }

  applyTextures({ snow, ice, rock } = {}) {
    if (!snow?.isTexture || !ice?.isTexture || !rock?.isTexture) {
      throw new TypeError('SnowArena requer as texturas finais de neve, gelo e rocha.');
    }

    this.snowMaterial.map = snow;
    this.snowMaterial.color.setHex(0xffffff);
    this.platformSnowMaterial.map = snow;
    this.platformSnowMaterial.color.setHex(0xffffff);
    this.treeSnowMaterial.map = snow;
    this.treeSnowMaterial.color.setHex(0xf5fbff);
    this.mountainSnowMaterial.map = snow;
    this.mountainSnowMaterial.color.setHex(0xf0f8ff);
    this.iceShelfMaterial.map = ice;
    this.iceShelfMaterial.color.setHex(0xb8efff);
    this.frozenLakeMaterial.map = ice;
    this.frozenLakeMaterial.color.setHex(0xa8e8ff);
    this.platformIceMaterial.map = ice;
    this.platformIceMaterial.color.setHex(0x9edfff);
    this.icePatchMaterial.map = ice;
    this.icePatchMaterial.color.setHex(0xc8f7ff);
    this.rockMaterial.map = rock;
    this.rockMaterial.color.setHex(0xb7c7d8);
    this.lanternStoneMaterial.map = rock;
    this.lanternStoneMaterial.color.setHex(0xaebdce);
    this.mountainRockMaterial.map = rock;
    this.mountainRockMaterial.color.setHex(0xaebdce);

    for (const material of [
      this.snowMaterial,
      this.platformSnowMaterial,
      this.treeSnowMaterial,
      this.mountainSnowMaterial,
      this.iceShelfMaterial,
      this.frozenLakeMaterial,
      this.platformIceMaterial,
      this.icePatchMaterial,
      this.rockMaterial,
      this.lanternStoneMaterial,
      this.mountainRockMaterial,
    ]) {
      material.needsUpdate = true;
    }

    return true;
  }

  update(deltaSeconds) {
    const safeDelta = Math.max(0, Number(deltaSeconds) || 0);
    this.snowfall.rotation.y +=
      safeDelta * this.config.snowfall.rotationRadiansPerSecond;
  }
}
