import { describe, it, expect, vi } from 'vitest';
import { createSession, guestSession, SESSION_ENDED, SYNC_FAILED } from '../src/lib/session.js';
import { addLot, addMessage, renameProject, emptyProject, STORAGE_KEY } from '../src/lib/project.js';
import { createStore } from '../src/lib/store.js';
import { ApiError } from '../src/lib/api.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
    data,
  };
}

const USER = Object.freeze({ id: 'u1', name: 'Ada', email: 'ada@example.com' });
const remoteProject = (overrides = {}) => ({ name: 'Untitled project', lotIds: [], messages: [], ...overrides });

function fakeApi(overrides = {}) {
  return {
    signIn: vi.fn(async () => USER),
    register: vi.fn(async () => USER),
    signOut: vi.fn(async () => ({})),
    getProject: vi.fn(async () => remoteProject()),
    saveProject: vi.fn(async (p) => remoteProject(p)),
    sendMessage: vi.fn(async (m) => remoteProject({ messages: [m] })),
    ...overrides,
  };
}

const MESSAGE = Object.freeze({ lotId: 'FM-0101', project: 'Lobby', quantity: '', note: 'Pillows?', neededBy: '' });

describe('session, signed out', () => {
  it('keeps the project on this device', () => {
    const storage = memoryStorage();
    const session = createSession({ api: fakeApi(), storage });
    session.store.update((p) => addLot(p, 'FM-0101'));
    expect(JSON.parse(storage.data[STORAGE_KEY]).lotIds).toEqual(['FM-0101']);
    expect(session.isSignedIn()).toBe(false);
  });
});

describe('session, signed in', () => {
  it('sends name and lot changes, then new messages, in order', async () => {
    const api = fakeApi();
    const session = createSession({ api, user: USER, project: remoteProject(), storage: memoryStorage() });
    session.store.update((p) => addLot(p, 'FM-0101'));
    session.store.update((p) => renameProject(p, 'Lobby'));
    session.store.update((p) => addMessage(p, MESSAGE));
    await session.flush();
    expect(api.saveProject).toHaveBeenLastCalledWith({ name: 'Lobby', lotIds: ['FM-0101'] });
    expect(api.sendMessage).toHaveBeenCalledWith(MESSAGE);
  });

  it('retries a change that could not reach the server with the next change', async () => {
    const notices = [];
    const api = fakeApi({ saveProject: vi.fn().mockRejectedValueOnce(new ApiError('lost')).mockResolvedValue(remoteProject()) });
    const session = createSession({ api, user: USER, storage: memoryStorage(), onNotice: (m) => notices.push(m) });
    session.store.update((p) => addLot(p, 'FM-0101'));
    await session.flush();
    expect(notices).toEqual([SYNC_FAILED]);
    session.store.update((p) => addLot(p, 'FM-0102'));
    await session.flush();
    expect(api.saveProject).toHaveBeenLastCalledWith({ name: 'Untitled project', lotIds: ['FM-0101', 'FM-0102'] });
  });

  it('keeps a message queued when the connection drops, and drops one the server refuses', async () => {
    const notices = [];
    const sendMessage = vi.fn()
      .mockRejectedValueOnce(new ApiError('lost'))
      .mockResolvedValueOnce(remoteProject())
      .mockRejectedValueOnce(new ApiError('Enter a note.', { status: 400 }));
    const session = createSession({ api: fakeApi({ sendMessage }), user: USER, storage: memoryStorage(), onNotice: (m) => notices.push(m) });
    session.store.update((p) => addMessage(p, MESSAGE));
    await session.flush();
    session.store.update((p) => addLot(p, 'FM-0101'));
    await session.flush();
    expect(sendMessage).toHaveBeenCalledTimes(2);
    session.store.update((p) => addMessage(p, { ...MESSAGE, note: '' }));
    await session.flush();
    session.store.update((p) => addLot(p, 'FM-0102'));
    await session.flush();
    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(notices).toEqual([SYNC_FAILED, 'Enter a note.']);
  });

  it('signs out locally and keeps the work on this device when the session expires', async () => {
    const storage = memoryStorage();
    const notices = [];
    const api = fakeApi({ saveProject: vi.fn(async () => { throw new ApiError('Signed out', { status: 401 }); }) });
    const session = createSession({ api, user: USER, storage, onNotice: (m) => notices.push(m) });
    const onUser = vi.fn();
    session.subscribe(onUser);
    session.store.update((p) => addLot(p, 'FM-0101'));
    await session.flush();
    expect(session.user()).toBeNull();
    expect(onUser).toHaveBeenCalledWith(null);
    expect(notices).toEqual([SESSION_ENDED]);
    expect(JSON.parse(storage.data[STORAGE_KEY]).lotIds).toEqual(['FM-0101']);
  });

  it('signs out and starts an empty project', async () => {
    const api = fakeApi();
    const session = createSession({ api, user: USER, project: remoteProject({ lotIds: ['FM-0101'] }), storage: memoryStorage() });
    await session.signOut();
    expect(api.signOut).toHaveBeenCalled();
    expect(session.user()).toBeNull();
    expect(session.store.get().lotIds).toEqual([]);

    const failing = createSession({ api: fakeApi({ signOut: vi.fn().mockRejectedValue(new ApiError('lost')) }), user: USER, storage: memoryStorage() });
    await expect(failing.signOut()).rejects.toThrow('lost');
    expect(failing.user()).toEqual(USER);
  });
});

