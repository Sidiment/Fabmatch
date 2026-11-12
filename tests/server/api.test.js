import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { makeServer, makeTempDir, ACCOUNT } from './helpers.js';
import { openRepositories } from '../../server/app.js';
import { loadConfig } from '../../server/config.js';

let server;
beforeEach(async () => { server = await makeServer(); });
afterEach(async () => { await server.cleanup(); });

async function signedInAgent() {
  const agent = request.agent(server.app);
  await agent.post('/api/auth/register').send(ACCOUNT).expect(201);
  return agent;
}

describe('catalog routes', () => {
  it('serves the Redesign Collective sample pieces with blank attributes', async () => {
    const res = await request(server.app).get('/api/lots/RC-0001').expect(200);
    expect(res.body.data.lot).toMatchObject({ kind: 'piece', mfr: 'Hickory Chair', fiber: null, fam: null, fire: [], qty: 1 });
    const all = (await request(server.app).get('/api/lots').expect(200)).body.data.lots;
    expect(all.filter((l) => l.kind === 'piece')).toHaveLength(91);
  });

  it('adds the sample pieces to a data directory seeded before they existed', async () => {
    const old = JSON.parse(await readFile(path.join(server.dataDir, 'lots.json'), 'utf8')).filter((l) => l.kind !== 'piece');
    await server.cleanup();
    const dataDir = path.join(await makeTempDir());
    await writeFile(path.join(dataDir, 'lots.json'), JSON.stringify(old));
    const config = loadConfig({ DATA_DIR: dataDir, STATIC_DIR: path.join(dataDir, 'no-site') });
    const repos = await openRepositories(config);
    expect(repos.catalog.findAllLots()).toHaveLength(old.length + 91);
    expect(repos.catalog.findLotById('RC-0091').mfr).toBe('Texture Fabrics');
    await repos.flush();
    const again = await openRepositories(config);
    expect(again.catalog.findAllLots()).toHaveLength(old.length + 91);
    await again.flush();
    server = await makeServer();
  });

  it('serves families and lots built from the seed', async () => {
    const res = await request(server.app).get('/api/catalog').expect(200);
    expect(res.body.data.families).toHaveLength(12);
    expect(res.body.data.lots.length).toBeGreaterThan(10);
    expect(res.body.data.lots[0]).toMatchObject({ id: 'FM-0101', title: 'Herringbone wool, Camel', region: 'Seattle region' });

    expect((await request(server.app).get('/api/families').expect(200)).body.data.families).toHaveLength(12);
    const lots = await request(server.app).get('/api/lots').expect(200);
    expect(lots.body.data.total).toBe(lots.body.data.lots.length);
    expect((await request(server.app).get('/api/lots/FM-0102').expect(200)).body.data.lot.id).toBe('FM-0102');
    expect((await request(server.app).get('/api/lots/FM-9999').expect(404)).body.error.message).toMatch(/FM-9999/);
  });

  it('answers unknown API routes with a JSON 404 and sets security headers', async () => {
    const res = await request(server.app).get('/api/nope').expect(404);
    expect(res.body.success).toBe(false);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect((await request(server.app).get('/api/health').expect(200)).body.data.ok).toBe(true);
  });
});

describe('project routes', () => {
  it('needs a session', async () => {
    await request(server.app).get('/api/project').expect(401);
    await request(server.app).put('/api/project').send({ name: 'x', lotIds: [] }).expect(401);
  });

  it('starts blank, saves the name and lots, and keeps them per account', async () => {
    const agent = await signedInAgent();
    expect((await agent.get('/api/project').expect(200)).body.data.project).toMatchObject({ name: 'Untitled project', lotIds: [], messages: [] });

    const saved = await agent.put('/api/project').send({ name: '  Lobby refresh ', lotIds: ['FM-0101', 'FM-0102', 'FM-0101'] }).expect(200);
    expect(saved.body.data.project).toMatchObject({ name: 'Lobby refresh', lotIds: ['FM-0101', 'FM-0102'] });
    expect((await agent.put('/api/project').send({ name: '', lotIds: [] }).expect(200)).body.data.project.name).toBe('Untitled project');

    const other = request.agent(server.app);
    await other.post('/api/auth/register').send({ ...ACCOUNT, email: 'grace@example.com' }).expect(201);
    expect((await other.get('/api/project')).body.data.project.lotIds).toEqual([]);
  });

  it('refuses unknown lots and malformed bodies', async () => {
    const agent = await signedInAgent();
    const res = await agent.put('/api/project').send({ name: 'x', lotIds: ['FM-0101', 'FM-9999'] }).expect(400);
    expect(res.body.error.message).toContain('FM-9999');
    await agent.put('/api/project').send({ name: 'x', lotIds: 'FM-0101' }).expect(400);
    await agent.put('/api/project').send({ name: 'x'.repeat(500), lotIds: [] }).expect(400);
  });

  it('saves workroom messages with the same rules as the form', async () => {
    const agent = await signedInAgent();
    const message = { lotId: 'FM-0101', project: 'Lobby', quantity: '10', note: 'Can this be cut as pillow covers?', neededBy: '2026-12-01' };
    const res = await agent.post('/api/project/messages').send(message).expect(201);
    const saved = res.body.data.project.messages[0];
    expect(saved).toMatchObject({ lotId: 'FM-0101', project: 'Lobby', quantity: '10', note: message.note });
    expect(saved.id).toBeTruthy();
    expect(saved.sentAt).toBeTruthy();

    const tooMuch = await agent.post('/api/project/messages').send({ ...message, quantity: '9999' }).expect(400);
    expect(tooMuch.body.error.fields.quantity).toMatch(/yd or less/);
    const empty = await agent.post('/api/project/messages').send({ lotId: 'FM-0101' }).expect(400);
    expect(Object.keys(empty.body.error.fields).sort()).toEqual(['note', 'project']);
    await agent.post('/api/project/messages').send({ ...message, lotId: 'FM-9999' }).expect(404);
  });
});

describe('contact route', () => {
  it('stores a valid message and returns field errors otherwise', async () => {
    const ok = await request(server.app).post('/api/contact').send({ name: 'Lin', email: 'lin@example.com', message: 'Hello' }).expect(201);
    expect(ok.body.data.received).toBe(true);
    expect(server.repos.contacts.findAll()).toHaveLength(1);
    const bad = await request(server.app).post('/api/contact').send({ name: '', email: 'x', message: '' }).expect(400);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['email', 'message', 'name']);
  });
});

describe('static site', () => {
  it('serves the built site and falls back to index.html outside /api', async () => {
    const siteDir = path.join(server.dataDir, 'site');
    await mkdir(siteDir, { recursive: true });
    await writeFile(path.join(siteDir, 'index.html'), '<!doctype html><title>Fabmatch</title>');
    const withSite = await makeServer({ STATIC_DIR: siteDir });
    try {
      expect((await request(withSite.app).get('/').expect(200)).text).toContain('Fabmatch');
      expect((await request(withSite.app).get('/anything').expect(200)).text).toContain('Fabmatch');
      await request(withSite.app).get('/api/nope').expect(404);
    } finally {
      await withSite.cleanup();
    }
  });
});

describe('config', () => {
  it('reads defaults and refuses bad numbers', () => {
    const config = loadConfig({});
    expect(config.port).toBe(3001);
    expect(config.cookieName).toBe('fm_session');
    expect(config.allowedOrigins).toContain('http://localhost:5173');
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT must be a positive number/);
  });
});
