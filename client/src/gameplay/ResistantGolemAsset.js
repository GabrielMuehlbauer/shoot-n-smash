import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  createWeakGolemRig,
  disposeWeakGolemAsset,
  prepareWeakGolemAsset,
} from './WeakGolemAsset.js';
import { createGolemAssetCache } from './GolemAssetCache.js';

export const RESISTANT_GOLEM_URL = '/assets/models/ice_golem_resistant.glb';
export const RESISTANT_GOLEM_SOURCE_HEIGHT = 4.5;
export const RESISTANT_GOLEM_GAME_HEIGHT = 2.7;

export const disposeResistantGolemAsset = disposeWeakGolemAsset;
export const createResistantGolemRig = createWeakGolemRig;

export function prepareResistantGolemAsset(scene) {
  return prepareWeakGolemAsset(scene);
}

const assetCache = createGolemAssetCache({
  url: RESISTANT_GOLEM_URL,
  prepare: prepareResistantGolemAsset,
});

export function createCachedResistantGolemAsset() {
  return assetCache.create();
}

export function preloadResistantGolemAsset({ loader = new GLTFLoader() } = {}) {
  return assetCache.preload(loader);
}

export async function loadResistantGolemAsset({ loader = new GLTFLoader() } = {}) {
  return assetCache.load(loader);
}
