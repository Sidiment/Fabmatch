/**
 * Static demo mode for GitHub Pages, where there is no API server. The catalog is exported to
 * catalog.json at build time (scripts/export-catalog.js) and this module answers the site's
 * /api requests from it. Browsing, filters, lot pages, estimates, and projects work; projects
 * are kept in the visitor's browser. Sign-in and the contact form say they are off.
 */

export const DEMO_SIGN_IN_OFF = 'Sign-in is off in this demo. Saved lots are kept in this browser.';
export const DEMO_CONTACT_OFF = 'The contact form is off in this demo.';
export const DEMO_ACTION_OFF = 'This action is off in this demo.';

const reply = (success, data, message, status) => new Response(
  JSON.stringify({ success, data: success ? data : null, error: success ? null : { message } }),
  { status, headers: { 'Content-Type': 'application/json' } },
);

const ok = (data) => reply(true, data, null, 200);
const off = (message) => reply(false, null, message, 503);

/**
 * Returns a fetch function that serves /api from the exported catalog and passes every other
 * request to the real fetch. catalogUrl is relative to the page, so the site works under any path.
 */
export function createStaticFetch({ realFetch = (...args) => globalThis.fetch(...args), catalogUrl = 'catalog.json' } = {}) {
  let catalog = null;
  const loadCatalog = async () => {
    if (!catalog) {
      catalog = realFetch(catalogUrl).then((response) => {
        if (!response.ok) throw new Error(`catalog.json returned ${response.status}`);
        return response.json();
      }).catch((error) => {
        catalog = null;
        throw error;
      });
    }
    return catalog;
  };

  return async function staticFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('/api')) return realFetch(input, init);
    const path = url.slice('/api'.length).split('?')[0];
    const method = String(init.method || 'GET').toUpperCase();

    if (method === 'GET') {
      if (path === '/health') return ok({ ok: true });
      if (path === '/auth/me') return ok({ user: null });
      if (path === '/catalog') return ok(await loadCatalog());
      if (path === '/families') return ok({ families: (await loadCatalog()).families });
      if (path === '/lots') {
        const { lots } = await loadCatalog();
        return ok({ lots, total: lots.length });
      }
      if (path.startsWith('/lots/')) {
        const id = decodeURIComponent(path.slice('/lots/'.length));
        const lot = (await loadCatalog()).lots.find((l) => l.id === id);
        return lot ? ok({ lot }) : reply(false, null, `No lot has the ID ${id}.`, 404);
      }
    }
    if (path.startsWith('/auth') || path.startsWith('/project')) return off(DEMO_SIGN_IN_OFF);
    if (path === '/contact') return off(DEMO_CONTACT_OFF);
    return off(DEMO_ACTION_OFF);
  };
}

export function installStaticApi(win = globalThis, options = {}) {
  const realFetch = win.fetch.bind(win);
  win.fetch = createStaticFetch({ realFetch, ...options });
  return win.fetch;
}
