/**
 * Who is signed in, and where the project is kept.
 *
 * Signed out: the project is kept on this device, as before.
 * Signed in: every change is sent to the account in order. A failed change stays in the
 * project on screen and is sent again with the next change.
 * Signing in merges the project kept on this device into the account, then clears the device copy.
 */
import { createStore } from './store.js';
import { emptyProject, loadProject, saveProject, clearSavedProject, normalizeProject, DEFAULT_PROJECT_NAME } from './project.js';
import { findLot } from '../data/lots.js';

/** Guide section 9.5, "Session ended". */
export const SESSION_ENDED = 'Signed out for security. Sign in to continue.';
export const SYNC_FAILED = 'The last change could not reach the account. It is kept here and will send with the next change.';

const toOutgoing = ({ lotId, project, quantity, note, neededBy }) => ({ lotId, project, quantity, note, neededBy });

export function createSession({ api, user = null, project = null, storage, onNotice = () => {} }) {
  let currentUser = user;
  let queue = Promise.resolve();
  let detailsDirty = false;
  let unsentMessages = [];
  const listeners = new Set();
  const noticeListeners = new Set([onNotice]);

  const notice = (message) => noticeListeners.forEach((fn) => fn(message));
  const notify = () => listeners.forEach((fn) => fn(currentUser));

  function persist(next, previous) {
    if (!currentUser) {
      saveProject(next, storage);
      return;
    }
    if (next.name !== previous.name || next.lotIds !== previous.lotIds) detailsDirty = true;
    unsentMessages = [...unsentMessages, ...next.messages.slice(previous.messages.length)];
    queue = queue.then(pushChanges);
  }

  const store = createStore(project ? normalizeProject(project) : (user ? emptyProject() : loadProject(storage)), persist);

  /** Session expired on the server: keep the work on this device so signing in again restores it. */
  function expire() {
    currentUser = null;
    detailsDirty = false;
    unsentMessages = [];
    saveProject(store.get(), storage);
    notify();
    notice(SESSION_ENDED);
  }

  function handleSyncError(error) {
    if (error.status === 401) return expire();
    if (error.status === 400 || error.status === 404) {
      notice(error.message);
      return undefined;
    }
    detailsDirty = true;
    notice(SYNC_FAILED);
    return undefined;
  }

  async function pushChanges() {
    if (!currentUser) return;
    try {
      if (detailsDirty) {
        detailsDirty = false;
        const { name, lotIds } = store.get();
        await api.saveProject({ name, lotIds });
      }
      while (unsentMessages.length) {
        const [message, ...rest] = unsentMessages;
        try {
          await api.sendMessage(toOutgoing(message));
        } catch (error) {
          // A message the server refused is dropped; a lost connection keeps it queued.
          if (error.status === 400 || error.status === 404) unsentMessages = rest;
          throw error;
        }
        unsentMessages = rest;
      }
    } catch (error) {
      handleSyncError(error);
    }
  }

  async function mergeLocalInto(remote, local) {
    let merged = normalizeProject(remote);
    const localLots = local.lotIds.filter((id) => findLot(id));
    const lotIds = [...new Set([...merged.lotIds, ...localLots])];
    const name = merged.name === DEFAULT_PROJECT_NAME ? local.name : merged.name;
    if (lotIds.length !== merged.lotIds.length || name !== merged.name) {
      merged = normalizeProject(await api.saveProject({ name, lotIds }));
    }
    for (const message of local.messages) {
      try {
        merged = normalizeProject(await api.sendMessage(toOutgoing(message)));
      } catch (error) {
        if (error.status === 401) throw error;
        notice(`A saved message about ${message.lotId} could not move to the account: ${error.message}`);
      }
    }
    return merged;
  }

  /** Called after the server accepts a sign-in or new account. */
  async function adopt(nextUser) {
    await queue;
    const local = store.get();
    currentUser = nextUser;
    try {
      const merged = await mergeLocalInto(await api.getProject(), local);
      clearSavedProject(storage);
      store.reset(merged);
    } catch (error) {
      if (error.status === 401) throw error;
      // Signed in, but the merge failed: keep the device project and send it with the next change.
      detailsDirty = true;
      unsentMessages = [...local.messages];
      notice(SYNC_FAILED);
    }
    notify();
    return nextUser;
  }

  return Object.freeze({
    store,
    user: () => currentUser,
    isSignedIn: () => Boolean(currentUser),
    signIn: async (values) => adopt(await api.signIn(values)),
    register: async (values) => adopt(await api.register(values)),
    async signOut() {
      await queue;
      try {
        await api.signOut();
      } catch (error) {
        if (error.status !== 401) throw error;
      }
      currentUser = null;
      detailsDirty = false;
      unsentMessages = [];
      store.reset(emptyProject());
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    onNotice(fn) {
      noticeListeners.add(fn);
      return () => noticeListeners.delete(fn);
    },
    /** Resolves once every queued change has been sent (or failed). */
    flush: () => queue,
  });
}

/** A signed-out session around an existing store, for pages rendered without the API (tests). */
export function guestSession(store) {
  const fail = () => Promise.reject(new Error('Sign in needs the Fabmatch API.'));
  return Object.freeze({
    store,
    user: () => null,
    isSignedIn: () => false,
    signIn: fail,
    register: fail,
    signOut: () => Promise.resolve(),
    subscribe: () => () => {},
    onNotice: () => () => {},
    flush: () => Promise.resolve(),
  });
}
