/** Public, read-only catalog endpoints: color families and lots. */
import { Router } from 'express';
import { sendData, notFound } from '../lib/http.js';

export function catalogRoutes({ catalog }) {
  const router = Router();

  router.get('/catalog', (req, res) => {
    sendData(res, { families: catalog.families(), lots: catalog.findAllLots() });
  });

  router.get('/families', (req, res) => {
    sendData(res, { families: catalog.families() });
  });

  router.get('/lots', (req, res) => {
    const lots = catalog.findAllLots();
    sendData(res, { lots, total: lots.length });
  });

  router.get('/lots/:id', (req, res) => {
    const lot = catalog.findLotById(req.params.id);
    if (!lot) throw notFound(`No lot has the ID ${req.params.id}.`);
    sendData(res, { lot });
  });

  return router;
}
