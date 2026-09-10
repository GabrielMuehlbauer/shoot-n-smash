import assert from 'node:assert/strict';
import test from 'node:test';

import { Texture } from 'three';

import { SNOW_ARENA_CONFIG } from '../config/snow-arena-config.js';
import { createSnowflakePositions, SnowArena } from './SnowArena.js';

test('cria todos os grupos visuais do protótipo de neve', () => {
  const arena = new SnowArena();

  assert.equal(arena.name, 'snow-arena');
  assert.equal(arena.getObjectByName('frozen-lake')?.isMesh, true);
  assert.equal(arena.getObjectByName('ice-island')?.children.length, 2);
  assert.equal(arena.getObjectByName('central-arena')?.children.length, 4);
  assert.equal(
    arena.getObjectByName('ice-patches')?.children.length,
    1,
  );
  assert.equal(
    arena.getObjectByName('rock-ring')?.children.length,
    1,
  );
  assert.equal(
    arena.getObjectByName('mountain-ring')?.children.length,
    2,
  );
  assert.equal(
    arena.getObjectByName('ice-patch-instances')?.count,
    SNOW_ARENA_CONFIG.icePatches.length,
  );
  assert.equal(
    arena.getObjectByName('rock-instances')?.count,
    SNOW_ARENA_CONFIG.rocks.length,
  );
  assert.equal(
    arena.getObjectByName('mountain-body-instances')?.count,
    SNOW_ARENA_CONFIG.mountains.length,
  );
  assert.equal(
    arena.getObjectByName('crystal-shard-instances')?.count,
    SNOW_ARENA_CONFIG.crystals.length * 3,
  );
  assert.equal(
    arena.getObjectByName('pine-trunk-instances')?.count,
    SNOW_ARENA_CONFIG.trees.length,
  );
  assert.equal(
    arena.getObjectByName('pine-foliage-instances')?.count,
    SNOW_ARENA_CONFIG.trees.length * 3,
  );
  assert.equal(
    arena.getObjectByName('lantern-flame-instances')?.count,
    SNOW_ARENA_CONFIG.lanterns.length,
  );
  assert.equal(arena.getObjectByName('snowfall')?.isPoints, true);

  let meshCount = 0;
  arena.traverse((object) => {
    if (object.isMesh) {
      meshCount += 1;
    }
  });
  assert.ok(
    meshCount + SNOW_ARENA_CONFIG.meshBudget.outsideArena <=
      SNOW_ARENA_CONFIG.meshBudget.maximum,
  );
});

test('reutiliza geometrias e materiais nos elementos repetidos', () => {
  const arena = new SnowArena();
  const rocks = arena.getObjectByName('rock-instances');
  const crystals = arena.getObjectByName('crystal-shard-instances');
  const pineFoliage = arena.getObjectByName('pine-foliage-instances');
  const mountainBodies = arena.getObjectByName('mountain-body-instances');
  const mountainSnow = arena.getObjectByName('mountain-snow-instances');

  assert.equal(rocks.isInstancedMesh, true);
  assert.equal(crystals.isInstancedMesh, true);
  assert.equal(pineFoliage.isInstancedMesh, true);
  assert.equal(mountainBodies.isInstancedMesh, true);
  assert.equal(mountainSnow.isInstancedMesh, true);
  assert.notEqual(mountainBodies.geometry, mountainSnow.geometry);
  assert.ok(
    mountainBodies.geometry.getAttribute('position').count >
      mountainSnow.geometry.getAttribute('position').count,
  );
  assert.equal(
    mountainBodies.geometry.getAttribute('uv').count,
    mountainBodies.geometry.getAttribute('position').count,
  );
  assert.notEqual(mountainBodies.material, mountainSnow.material);
});

test('aplica as texturas finais sem duplicar materiais da arena', () => {
  const arena = new SnowArena();
  const textures = {
    snow: new Texture(),
    ice: new Texture(),
    rock: new Texture(),
  };

  assert.equal(arena.applyTextures(textures), true);
  assert.equal(arena.snowMaterial.map, textures.snow);
  assert.equal(arena.platformSnowMaterial.map, textures.snow);
  assert.equal(arena.treeSnowMaterial.map, textures.snow);
  assert.equal(arena.mountainSnowMaterial.map, textures.snow);
  assert.equal(arena.iceShelfMaterial.map, textures.ice);
  assert.equal(arena.frozenLakeMaterial.map, textures.ice);
  assert.equal(arena.platformIceMaterial.map, textures.ice);
  assert.equal(arena.icePatchMaterial.map, textures.ice);
  assert.equal(arena.rockMaterial.map, textures.rock);
  assert.equal(arena.lanternStoneMaterial.map, textures.rock);
  assert.equal(arena.mountainRockMaterial.map, textures.rock);
  assert.throws(() => arena.applyTextures({}), /neve, gelo e rocha/i);
});

test('mantém obstáculos decorativos fora da área inicial do jogador', () => {
  for (const patch of SNOW_ARENA_CONFIG.icePatches) {
    const outerRadius = patch.radius * Math.max(patch.scaleX, patch.scaleZ);
    assert.ok(
      Math.hypot(patch.x, patch.z) - outerRadius >=
        SNOW_ARENA_CONFIG.playerClearanceRadius,
    );
  }

  for (const rock of SNOW_ARENA_CONFIG.rocks) {
    assert.ok(
      Math.hypot(rock.x, rock.z) - rock.scale * 1.18 >=
        SNOW_ARENA_CONFIG.playerClearanceRadius,
    );
  }

  for (const crystal of SNOW_ARENA_CONFIG.crystals) {
    assert.ok(
      Math.hypot(crystal.x, crystal.z) - crystal.scale >=
        SNOW_ARENA_CONFIG.playerClearanceRadius,
    );
  }

  for (const tree of SNOW_ARENA_CONFIG.trees) {
    assert.ok(
      Math.hypot(tree.x, tree.z) - tree.scale >=
        SNOW_ARENA_CONFIG.playerClearanceRadius,
    );
  }

  for (const mountain of SNOW_ARENA_CONFIG.mountains) {
    assert.ok(
      Math.hypot(mountain.x, mountain.z) - mountain.radius >=
        SNOW_ARENA_CONFIG.mountainClearanceRadius,
    );
  }
});

test('gera neve determinística e dentro dos limites configurados', () => {
  const first = createSnowflakePositions();
  const second = createSnowflakePositions();

  assert.deepEqual(first, second);
  assert.equal(first.length, SNOW_ARENA_CONFIG.snowfall.count * 3);

  for (let index = 0; index < first.length; index += 3) {
    const radius = Math.hypot(first[index], first[index + 2]);
    assert.ok(radius <= SNOW_ARENA_CONFIG.snowfall.radius);
    assert.ok(first[index + 1] >= SNOW_ARENA_CONFIG.snowfall.minY);
    assert.ok(first[index + 1] <= SNOW_ARENA_CONFIG.snowfall.maxY);
  }
});

test('anima a atmosfera sem aceitar delta negativo', () => {
  const arena = new SnowArena();
  const initialRotation = arena.snowfall.rotation.y;

  arena.update(2);
  assert.equal(
    arena.snowfall.rotation.y,
    initialRotation +
      2 * SNOW_ARENA_CONFIG.snowfall.rotationRadiansPerSecond,
  );

  arena.update(-10);
  assert.equal(
    arena.snowfall.rotation.y,
    initialRotation +
      2 * SNOW_ARENA_CONFIG.snowfall.rotationRadiansPerSecond,
  );
});
