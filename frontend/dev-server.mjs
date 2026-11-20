import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

/** Serve the live React source and send all /api traffic to this launch's API process. */
export async function startWeb({ apiOrigin, open }) {
  const root = fileURLToPath(new URL('./', import.meta.url));
  const web = await createServer({
    root,
    configFile: path.join(root, 'vite.config.js'),
    clearScreen: false,
    server: {
      host: '127.0.0.1',
      open,
      proxy: { '/api': { target: apiOrigin } },
      fs: { allow: [root, path.resolve(root, '../node_modules')] },
    },
  });
  try {
    await web.listen();
    return web;
  } catch (error) {
    await web.close();
    throw error;
  }
}
