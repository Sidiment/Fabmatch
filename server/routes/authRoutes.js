/** Account and session endpoints under /api/auth. */
import { Router } from 'express';
import { parseBody, sendData, unauthorized, conflict } from '../lib/http.js';
import { signInSchema, registrationSchema } from '../schemas.js';
import { validateSignIn, validateRegistration } from '../../shared/validators.js';
import { hashPassword, verifyPassword, verifyAgainstDummy } from '../auth/password.js';
import { sessionCookieOptions } from '../middleware/auth.js';
import { DuplicateEmailError, toPublicUser } from '../repositories/userRepository.js';

/** Guide section 9.5, "Sign-in failed". The same words whether the email or the password was wrong. */
export const SIGN_IN_FAILED = 'That email address or password was not recognized. Check the spelling or reset the password.';

export function authRoutes({ config, users, sessions, limits, logger }) {
  const router = Router();
  const cookieOptions = sessionCookieOptions(config);
  const { maxAge, ...clearOptions } = cookieOptions;

  async function startSession(res, user) {
    const { token } = await sessions.create(user.id);
    res.cookie(config.cookieName, token, cookieOptions);
  }

  /** Ends the session the request arrived with. clearCookie is false when a new cookie replaces it. */
  async function endCurrentSession(req, res, { clearCookie = true } = {}) {
    if (req.sessionToken) await sessions.removeByToken(req.sessionToken);
    if (clearCookie) res.clearCookie(config.cookieName, clearOptions);
  }

  router.get('/me', (req, res) => {
    sendData(res, { user: req.user ? toPublicUser(req.user) : null });
  });

  router.post('/register', limits.auth, async (req, res) => {
    const values = parseBody(req.body, registrationSchema, validateRegistration);
    let user;
    try {
      user = await users.create({ ...values, passwordHash: await hashPassword(values.password) });
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        throw conflict('An account with that email address already exists. Sign in instead.', { email: 'This email address already has an account.' });
      }
      throw error;
    }
    await endCurrentSession(req, res, { clearCookie: false });
    await startSession(res, user);
    logger.info('account created', { userId: user.id, role: user.role });
    sendData(res, { user: toPublicUser(user) }, 201);
  });

  router.post('/login', limits.auth, async (req, res) => {
    const { email, password } = parseBody(req.body, signInSchema, validateSignIn);
    const user = users.findByEmail(email);
    const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyAgainstDummy(password);
    if (!valid) throw unauthorized(SIGN_IN_FAILED);
    // A new token on every sign-in, so a token seen before sign-in is worthless after it.
    await endCurrentSession(req, res, { clearCookie: false });
    await startSession(res, user);
    sendData(res, { user: toPublicUser(user) });
  });

  router.post('/logout', async (req, res) => {
    await endCurrentSession(req, res);
    sendData(res, { signedOut: true });
  });

  return router;
}
