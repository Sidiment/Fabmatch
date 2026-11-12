import { describe, it, expect, vi } from 'vitest';
import { createStaticFetch, DEMO_SIGN_IN_OFF, DEMO_CONTACT_OFF } from '../src/lib/staticApi.js';
import { createApi } from '../src/lib/api.js';
import { exportCatalog } from '../scripts/export-catalog.js';

const catalog = { families: [{ code: 'BKT-01' }], lots: [{ id: 'RC-0001' }, { id: 'FM-0101' }] };

function makeFetch() {
  const realFetch = vi.fn(async (url) => {
    if (url === 'catalog.json') return new Response(JSON.stringify(catalog), { status: 200 });
    return new Response('page', { status: 200 });
  });
  return { realFetch, api: createApi({ fetchImpl: createStaticFetch({ realFetch }) }), fetch: createStaticFetch({ realFetch }) };
}

describe('static demo API', () => {
  it('serves the catalog from catalog.json and loads it once', async () => {
    const { realFetch, api } = makeFetch();
    expect(await api.catalog()).toEqual(catalog);
    expect(await api.catalog()).toEqual(catalog);
    expect(realFetch).toHaveBeenCalledTimes(1);
    expect(await api.currentUser()).toBeNull();
  });

  it('answers lot lookups and passes other requests through', async () => {
    const { realFetch, fetch } = makeFetch();
    const one = await (await fetch('/api/lots/RC-0001')).json();
    expect(one.data.lot.id).toBe('RC-0001');
    expect((await fetch('/api/lots/NOPE')).status).toBe(404);
    expect((await (await fetch('/api/lots')).json()).data.total).toBe(2);
    await fetch('samples/rc-0001.jpg');
    expect(realFetch).toHaveBeenLastCalledWith('samples/rc-0001.jpg', {});
  });

  it('says sign-in, projects, and contact are off', async () => {
    const { api } = makeFetch();
    await expect(api.signIn({ email: 'a@b.co', password: 'x' })).rejects.toThrow(DEMO_SIGN_IN_OFF);
    await expect(api.saveProject({ name: 'P', lotIds: [] })).rejects.toThrow(DEMO_SIGN_IN_OFF);
    await expect(api.sendContact({})).rejects.toThrow(DEMO_CONTACT_OFF);
  });

  it('exports every lot, sample pieces included', async () => {
    const exported = await exportCatalog();
    expect(exported.families).toHaveLength(12);
    expect(exported.lots.filter((l) => l.kind === 'piece')).toHaveLength(91);
  });
});
