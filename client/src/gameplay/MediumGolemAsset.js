import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  createWeakGolemRig,
  disposeWeakGolemAsset,
  prepareWeakGolemAsset,
} from './WeakGolemAsset.js';
import { createGolemAssetCache } from './GolemAssetCache.js';

export const MEDIUM_GOLEM_URL = '/assets/models/ice_golem_medium.glb';
export const MEDIUM_GOLEM_SOURCE_HEIGHT = 4.5;
export const MEDIUM_GOLEM_GAME_HEIGHT = 2.45;

export const disposeMediumGolemAsset = disposeWeakGolemAsset;
export const createMediumGolemRig = createWeakGolemRig;

export function prepareMediumGolemAsset(scene) {
  return prepareWeakGolemAsset(scene);
}

const assetCache = createGolemAssetCache({
  url: MEDIUM_GOLEM_URL,
  prepare: prepareMediumGolemAsset,
});

export function createCachedMediumGolemAsset() {
  return assetCache.create();
}

export function preloadMediumGolemAsset({ loader = new GLTFLoader() } = {}) {
  return assetCache.preload(loader);
}

export async function loadMediumGolemAsset({ loader = new GLTFLoader() } = {}) {
  return assetCache.load(loader);
}
