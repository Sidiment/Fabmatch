/**
 * Sign-in sessions. The browser holds a random token in a cookie; only its SHA-256 hash is
 * stored, so a copy of the data directory cannot be used to sign in.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { openCollection } from '../lib/jsonStore.js';

const TOKEN_BYTES = 32;

export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');

export async function createSessionRepository({ dataDir, ttlMs, now = () => Date.now() }) {
  const sessions = await openCollection(dataDir, 'sessions');
  const isLive = (session) => Date.parse(session.expiresAt) > now();

  return Object.freeze({
    /** Starts a session and returns the raw token, which is only ever sent to the browser. */
    async create(userId) {
      const token = randomBytes(TOKEN_BYTES).toString('base64url');
      const session = await sessions.insert({
        id: randomUUID(),
        userId,
        tokenHash: hashToken(token),
        createdAt: new Date(now()).toISOString(),
        expiresAt: new Date(now() + ttlMs).toISOString(),
      });
      return { token, session };
    },
    findLiveByToken(token) {
      if (!token) return null;
      const tokenHash = hashToken(token);
      const session = sessions.find((s) => s.tokenHash === tokenHash);
      return session && isLive(session) ? session : null;
    },
    removeByToken: (token) => sessions.remove((s) => s.tokenHash === hashToken(token)),
    removeExpired: () => sessions.remove((s) => !isLive(s)),
    flush: sessions.flush,
  });
}
