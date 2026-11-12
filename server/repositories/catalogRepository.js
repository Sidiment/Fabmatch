/**
 * Color families and lots. Families are reference data read from the seed file.
 * Lots are stored in the data directory, seeded on first start from the handoff sample lots
 * and the Redesign Collective sample pieces, so a later workroom portal can add and edit them.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { openCollection } from '../lib/jsonStore.js';
import { buildLotRecords, buildSampleRecords } from '../../shared/catalog.js';

async function readSeed(seedDir, file) {
  return JSON.parse(await readFile(path.join(seedDir, file), 'utf8'));
}

/** The sample pieces file is optional, so a seed directory without it still starts. */
async function readOptionalSeed(seedDir, file, fallback) {
  try {
    return await readSeed(seedDir, file);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function createCatalogRepository({ dataDir, seedDir }) {
  const familiesJson = await readSeed(seedDir, 'color-families.json');
  const families = Object.freeze(familiesJson.families.map((f) => Object.freeze(f)));
  const lotsJson = await readSeed(seedDir, 'sample-lots.json');
  const samplesJson = await readOptionalSeed(seedDir, 'redesign-collective-samples.json', { samples: [] });
  const sampleRecords = buildSampleRecords(samplesJson.samples);
  const lots = await openCollection(dataDir, 'lots', {
    seed: () => [...buildLotRecords(lotsJson.lots, families), ...sampleRecords],
  });

  // A data directory seeded before the sample pieces were added gets the ones it lacks, by ID.
  // Pieces already stored are left as they are, so later edits are kept.
  const storedIds = new Set(lots.all().map((lot) => lot.id));
  const newSamples = sampleRecords.filter((record) => !storedIds.has(record.id));
  if (newSamples.length) await lots.insertMany(newSamples);

  return Object.freeze({
    families: () => families,
    findAllLots: () => lots.all(),
    findLotById: (id) => lots.find((lot) => lot.id === id),
    flush: lots.flush,
  });
}
