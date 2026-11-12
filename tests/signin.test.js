import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderSignIn, nextHash } from '../src/pages/signin.js';
import { parseHash, routes } from '../src/lib/router.js';
import { ApiError } from '../src/lib/api.js';
import { validateRegistration, validateSignIn, validateAsk, validateContact } from '../shared/validators.js';
import { roleLabel } from '../shared/roles.js';
import { buildLotRecord } from '../shared/catalog.js';
import { renderAbout, CONTACT_RECEIVED } from '../src/pages/about.js';
import { renderProjects } from '../src/pages/projects.js';
import { createStore } from '../src/lib/store.js';
import { emptyProject } from '../src/lib/project.js';
import { bootstrap, LOAD_FAILED } from '../src/bootstrap.js';
import { SEED_FAMILIES, SEED_LOTS } from './setup.js';
import { LOTS } from '../src/data/lots.js';

const toast = { show: vi.fn(), hide: () => {} };
const USER = Object.freeze({ id: 'u1', name: 'Ada', email: 'ada@example.com' });
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeSession(overrides = {}) {
  return { user: () => null, isSignedIn: () => false, signIn: vi.fn(async () => USER), register: vi.fn(async () => USER), signOut: vi.fn(async () => {}), ...overrides };
}

function submit(node, values) {
  Object.entries(values).forEach(([name, value]) => { node.querySelector(`[name="${name}"]`).value = value; });
  node.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => { document.body.innerHTML = ''; window.location.hash = ''; toast.show.mockClear(); window.scrollTo = () => {}; });

describe('sign-in routes', () => {
  it('parses and builds sign-in links', () => {
    expect(parseHash('#/signin?mode=register')).toMatchObject({ name: 'signin', query: 'mode=register' });
    expect(routes.signIn()).toBe('#/signin');
    expect(routes.signIn({ mode: 'register', next: 'projects' })).toBe('#/signin?mode=register&next=projects');
  });

  it('only returns to pages inside the site', () => {
    expect(nextHash('')).toBe('#/projects');
    expect(nextHash('lots/FM-0101')).toBe('#/lots/FM-0101');
    expect(nextHash('https://evil.example')).toBe('#/projects');
    expect(nextHash('signin')).toBe('#/projects');
  });
});

describe('sign-in page', () => {
  it('validates before calling the server, then signs in and moves on', async () => {
    const session = fakeSession();
    const node = renderSignIn({ session, route: { query: 'next=textiles' }, toast });
    document.body.append(node);
    expect(node.querySelector('h1').textContent).toBe('Sign in');
    expect(node.querySelector('[name="name"]')).toBeNull();

    submit(node, { email: 'nope', password: '' });
    expect(session.signIn).not.toHaveBeenCalled();
    expect(node.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
    expect(document.activeElement.name).toBe('email');

    submit(node, { email: 'Ada@Example.com', password: 'secret' });
    await flushPromises();
    expect(session.signIn).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'secret' });
    expect(toast.show).toHaveBeenCalledWith('Signed in as Ada.');
    expect(window.location.hash).toBe('#/textiles');
  });

  it('shows the server message and keeps the email when sign-in fails', async () => {
    const session = fakeSession({ signIn: vi.fn().mockRejectedValue(new ApiError('That email address or password was not recognized.', { status: 401 })) });
    const node = renderSignIn({ session, route: { query: '' }, toast });
    submit(node, { email: 'ada@example.com', password: 'wrong' });
    await flushPromises();
    expect(node.querySelector('[data-auth-status]').textContent).toContain('not recognized');
    expect(node.querySelector('[name="email"]').value).toBe('ada@example.com');
    expect(node.querySelector('[name="password"]').value).toBe('');
  });

  it('creates an account with a role and shows server field errors', async () => {
    const session = fakeSession({ register: vi.fn().mockRejectedValue(new ApiError('Check.', { status: 409, fields: { email: 'This email address already has an account.' } })) });
    const node = renderSignIn({ session, route: { query: 'mode=register' }, toast });
    expect(node.querySelector('h1').textContent).toBe('Create an account');
    expect(node.querySelectorAll('#auth-role option')).toHaveLength(4);
    submit(node, { name: 'Ada', email: 'ada@example.com', password: 'long enough pw', role: 'workroom' });
    await flushPromises();
    expect(session.register).toHaveBeenCalledWith({ name: 'Ada', email: 'ada@example.com', password: 'long enough pw', role: 'workroom' });
    expect(node.querySelector('#auth-email-error').textContent).toContain('already has an account');
  });

  it('shows the signed-in state with a sign-out button', async () => {
    const session = fakeSession({ user: () => USER });
    const node = renderSignIn({ session, route: { query: '' }, toast });
    expect(node.textContent).toContain('Signed in as Ada (ada@example.com)');
    node.querySelector('[data-auth-sign-out]').click();
    await flushPromises();
    expect(session.signOut).toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith('Signed out.');

    const failing = fakeSession({ user: () => USER, signOut: vi.fn().mockRejectedValue(new Error('offline')) });
    renderSignIn({ session: failing, route: { query: '' }, toast }).querySelector('[data-auth-sign-out]').click();
    await flushPromises();
    expect(toast.show).toHaveBeenCalledWith('offline');
  });
});

