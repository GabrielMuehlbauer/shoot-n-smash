import {
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Fog,
  Points,
  PointsMaterial,
} from 'three';

import { SNOW_ARENA_CONFIG } from '../config/snow-arena-config.js';

const TRANSITION_FIELDS = Object.freeze([
  'intensity',
  'fallSpeed',
  'windSpeed',
  'opacity',
  'particleSize',
  'fogNear',
  'fogFar',
]);

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function lerp(from, to, ratio) {
  return from + (to - from) * ratio;
}

export function resolveWeatherProfile(
  state,
  config = SNOW_ARENA_CONFIG.weather,
) {
  if (state?.status === 'boss' || state?.status === 'boss-pending') {
    return config.bossProfile;
  }

  if (state?.status === 'complete') {
    return config.bossProfile;
  }

  const wave = Number.isFinite(state?.wave) ? Math.trunc(state.wave) : 1;
  const index = Math.min(Math.max(wave - 1, 0), config.profiles.length - 1);
  return config.profiles[index];
}

export class SnowstormSystem {
  constructor({ scene, camera, config = SNOW_ARENA_CONFIG.weather } = {}) {
    if (!scene?.add || !camera?.position) {
      throw new TypeError('SnowstormSystem requer cena e cÃ¢mera vÃ¡lidas.');
    }

    this.scene = scene;
    this.camera = camera;
    this.config = config;
    this.random = createSeededRandom(config.seed);
    this.elapsedSeconds = 0;
    this.disposed = false;
    this.current = { ...config.profiles[0] };
    this.target = config.profiles[0];
    this.currentFogColor = new Color(this.current.fogColor);
    this.targetFogColor = new Color(this.target.fogColor);

    const positions = new Float32Array(config.maxParticleCount * 3);
    this.fallVariation = new Float32Array(config.maxParticleCount);
    this.windVariation = new Float32Array(config.maxParticleCount);

    for (let index = 0; index < config.maxParticleCount; index += 1) {
      const offset = index * 3;
      positions[offset] = (this.random() * 2 - 1) * config.radius;
      positions[offset + 1] =
        config.minY + this.random() * (config.maxY - config.minY);
      positions[offset + 2] = (this.random() * 2 - 1) * config.radius;
      this.fallVariation[index] = 0.68 + this.random() * 0.64;
      this.windVariation[index] = 0.55 + this.random() * 0.9;
    }

    this.geometry = new BufferGeometry();
    this.positionAttribute = new Float32BufferAttribute(positions, 3);
    this.positionAttribute.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setDrawRange(
      0,
      Math.round(config.maxParticleCount * this.current.intensity),
    );
    this.material = new PointsMaterial({
      color: 0xffffff,
      size: this.current.particleSize,
      transparent: true,
      opacity: this.current.opacity,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.name = 'progressive-snowstorm';
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.applyAtmosphere();
  }

  setWaveState(state) {
    if (this.disposed) {
      return false;
    }

    this.target = resolveWeatherProfile(state, this.config);
    this.targetFogColor.setHex(this.target.fogColor);
    return true;
  }

  applyAtmosphere() {
    if (!this.scene.background?.isColor) {
      this.scene.background = this.currentFogColor.clone();
    } else {
      this.scene.background.copy(this.currentFogColor);
    }

    if (!this.scene.fog?.isFog) {
      this.scene.fog = new Fog(
        this.currentFogColor,
        this.current.fogNear,
        this.current.fogFar,
      );
    } else {
      this.scene.fog.color.copy(this.currentFogColor);
      this.scene.fog.near = this.current.fogNear;
      this.scene.fog.far = this.current.fogFar;
    }
  }

  update(deltaSeconds) {
    if (this.disposed) {
      return false;
    }

    const delta = Math.max(0, Number(deltaSeconds) || 0);
    const transitionRatio = Math.min(
      1,
      delta / Math.max(this.config.transitionSeconds, Number.EPSILON),
    );
    for (const key of TRANSITION_FIELDS) {
      this.current[key] = lerp(this.current[key], this.target[key], transitionRatio);
    }
    this.currentFogColor.lerp(this.targetFogColor, transitionRatio);
    this.current.fogColor = this.currentFogColor.getHex();
    this.elapsedSeconds += delta;

    const positions = this.positionAttribute.array;
    const activeCount = Math.max(
      1,
      Math.round(this.config.maxParticleCount * this.current.intensity),
    );
    const gust =
      Math.sin(this.elapsedSeconds * 1.7) * 0.34 * this.current.intensity;
    const radius = this.config.radius;

    for (let index = 0; index < activeCount; index += 1) {
      const offset = index * 3;
      positions[offset] +=
        (this.current.windSpeed * this.windVariation[index] + gust) * delta;
      positions[offset + 1] -=
        this.current.fallSpeed * this.fallVariation[index] * delta;
      positions[offset + 2] += this.current.windSpeed * 0.18 * delta;

      if (positions[offset] > radius) {
        positions[offset] -= radius * 2;
      }
      if (positions[offset + 2] > radius) {
        positions[offset + 2] -= radius * 2;
      }
      if (positions[offset + 1] < this.config.minY) {
        positions[offset] = (this.random() * 2 - 1) * radius;
        positions[offset + 1] = this.config.maxY;
        positions[offset + 2] = (this.random() * 2 - 1) * radius;
      }
    }

    this.geometry.setDrawRange(0, activeCount);
    this.positionAttribute.needsUpdate = true;
    this.material.opacity = this.current.opacity;
    this.material.size = this.current.particleSize;
    this.points.position.set(
      this.camera.position.x,
      0,
      this.camera.position.z,
    );
    this.applyAtmosphere();
    return true;
  }

  dispose() {
    if (this.disposed) {
      return false;
    }

    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.disposed = true;
    return true;
  }
}
