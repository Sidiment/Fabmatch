import { describe, it, expect, vi } from 'vitest';
import { createApi, ApiError, CONNECTION_LOST } from '../src/lib/api.js';

const reply = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const ok = (data) => reply(200, { success: true, data, error: null });

describe('api client', () => {
  it('sends JSON with same-origin credentials and unwraps the envelope', async () => {
    const fetchImpl = vi.fn(() => ok({ user: { name: 'Ada' } }));
    const api = createApi({ fetchImpl });
    expect(await api.signIn({ email: 'a@b.co', password: 'x' })).toEqual({ name: 'Ada' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.co', password: 'x' });
  });

  it('sends GETs without a body', async () => {
    const fetchImpl = vi.fn(() => ok({ project: { name: 'P', lotIds: [], messages: [] } }));
    const api = createApi({ fetchImpl });
    expect((await api.getProject()).name).toBe('P');
    expect(fetchImpl.mock.calls[0][1].body).toBeUndefined();
    expect(fetchImpl.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
  });

  it('maps every endpoint to its route', async () => {
    const fetchImpl = vi.fn(() => ok({ user: null, project: {}, received: true }));
    const api = createApi({ fetchImpl, base: '/x' });
    await api.catalog();
    await api.currentUser();
    await api.register({});
    await api.signOut();
    await api.saveProject({ name: 'n', lotIds: [], extra: true });
    await api.sendMessage({ lotId: 'FM-0101' });
    await api.sendContact({});
    expect(fetchImpl.mock.calls.map(([u, i]) => `${i.method} ${u}`)).toEqual([
      'GET /x/catalog', 'GET /x/auth/me', 'POST /x/auth/register', 'POST /x/auth/logout',
      'PUT /x/project', 'POST /x/project/messages', 'POST /x/contact',
    ]);
    expect(JSON.parse(fetchImpl.mock.calls[4][1].body)).toEqual({ name: 'n', lotIds: [] });
  });

  it('throws ApiError with the server message, status, and fields', async () => {
    const api = createApi({ fetchImpl: () => reply(400, { success: false, data: null, error: { message: 'Check the fields.', fields: { email: 'Bad' } } }) });
    const error = await api.register({}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'Check the fields.', status: 400, fields: { email: 'Bad' } });
  });

  it('reports a lost connection and a non-JSON reply in plain words', async () => {
    const offline = createApi({ fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')) });
    await expect(offline.catalog()).rejects.toMatchObject({ message: CONNECTION_LOST, status: 0 });
    const broken = createApi({ fetchImpl: () => Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error('html')) }) });
    await expect(broken.catalog()).rejects.toMatchObject({ status: 502, message: expect.stringContaining('502') });
  });
});
