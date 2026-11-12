/** Builds a server on a fresh temporary data directory for each test. */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig } from '../../server/config.js';
import { createLogger } from '../../server/lib/logger.js';
import { createServer } from '../../server/app.js';

export async function makeTempDir() {
  return mkdtemp(path.join(tmpdir(), 'fabmatch-test-'));
}

export async function makeServer(env = {}) {
  const dataDir = await makeTempDir();
  const config = loadConfig({ DATA_DIR: dataDir, STATIC_DIR: path.join(dataDir, 'no-site'), ...env });
  const server = await createServer({ config, logger: createLogger({ silent: true }) });
  const cleanup = async () => {
    await server.repos.flush();
    await rm(dataDir, { recursive: true, force: true });
  };
  return { ...server, dataDir, cleanup };
}

export const ACCOUNT = Object.freeze({ name: 'Ada Lovelace', email: 'Ada@Example.com', password: 'correct horse battery', role: 'designer' });
