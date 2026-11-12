/**
 * Starts the site: loads the catalog and the signed-in account from the API, then renders.
 * If the API cannot be reached the page says so instead of rendering an empty catalog.
 */
import { html, el } from './lib/html.js';
import { createApi } from './lib/api.js';
import { createSession } from './lib/session.js';
import { hydrateCatalog } from './data/lots.js';
import { createApp } from './app.js';

export const LOAD_FAILED = 'The textile catalog could not load. Check the connection and reload the page.';

function safeStorage(win) {
  try {
    return win.localStorage;
  } catch {
    return null;
  }
}

function renderStatus(root, message, { busy = false } = {}) {
  root.replaceChildren(el(html`
    <main id="main" class="wrap boot-status" aria-busy="${busy ? 'true' : 'false'}">
      <p role="status">${message}</p>
    </main>`));
}

export async function bootstrap(root, { api = createApi(), win = window } = {}) {
  renderStatus(root, 'Loading textiles…', { busy: true });
  try {
    const [catalog, user] = await Promise.all([api.catalog(), api.currentUser()]);
    hydrateCatalog(catalog);
    const project = user ? await api.getProject() : null;
    const session = createSession({ api, user, project, storage: safeStorage(win) });
    return createApp(root, { session, api, win });
  } catch (error) {
    console.error('Fabmatch: could not start.', error);
    renderStatus(root, LOAD_FAILED);
    return null;
  }
}
