/** Reads the session cookie on every request and attaches req.user when it is live. */
import { unauthorized } from '../lib/http.js';

export function sessionCookieOptions(config) {
  return Object.freeze({
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionTtlMs,
  });
}

export function loadSession({ config, sessions, users }) {
  return (req, res, next) => {
    const token = req.cookies?.[config.cookieName];
    const session = sessions.findLiveByToken(token);
    const user = session ? users.findById(session.userId) : null;
    req.session = user ? session : null;
    req.sessionToken = user ? token : null;
    req.user = user;
    if (token && !user) {
      // Stale or unknown cookie: clear it so the browser stops sending it.
      const { maxAge, ...options } = sessionCookieOptions(config);
      res.clearCookie(config.cookieName, options);
    }
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(unauthorized('Signed out for security. Sign in to continue.'));
  return next();
}
