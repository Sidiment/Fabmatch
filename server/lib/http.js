/**
 * Response envelope and errors. Every API response is
 *   { success: true,  data: {...}, error: null }  or
 *   { success: false, data: null,  error: { message, fields? } }.
 */

export class HttpError extends Error {
  constructor(status, message, { fields } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.fields = fields;
  }
}

export const badRequest = (message, fields) => new HttpError(400, message, { fields });
export const unauthorized = (message = 'Sign in to continue.') => new HttpError(401, message);
export const notFound = (message = 'Not found.') => new HttpError(404, message);
export const conflict = (message, fields) => new HttpError(409, message, { fields });

export function sendData(res, data, status = 200) {
  res.status(status).json({ success: true, data, error: null });
}

export function sendError(res, status, message, fields) {
  const error = fields && Object.keys(fields).length ? { message, fields } : { message };
  res.status(status).json({ success: false, data: null, error });
}

const FIX_FIELDS = 'Check the highlighted fields.';

/**
 * Parses req.body with a zod schema for shape and types, then runs a shared field validator
 * for the rules the browser also checks. Throws a 400 with per-field messages on failure.
 */
export function parseBody(body, schema, validate = (values) => ({ errors: {}, values })) {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    const fields = {};
    parsed.error.issues.forEach((issue) => {
      const key = issue.path[0];
      if (key !== undefined && !fields[key]) fields[key] = issue.message;
    });
    throw badRequest(FIX_FIELDS, fields);
  }
  const { errors, values } = validate(parsed.data);
  if (Object.keys(errors).length) throw badRequest(FIX_FIELDS, errors);
  return values;
}