describe('signing in', () => {
  it('merges the device project into the account and clears the device copy', async () => {
    const local = addMessage(addLot(addLot(renameProject(emptyProject(), 'Lobby'), 'FM-0102'), 'FM-GONE'), MESSAGE);
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(local) });
    const api = fakeApi({ getProject: vi.fn(async () => remoteProject({ lotIds: ['FM-0101'] })) });
    const session = createSession({ api, storage });
    const user = await session.signIn({ email: 'ada@example.com', password: 'x' });

    expect(user).toEqual(USER);
    expect(api.saveProject).toHaveBeenCalledWith({ name: 'Lobby', lotIds: ['FM-0101', 'FM-0102'] });
    expect(api.sendMessage).toHaveBeenCalledWith(MESSAGE);
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
    expect(session.isSignedIn()).toBe(true);
  });

  it('keeps the account name and skips the save when nothing new is on the device', async () => {
    const api = fakeApi({ getProject: vi.fn(async () => remoteProject({ name: 'Clinic', lotIds: ['FM-0101'] })) });
    const session = createSession({ api, storage: memoryStorage() });
    await session.register({ name: 'Ada' });
    expect(api.register).toHaveBeenCalled();
    expect(api.saveProject).not.toHaveBeenCalled();
    expect(session.store.get()).toMatchObject({ name: 'Clinic', lotIds: ['FM-0101'] });
  });

  it('stays signed in and retries later when the merge fails', async () => {
    const notices = [];
    const api = fakeApi({ getProject: vi.fn().mockRejectedValue(new ApiError('lost')) });
    const session = createSession({ api, storage: memoryStorage(), onNotice: (m) => notices.push(m) });
    session.store.update((p) => addLot(p, 'FM-0101'));
    await session.signIn({});
    expect(session.isSignedIn()).toBe(true);
    expect(notices).toEqual([SYNC_FAILED]);
    session.store.update((p) => renameProject(p, 'Later'));
    await session.flush();
    expect(api.saveProject).toHaveBeenLastCalledWith({ name: 'Later', lotIds: ['FM-0101'] });
  });

  it('reports a device message the server refuses but still signs in', async () => {
    const notices = [];
    const local = addMessage(emptyProject(), MESSAGE);
    const api = fakeApi({ sendMessage: vi.fn().mockRejectedValue(new ApiError('Too much', { status: 400 })) });
    const session = createSession({ api, storage: memoryStorage({ [STORAGE_KEY]: JSON.stringify(local) }), onNotice: (m) => notices.push(m) });
    await session.signIn({});
    expect(session.isSignedIn()).toBe(true);
    expect(notices[0]).toContain('Too much');
  });

  it('surfaces a rejected sign-in without changing anything', async () => {
    const api = fakeApi({ signIn: vi.fn().mockRejectedValue(new ApiError('Not recognized', { status: 401 })) });
    const session = createSession({ api, storage: memoryStorage() });
    await expect(session.signIn({})).rejects.toThrow('Not recognized');
    expect(session.isSignedIn()).toBe(false);
  });
});

describe('guest session', () => {
  it('wraps a store and refuses to sign in without the API', async () => {
    const store = createStore(emptyProject(), () => {});
    const session = guestSession(store);
    expect(session.store).toBe(store);
    expect(session.user()).toBeNull();
    await expect(session.signIn({})).rejects.toThrow(/needs the Fabmatch API/);
    await expect(session.signOut()).resolves.toBeUndefined();
    expect(typeof session.subscribe(() => {})).toBe('function');
    expect(typeof session.onNotice(() => {})).toBe('function');
  });
});
