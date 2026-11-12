/** The About page contact form. Messages are stored until the contact route is decided. */
import { Router } from 'express';
import { parseBody, sendData } from '../lib/http.js';
import { contactSchema } from '../schemas.js';
import { validateContact } from '../../shared/validators.js';

export function contactRoutes({ contacts, limits, logger }) {
  const router = Router();

  router.post('/', limits.contact, async (req, res) => {
    const values = parseBody(req.body, contactSchema, validateContact);
    const saved = await contacts.create({ ...values, userId: req.user?.id ?? null });
    logger.info('contact message received', { contactId: saved.id });
    sendData(res, { received: true, id: saved.id }, 201);
  });

  return router;
}
