import {
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

export class SnowArena extends Group {
  constructor(config = SNOW_ARENA_CONFIG) {
    super();
    this.name = 'snow-arena';
    this.config = config;

    this.add(
      this.createIsland(),
      this.createIcePatches(),
      this.createRocks(),
      this.createMountains(),
    );

    this.snowfall = this.createSnowfall();
    this.add(this.snowfall);
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

  createMountains() {
    const group = new Group();
    group.name = 'mountain-ring';

    const geometry = new ConeGeometry(1, 1, 7);
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
      geometry,
      this.mountainRockMaterial,
      mountainCount,
    );
    const snowCaps = new InstancedMesh(
      geometry,
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
        mountain.height * 0.79,
        mountain.z,
      );
      transform.scale.set(
        mountain.radius * 0.56,
        mountain.height * 0.34,
        mountain.radius * 0.56,
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
    this.mountainSnowMaterial.map = snow;
    this.mountainSnowMaterial.color.setHex(0xf0f8ff);
    this.iceShelfMaterial.map = ice;
    this.iceShelfMaterial.color.setHex(0xb8efff);
    this.icePatchMaterial.map = ice;
    this.icePatchMaterial.color.setHex(0xc8f7ff);
    this.rockMaterial.map = rock;
    this.rockMaterial.color.setHex(0xb7c7d8);
    this.mountainRockMaterial.map = rock;
    this.mountainRockMaterial.color.setHex(0xaebdce);

    for (const material of [
      this.snowMaterial,
      this.mountainSnowMaterial,
      this.iceShelfMaterial,
      this.icePatchMaterial,
      this.rockMaterial,
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
