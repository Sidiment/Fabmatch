/**
 * Builds the Express app. Opening the repositories is async (they read their JSON files),
 * so createServer resolves once the data is loaded. Tests call it with a temporary data dir.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { loadConfig } from './config.js';
import { createLogger } from './lib/logger.js';
import { HttpError, sendData, sendError } from './lib/http.js';
import { createCatalogRepository } from './repositories/catalogRepository.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createSessionRepository } from './repositories/sessionRepository.js';
import { createProjectRepository } from './repositories/projectRepository.js';
import { createContactRepository } from './repositories/contactRepository.js';
import { loadSession } from './middleware/auth.js';
import { requireSameOriginJson } from './middleware/security.js';
import { createRateLimits } from './middleware/rateLimits.js';
import { authRoutes } from './routes/authRoutes.js';
import { catalogRoutes } from './routes/catalogRoutes.js';
import { projectRoutes } from './routes/projectRoutes.js';
import { contactRoutes } from './routes/contactRoutes.js';

const BODY_LIMIT = '32kb';

export async function openRepositories(config) {
  const { dataDir, seedDir, sessionTtlMs } = config;
  const [catalog, users, sessions, projects, contacts] = await Promise.all([
    createCatalogRepository({ dataDir, seedDir }),
    createUserRepository({ dataDir }),
    createSessionRepository({ dataDir, ttlMs: sessionTtlMs }),
    createProjectRepository({ dataDir }),
    createContactRepository({ dataDir }),
  ]);
  await sessions.removeExpired();
  const repos = { catalog, users, sessions, projects, contacts };
  const flush = () => Promise.all(Object.values(repos).map((r) => r.flush()));
  return Object.freeze({ ...repos, flush });
}

function errorHandler(logger) {
  // Express needs all four arguments to treat this as the error handler.
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, next) => {
    if (error instanceof HttpError) return sendError(res, error.status, error.message, error.fields);
    if (error.type === 'entity.parse.failed') return sendError(res, 400, 'The request body is not valid JSON.');
    if (error.type === 'entity.too.large') return sendError(res, 413, 'The request is too large.');
    logger.error('unhandled request error', { method: req.method, path: req.path, error });
    return sendError(res, 500, 'Something went wrong on the server. Try again in a moment.');
  };
}

function serveSite(app, staticDir) {
  const indexFile = path.join(staticDir, 'index.html');
  if (!existsSync(indexFile)) return;
  app.use(express.static(staticDir, { index: 'index.html', maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(indexFile));
}

export async function createServer({ config = loadConfig(), logger = createLogger(), repos } = {}) {
  const data = repos ?? await openRepositories(config);
  const limits = createRateLimits(config.rateLimits);
  const deps = { config, logger, limits, ...data };
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet());

  const api = express.Router();
  api.use(limits.api);
  api.use(express.json({ limit: BODY_LIMIT }));
  api.use(cookieParser());
  api.use(requireSameOriginJson(config));
  api.use(loadSession(deps));
  api.get('/health', (req, res) => sendData(res, { ok: true }));
  api.use('/auth', authRoutes(deps));
  api.use('/', catalogRoutes(deps));
  api.use('/project', projectRoutes(deps));
  api.use('/contact', contactRoutes(deps));
  api.use((req, res) => sendError(res, 404, `No API route for ${req.method} ${req.originalUrl}.`));

  app.use('/api', api);
  serveSite(app, config.staticDir);
  app.use(errorHandler(logger));

  return Object.freeze({ app, repos: data, config });
}