describe('shared validators', () => {
  it('checks registration, sign-in, ask, and contact fields', () => {
    expect(validateRegistration({ name: 'A', email: 'A@B.co', password: 'x'.repeat(10), role: 'designer' })).toEqual({ errors: {}, values: { name: 'A', email: 'a@b.co', password: 'x'.repeat(10), role: 'designer' } });
    expect(validateRegistration({ name: 'x'.repeat(101), email: 'a@b.co', password: 'x'.repeat(201), role: 'designer' }).errors).toMatchObject({ name: expect.any(String), password: expect.any(String) });
    expect(Object.keys(validateSignIn({}).errors).sort()).toEqual(['email', 'password']);
    const lot = { yd: 10 };
    expect(validateAsk({ project: 'x'.repeat(121), note: 'x'.repeat(2001) }, lot).errors).toMatchObject({ project: expect.stringContaining('120'), note: expect.stringContaining('2000') });
    expect(validateContact({ name: 'x'.repeat(101), email: 'a@b.co', message: 'x'.repeat(4001) }).errors).toMatchObject({ name: expect.any(String), message: expect.any(String) });
    expect(roleLabel('workroom')).toBe('Workroom owner');
    expect(roleLabel('nope')).toBe('');
    expect(() => buildLotRecord({ fam: 99, shade: 0 }, 0, SEED_FAMILIES)).toThrow(/missing color family/);
  });
});

describe('pages that talk to the API', () => {
  it('sends the contact form and shows the result', async () => {
    const api = { sendContact: vi.fn().mockResolvedValueOnce({ received: true }).mockRejectedValueOnce(new ApiError('Too many messages.', { status: 429 })) };
    const node = renderAbout({ api });
    document.body.append(node);
    submit(node, { name: 'Lin', email: 'lin@example.com', message: 'Hello' });
    await flushPromises();
    expect(api.sendContact).toHaveBeenCalledWith({ name: 'Lin', email: 'lin@example.com', message: 'Hello' });
    expect(node.querySelector('[data-contact-status]').textContent).toBe(CONTACT_RECEIVED('Lin'));
    submit(node, { name: 'Lin', email: 'lin@example.com', message: 'Again' });
    await flushPromises();
    expect(node.querySelector('[data-contact-status]').textContent).toBe('Too many messages.');
  });

  it('says where the project is kept', () => {
    const store = createStore(emptyProject(), () => {});
    expect(renderProjects({ store, session: fakeSession(), toast }).querySelector('.lede').textContent).toBe('0 lots saved.');
    expect(renderProjects({ store, session: fakeSession({ isSignedIn: () => true }), toast }).querySelector('.lede').textContent).toContain('saved to the account');
  });
});

describe('bootstrap', () => {
  const catalog = { families: SEED_FAMILIES, lots: SEED_LOTS };

  it('loads the catalog and the signed-in project before rendering', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const api = { catalog: vi.fn(async () => catalog), currentUser: vi.fn(async () => USER), getProject: vi.fn(async () => ({ name: 'Clinic', lotIds: ['FM-0101'], messages: [] })) };
    const app = await bootstrap(root, { api, win: window });
    expect(LOTS).toHaveLength(SEED_LOTS.length);
    expect(app.session.user()).toEqual(USER);
    expect(root.querySelector('[data-account-name]').textContent).toBe('Ada');
    expect(root.querySelector('[data-project-count]').textContent).toBe('1');
  });

  it('says so when the API cannot be reached', async () => {
    const root = document.createElement('div');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = { catalog: vi.fn().mockRejectedValue(new ApiError('lost')), currentUser: vi.fn(async () => null) };
    expect(await bootstrap(root, { api, win: window })).toBeNull();
    expect(root.textContent).toContain(LOAD_FAILED);
    errorSpy.mockRestore();
  });
});
