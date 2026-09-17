import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  createWeakGolemRig,
  disposeWeakGolemAsset,
  prepareWeakGolemAsset,
} from './WeakGolemAsset.js';

export const MEDIUM_GOLEM_URL = '/assets/models/ice_golem_medium.glb';
export const MEDIUM_GOLEM_SOURCE_HEIGHT = 4.5;
export const MEDIUM_GOLEM_GAME_HEIGHT = 2.45;

export const disposeMediumGolemAsset = disposeWeakGolemAsset;
export const createMediumGolemRig = createWeakGolemRig;

export function prepareMediumGolemAsset(scene) {
  return prepareWeakGolemAsset(scene);
}

export async function loadMediumGolemAsset({ loader = new GLTFLoader() } = {}) {
  const { scene } = await loader.loadAsync(MEDIUM_GOLEM_URL);
  try {
    return prepareMediumGolemAsset(scene);
  } catch (error) {
    if (scene) disposeMediumGolemAsset(scene);
    throw error;
  }
}
