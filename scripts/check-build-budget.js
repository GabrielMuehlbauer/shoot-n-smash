import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST_PATH = fileURLToPath(new URL('../client/dist/', import.meta.url));
const BUDGETS = Object.freeze({
  initialJavaScriptBytes: 100 * 1024,
  initialJavaScriptGzipBytes: 35 * 1024,
  totalJavaScriptBytes: 850 * 1024,
  totalJavaScriptGzipBytes: 250 * 1024,
  textureBytes: 180 * 1024,
});

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat();
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

const indexHtml = await readFile(`${DIST_PATH}/index.html`, 'utf8');
const initialScriptUrl = indexHtml.match(
  /<script[^>]+type="module"[^>]+src="(?<url>[^"]+)"/,
)?.groups?.url;

assert.ok(initialScriptUrl, 'O build não declarou o módulo JavaScript inicial.');

const initialScriptPath = `${DIST_PATH}/${initialScriptUrl.replace(/^\//, '')}`;
const initialScript = await readFile(initialScriptPath);
const files = await listFiles(DIST_PATH);
const javaScriptFiles = files.filter((file) => file.endsWith('.js'));
const textureFiles = files.filter((file) => /assets\/textures\/.*\.jpe?g$/i.test(file));
assert.equal(textureFiles.length, 3, 'O build deve conter as três texturas finais.');
const javaScriptBuffers = await Promise.all(javaScriptFiles.map((file) => readFile(file)));
const textureStats = await Promise.all(textureFiles.map((file) => stat(file)));

const report = Object.freeze({
  initialJavaScriptBytes: initialScript.byteLength,
  initialJavaScriptGzipBytes: gzipSync(initialScript).byteLength,
  totalJavaScriptBytes: sum(javaScriptBuffers.map((buffer) => buffer.byteLength)),
  totalJavaScriptGzipBytes: sum(
    javaScriptBuffers.map((buffer) => gzipSync(buffer).byteLength),
  ),
  textureBytes: sum(textureStats.map(({ size }) => size)),
});

for (const [name, maximum] of Object.entries(BUDGETS)) {
  assert.ok(
    report[name] <= maximum,
    `${name} excedeu o orçamento: ${report[name]} > ${maximum} bytes.`,
  );
}

console.log('Orçamentos do build aprovados:', report);
