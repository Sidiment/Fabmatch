/**
 * Builds lot records from the handoff sample lots. Shared by the server (which stores the
 * records) and the browser (which links each record to its color family object).
 * Lot IDs, last-confirmed dates, and the region are sample values so the cards can carry
 * the fields the guide asks for (sections 6.2 and 10.2).
 */

export const PATTERN_NAMES = Object.freeze({
  h: 'Herringbone', t: 'Twill or plain weave', b: 'Textured', p: 'Plaid', f: 'Felted',
});

export const REGION = 'Seattle region';

const SAMPLE_CONFIRMED_BASE = Date.UTC(2026, 9, 28);
const DAY_MS = 86400000;

function sampleConfirmedDate(index) {
  const daysAgo = (index * 3) % 20;
  return new Date(SAMPLE_CONFIRMED_BASE - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

export function lotIdFor(index) {
  return `FM-${String(101 + index).padStart(4, '0')}`;
}

/** One stored lot record: the raw sample fields plus ID, title, region, status, and date. */
export function buildLotRecord(raw, index, families) {
  const family = families[raw.fam];
  if (!family || !family.tones[raw.shade]) {
    throw new Error(`Sample lot ${index} points at a missing color family or tone.`);
  }
  return {
    ...raw,
    fire: [...raw.fire],
    docs: [...raw.docs],
    id: lotIdFor(index),
    pattern: PATTERN_NAMES[raw.tex],
    title: `${raw.name}, ${family.tones[raw.shade].name}`,
    region: REGION,
    status: 'Available',
    lastConfirmed: sampleConfirmedDate(index),
  };
}

export function buildLotRecords(rawLots, families) {
  return rawLots.map((raw, index) => buildLotRecord(raw, index, families));
}

/*
 * Redesign Collective sample pieces, converted from DATASET_FABRIC_SAMPLES.xlsx
 * (server/data/seed/redesign-collective-samples.json). They are lots like the others, but
 * counted in pieces instead of yards, and the sheet records only brand, size, quantity, and
 * codes. Every attribute the sheet does not record is left blank (null or an empty list);
 * the site shows "Not recorded" for those. A lot needs at least an ID, a name, a title, a
 * kind, and an amount on hand.
 */

export const SAMPLE_SOURCE = 'Redesign Collective';
export const LOT_KINDS = Object.freeze({ yardage: 'yardage', piece: 'piece' });

export function sampleIdFor(index) {
  return `RC-${String(index + 1).padStart(4, '0')}`;
}

const inches = (n) => String(Number(n));

/** One stored sample record. Attributes the spreadsheet does not have stay blank. */
export function buildSampleRecord(raw, index) {
  const number = index + 1;
  const brand = raw.brand ? String(raw.brand).trim() : null;
  const hasSize = Number(raw.w) > 0 && Number(raw.h) > 0;
  const qty = Number.isInteger(raw.qty) && raw.qty > 0 ? raw.qty : 1;
  return {
    id: sampleIdFor(index),
    kind: LOT_KINDS.piece,
    name: brand ? `${brand} sample` : 'Sample',
    title: brand ? `${brand} sample ${number}` : `Sample ${number}, brand not recorded`,
    mfr: brand,
    mfrVerified: false,
    qty,
    remnants: hasSize ? [{ w: Number(raw.w), h: Number(raw.h), qty }] : [],
    size: hasSize ? `${inches(raw.w)} x ${inches(raw.h)} in` : null,
    photo: raw.photo ? `samples/${raw.photo}.jpg` : null,
    photoCard: raw.photo ? `samples/${raw.photo}-card.jpg` : null,
    naics: raw.naics || null,
    inventoryCode: raw.inventoryCode || null,
    unitNote: raw.unitNote || null,
    source: SAMPLE_SOURCE,
    sourceRow: raw.sheetRow ?? null,
    // Not in the spreadsheet: left blank on purpose.
    cat: null,
    fiber: null,
    width: null,
    yd: null,
    fam: null,
    shade: null,
    tex: null,
    pattern: null,
    directional: null,
    fire: [],
    rubs: null,
    nrc: null,
    docs: [],
    region: null,
    status: 'In inventory',
    lastConfirmed: null,
  };
}

export function buildSampleRecords(rawSamples) {
  return (rawSamples || []).map((raw, index) => buildSampleRecord(raw, index));
}

export const isPieceLot = (lot) => lot?.kind === LOT_KINDS.piece;

/** Attributes a lot card or lot page would show that this record leaves blank, in plain words. */
const ATTRIBUTE_CHECKS = Object.freeze([
  ['Brand or manufacturer', (l) => !l.mfr],
  ['Application (upholstery, drapery, and so on)', (l) => !l.cat],
  ['Fiber content', (l) => !l.fiber],
  ['Color family and tone', (l) => l.fam === null || l.fam === undefined],
  ['Pattern', (l) => !l.pattern],
  ['Direction (one-way or may be turned)', (l) => l.directional === null || l.directional === undefined],
  ['Fabric width (rolls only)', (l) => !isPieceLot(l) && !l.width],
  ['Piece size', (l) => isPieceLot(l) && !l.size],
  ['Fire rating', (l) => !l.fire || l.fire.length === 0],
  ['Abrasion (double rubs)', (l) => !l.rubs],
  ['Acoustic rating (NRC)', (l) => !l.nrc],
  ['Documentation on file', (l) => !l.docs || l.docs.length === 0],
  ['Region', (l) => !l.region],
  ['Last confirmed date', (l) => !l.lastConfirmed],
  ['Photograph', (l) => isPieceLot(l) && !l.photo],
]);

export function missingAttributes(lot) {
  return ATTRIBUTE_CHECKS.filter(([, isMissing]) => isMissing(lot)).map(([label]) => label);
}
