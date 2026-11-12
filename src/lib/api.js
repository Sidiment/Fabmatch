/**
 * The browser's client for the Fabmatch API. Unwraps the { success, data, error } envelope
 * and throws ApiError with the server's message (and per-field messages) on failure.
 */

export const CONNECTION_LOST = 'The connection was lost. Check the connection and try again.';

export class ApiError extends Error {
  constructor(message, { status = 0, fields = {} } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

async function readPayload(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createApi({ fetchImpl = (...args) => globalThis.fetch(...args), base = '/api' } = {}) {
  async function request(method, path, body) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(CONNECTION_LOST);
    }
    const payload = await readPayload(response);
    if (!response.ok || !payload?.success) {
      const message = payload?.error?.message || `The server could not complete the request (${response.status}).`;
      throw new ApiError(message, { status: response.status, fields: payload?.error?.fields || {} });
    }
    return payload.data;
  }

  return Object.freeze({
    catalog: () => request('GET', '/catalog'),
    currentUser: () => request('GET', '/auth/me').then((d) => d.user),
    register: (values) => request('POST', '/auth/register', values).then((d) => d.user),
    signIn: (values) => request('POST', '/auth/login', values).then((d) => d.user),
    signOut: () => request('POST', '/auth/logout', {}),
    getProject: () => request('GET', '/project').then((d) => d.project),
    saveProject: ({ name, lotIds }) => request('PUT', '/project', { name, lotIds }).then((d) => d.project),
    sendMessage: (message) => request('POST', '/project/messages', message).then((d) => d.project),
    sendContact: (values) => request('POST', '/contact', values),
  });
}
