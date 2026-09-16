// Optional real-browser smoke check. Start `npm run dev:client` first.
// BROWSER_EXECUTABLE may point to an installed Chromium/Edge executable.
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const executable = process.env.BROWSER_EXECUTABLE
  ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
await access(executable);
const profile = await mkdtemp(join(tmpdir(), 'slingshot-browser-'));
const browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let launchError;
browser.on('error', (error) => { launchError = error; });
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    if (launchError) throw launchError;
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok(port, 'Browser debugging endpoint did not start');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  const errors = [];
  const responses = [];
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      message.error ? request.reject(message.error) : request.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args);
    if (message.method === 'Network.responseReceived') responses.push(message.params.response);
  };
  function send(method, params = {}) {
    const id = ++serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 20_000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: process.env.GAME_URL ?? 'http://localhost:5173/' });
  for (let i = 0; i < 100; i++) {
    if (await evaluate("document.readyState === 'complete' && Boolean(document.querySelector('#start-scene-button'))")) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  await evaluate("document.querySelector('#start-scene-button').click()");
  let state;
  for (let i = 0; i < 150; i++) {
    state = await evaluate(`({
      canvas: document.querySelector('[data-game-canvas]')?.dataset.scenario,
      errorVisible: document.querySelector('#scene-error')?.hidden === false,
      state: document.querySelector('#prototype-view')?.dataset.gameState,
    })`);
    if (state.errorVisible || (state.canvas === 'ice-scenario' && responses.some((r) => r.url.endsWith('/models/slingshot_final.glb')))) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  // Allow a few frames after the final asset response for parsing and rendering.
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const screenshot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  await writeFile(new URL('../slingshot_game_preview.jpg', import.meta.url), Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify({ state, errors, assetResponses: responses.filter((r) => /\.glb$/.test(r.url)).map(({ url, status }) => ({ url, status })) }, null, 2));
  assert.equal(state.errorVisible, false, 'The game displayed its loading error');
  assert.equal(state.canvas, 'ice-scenario');
  assert.ok(responses.some((r) => r.url.endsWith('/models/slingshot_final.glb') && r.status === 200));
} finally {
  socket?.close();
  browser.kill();
}
