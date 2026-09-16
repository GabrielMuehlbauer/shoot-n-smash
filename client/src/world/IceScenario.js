import { Float32BufferAttribute, Group, Mesh, RepeatWrapping, SRGBColorSpace } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addIceBackdrop } from './IceBackdrop.js';

export const ICE_SCENARIO_URL = '/assets/models/ice_scenario.glb';
export const ICE_SCENARIO_PLACEMENT = Object.freeze({
  scale: 2.7,
  floorHeight: 1.56,
  centerZ: 2,
  arenaZ: -36.5,
  arenaScale: 1.15,
  arenaHeightScale: 0.55,
});

export function disposeScenario(root, { materials = true } = {}) {
  const geometries = new Set();
  const uniqueMaterials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      uniqueMaterials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  if (materials) {
    for (const material of uniqueMaterials) {
      if (material.map) textures.add(material.map);
      material.dispose();
    }
    for (const texture of textures) texture.dispose();
  }
}

// This asset has solid PBR colors, no textures or animations. Bake its static
// transforms and batch by material, preserving flat normals and emission.
export function prepareIceScenario(source) {
  if (!source?.isObject3D) throw new Error('O GLB da arena não contém uma cena.');
  const backdrop = addIceBackdrop(source, ICE_SCENARIO_PLACEMENT);
  const batches = new Map();
  const arenaFloorMaterial = source.getObjectByName('Arena_Snow_Top')?.material.clone();
  if (arenaFloorMaterial) {
    arenaFloorMaterial.name = 'Arena_Ice_Top';
    arenaFloorMaterial.color.setHex(0x6593af);
    arenaFloorMaterial.roughness = 0.4;
  }
  source.updateMatrixWorld(true);
  source.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry.index
      ? object.geometry.toNonIndexed()
      : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    if (object.name.startsWith('Arena_Rune_')) {
      const positions = geometry.attributes.position;
      const floor = ICE_SCENARIO_PLACEMENT.floorHeight;
      for (let i = 0; i < positions.count; i++) {
        positions.setY(i, floor + 0.006 + (positions.getY(i) - floor) * 0.1);
      }
      geometry.computeVertexNormals();
    }
    const { scale, centerZ, arenaZ, arenaScale, arenaHeightScale } = ICE_SCENARIO_PLACEMENT;
    if (object.name.startsWith('Arena_')) {
      // Only the platform and stairs move forward; the surrounding landscape
      // keeps its uniform scale. Geometry is expressed in the root's coordinates.
      geometry.scale(arenaScale / scale, arenaHeightScale / scale, arenaScale / scale);
      geometry.translate(0, 0, (arenaZ - centerZ * arenaScale + centerZ * scale) / scale);
    }
    if (object.name === 'Snow_Ground') {
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        // Extend the back edge beneath the new mountain line.
        if (positions.getZ(i) > 14) {
          positions.setZ(i, 14 + (positions.getZ(i) - 14) * 1.8);
        }
        const radius = Math.hypot(positions.getX(i) * scale, (positions.getZ(i) - centerZ) * scale);
        const t = Math.max(0, Math.min(1, (radius - 26) / 8));
        positions.setY(i, positions.getY(i) * t * t * (3 - 2 * t));
      }
      geometry.computeVertexNormals();
    }
    for (const attribute of Object.keys(geometry.attributes)) {
      if (attribute !== 'position' && attribute !== 'normal') {
        geometry.deleteAttribute(attribute);
      }
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const groups = Array.isArray(object.material)
      ? geometry.groups
      : [{ start: 0, count: geometry.attributes.position.count, materialIndex: 0 }];
    for (const group of groups) {
      const material = object.name === 'Arena_Snow_Top' && arenaFloorMaterial
        ? arenaFloorMaterial : materials[group.materialIndex];
      const part = geometry.clone();
      part.clearGroups();
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        const sliced = attribute.clone();
        sliced.array = attribute.array.slice(
          group.start * attribute.itemSize,
          (group.start + group.count) * attribute.itemSize,
        );
        sliced.count = group.count;
        part.setAttribute(name, sliced);
      }
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material).push(part);
    }
    geometry.dispose();
  });

  const root = new Group();
  root.name = 'ice-scenario';
  root.userData.backdrop = backdrop;
  try {
    for (const [material, parts] of batches) {
      const geometry = mergeGeometries(parts);
      if (!geometry) throw new Error('Falha ao preparar a geometria da arena.');
      if (material.name === 'Snow') {
        // World-space UVs also work on the snow caps, without changing the GLB.
        const positions = geometry.attributes.position;
        const uv = new Float32Array(positions.count * 2);
        for (let i = 0; i < positions.count; i++) {
          uv[i * 2] = positions.getX(i) * 0.9;
          uv[i * 2 + 1] = positions.getZ(i) * 0.9;
        }
        geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
        material.color.setHex(0xa5bfd5);
      }
      if (material.name === 'Emission_Blue') {
        material.color.setHex(0x79a8c0);
        material.emissiveIntensity = 0.12;
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new Mesh(geometry, material);
      mesh.name = `ice-scenario-${material.name}`;
      root.add(mesh);
    }
    if (!root.children.length) throw new Error('O GLB da arena está vazio.');
    const { scale, centerZ } = ICE_SCENARIO_PLACEMENT;
    // GLTFLoader already converts Blender Z-up to Three.js Y-up.
    root.scale.setScalar(scale);
    root.position.set(0, 0, -centerZ * scale);
    root.updateMatrixWorld(true);
    return root;
  } catch (error) {
    disposeScenario(root, { materials: false });
    throw error;
  } finally {
    for (const parts of batches.values()) {
      for (const geometry of parts) geometry.dispose();
    }
    disposeScenario(source, { materials: false });
  }
}

export async function loadIceScenario({ loader = new GLTFLoader(), textureLoader = null } = {}) {
  const gltf = await loader.loadAsync(ICE_SCENARIO_URL);
  let scenario;
  try {
    scenario = prepareIceScenario(gltf.scene);
    if (textureLoader) {
      const snow = await textureLoader.loadAsync('/assets/textures/snow-ground.jpg');
      snow.colorSpace = SRGBColorSpace;
      snow.wrapS = snow.wrapT = RepeatWrapping;
      snow.anisotropy = 4;
      scenario.getObjectByName('ice-scenario-Snow').material.map = snow;
    }
    return scenario;
  } catch (error) {
    if (scenario) disposeScenario(scenario);
    else if (gltf.scene) disposeScenario(gltf.scene);
    throw error;
  }
}
