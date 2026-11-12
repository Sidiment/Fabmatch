/**
 * A collection of records kept in one JSON file. Prototype storage in place of a database.
 *
 * - Records live in memory and every change is written to disk before the call resolves.
 * - Writes go to a temporary file and are renamed into place, so a crash never leaves half a file.
 * - Writes run one at a time in call order.
 * - Records are frozen; changes replace them with new objects.
 *
 * It assumes a single server process owns the data directory.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const freeze = (record) => Object.freeze({ ...record });

async function readRecords(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('expected a JSON array');
    return parsed;
  } catch (error) {
    // Refuse to start rather than overwrite a file that holds data we cannot read.
    throw new Error(`Data file ${file} is not valid: ${error.message}. Fix or move it, then restart.`);
  }
}

async function writeAtomic(file, text) {
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(temp, text, 'utf8');
  await rename(temp, file);
}

export async function openCollection(dataDir, name, { seed = () => [] } = {}) {
  await mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, `${name}.json`);
  const existing = await readRecords(file);
  let records = Object.freeze((existing ?? seed()).map(freeze));
  let queue = Promise.resolve();

  const persist = () => {
    const snapshot = JSON.stringify(records, null, 2);
    const write = queue.catch(() => {}).then(() => writeAtomic(file, snapshot));
    queue = write;
    return write;
  };

  if (existing === null) await persist();

  return Object.freeze({
    name,
    all: () => records,
    find: (predicate) => records.find(predicate) ?? null,
    filter: (predicate) => records.filter(predicate),

    async insert(record) {
      const stored = freeze(record);
      records = Object.freeze([...records, stored]);
      await persist();
      return stored;
    },

    /** Adds several records with one write. */
    async insertMany(list) {
      const stored = list.map(freeze);
      records = Object.freeze([...records, ...stored]);
      await persist();
      return stored;
    },

    /** Replaces the first matching record with change(record). Returns the new record or null. */
    async update(predicate, change) {
      const index = records.findIndex(predicate);
      if (index === -1) return null;
      const updated = freeze(change(records[index]));
      records = Object.freeze(records.map((r, i) => (i === index ? updated : r)));
      await persist();
      return updated;
    },

    /** Removes every matching record. Returns how many were removed. */
    async remove(predicate) {
      const kept = records.filter((r) => !predicate(r));
      const removed = records.length - kept.length;
      if (removed > 0) {
        records = Object.freeze(kept);
        await persist();
      }
      return removed;
    },

    /** Resolves once every queued write has reached disk. */
    flush: () => queue.catch(() => {}),
  });
}
