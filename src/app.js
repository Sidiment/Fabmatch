import { createStore } from './lib/store.js';
import { guestSession } from './lib/session.js';
import { parseHash } from './lib/router.js';
import { toggleLot, hasLot } from './lib/project.js';
import { findLot } from './data/lots.js';
import { renderHeader, syncHeader } from './components/header.js';
import { renderFooter } from './components/footer.js';
import { createToast } from './components/toast.js';
import { syncAddButtons } from './components/lotCard.js';
import { renderHome } from './pages/home.js';
import { renderTextiles } from './pages/textiles.js';
import { renderLot } from './pages/lot.js';
import { renderProjects } from './pages/projects.js';
import { renderAbout } from './pages/about.js';
import { renderNotFound } from './pages/notFound.js';
import { renderSignIn } from './pages/signin.js';

const PAGES = Object.freeze({
  home: renderHome, textiles: renderTextiles, lot: renderLot, projects: renderProjects, about: renderAbout, signin: renderSignIn, notFound: renderNotFound,
});

const TITLES = Object.freeze({
  home: 'Fabmatch: reclaimed textiles, ready to specify',
  textiles: 'Textiles | Fabmatch',
  projects: 'Projects | Fabmatch',
  about: 'About | Fabmatch',
  signin: 'Sign in | Fabmatch',
  notFound: 'Page not found | Fabmatch',
});

function queryParam(query, key) {
  return new URLSearchParams(query).get(key) || '';
}

/** Pages that show different content to signed-in accounts, so they re-render on sign in or out. */
const ACCOUNT_PAGES = new Set(['projects', 'signin', 'lot']);

export function createApp(root, { store: givenStore, session = guestSession(givenStore || createStore()), api = null, win = window } = {}) {
  const { store } = session;
  const toast = createToast(document.body);
  const signOut = async () => {
    try {
      await session.signOut();
      toast.show('Signed out.');
    } catch (error) {
      toast.show(error.message);
    }
  };
  const header = renderHeader({ project: store.get(), user: session.user(), onSignOut: signOut });
  const main = document.createElement('main');
  main.id = 'main';
  main.tabIndex = -1;
  root.replaceChildren(header, main, renderFooter());

  const onToggleLot = (lotId) => {
    const lot = findLot(lotId);
    if (!lot) return;
    const wasIn = hasLot(store.get(), lotId);
    store.update((p) => toggleLot(p, lotId));
    const name = store.get().name;
    toast.show(wasIn ? `Removed ${lot.title} from ${name}` : `Added ${lot.title} to ${name}`, {
      undo: () => store.update((p) => toggleLot(p, lotId)),
    });
  };

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lot-add]');
    if (button) onToggleLot(button.dataset.lotAdd);
  });

  let currentRoute = parseHash(win.location.hash);

  const render = () => {
    const previous = currentRoute;
    currentRoute = parseHash(win.location.hash);
    const page = PAGES[currentRoute.name] || renderNotFound;
    const node = page({ store, session, api, route: currentRoute, toast });
    const filterUpdate = isFilterUpdate(previous, currentRoute);
    if (!filterUpdate) node.classList.add('page-enter');
    main.replaceChildren(node);
    document.title = currentRoute.name === 'lot' && findLot(currentRoute.param)
      ? `${findLot(currentRoute.param).title} | Fabmatch`
      : TITLES[currentRoute.name] || TITLES.notFound;
    syncHeader(header, headerState(store.get()));
    if (!filterUpdate) scrollToTopOrAnchor(win, currentRoute.anchor);
  };

  const headerState = (project) => ({
    routeName: currentRoute.name, project, query: queryParam(currentRoute.query, 'q'), user: session.user(),
  });

  store.subscribe((project) => {
    syncAddButtons(root, project);
    syncHeader(header, headerState(project));
  });

  session.subscribe(() => {
    syncHeader(header, headerState(store.get()));
    if (ACCOUNT_PAGES.has(currentRoute.name)) render();
  });
  session.onNotice((message) => toast.show(message));

  win.addEventListener('hashchange', render);
  render();
  return Object.freeze({ store, session, toast, render });
}

/** A filter or sort change on the textiles page keeps the reader's place; a new search does not. */
function isFilterUpdate(previous, next) {
  return previous.name === 'textiles' && next.name === 'textiles'
    && queryParam(previous.query, 'q') === queryParam(next.query, 'q');
}

/** Scrolls to the anchor, opening any collapsed details that contains it, or to the top. */
function scrollToTopOrAnchor(win, anchor) {
  if (anchor) {
    const target = document.getElementById(anchor);
    if (target) {
      let details = target.closest('details');
      while (details) { details.open = true; details = details.parentElement?.closest('details'); }
      if (typeof target.scrollIntoView === 'function') { target.scrollIntoView(); return; }
    }
  }
  if (typeof win.scrollTo === 'function') win.scrollTo(0, 0);
}
