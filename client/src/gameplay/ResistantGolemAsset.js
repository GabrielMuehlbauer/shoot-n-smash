import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  createWeakGolemRig,
  disposeWeakGolemAsset,
  prepareWeakGolemAsset,
} from './WeakGolemAsset.js';

export const RESISTANT_GOLEM_URL = '/assets/models/ice_golem_resistant.glb';
export const RESISTANT_GOLEM_SOURCE_HEIGHT = 4.5;
export const RESISTANT_GOLEM_GAME_HEIGHT = 2.7;

export const disposeResistantGolemAsset = disposeWeakGolemAsset;
export const createResistantGolemRig = createWeakGolemRig;

export function prepareResistantGolemAsset(scene) {
  return prepareWeakGolemAsset(scene);
}

export async function loadResistantGolemAsset({ loader = new GLTFLoader() } = {}) {
  const { scene } = await loader.loadAsync(RESISTANT_GOLEM_URL);
  try {
    return prepareResistantGolemAsset(scene);
  } catch (error) {
    if (scene) disposeResistantGolemAsset(scene);
    throw error;
  }
}
