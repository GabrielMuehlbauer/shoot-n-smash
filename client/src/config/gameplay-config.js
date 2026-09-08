const freeze = (value) => Object.freeze(value);

const ENEMY_TYPES = freeze([
  freeze({
    id: 'weak',
    label: 'Fraco',
    maxResistance: 1,
    damage: 1,
    color: 0x6edcff,
  }),
  freeze({
    id: 'medium',
    label: 'Médio',
    maxResistance: 2,
    damage: 2,
    color: 0x6f8cff,
  }),
  freeze({
    id: 'resistant',
    label: 'Resistente',
    maxResistance: 3,
    damage: 3,
    color: 0x9e6fff,
  }),
]);

export const GAMEPLAY_CONFIG = freeze({
  player: freeze({
    initialHealth: 100,
    maxHealth: 100,
  }),
  waves: freeze({
    interWaveDelaySeconds: 2.5,
    definitions: freeze([
      freeze({
        number: 1,
        enemyCount: 3,
        spawnIntervalSeconds: 1.25,
        moveSpeed: 1.15,
        typeIds: freeze(['weak']),
      }),
      freeze({
        number: 2,
        enemyCount: 4,
        spawnIntervalSeconds: 1.1,
        moveSpeed: 1.25,
        typeIds: freeze(['weak', 'medium']),
      }),
      freeze({
        number: 3,
        enemyCount: 5,
        spawnIntervalSeconds: 0.95,
        moveSpeed: 1.4,
        typeIds: freeze(['weak', 'medium', 'resistant']),
      }),
      freeze({
        number: 4,
        enemyCount: 6,
        spawnIntervalSeconds: 0.8,
        moveSpeed: 1.6,
        typeIds: freeze(['weak', 'medium', 'resistant']),
      }),
    ]),
  }),
  boss: freeze({
    spawnDelaySeconds: 3,
    moveSpeed: 0.85,
    radius: 2.2,
    visualScale: 2.35,
    spawnHeight: 2.2,
    type: freeze({
      id: 'boss',
      label: 'Chefão',
      maxResistance: 10,
      damage: 10,
      color: 0xc7f3ff,
    }),
  }),
  score: freeze({
    enemyElimination: freeze({
      weak: 100,
      medium: 250,
      resistant: 500,
      boss: 2000,
    }),
    waveCompleted: 500,
    phaseCompleted: 1000,
  }),
  charge: freeze({
    durationSeconds: 1.2,
  }),
  xr: freeze({
    referenceSpaceType: 'local-floor',
    pullDistance: freeze({
      minimum: 0.12,
      maximum: 0.72,
    }),
  }),
  slingshotVisual: freeze({
    position: freeze({ x: 0.32, y: -0.32, z: -0.72 }),
    handle: freeze({
      length: 0.34,
      radius: 0.048,
    }),
    fork: freeze({
      tipX: 0.17,
      tipY: 0.26,
      radius: 0.032,
    }),
    pouch: freeze({
      y: 0.1,
      radius: 0.085,
      restZ: 0.015,
      pullDistance: 0.42,
    }),
    loadedBall: freeze({
      radius: 0.105,
    }),
    band: freeze({
      width: 1,
    }),
    trajectory: freeze({
      pointCount: 22,
      stepSeconds: 0.075,
      pointSize: 0.075,
    }),
    colors: freeze({
      wood: 0x8a4f2a,
      pouch: 0x352117,
      band: 0xf1c27d,
      snowball: 0xf4fbff,
      snowballEmissive: 0x173845,
      specialBall: 0xffc857,
      specialBallEmissive: 0x8f4f00,
      trajectory: 0xc8f4ff,
      specialTrajectory: 0xffd978,
    }),
  }),
  projectile: freeze({
    radius: 0.18,
    widthSegments: 16,
    heightSegments: 12,
    color: 0xf4fbff,
    emissiveColor: 0x173845,
    emissiveIntensity: 0.08,
    specialColor: 0xffc857,
    specialEmissiveColor: 0x8f4f00,
    specialEmissiveIntensity: 0.85,
    roughness: 0.92,
    minSpeed: 10,
    maxSpeed: 24,
    spawnOffset: freeze({ x: 0.32, y: -0.22, z: -0.72 }),
    gravity: -9.8,
    groundY: 0.18,
    lifetimeSeconds: 5,
    horizontalLimit: 40,
    maxActive: 24,
    hitStrength: 1,
  }),
  items: freeze({
    radius: 0.62,
    lifetimeSeconds: 12,
    spawnChanceByWave: freeze([0.12, 0.2, 0.3, 0.4]),
    spawn: freeze({
      minRadius: 6,
      maxRadius: 10,
      height: 1.35,
    }),
    animation: freeze({
      bobAmplitude: 0.16,
      bobAngularSpeed: 2.8,
      rotationSpeed: 1.25,
    }),
    types: freeze([
      freeze({
        id: 'health',
        label: 'Vida',
        weight: 0.55,
        color: 0x56e39f,
        emissiveColor: 0x123f31,
        effect: freeze({
          kind: 'heal',
          amount: 20,
        }),
      }),
      freeze({
        id: 'special-ammo',
        label: 'Munição especial',
        weight: 0.45,
        color: 0xffc857,
        emissiveColor: 0x4a2d08,
        effect: freeze({
          kind: 'special-ammo',
          shots: 3,
          maxShots: 6,
          hitStrength: 2,
        }),
      }),
    ]),
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
