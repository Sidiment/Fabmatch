/** The signed-in account's project under /api/project. Every route needs a session. */
import { Router } from 'express';
import { parseBody, sendData, badRequest, notFound } from '../lib/http.js';
import { projectDetailsSchema, messageSchema } from '../schemas.js';
import { validateAsk } from '../../shared/validators.js';
import { requireAuth } from '../middleware/auth.js';
import { DEFAULT_PROJECT_NAME, toPublicProject } from '../repositories/projectRepository.js';

export function projectRoutes({ catalog, projects }) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    sendData(res, { project: toPublicProject(projects.findByUser(req.user.id)) });
  });

  /** Replaces the name and saved lots. Unknown lot IDs are refused so the project never points at nothing. */
  router.put('/', async (req, res) => {
    const { name, lotIds } = parseBody(req.body, projectDetailsSchema);
    const unique = [...new Set(lotIds)];
    const unknown = unique.filter((id) => !catalog.findLotById(id));
    if (unknown.length) throw badRequest(`These lot IDs are not in the catalog: ${unknown.join(', ')}.`, { lotIds: 'Remove the lots that are no longer listed.' });
    const saved = await projects.saveDetails(req.user.id, { name: name.trim() || DEFAULT_PROJECT_NAME, lotIds: unique });
    sendData(res, { project: toPublicProject(saved) });
  });

  /** Saves an Ask the workroom message with the project. Delivery to workrooms opens in the pilot. */
  router.post('/messages', async (req, res) => {
    const body = parseBody(req.body, messageSchema);
    const lot = catalog.findLotById(body.lotId);
    if (!lot) throw notFound(`No lot has the ID ${body.lotId}.`);
    const { errors, values } = validateAsk(body, lot);
    if (Object.keys(errors).length) throw badRequest('Check the highlighted fields.', errors);
    const saved = await projects.addMessage(req.user.id, { lotId: lot.id, ...values });
    sendData(res, { project: toPublicProject(saved) }, 201);
  });

  return router;
}
