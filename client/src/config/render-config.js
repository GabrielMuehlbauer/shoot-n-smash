export const RENDER_CONFIG = Object.freeze({
  xr: Object.freeze({
    referenceSpaceType: 'local-floor',
  }),
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
  loop: Object.freeze({
    maxDeltaSeconds: 0.05,
    beaconRotationRadiansPerSecond: 0.65,
  }),
});
