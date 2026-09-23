import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { FlyingIceEnemyVisual } from './gameplay/FlyingIceEnemyVisual.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111b);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 50);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.04).texture;
room.dispose();
pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xc9f4ff, 0x0a1624, 1.05));
const key = new THREE.DirectionalLight(0xe9fbff, 2.6);
key.position.set(4, 6, 7);
scene.add(key);
const rim = new THREE.DirectionalLight(0x3fd9ff, 1.7);
rim.position.set(-5, 3, -5);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(5, 48),
  new THREE.MeshStandardMaterial({ color: 0x10283a, roughness: 0.92 }),
);
floor.rotation.x = -Math.PI * 0.5;
floor.position.y = -1.25;
scene.add(floor);

const visual = new FlyingIceEnemyVisual();
visual.root.traverse((object) => {
  if (!object.isMesh) return;
  object.castShadow = true;
  object.receiveShadow = true;
});
scene.add(visual.root);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.05, 0);
controls.enableDamping = true;
const previewQuery = new URLSearchParams(location.search);
function setView(view) {
  const positions = {
    front: [0, 0.15, 7],
    side: [7, 0.15, 0],
    back: [0, 0.15, -7],
  };
  camera.position.set(...positions[view]);
  camera.lookAt(controls.target);
  controls.update();
}
setView(previewQuery.get('view') ?? 'front');

let triangles = 0;
let meshes = 0;
visual.root.traverse((object) => {
  if (!object.isMesh) return;
  meshes += 1;
  triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
});
document.getElementById('status').textContent = `${meshes} malhas - ${triangles} triangulos`;
for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => setView(button.dataset.view));
}

const originalMaterials = new Map();
for (const material of visual.materials) {
  originalMaterials.set(material, {
    color: material.color.clone(),
    emissive: material.emissive.clone(),
    emissiveIntensity: material.emissiveIntensity,
  });
}
const silhouetteInput = document.getElementById('silhouette');
function applySilhouette(enabled) {
  for (const material of visual.materials) {
    const original = originalMaterials.get(material);
    material.color.copy(enabled ? new THREE.Color(0x000000) : original.color);
    material.emissive.copy(enabled ? new THREE.Color(0x000000) : original.emissive);
    material.emissiveIntensity = enabled ? 0 : original.emissiveIntensity;
  }
}
silhouetteInput.addEventListener('change', (event) => applySilhouette(event.target.checked));
silhouetteInput.checked = previewQuery.get('silhouette') === '1';
applySilhouette(silhouetteInput.checked);
document.getElementById('animate').checked = previewQuery.get('animate') !== '0';

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
renderer.setAnimationLoop((time) => {
  if (document.getElementById('animate').checked) {
    visual.update({ elapsed: time / 1000 });
  }
  controls.update();
  renderer.render(scene, camera);
});
