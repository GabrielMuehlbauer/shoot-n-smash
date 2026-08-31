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
  target: freeze({
    position: freeze({ x: 4, y: 2.15, z: -11 }),
    radius: 1.25,
    maxHealth: 100,
    damagePerHit: 25,
    colors: freeze({
      active: 0x79d9ff,
      damaged: 0xffb45f,
      destroyed: 0x4c6175,
      emissive: 0x0c4c66,
    }),
  }),
});
