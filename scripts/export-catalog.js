/**
 * Writes the catalog (color families and every lot, including the Redesign Collective sample
 * pieces) to one JSON file, in the shape GET /api/catalog returns. Used by the static
 * GitHub Pages build: node scripts/export-catalog.js dist/catalog.json
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLotRecords, buildSampleRecords } from '../shared/catalog.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const seedDir = path.join(root, 'server', 'data', 'seed');
const readSeed = async (file) => JSON.parse(await readFile(path.join(seedDir, file), 'utf8'));

export async function exportCatalog() {
  const { families } = await readSeed('color-families.json');
  const { lots } = await readSeed('sample-lots.json');
  const { samples } = await readSeed('redesign-collective-samples.json');
  return { families, lots: [...buildLotRecords(lots, families), ...buildSampleRecords(samples)] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = path.resolve(process.argv[2] || 'dist/catalog.json');
  const catalog = await exportCatalog();
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(catalog));
  console.log(`Wrote ${catalog.lots.length} lots to ${path.relative(process.cwd(), out)}`);
}
