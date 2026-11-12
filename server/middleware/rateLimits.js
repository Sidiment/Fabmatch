/** In-memory rate limits per IP address. Enough for one prototype server process. */
import { rateLimit } from 'express-rate-limit';
import { sendError } from '../lib/http.js';

function limiter(windowMs, limit, message) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => sendError(res, 429, message),
  });
}

export function createRateLimits({ windowMs, auth, contact, api }) {
  return Object.freeze({
    api: limiter(windowMs, api, 'Too many requests. Wait a few minutes and try again.'),
    auth: limiter(windowMs, auth, 'Too many sign-in attempts. Wait 15 minutes and try again.'),
    contact: limiter(windowMs, contact, 'Too many messages from this connection. Wait 15 minutes and try again.'),
  });
}
