/** Starts the Fabmatch API (and serves dist/ when it has been built). */
import { loadConfig } from './config.js';
import { createLogger } from './lib/logger.js';
import { createServer } from './app.js';

const SHUTDOWN_TIMEOUT_MS = 5000;
const SESSION_SWEEP_MS = 60 * 60 * 1000;

async function main() {
  const logger = createLogger();
  const config = loadConfig();
  const { app, repos } = await createServer({ config, logger });

  const server = app.listen(config.port, () => {
    logger.info('Fabmatch API listening', { url: `http://localhost:${config.port}`, dataDir: config.dataDir });
  });
  server.on('error', (error) => {
    logger.error('server failed to start', { error });
    process.exit(1);
  });

  const sweep = setInterval(() => {
    repos.sessions.removeExpired().catch((error) => logger.error('session sweep failed', { error }));
  }, SESSION_SWEEP_MS);
  sweep.unref();

  const shutdown = (signal) => {
    logger.info('shutting down', { signal });
    clearInterval(sweep);
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
    server.close(async () => {
      await repos.flush();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  createLogger().error('could not start the Fabmatch API', { error });
  process.exit(1);
});
