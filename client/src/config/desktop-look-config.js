const MAX_PITCH_RADIANS = (85 * Math.PI) / 180;

export const DESKTOP_LOOK_CONFIG = Object.freeze({
  pointerSpeed: 1,
  minPolarAngle: Math.PI / 2 - MAX_PITCH_RADIANS,
  maxPolarAngle: Math.PI / 2 + MAX_PITCH_RADIANS,
  unadjustedMovement: false,
});
