import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GAMEPLAY_CONFIG } from '../config/gameplay-config.js';
import { disposeSlingshotAsset, loadSlingshotAsset, SLINGSHOT_ASSET_URL } from './SlingshotAsset.js';
import { SlingshotVisualSystem } from './SlingshotVisualSystem.js';

const publicFile = new URL('../../public/models/slingshot_final.glb', import.meta.url);

async function readAsset() {
  const bytes = await readFile(publicFile);
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

function createVisual(assetLoader) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(65, 16/9, .1, 500);
  camera.position.set(0, 1.65, 0);
  const visual = new SlingshotVisualSystem({ scene, camera, assetLoader });
  return { visual, scene, camera };
}

test('GLB final contém seis peças, quatro materiais leves e geometria dentro do orçamento', async () => {
  const { scene } = await readAsset();
  const root = scene.getObjectByName('Slingshot_Root');
  assert.ok(root);
  assert.deepEqual(root.position.toArray(), [0, 0, 0], 'não usar extras.pivot reservado pelo GLTFLoader');
  assert.equal(root.children.length, 6);
  const materials = new Set();
  let vertices = 0;
  let triangles = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    assert.ok(object.matrixWorld.elements.every(Number.isFinite));
    assert.deepEqual(object.scale.toArray(), [1, 1, 1]);
    assert.ok(!object.isCamera && !object.isLight);
    if (!object.isMesh) return;
    assert.ok(object.geometry.attributes.normal);
    const positions = object.geometry.attributes.position;
    assert.ok(positions.array.every(Number.isFinite));
    vertices += positions.count;
    triangles += (object.geometry.index?.count ?? positions.count) / 3;
    materials.add(object.material);
    assert.equal(object.material.metalness, 0);
    assert.equal(object.material.map, null);
    assert.equal(object.material.normalMap, null);
    if (object.material.name !== 'Ice_Detail') assert.ok(object.geometry.attributes.color);
  });
  assert.equal(triangles, 3608);
  assert.ok(triangles < 5000);
  assert.ok(vertices < 10_000, 'inclui vértices separados por normais/cores na exportação');
  assert.deepEqual([...materials].map((m) => m.name).sort(), ['Ice_Detail','Leather','Rubber','Wood_Main']);
  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  assert.ok(size.y >= .55 && size.y <= .75, 'glTF Y-up com altura em metros');
  assert.ok(Math.abs(bounds.getCenter(new Vector3()).x) < .025);
  const gripBounds = new Box3().setFromObject(root.getObjectByName('Grip_Wrap'));
  assert.ok(gripBounds.containsPoint(new Vector3()), 'pivô está na região da empunhadura');
  for (const name of ['Wood_Frame','Grip_Wrap','Band_L','Band_R','Leather_Pouch','Ice_Details']) {
    assert.ok(root.getObjectByName(name)?.isMesh, name);
  }
  assert.ok((await readFile(publicFile)).length < 400_000);
  assert.deepEqual(await readFile(publicFile), await readFile(new URL('../../../slingshot_final.glb', import.meta.url)));
  disposeSlingshotAsset(scene);
});

