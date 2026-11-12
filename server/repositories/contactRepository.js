/** Contact form messages, held until the public contact route is decided (guide open item 10). */
import { randomUUID } from 'node:crypto';
import { openCollection } from '../lib/jsonStore.js';

export async function createContactRepository({ dataDir }) {
  const messages = await openCollection(dataDir, 'contact-messages');
  return Object.freeze({
    create: ({ name, email, message, userId = null }) => messages.insert({
      id: randomUUID(), name, email, message, userId, receivedAt: new Date().toISOString(),
    }),
    findAll: () => messages.all(),
    flush: messages.flush,
  });
}
