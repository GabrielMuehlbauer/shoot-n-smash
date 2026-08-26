export const RENDER_CONFIG = Object.freeze({
  camera: Object.freeze({
    fov: 65,
    near: 0.1,
    far: 120,
    position: Object.freeze({ x: 0, y: 1.65, z: 0 }),
    lookAt: Object.freeze({ x: 0, y: 0.9, z: -6 }),
  }),
  renderer: Object.freeze({
    maxPixelRatio: 2,
    clearColor: 0x07172f,
  }),
  ground: Object.freeze({
    size: 60,
    color: 0xe5f3f8,
  }),
  loop: Object.freeze({
    maxDeltaSeconds: 0.05,
    markerRotationRadiansPerSecond: 0.65,
  }),
});
