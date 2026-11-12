/** Accounts. Emails are stored lowercase and are unique. */
import { randomUUID } from 'node:crypto';
import { openCollection } from '../lib/jsonStore.js';

export class DuplicateEmailError extends Error {
  constructor() {
    super('An account with that email address already exists.');
    this.name = 'DuplicateEmailError';
  }
}

/** The fields safe to send to the browser. Never includes the password hash. */
export function toPublicUser(user) {
  return Object.freeze({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt });
}

export async function createUserRepository({ dataDir }) {
  const users = await openCollection(dataDir, 'users');

  const findByEmail = (email) => users.find((u) => u.email === String(email).toLowerCase());

  return Object.freeze({
    findById: (id) => users.find((u) => u.id === id),
    findByEmail,
    async create({ email, name, role, passwordHash }) {
      const normalized = String(email).toLowerCase();
      if (findByEmail(normalized)) throw new DuplicateEmailError();
      return users.insert({ id: randomUUID(), email: normalized, name, role, passwordHash, createdAt: new Date().toISOString() });
    },
    flush: users.flush,
  });
}
