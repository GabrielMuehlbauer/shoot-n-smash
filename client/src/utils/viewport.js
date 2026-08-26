function toSafeDimension(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 1;
  }

  return Math.max(1, Math.floor(numericValue));
}

export function calculateViewport(
  width,
  height,
  devicePixelRatio = 1,
  maxPixelRatio = 2,
) {
  const safeWidth = toSafeDimension(width);
  const safeHeight = toSafeDimension(height);
  const safeMaximum = Math.max(1, Number(maxPixelRatio) || 1);
  const safeDevicePixelRatio = Math.max(1, Number(devicePixelRatio) || 1);

  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    aspect: safeWidth / safeHeight,
    pixelRatio: Math.min(safeDevicePixelRatio, safeMaximum),
  });
}

export function resizeRendererToContainer({
  container,
  camera,
  renderer,
  devicePixelRatio = 1,
  maxPixelRatio = 2,
}) {
  const bounds = container.getBoundingClientRect();
  const viewport = calculateViewport(
    bounds.width,
    bounds.height,
    devicePixelRatio,
    maxPixelRatio,
  );

  camera.aspect = viewport.aspect;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(viewport.pixelRatio);
  renderer.setSize(viewport.width, viewport.height, false);

  return viewport;
}
