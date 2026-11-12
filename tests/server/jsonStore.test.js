import { describe, it, expect, afterEach } from 'vitest';
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { openCollection } from '../../server/lib/jsonStore.js';
import { makeTempDir } from './helpers.js';

let dir;
afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

describe('json store', () => {
  it('seeds a new file, then inserts, updates, and removes records on disk', async () => {
    dir = await makeTempDir();
    const things = await openCollection(dir, 'things', { seed: () => [{ id: 'a', n: 1 }] });
    const file = path.join(dir, 'things.json');
    expect(await readJson(file)).toEqual([{ id: 'a', n: 1 }]);

    const before = things.all();
    await things.insert({ id: 'b', n: 2 });
    expect(before).toHaveLength(1);
    expect(Object.isFrozen(things.find((t) => t.id === 'b'))).toBe(true);

    const updated = await things.update((t) => t.id === 'a', (t) => ({ ...t, n: 10 }));
    expect(updated.n).toBe(10);
    expect(await things.update((t) => t.id === 'zzz', (t) => t)).toBeNull();
    expect(await things.remove((t) => t.id === 'b')).toBe(1);
    expect(await things.remove((t) => t.id === 'b')).toBe(0);
    expect(things.filter((t) => t.n > 5)).toHaveLength(1);
    await things.flush();
    expect(await readJson(file)).toEqual([{ id: 'a', n: 10 }]);
    expect((await readdir(dir)).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('reloads what was written and keeps call order under concurrent writes', async () => {
    dir = await makeTempDir();
    const first = await openCollection(dir, 'items');
    await Promise.all(Array.from({ length: 20 }, (_, i) => first.insert({ id: String(i) })));
    const again = await openCollection(dir, 'items', { seed: () => [{ id: 'ignored' }] });
    expect(again.all().map((r) => r.id)).toEqual(Array.from({ length: 20 }, (_, i) => String(i)));
  });

  it('refuses to start on a corrupt file instead of overwriting it', async () => {
    dir = await makeTempDir();
    await writeFile(path.join(dir, 'broken.json'), '{ not json', 'utf8');
    await expect(openCollection(dir, 'broken')).rejects.toThrow(/is not valid/);
    await writeFile(path.join(dir, 'object.json'), '{"a":1}', 'utf8');
    await expect(openCollection(dir, 'object')).rejects.toThrow(/expected a JSON array/);
  });
});
