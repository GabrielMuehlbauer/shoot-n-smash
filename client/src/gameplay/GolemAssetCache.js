import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const INSTANCE_FLAG = 'shared-golem-asset-instance';

function cloneMaterials(root) {
  const clones = new Map();
  const cloneMaterial = (material) => {
    if (!clones.has(material)) clones.set(material, material.clone());
    return clones.get(material);
  };

  root.traverse((object) => {
    if (Array.isArray(object.material)) {
      object.material = object.material.map(cloneMaterial);
    } else if (object.material) {
      object.material = cloneMaterial(object.material);
    }
  });
}

export function cloneGolemAsset(template) {
  const instance = cloneSkeleton(template);
  cloneMaterials(instance);
  instance.userData[INSTANCE_FLAG] = true;
  return instance;
}

export function disposeGolemAsset(scene) {
  const geometries = new Set();
  const materials = new Set();
  const sharesCachedGeometry = scene?.userData?.[INSTANCE_FLAG] === true;

  scene?.traverse?.((object) => {
    if (object.geometry && !sharesCachedGeometry) geometries.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      materials.add(material);
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

export function createGolemAssetCache({ url, prepare }) {
  let template = null;
  let pending = null;

  const preload = (loader) => {
    if (template) return Promise.resolve(template);
    if (pending) return pending;

    pending = Promise.resolve()
      .then(() => loader.loadAsync(url))
      .then(({ scene }) => {
        try {
          template = prepare(scene);
          return template;
        } catch (error) {
          disposeGolemAsset(scene);
          throw error;
        }
      })
      .catch((error) => {
        pending = null;
        throw error;
      });

    return pending;
  };

  return Object.freeze({
    create() {
      return template ? cloneGolemAsset(template) : null;
    },
    async load(loader) {
      await preload(loader);
      return cloneGolemAsset(template);
    },
    preload,
  });
}
