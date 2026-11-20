import os from 'node:os';
import path from 'node:path';

export function stateDirectory() {
  if (process.env.FORENSIQ_LOCAL_DIR) return path.resolve(process.env.FORENSIQ_LOCAL_DIR);
  const home = os.homedir();
  let parent = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  if (process.platform === 'darwin') parent = path.join(home, 'Library', 'Application Support');
  if (process.platform === 'win32') parent = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  return path.join(parent, 'FORENSIQ', 'local');
}