test('puxa elásticos volumétricos sem mover madeira e restaura exatamente a geometria', async () => {
  const asset = await loadSlingshotAsset({ config: GAMEPLAY_CONFIG.slingshotVisual, loader: { loadAsync: readAsset } });
  const scene = asset.scene;
  const wood = scene.getObjectByName('Wood_Frame');
  const pouch = scene.getObjectByName('Leather_Pouch');
  const woodBase = wood.geometry.attributes.position.array.slice();
  const pouchRest = pouch.position.clone();
  const bands = ['Band_L','Band_R'].map((name) => {
    const mesh = scene.getObjectByName(name);
    return { mesh, base: mesh.geometry.attributes.position.array.slice() };
  });
  asset.setPull(.42);
  assert.ok(Math.abs((pouch.position.z - pouchRest.z) * scene.scale.z - .42) < 1e-6);
  for (const { mesh, base } of bands) {
    const positions = mesh.geometry.attributes.position;
    let pinned = 0, moved = 0;
    for (let i = 0; i < positions.count; i++) {
      assert.equal(positions.getX(i), base[i*3]);
      assert.equal(positions.getY(i), base[i*3+1]);
      const displacement = positions.getZ(i) - base[i*3+2];
      if (Math.abs(displacement) < 1e-6) pinned++;
      if (Math.abs(displacement * scene.scale.z - .42) < 1e-6) moved++;
    }
    assert.ok(pinned >= 8 && moved >= 8, 'fixação na madeira e conexão móvel ao bolso');
    assert.ok(positions.count > 50 && mesh.isMesh, 'elásticos não são linhas');
    assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));
  }
  assert.deepEqual(wood.geometry.attributes.position.array, woodBase);
  asset.setPull(0);
  assert.deepEqual(pouch.position.toArray(), pouchRest.toArray());
  for (const { mesh, base } of bands) assert.deepEqual(mesh.geometry.attributes.position.array, base);
  asset.dispose();
});

test('substitui o visual antigo e preserva carga, munição e trajetória', async () => {
  const { visual } = createVisual({ loadAsync: async (url) => {
    assert.equal(url, SLINGSHOT_ASSET_URL);
    return readAsset();
  } });
  visual.update({ charging: true, ratio: .5, speed: 17, ammoType: 'special' });
  assert.equal(await visual.assetLoadPromise, true);
  assert.equal(visual.assetStatus, 'ready');
  assert.equal(visual.root.getObjectByName('slingshot-handle').visible, false);
  assert.equal(visual.leftBand.visible, false);
  assert.equal(visual.pouch.visible, false);
  assert.equal(visual.loadedBall.visible, true);
  assert.equal(visual.loadedBall.material, visual.loadedBallMaterials.special);
  assert.ok(visual.trajectory.geometry.drawRange.count > 0);
  const pouch = visual.asset.scene.getObjectByName('Leather_Pouch');
  visual.root.updateMatrixWorld(true);
  const point = visual.root.worldToLocal(pouch.getWorldPosition(new Vector3()));
  assert.ok(Math.abs(point.y - GAMEPLAY_CONFIG.slingshotVisual.pouch.y) < 1e-6);
  assert.ok(Math.abs(point.z - visual.pouch.position.z) < 1e-6);
  visual.update({ charging: false, ratio: 0, speed: 10 });
  assert.equal(visual.loadedBall.visible, false);
  visual.setVisible(false);
  assert.equal(visual.root.visible, false);
  const resources = new Set();
  visual.asset.scene.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    if (object.material) resources.add(object.material);
  });
  let releases = 0;
  for (const resource of resources) resource.addEventListener('dispose', () => releases++);
  visual.dispose();
  visual.dispose();
  assert.equal(releases, resources.size);
});

test('falha no download conserva o estilingue funcional e não rejeita a inicialização', async (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const failure = new Error('GLB indisponível');
  const { visual } = createVisual({ loadAsync: async () => { throw failure; } });
  assert.equal(await visual.assetLoadPromise, false);
  assert.equal(visual.assetStatus, 'error');
  assert.equal(visual.assetError, failure);
  assert.equal(visual.root.getObjectByName('slingshot-handle').visible, true);
  assert.equal(warning.mock.callCount(), 1);
  assert.equal(visual.update({ charging: true, ratio: 1, speed: 20 }), true);
  visual.dispose();
});

test('sair enquanto carrega libera o GLB atrasado sem reanexar objetos', async () => {
  const gltf = await readAsset();
  const resources = new Set();
  gltf.scene.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    if (object.material) resources.add(object.material);
  });
  let releases = 0;
  for (const resource of resources) resource.addEventListener('dispose', () => releases++);
  let resolve;
  const { visual, scene } = createVisual({ loadAsync: () => new Promise((done) => { resolve = done; }) });
  visual.dispose();
  resolve(gltf);
  assert.equal(await visual.assetLoadPromise, false);
  assert.equal(scene.children.length, 0);
  assert.equal(releases, resources.size);
});
