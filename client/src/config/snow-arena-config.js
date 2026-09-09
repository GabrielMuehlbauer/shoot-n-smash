const freezePlacement = (placement) => Object.freeze({ ...placement });
const freezePlacements = (placements) =>
  Object.freeze(placements.map(freezePlacement));

export const SNOW_ARENA_CONFIG = Object.freeze({
  playerClearanceRadius: 4,
  mountainClearanceRadius: 14,
  meshBudget: Object.freeze({
    maximum: 10,
    outsideArena: 2,
  }),
  fog: Object.freeze({
    color: 0x93b8cb,
    near: 24,
    far: 68,
  }),
  island: Object.freeze({
    radiusTop: 30,
    radiusBottom: 34,
    depth: 2.4,
    segments: 64,
    iceColor: 0x5d91ad,
    snowColor: 0xe8f5f8,
  }),
  icePatches: freezePlacements([
    { x: -5.8, z: -5.4, radius: 2.1, scaleX: 1, scaleZ: 0.56, rotation: -0.28 },
    { x: -9.4, z: 2.8, radius: 2.5, scaleX: 1, scaleZ: 0.48, rotation: 0.17 },
    { x: 8.8, z: 5.1, radius: 2.2, scaleX: 0.64, scaleZ: 1, rotation: -0.51 },
  ]),
  rocks: freezePlacements([
    { x: -7.8, z: -11.2, scale: 0.9, rotation: 0.35 },
    { x: 8.9, z: -12.6, scale: 1.25, rotation: -0.62 },
    { x: 13.8, z: -3.4, scale: 0.8, rotation: 0.91 },
    { x: 11.7, z: 9.8, scale: 1.05, rotation: -0.16 },
    { x: -6.3, z: 13.4, scale: 1.15, rotation: 0.48 },
    { x: -14.1, z: 5.8, scale: 0.76, rotation: -0.77 },
  ]),
  mountains: freezePlacements([
    { x: -21, z: -25, radius: 5.8, height: 12.5, rotation: 0.15 },
    { x: -8, z: -29, radius: 6.4, height: 15.5, rotation: -0.21 },
    { x: 7, z: -30, radius: 5.2, height: 11.8, rotation: 0.43 },
    { x: 21, z: -24, radius: 6.9, height: 16.2, rotation: -0.37 },
    { x: 27, z: 12, radius: 6.2, height: 14.9, rotation: -0.12 },
    { x: 13, z: 27, radius: 5.8, height: 13.6, rotation: 0.29 },
    { x: -7, z: 29, radius: 6.7, height: 16.8, rotation: -0.46 },
    { x: -29, z: 1, radius: 6.1, height: 15.1, rotation: -0.33 },
  ]),
  snowfall: Object.freeze({
    count: 360,
    radius: 30,
    minY: 1.2,
    maxY: 18,
    color: 0xffffff,
    size: 0.1,
    opacity: 0.72,
    rotationRadiansPerSecond: 0.018,
    seed: 0x51a7f10,
  }),
});
