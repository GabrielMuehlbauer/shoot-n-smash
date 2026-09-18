import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3 } from 'three';

// Small CPU rasterizer for deterministic model QA when a browser is unavailable.
const base = new URL('../client/public/models/ice-golem/', import.meta.url);
const bytes = await readFile(new URL('ice_golem.glb', base));
const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
);
gltf.scene.updateMatrixWorld(true);
const WIDTH = 760, HEIGHT = 820;
const light = new Vector3(.4, .65, .7).normalize();
const meshes = [];
gltf.scene.traverse(object => { if (object.isSkinnedMesh) meshes.push(object); });

function crc32(data) {
  let crc = -1;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
function png(pixels) {
  const raw = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) pixels.copy(raw, y * (WIDTH * 4 + 1) + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0); header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function render(view) {
  const angle = view === 'quarter' ? Math.PI / 5 : 0;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4), depth = new Float32Array(WIDTH * HEIGHT);
  depth.fill(-Infinity);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const i = (y * WIDTH + x) * 4;
    const v = y / HEIGHT;
    pixels[i] = 8 + v * 9; pixels[i+1] = 19 + v * 17; pixels[i+2] = 30 + v * 23; pixels[i+3] = 255;
  }
  for (const mesh of meshes) {
    const geometry = mesh.geometry, attr = geometry.attributes.position;
    const index = geometry.index;
    const verts = new Array(attr.count);
    const temp = new Vector3();
    for (let i = 0; i < attr.count; i++) {
      temp.fromBufferAttribute(attr, i);
      mesh.applyBoneTransform(i, temp);
      mesh.localToWorld(temp);
      const horizontal = view === 'front' ? temp.x : view === 'side' ? -temp.z : temp.x*cosine-temp.z*sine;
      const closeness = view === 'front' ? temp.z : view === 'side' ? temp.x : temp.x*sine+temp.z*cosine;
      verts[i] = { x: (horizontal + 2.05) / 4.10 * WIDTH,
        y: (4.62 - temp.y) / 4.70 * HEIGHT, z: closeness, world: temp.clone() };
    }
    const base = mesh.material.color.clone().convertLinearToSRGB();
    const baseColor = [base.r, base.g, base.b].map(channel => channel * 255);
    const colors = geometry.attributes.color;
    const viewDirection = view === 'front' ? new Vector3(0, 0, 1)
      : view === 'side' ? new Vector3(1, 0, 0) : new Vector3(sine, 0, cosine);
    const half = light.clone().add(viewDirection).normalize();
    for (let i = 0; i < (index?.count ?? attr.count); i += 3) {
      const ia = index ? index.getX(i) : i;
      const ib = index ? index.getX(i+1) : i+1;
      const ic = index ? index.getX(i+2) : i+2;
      const a = verts[ia], b = verts[ib], c = verts[ic];
      const ab = b.world.clone().sub(a.world), ac = c.world.clone().sub(a.world);
      const normal = ab.cross(ac).normalize();
      if ((view === 'front' ? normal.z : view === 'side' ? normal.x : normal.x*sine+normal.z*cosine) <= 0) continue;
      const area = (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      if (Math.abs(area) < .02) continue;
      const minX = Math.max(0, Math.floor(Math.min(a.x,b.x,c.x))), maxX = Math.min(WIDTH-1, Math.ceil(Math.max(a.x,b.x,c.x)));
      const minY = Math.max(0, Math.floor(Math.min(a.y,b.y,c.y))), maxY = Math.min(HEIGHT-1, Math.ceil(Math.max(a.y,b.y,c.y)));
      const shade = mesh.material.name === 'Ice_Emission' ? 1.18
        : mesh.material.name === 'Ice_Fissure' ? 1.0
          : .43 + .57 * Math.max(0, normal.dot(light));
      const gloss = mesh.material.name === 'Ice_Crystal' ? .32
        : mesh.material.name === 'Ice_Base' ? .12 : 0;
      const highlight = gloss * Math.pow(Math.max(0, normal.dot(half)), 14)
        + gloss * .35 * Math.pow(1 - Math.abs(normal.dot(viewDirection)), 3);
      const color = colors ? [0, 1, 2].map(channel =>
        (colors.getComponent(ia, channel) + colors.getComponent(ib, channel)
          + colors.getComponent(ic, channel)) / 3) : [1, 1, 1];
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const px=x+.5, py=y+.5;
        const u=((b.x-px)*(c.y-py)-(b.y-py)*(c.x-px))/area;
        const v=((c.x-px)*(a.y-py)-(c.y-py)*(a.x-px))/area;
        const w=1-u-v;
        if (u < 0 || v < 0 || w < 0) continue;
        const at = y*WIDTH+x, z = a.z*u+b.z*v+c.z*w;
        if (z <= depth[at]) continue;
        depth[at] = z;
        const offset = at*4;
        for (let channel=0;channel<3;channel++) pixels[offset+channel] = Math.min(255,
          baseColor[channel] * shade * color[channel] + 255 * highlight);
      }
    }
  }
  return png(pixels);
}
for (const view of ['front','quarter','side']) {
  const path = new URL(`preview_${view}.png`, base);
  await writeFile(path, render(view));
  console.log(fileURLToPath(path));
}
