/**
 * The current project: saved lots and workroom messages, kept on this device.
 * Functions return new state objects. Storage failures fall back to an empty project.
 */
export const STORAGE_KEY = 'fabmatch.project.v1';
export const DEFAULT_PROJECT_NAME = 'Untitled project';

export function emptyProject(name = DEFAULT_PROJECT_NAME) {
  return Object.freeze({ name, lotIds: Object.freeze([]), messages: Object.freeze([]) });
}

/** Accepts a project from storage or the API and returns a well-formed frozen project. */
export function normalizeProject(parsed) {
  if (!parsed || typeof parsed !== 'object') return emptyProject();
  return Object.freeze({
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : DEFAULT_PROJECT_NAME,
    lotIds: Object.freeze(Array.isArray(parsed.lotIds) ? parsed.lotIds.filter((id) => typeof id === 'string') : []),
    messages: Object.freeze(Array.isArray(parsed.messages) ? parsed.messages.filter((m) => m && typeof m === 'object') : []),
  });
}

export function loadProject(storage = safeStorage()) {
  try {
    const rawValue = storage ? storage.getItem(STORAGE_KEY) : null;
    return rawValue ? normalizeProject(JSON.parse(rawValue)) : emptyProject();
  } catch (error) {
    console.warn('Fabmatch: could not read the saved project, starting empty.', error);
    return emptyProject();
  }
}

export function saveProject(project, storage = safeStorage()) {
  try {
    if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(project));
    return true;
  } catch (error) {
    console.warn('Fabmatch: could not save the project on this device.', error);
    return false;
  }
}

/** Forgets the project kept on this device, for example once it has moved into an account. */
export function clearSavedProject(storage = safeStorage()) {
  try {
    if (storage) storage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn('Fabmatch: could not clear the project saved on this device.', error);
    return false;
  }
}

export function hasLot(project, lotId) {
  return project.lotIds.includes(lotId);
}

export function addLot(project, lotId) {
  if (hasLot(project, lotId)) return project;
  return Object.freeze({ ...project, lotIds: Object.freeze([...project.lotIds, lotId]) });
}

export function removeLot(project, lotId) {
  return Object.freeze({ ...project, lotIds: Object.freeze(project.lotIds.filter((id) => id !== lotId)) });
}

export function toggleLot(project, lotId) {
  return hasLot(project, lotId) ? removeLot(project, lotId) : addLot(project, lotId);
}

export function renameProject(project, name) {
  const trimmed = String(name || '').trim();
  return Object.freeze({ ...project, name: trimmed || DEFAULT_PROJECT_NAME });
}

export function addMessage(project, message) {
  const entry = Object.freeze({ ...message, sentAt: message.sentAt || new Date().toISOString() });
  return Object.freeze({ ...project, messages: Object.freeze([...project.messages, entry]) });
}

function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
