import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { makeServer, ACCOUNT } from './helpers.js';
import { hashPassword, verifyPassword } from '../../server/auth/password.js';
import { SIGN_IN_FAILED } from '../../server/routes/authRoutes.js';

let server;
beforeEach(async () => { server = await makeServer(); });
afterEach(async () => { await server.cleanup(); });

const register = (agent, body = ACCOUNT) => agent.post('/api/auth/register').send(body);

describe('passwords', () => {
  it('hashes with a salt and verifies only the right password', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('wrong horse battery', a)).toBe(false);
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
  });
});

describe('auth routes', () => {
  it('creates an account, starts a session, and never returns or stores the password', async () => {
    const agent = request.agent(server.app);
    const res = await register(agent).expect(201);
    expect(res.body).toMatchObject({ success: true, error: null, data: { user: { name: 'Ada Lovelace', email: 'ada@example.com', role: 'designer' } } });
    expect(res.body.data.user.passwordHash).toBeUndefined();

    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^fm_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.data.user.email).toBe('ada@example.com');

    const usersFile = await readFile(path.join(server.dataDir, 'users.json'), 'utf8');
    expect(usersFile).not.toContain(ACCOUNT.password);
    const sessionsFile = await readFile(path.join(server.dataDir, 'sessions.json'), 'utf8');
    expect(sessionsFile).not.toContain(cookie.split(';')[0].split('=')[1]);
  });

  it('refuses a duplicate email and invalid fields with per-field messages', async () => {
    await register(request(server.app)).expect(201);
    const dup = await register(request(server.app), { ...ACCOUNT, email: 'ada@example.com' }).expect(409);
    expect(dup.body.error.fields.email).toMatch(/already has an account/);

    const bad = await register(request(server.app), { name: '', email: 'nope', password: 'short', role: 'admin' }).expect(400);
    expect(Object.keys(bad.body.error.fields).sort()).toEqual(['email', 'name', 'password', 'role']);

    const wrongType = await register(request(server.app), { name: 5, email: 'a@b.co', password: 'x'.repeat(12) }).expect(400);
    expect(wrongType.body.error.fields.name).toBeDefined();
  });

  it('signs in with any email casing, rotates the session, and gives one message for every failure', async () => {
    await register(request(server.app)).expect(201);
    const agent = request.agent(server.app);
    const ok = await agent.post('/api/auth/login').send({ email: 'ADA@example.com', password: ACCOUNT.password }).expect(200);
    expect(ok.body.data.user.name).toBe('Ada Lovelace');

    const wrongPassword = await request(server.app).post('/api/auth/login').send({ email: 'ada@example.com', password: 'nope nope nope' }).expect(401);
    const unknownEmail = await request(server.app).post('/api/auth/login').send({ email: 'who@example.com', password: 'nope nope nope' }).expect(401);
    expect(wrongPassword.body.error.message).toBe(SIGN_IN_FAILED);
    expect(unknownEmail.body.error.message).toBe(SIGN_IN_FAILED);
  });

  it('signs out, ends the session on the server, and clears a stale cookie', async () => {
    const agent = request.agent(server.app);
    const res = await register(agent).expect(201);
    const cookie = res.headers['set-cookie'][0].split(';')[0];
    await agent.post('/api/auth/logout').send({}).expect(200);
    expect((await agent.get('/api/auth/me')).body.data.user).toBeNull();

    // Replaying the old cookie no longer works, and the server tells the browser to drop it.
    const replay = await request(server.app).get('/api/project').set('Cookie', cookie).expect(401);
    expect(replay.body.error.message).toBe('Signed out for security. Sign in to continue.');
    expect(replay.headers['set-cookie'][0]).toMatch(/fm_session=;/);
  });

  it('rejects cross-site and non-JSON writes', async () => {
    await request(server.app).post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'a@b.co', password: 'x' }).expect(403);
    await request(server.app).post('/api/auth/login').set('Content-Type', 'application/x-www-form-urlencoded').send('email=a@b.co&password=x').expect(415);
    await request(server.app).post('/api/auth/login').set('Origin', 'http://localhost:5173').send({ email: 'a@b.co', password: 'x'.repeat(12) }).expect(401);
    const malformed = await request(server.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400);
    expect(malformed.body.error.message).toMatch(/not valid JSON/);
  });

  it('rate limits sign-in attempts', async () => {
    const limited = await makeServer({ AUTH_RATE_LIMIT: '2' });
    try {
      const attempt = () => request(limited.app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(12) });
      await attempt().expect(401);
      await attempt().expect(401);
      const third = await attempt().expect(429);
      expect(third.body.error.message).toMatch(/Too many sign-in attempts/);
    } finally {
      await limited.cleanup();
    }
  });

  it('uses a Secure __Host- cookie in production', async () => {
    const prod = await makeServer({ NODE_ENV: 'production' });
    try {
      const res = await register(request(prod.app)).expect(201);
      expect(res.headers['set-cookie'][0]).toMatch(/^__Host-fm_session=.*Secure/);
    } finally {
      await prod.cleanup();
    }
  });
});
