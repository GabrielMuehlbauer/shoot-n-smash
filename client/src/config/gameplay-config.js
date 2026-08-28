const freeze = (value) => Object.freeze(value);

export const GAMEPLAY_CONFIG = freeze({
  charge: freeze({
    durationSeconds: 1.2,
  }),
  projectile: freeze({
    radius: 0.18,
    widthSegments: 16,
    heightSegments: 12,
    color: 0xf4fbff,
    emissiveColor: 0x173845,
    emissiveIntensity: 0.08,
    roughness: 0.92,
    minSpeed: 10,
    maxSpeed: 24,
    spawnDistance: 0.72,
    gravity: -9.8,
    groundY: 0.18,
    lifetimeSeconds: 5,
    horizontalLimit: 40,
    maxActive: 24,
  }),
});
