/**
 * Lot records for the site, loaded from the API at start (see src/bootstrap.js).
 * The exported lists are live bindings that hydrateCatalog replaces, so pages that import
 * them render the loaded catalog. Each record is linked to its color family and tone.
 */
import { FAMILIES, hydrateFamilies } from './families.js';
import { PATTERN_NAMES, REGION, SAMPLE_SOURCE, isPieceLot, missingAttributes } from '../../shared/catalog.js';

export { PATTERN_NAMES, REGION, SAMPLE_SOURCE, isPieceLot, missingAttributes };

export const CATEGORIES = Object.freeze([
  { id: 'Upholstery', blurb: 'Seating and cushions' },
  { id: 'Drapery', blurb: 'Window and divider panels' },
  { id: 'Wallcovering', blurb: 'Stretched and wrapped walls' },
  { id: 'Acoustic', blurb: 'Panels and absorptive fabrics' },
  { id: 'Art-ready', blurb: 'Stretched panels and triptychs' },
]);

export let LOTS = Object.freeze([]);
export let FIBERS = Object.freeze([]);
export let DOC_TYPES = Object.freeze([]);
export let MANUFACTURERS = Object.freeze([]);
export let BRANDS = Object.freeze([]);

/** Lot kinds as the filter rail names them. */
export const KIND_LABELS = Object.freeze({ yardage: 'Yardage lots', piece: 'Sample pieces' });
export const kindLabel = (lot) => (isPieceLot(lot) ? KIND_LABELS.piece : KIND_LABELS.yardage);

/** A lot with no color family recorded (fam is null) has no family or tone; one that names a missing family is an error. */
function linkLot(record) {
  const unrecorded = record.fam === null || record.fam === undefined;
  const family = unrecorded ? null : FAMILIES[record.fam];
  const tone = family?.tones[record.shade] ?? null;
  if (!unrecorded && !tone) throw new Error(`Lot ${record.id} points at a color family or tone that is not loaded.`);
  return Object.freeze({
    ...record,
    fire: Object.freeze([...record.fire]),
    docs: Object.freeze([...record.docs]),
    family,
    tone,
  });
}

/** Replaces the catalog with { families, lots } as returned by GET /api/catalog. */
export function hydrateCatalog({ families, lots }) {
  if (!Array.isArray(lots)) throw new TypeError('Lots must be a list.');
  hydrateFamilies(families);
  LOTS = Object.freeze(lots.map(linkLot));
  FIBERS = Object.freeze([...new Set(LOTS.map((l) => l.fiber).filter(Boolean))]);
  DOC_TYPES = Object.freeze([...new Set(LOTS.flatMap((l) => l.docs))]);
  MANUFACTURERS = Object.freeze([...new Set(LOTS.filter((l) => l.mfrVerified !== false).map((l) => l.mfr).filter(Boolean))]);
  BRANDS = Object.freeze([...new Set(LOTS.map((l) => l.mfr).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
  return LOTS;
}

export function findLot(id) {
  return LOTS.find((lot) => lot.id === id) || null;
}

export function lotsInCategory(category) {
  if (!category) return LOTS;
  return LOTS.filter((lot) => matchesCategory(lot, category));
}

/** Art-ready is not a stored category; wallcovering weights cover it until workrooms confirm. */
export function matchesCategory(lot, category) {
  if (!category) return true;
  if (category === 'Art-ready') return lot.cat === 'Wallcovering';
  return lot.cat === category;
}
