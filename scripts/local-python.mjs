/**
 * Bootstraps a private Python for the local development server via Astral uv.
 * The release wheel comes directly from PyPI, with a checked-in SHA-256 for
 * each platform. uv verifies its managed CPython distribution. All runtime
 * Python dependencies, including transitive dependencies, are hash-locked.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { fetch, EnvHttpProxyAgent } from 'undici';

const pythonVersion = '3.12.16';
const isWindows = process.platform === 'win32';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function run(file, args, env, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { env, signal, shell: false, windowsHide: true, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Python setup stopped (exit ${code}). See the setup output above, then retry npm run dev.`));
    });
  });
}

async function getUv(dataDir, manifest, wheel, signal) {
  const directory = path.join(dataDir, 'tools', 'uv-' + manifest.version, process.platform + '-' + process.arch);
  const name = isWindows ? 'uv.exe' : 'uv';
  const file = path.join(directory, name);
  if (await exists(file)) return file;
  await mkdir(directory, { recursive: true, mode: 0o700 });

  console.log(`[FORENSIQ] Downloading the local Python installer (uv ${manifest.version})…`);
  const dispatcher = new EnvHttpProxyAgent();
  try {
    const timeout = AbortSignal.timeout(5 * 60_000);
    const response = await fetch(wheel.url, {
      dispatcher,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) throw new Error(`PyPI returned HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== wheel.size || digest(bytes) !== wheel.sha256) {
      throw new Error('The downloaded installer failed its SHA-256 check.');
    }
    const entry = `uv-${manifest.version}.data/scripts/${name}`;
    const bundle = unzipSync(bytes, { filter: (member) => member.name === entry });
    if (!bundle[entry]) throw new Error('The Python installer is missing from the verified wheel.');
    // Rename only the complete executable into place. An interrupted download
    // leaves the next run able to retry without executing a partial file.
    const temporary = file + '.partial';
    try {
      await writeFile(temporary, bundle[entry], { mode: 0o700 });
      if (!isWindows) await chmod(temporary, 0o700);
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
    return file;
  } catch (error) {
    throw new Error(`Could not prepare the Python installer from files.pythonhosted.org: ${error.message}`, { cause: error });
  } finally {
    await dispatcher.close();
  }
}

/** The caller owns the per-workspace process lock for dataDir. */
export async function ensureLocalPython({ projectRoot, dataDir, signal }) {
  const manifest = JSON.parse(await readFile(new URL('./uv-wheels.json', import.meta.url), 'utf8'));
  const wheel = manifest.platforms[process.platform + '-' + process.arch];
  if (!wheel) throw new Error(`Local Python is unavailable for ${process.platform}/${process.arch}. Use x64 or ARM64 Node on Windows, macOS or Linux.`);

  const home = path.resolve(dataDir, 'python-runtime');
  const lock = path.resolve(projectRoot, 'scripts', 'local-requirements.lock');
  const locked = await readFile(lock);
  const release = `cpython-${pythonVersion}-${process.platform}-${process.arch}-${digest(locked).slice(0, 12)}`;
  const environment = path.join(home, 'envs', release);
  const python = path.join(environment, ...(isWindows ? ['Scripts', 'python.exe'] : ['bin', 'python']));
  const ready = path.join(environment, '.forensiq-ready');
  if (await exists(ready) && await exists(python)) return python;

  const uv = await getUv(home, manifest, wheel, signal);
  const env = {
    ...process.env,
    UV_CACHE_DIR: path.join(home, 'cache'),
    UV_PYTHON_INSTALL_DIR: path.join(home, 'interpreters'),
  };
  delete env.VIRTUAL_ENV;
  delete env.PYTHONHOME;
  delete env.PYTHONPATH;
  const request = `cpython-${pythonVersion}`;
  const options = ['--no-config', '--system-certs'];
  console.log(`[FORENSIQ] Preparing private Python ${pythonVersion}…`);
  await run(uv, [...options, 'python', 'install', '--no-bin', '--no-registry', request], env, signal);
  await mkdir(path.dirname(environment), { recursive: true });
  await run(uv, [...options, 'venv', '--clear', '--managed-python', '--no-python-downloads', '--python', request, environment], env, signal);
  console.log('[FORENSIQ] Installing verified API dependencies…');
  await run(uv, [...options, 'pip', 'sync', '--python', python, '--require-hashes', '--only-binary', ':all:', '--strict', lock], env, signal);
  await run(python, ['-I', '-c', 'import fastapi, uvicorn, sqlite3, jwt, python_multipart'], env, signal);
  await writeFile(ready, release + '\n', { mode: 0o600 });
  return python;
}
