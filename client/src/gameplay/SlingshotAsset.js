import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const SLINGSHOT_ASSET_URL = '/models/slingshot_final.glb';
const REQUIRED_PARTS = ['Wood_Frame', 'Grip_Wrap', 'Band_L', 'Band_R', 'Leather_Pouch', 'Ice_Details'];

export function disposeSlingshotAsset(scene) {
  const resources = new Set();
  scene.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) resources.add(material);
  });
  for (const resource of resources) resource.dispose();
}

// The source asset stays unrigged and editable. This small runtime adapter
// retains the existing shot interaction without bones or animation clips.
export function prepareSlingshotAsset(
  scene,
  config,
  { overlay = true, pullDirection = 1, scale = 0.88 } = {},
) {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('A escala do estilingue deve ser maior que zero.');
  }

  if (![1, -1].includes(pullDirection)) {
    throw new RangeError('A direção de tensão do estilingue deve ser 1 ou -1.');
  }

  const root = scene.getObjectByName('Slingshot_Root');
  if (!root || REQUIRED_PARTS.some((name) => !root.getObjectByName(name)?.isMesh)) {
    throw new Error('O GLB do estilingue não contém todas as peças necessárias.');
  }
  const pouch = root.getObjectByName('Leather_Pouch');
  const restPouch = pouch.position.clone();
  scene.scale.setScalar(scale);
  scene.position.set(0, config.pouch.y - restPouch.y * scale, config.pouch.restZ - restPouch.z * scale);
  const bands = ['Band_L', 'Band_R'].map((name) => {
    const band = root.getObjectByName(name);
    const toThree = ([x, y, z]) => new Vector3(x, z, -y);
    const tip = toThree(band.userData.tip_blender);
    const end = toThree(band.userData.pouch_attachment_blender);
    const direction = end.clone().sub(tip);
    const lengthSquared = direction.lengthSq();
    const positions = band.geometry.attributes.position;
    const weights = new Float32Array(positions.count);
    const point = new Vector3();
    for (let i = 0; i < positions.count; i++) {
      const t = point.fromBufferAttribute(positions, i).sub(tip).dot(direction) / lengthSquared;
      // Clamp attachment cross sections together, keeping the tip fixed.
      weights[i] = t < .05 ? 0 : t > .95 ? 1 : Math.max(0, Math.min(1, t));
    }
    return { band, base: positions.array.slice(), weights };
  });
  scene.traverse((object) => {
    if (!object.isMesh) return;
    if (overlay) {
      object.renderOrder = 20;
      // Same first-person overlay as the original visual; no world clipping.
      object.material.transparent = true;
      object.material.depthTest = false;
      object.material.depthWrite = false;
    }
  });
  let lastDistance = null;
  return {
    scene,
    setPull(distance) {
      const safeDistance = Math.max(0, Number(distance) || 0);
      if (safeDistance === lastDistance) return;
      lastDistance = safeDistance;
      const offset = (safeDistance / scale) * pullDirection;
      pouch.position.copy(restPouch);
      pouch.position.z += offset;
      for (const { band, base, weights } of bands) {
        const positions = band.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          positions.setXYZ(i, base[i*3], base[i*3+1], base[i*3+2] + offset*weights[i]);
        }
        positions.needsUpdate = true;
        band.geometry.computeVertexNormals();
        band.geometry.computeBoundingSphere();
      }
    },
    dispose() { disposeSlingshotAsset(scene); },
  };
}

export async function loadSlingshotAsset({
  config,
  loader = new GLTFLoader(),
  prepareOptions,
}) {
  const { scene } = await loader.loadAsync(SLINGSHOT_ASSET_URL);
  try {
    return prepareSlingshotAsset(scene, config, prepareOptions);
  } catch (error) {
    disposeSlingshotAsset(scene);
    throw error;
  }
}
