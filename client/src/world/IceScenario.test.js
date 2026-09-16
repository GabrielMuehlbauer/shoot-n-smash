import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Box3, Raycaster, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RenderContext } from '../core/RenderContext.js';
import { disposeScenario, loadIceScenario, prepareIceScenario, ICE_SCENARIO_URL } from './IceScenario.js';

async function readScenario() {
  const bytes = await readFile(new URL('../../public/assets/models/ice_scenario.glb', import.meta.url));
  return new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
  );
}

test('GLB preserva a geometria com piso circular distinto e combate livre', async () => {
  const gltf = await readScenario();
  let sourceTriangles = 0;
  gltf.scene.traverse((object) => {
    if (object.isMesh) {
      sourceTriangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    }
    assert.ok(!object.isCamera && !object.isLight);
  });
  const scenario = prepareIceScenario(gltf.scene);
  assert.equal(scenario.scale.x, scenario.scale.y, 'escala vertical deve preservar as proporções');
  assert.equal(scenario.scale.y, scenario.scale.z);
  assert.equal(scenario.children.length, 9);
  const floor = scenario.getObjectByName('ice-scenario-Arena_Ice_Top');
  assert.ok(floor, 'a plataforma tem material próprio para se destacar da neve');
  const floorBounds = new Box3().setFromObject(floor, true);
  assert.ok(Math.abs(floorBounds.getCenter(new Vector3()).z + 36.5) < 0.01);
  assert.ok(floorBounds.max.z < -22.2, 'plataforma fora do raio de combate');
  assert.ok(floorBounds.max.y > 0.7 && floorBounds.max.y < 1, 'plataforma elevada visível');
  assert.equal(scenario.children.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count / 3, 0), sourceTriangles + scenario.userData.backdrop.triangles);
  assert.ok(sourceTriangles > 90_000);
  assert.ok(scenario.children.some((mesh) => mesh.material.name === 'Emission_Warm' && mesh.material.emissiveIntensity > 0));
  assert.ok(scenario.children.every((mesh) => mesh.geometry.attributes.normal));
  assert.ok(scenario.getObjectByName('ice-scenario-Snow').geometry.attributes.uv);
  assert.ok(scenario.getObjectByName('ice-scenario-Emission_Blue').material.emissiveIntensity < 0.2);

  // The player and the full 20 m spawn ring stand on snow at Y=0.
  for (const radius of [0, 17, 20, 22.2]) {
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const ray = new Raycaster(new Vector3(Math.cos(angle) * radius, 8, Math.sin(angle) * radius), new Vector3(0, -1, 0));
      const hit = ray.intersectObject(scenario, true)[0];
      assert.ok(hit, `piso ausente no raio ${radius}`);
      assert.ok(Math.abs(hit.point.y) < 0.1, `piso desalinhado: ${hit.point.y}`);
    }
  }
  disposeScenario(scenario);
});

test('a vista traseira possui cenário em todos os setores do horizonte', async () => {
  const gltf = await readScenario();
  const scene = prepareIceScenario(gltf.scene);
  assert.equal(scene.userData.backdrop.trees, 50);
  assert.equal(scene.userData.backdrop.mountains, 11);
  assert.equal(scene.userData.backdrop.rocks, 22);
  for (let i = 0; i <= 24; i++) {
    const angle = i * Math.PI / 24;
    const ray = new Raycaster(new Vector3(0, 6, 0),
      new Vector3(Math.cos(angle), 0, Math.sin(angle)), 26, 180);
    assert.ok(ray.intersectObject(scene, true).length > 0,
      `horizonte vazio no setor traseiro ${i}`);
  }
  const triangles = scene.children.reduce((total, mesh) => total + mesh.geometry.attributes.position.count / 3, 0);
  assert.ok(triangles < 200_000);
  assert.equal(scene.children.length, 9, 'o preenchimento reutiliza os mesmos lotes de materiais');
  disposeScenario(scene);
});

