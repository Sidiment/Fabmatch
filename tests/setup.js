/**
 * Loads the seed catalog the way the server would, so page and component tests render real
 * lots without a running API.
 */
import familiesJson from '../server/data/seed/color-families.json';
import lotsJson from '../server/data/seed/sample-lots.json';
import { buildLotRecords } from '../shared/catalog.js';
import { hydrateCatalog } from '../src/data/lots.js';

export const SEED_FAMILIES = familiesJson.families;
export const SEED_LOTS = buildLotRecords(lotsJson.lots, SEED_FAMILIES);

hydrateCatalog({ families: SEED_FAMILIES, lots: SEED_LOTS });
