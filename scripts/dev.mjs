/** Starts the complete local development stack. The cloud Docker entry point stays independent. */
import { spawn } from 'node:child_process';
import { mkdir, realpath } from 'node:fs/promises';
import { createServer as createSocketServer } from 'node:net';
import { stateDirectory } from './local-state.mjs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const host = '127.0.0.1';
const controller = new AbortController();
const { signal } = controller;
const stopSignals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
if (process.platform === 'win32') stopSignals.push('SIGBREAK');
function onStop() {
  if (signal.aborted) return;
  console.log('\nStopping FORENSIQ. Wait for the terminal prompt before reinstalling.');
  controller.abort();
}
// Keep handling repeated interrupts while the API and development server close.
for (const name of stopSignals) process.on(name, onStop);

async function allocatePort() {
  const socket = createSocketServer();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, host, resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

function startApi(python, databaseFile, port) {
  const api = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', host,
    '--port', String(port), '--no-proxy-headers', '--no-server-header', '--no-access-log', '--log-level', 'warning'], {
    cwd: path.join(projectRoot, 'backend'),
    env: {
      ...process.env,
      FORENSIQ_DB_PATH: databaseFile,
      COOKIE_SECURE: 'false',
      FORENSIQ_LOCAL_BOOTSTRAP: '1',
      PYTHONNOUSERSITE: '1',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  const ended = new Promise(resolve => {
    api.once('error', error => resolve({ error }));
    api.once('close', (code, terminationSignal) => resolve({ code, terminationSignal }));
  });
  const origin = 'http://' + host + ':' + port;
  return { api, origin, ended };
}

async function waitForApi(server) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const earlyExit = await Promise.race([server.ended, Promise.resolve(null)]);
    if (earlyExit) throw earlyExit.error || new Error('The API stopped during startup. See its message above.');
    try {
      const response = await fetch(server.origin + '/api/health', { signal: AbortSignal.timeout(1500) });
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch { /* The socket opens after the initial migration has finished. */ }
    await delay(200, undefined, { signal });
  }
  throw new Error('The case database and API did not become ready within 60 seconds.');
}

async function stopApi(server) {
  if (server.api.exitCode !== null || server.api.signalCode !== null) return;
  server.api.kill('SIGTERM');
  const timer = setTimeout(() => server.api.kill('SIGKILL'), 5000);
  timer.unref();
  try { await server.ended; } finally { clearTimeout(timer); }
}

async function main() {
  // Load packages inside the error boundary so an interrupted npm ci is actionable.
  const { default: lockfile } = await import('proper-lockfile');
  const { ensureLocalPython } = await import('./local-python.mjs');
  const { startWeb } = await import('../frontend/dev-server.mjs');
  signal.throwIfAborted();
  const proposedDirectory = stateDirectory();
  await mkdir(proposedDirectory, { recursive: true, mode: 0o700 });
  const stateDir = await realpath(proposedDirectory);
  const relative = path.relative(projectRoot, stateDir);
  if (relative === '' || (!path.isAbsolute(relative) && relative.split(path.sep)[0] !== '..')) {
    throw new Error('Choose a FORENSIQ_LOCAL_DIR outside the source folder to keep database files private.');
  }
  // Isolate the child interpreter from any global Python development environment.
  delete process.env.PYTHONPATH;
  delete process.env.PYTHONHOME;
  process.env.PYTHONNOUSERSITE = '1';
  const databaseFile = process.env.FORENSIQ_DB_PATH
    ? path.resolve(process.env.FORENSIQ_DB_PATH)
    : path.join(stateDir, 'forensiq.sqlite3');
  let release, server, web;
  try {
    try {
      release = await lockfile.lock(stateDir, {
        lockfilePath: path.join(stateDir, 'sqlite-launcher.lock'),
        stale: 30000, update: 5000,
      });
    } catch (error) {
      if (error.code === 'ELOCKED') throw new Error('A local FORENSIQ launcher already owns this workspace. Use its printed URL. If it was interrupted, wait 30 seconds and run npm run dev again.');
      throw error;
    }
    console.log('\nFORENSIQ · Starting your local evidence workspace');
    console.log('Local data: ' + stateDir);
    console.log('Preparing the API runtime. The first start downloads its dependencies…');
    const python = await ensureLocalPython({ projectRoot, dataDir: stateDir, signal });
    signal.throwIfAborted();

    console.log('Starting the local API with SQLite: ' + databaseFile);
    server = startApi(python, databaseFile, await allocatePort());
    await waitForApi(server);
    console.log('API health check passed. Starting the website…');
    web = await startWeb({ apiOrigin: server.origin, open: Boolean(process.stdout.isTTY && !process.env.CI) });
    console.log('\nFORENSIQ is ready. Open the local address below. Press Ctrl+C to stop.');
    web.printUrls();
    const closed = signal.aborted || await new Promise(resolve => {
      signal.addEventListener('abort', () => resolve(true), { once: true });
      server.ended.then(() => resolve(false));
    });
    if (!closed) throw new Error('The API stopped unexpectedly. Its last message is above.');
  } finally {
    const cleanups = [() => web?.close(), () => server && stopApi(server), () => release?.()];
    for (const cleanup of cleanups) {
      try { await cleanup(); } catch (error) { console.error('Local shutdown: ' + error.message); }
    }
  }
}

try {
  await main();
} catch (error) {
  if (!signal.aborted) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND') {
      console.error('\nFORENSIQ could not load its dependencies. Stop any running copy of FORENSIQ with Ctrl+C and wait for its terminal prompt. Run npm ci in the extracted project folder. Run npm run dev after npm ci succeeds.');
      console.error('Missing dependency detail: ' + error.message);
    } else {
      console.error('\nFORENSIQ could not start. ' + error.message);
    }
    process.exitCode = 1;
  }
} finally {
  for (const name of stopSignals) process.removeListener(name, onStop);
}
