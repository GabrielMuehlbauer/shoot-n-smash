import { Group } from 'three';

// The reference GLB was composed for a frontal camera. Fill the reverse view
// with its own reusable meshes, so turning around never exposes an empty edge.
export function addIceBackdrop(source, { scale, centerZ }) {
  const existing = source.getObjectByName('Rear_Backdrop');
  if (existing) return existing.userData;
  const pines = source.getObjectByName('Snow_Pines')?.children.slice(0, 4);
  const mountains = source.getObjectByName('Mountains')?.children.slice(0, 7);
  const rocks = source.getObjectByName('Ice_Rocks')?.children.filter((o) => /^Ice_Rock_\d+$/.test(o.name)).slice(0, 6);
  if (!pines?.length || !mountains?.length || !rocks?.length) {
    throw new Error('O cenário não contém as peças para completar o horizonte.');
  }
  const backdrop = new Group();
  backdrop.name = 'Rear_Backdrop';
  const counts = { trees: 0, mountains: 0, rocks: 0, triangles: 0 };
  function place(prototype, name, angle, radius, size, elevation = 0) {
    const object = prototype.clone(true);
    object.name = name;
    object.position.set(Math.cos(angle) * radius / scale, elevation / scale,
      Math.sin(angle) * radius / scale + centerZ);
    object.rotation.set(0, angle + 0.37, 0);
    object.scale.setScalar(size);
    object.traverse((child) => {
      if (child.isMesh) {
        counts.triangles += (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3;
      }
    });
    backdrop.add(object);
    return object;
  }

  // Overlapping peaks close the skyline, including the joins to both sides.
  for (let i = 0; i < 11; i++) {
    const angle = -0.14 + i * (Math.PI + 0.28) / 10;
    place(mountains[i % mountains.length], `Rear_Mountain_${i}`, angle,
      100 + Math.sin(i * 1.9) * 5, 0.70 + (i % 3) * 0.10, -1);
    counts.mountains++;
  }
  // Staggered tree lines leave a broad, clear combat floor in the foreground.
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 25; i++) {
      const angle = -0.08 + (i + row * 0.38) * (Math.PI + 0.16) / 24;
      const radius = 48 + row * 20 + Math.sin(i * 2.7 + row) * 5;
      place(pines[(i + row) % pines.length], `Rear_Pine_${row}_${i}`, angle,
        radius, 0.62 + ((i * 7 + row) % 9) * 0.055, -0.25);
      counts.trees++;
    }
  }
  for (let i = 0; i < 22; i++) {
    const angle = 0.04 + i * (Math.PI - 0.08) / 21;
    const radius = 34 + (i % 4) * 2.8;
    place(rocks[i % rocks.length], `Rear_Rock_${i}`, angle,
      radius, 0.7 + (i % 3) * 0.22, 0.8);
    counts.rocks++;
  }
  backdrop.userData = counts;
  source.add(backdrop);
  return counts;
}
