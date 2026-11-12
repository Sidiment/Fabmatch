/**
 * Cross-site request protection for the cookie session, layered:
 *  1. The session cookie is SameSite=Lax, so other sites cannot send it on POST/PUT/DELETE.
 *  2. Writes must be JSON. A plain HTML form on another site cannot send application/json.
 *  3. When the browser sends an Origin header, it must be this site or an allowed origin.
 */
import { sendError } from '../lib/http.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireSameOriginJson({ allowedOrigins }) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    const selfOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin && origin !== selfOrigin && !allowed.has(origin)) {
      return sendError(res, 403, 'This request came from a site that is not allowed.');
    }
    if (!req.is('application/json')) {
      return sendError(res, 415, 'Send the request body as JSON.');
    }
    return next();
  };
}
