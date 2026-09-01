const freeze = (value) => Object.freeze(value);

const ENEMY_TYPES = freeze([
  freeze({
    id: 'weak',
    label: 'Fraco',
    maxResistance: 1,
    color: 0x6edcff,
  }),
  freeze({
    id: 'medium',
    label: 'Médio',
    maxResistance: 2,
    color: 0x6f8cff,
  }),
  freeze({
    id: 'resistant',
    label: 'Resistente',
    maxResistance: 3,
    color: 0x9e6fff,
  }),
]);

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
    hitStrength: 1,
  }),
  enemy: freeze({
    radius: 1.05,
    types: ENEMY_TYPES,
    moveSpeed: 1.25,
    playerContactRadius: 1.5,
    playerPosition: freeze({ x: 0, y: 1.05, z: 0 }),
    spawn: freeze({
      minRadius: 17,
      maxRadius: 20,
      height: 1.05,
    }),
    animation: freeze({
      bobAmplitude: 0.07,
      bobAngularSpeed: 5.2,
      limbSwingAmplitude: 0.32,
    }),
    colors: freeze({
      damaged: 0xffb45f,
      destroyed: 0x4c6175,
      emissive: 0x0c4c66,
      eyes: 0x08283a,
      horns: 0xd9f7ff,
    }),
  }),
  impactFeedback: freeze({
    lifetimeSeconds: 0.32,
    maxActive: 12,
    startScale: 0.18,
    endScale: 0.72,
    color: 0xffffff,
  }),
});
