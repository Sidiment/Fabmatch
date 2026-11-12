/**
 * One working project per account: a name, saved lot IDs, and workroom messages.
 * A project record is only written once the account changes something.
 */
import { randomUUID } from 'node:crypto';
import { openCollection } from '../lib/jsonStore.js';

export const DEFAULT_PROJECT_NAME = 'Untitled project';

/** The fields sent to the browser, in the shape the site's project state uses. */
export function toPublicProject(project) {
  return Object.freeze({ name: project.name, lotIds: project.lotIds, messages: project.messages, updatedAt: project.updatedAt ?? null });
}

const blankProject = (userId) => ({ userId, name: DEFAULT_PROJECT_NAME, lotIds: [], messages: [], updatedAt: null });

export async function createProjectRepository({ dataDir }) {
  const projects = await openCollection(dataDir, 'projects');
  const byUser = (userId) => (p) => p.userId === userId;

  async function upsert(userId, change) {
    const timestamp = new Date().toISOString();
    const updated = await projects.update(byUser(userId), (p) => ({ ...change(p), updatedAt: timestamp }));
    if (updated) return updated;
    const created = { ...change(blankProject(userId)), id: randomUUID(), createdAt: timestamp, updatedAt: timestamp };
    return projects.insert(created);
  }

  return Object.freeze({
    findByUser: (userId) => projects.find(byUser(userId)) ?? blankProject(userId),
    saveDetails: (userId, { name, lotIds }) => upsert(userId, (p) => ({ ...p, name, lotIds: [...lotIds] })),
    addMessage(userId, message) {
      const entry = Object.freeze({ id: randomUUID(), ...message, sentAt: new Date().toISOString() });
      return upsert(userId, (p) => ({ ...p, messages: [...p.messages, entry] }));
    },
    flush: projects.flush,
  });
}