test('montanhas têm relevo detalhado e rochas têm neve na própria superfície', async () => {
  const { scene } = await readScenario();
  function triangles(root) {
    let total = 0;
    root.traverse((object) => {
      if (object.isMesh) total += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    });
    return total;
  }
  const mountain = scene.getObjectByName('Mountain_00');
  assert.ok(triangles(mountain) >= 1500);
  const levels = new Set();
  mountain.traverse((object) => {
    if (!object.isMesh) return;
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) levels.add(positions.getY(i).toFixed(3));
  });
  assert.ok(levels.size > 100, 'encostas não devem se resumir a poucos anéis horizontais');
  const rock = scene.getObjectByName('Rock_Prototype_0');
  assert.ok(triangles(rock) >= 600);
  const materials = new Set();
  rock.traverse((object) => { if (object.material) materials.add(object.material.name); });
  assert.ok(materials.has('Snow') && materials.has('Rock_Ice'));
  assert.equal(scene.getObjectByName('Rock_SnowCap_Prototype_0'), undefined);
  disposeScenario(scene);
});

test('textura de neve é aplicada e liberada ao descartar a cena', async () => {
  const texture = new Texture();
  let released = 0;
  texture.addEventListener('dispose', () => released++);
  const scene = await loadIceScenario({
    loader: { loadAsync: readScenario },
    textureLoader: { loadAsync: async (url) => {
      assert.equal(url, '/assets/textures/snow-ground.jpg');
      return texture;
    } },
  });
  assert.equal(scene.getObjectByName('ice-scenario-Snow').material.map, texture);
  disposeScenario(scene);
  assert.equal(released, 1);
});

function contextWith(loader) {
  class HeadlessContext extends RenderContext {
    createRenderer() {
      return {
        domElement: { dataset: {}, remove() {} },
        setAnimationLoop() {}, setPixelRatio() {}, setSize() {}, dispose() {},
      };
    }
  }
  return new HeadlessContext({ append() {}, getBoundingClientRect: () => ({ width: 800, height: 600 }) }, {
    windowRef: { addEventListener() {}, removeEventListener() {} },
    ResizeObserverClass: null,
    textureLoader: null,
    scenarioLoader: loader,
  });
}

test('RenderContext carrega o GLB e substitui o cenário antigo antes da partida', async () => {
  const context = contextWith({ loadAsync: async (url) => {
    assert.equal(url, ICE_SCENARIO_URL);
    return readScenario();
  } });
  assert.equal(await context.assetLoadPromise, true);
  assert.equal(context.assetStatus, 'ready');
  assert.equal(context.snowArena.name, 'ice-scenario');
  assert.equal(context.scene.getObjectByName('snow-arena'), undefined);
  assert.ok(context.snowArena.getObjectByName('snowfall'));
  assert.equal(context.iceBeacon.parent.visible, false);
  assert.equal(context.renderer.domElement.dataset.scenario, 'ice-scenario');
  context.update(0.1);
  context.dispose();
  assert.equal(context.scene.children.length, 0);
});

test('falha de download é relatada e não inicia a arena antiga silenciosamente', async () => {
  const failure = new Error('GLB 404');
  const context = contextWith({ loadAsync: async () => { throw failure; } });
  assert.equal(await context.assetLoadPromise, false);
  assert.equal(context.assetStatus, 'error');
  assert.equal(context.assetError, failure);
  context.dispose();
});

test('sair durante o carregamento descarta o GLB atrasado', async () => {
  const gltf = await readScenario();
  let resolve;
  let materialDisposals = 0;
  const materials = new Set();
  gltf.scene.traverse((object) => {
    for (const mat of [object.material].flat().filter(Boolean)) materials.add(mat);
  });
  for (const mat of materials) mat.addEventListener('dispose', () => materialDisposals++);
  const context = contextWith({ loadAsync: () => new Promise((done) => { resolve = done; }) });
  context.dispose();
  resolve(gltf);
  assert.equal(await context.assetLoadPromise, false);
  assert.equal(context.scene.children.length, 0);
  assert.equal(materialDisposals, materials.size);
});
