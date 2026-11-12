import { html, raw, el } from '../lib/html.js';
import { ICONS } from '../lib/icons.js';
import { routes, navigate } from '../lib/router.js';
import { filtersToQuery, emptyFilters, withFilter } from '../lib/filters.js';

export const NAV_ITEMS = Object.freeze([
  { name: 'textiles', label: 'Textiles', href: routes.textiles() },
  { name: 'projects', label: 'Projects', href: routes.projects() },
  { name: 'about', label: 'About', href: routes.about() },
]);

export function renderHeader({ project, user = null, onSignOut }) {
  const header = el(html`
    <header class="site-header">
      <div class="wrap site-header__bar">
        <a class="wordmark" href="${routes.home()}" aria-label="Fabmatch home">
          <img src="brand/wordmark-light.svg" alt="" width="150" height="29">
        </a>
        <form class="search" role="search" data-search>
          <label class="visually-hidden" for="site-search">Search textiles</label>
          ${raw(ICONS.search)}
          <input id="site-search" type="search" name="q" placeholder="Search fiber, color, or pattern" autocomplete="off">
          <button class="search__go" type="submit">Search</button>
        </form>
        <nav class="site-nav" aria-label="Main">
          ${NAV_ITEMS.map((item) => html`<a href="${item.href}" data-nav="${item.name}">${item.label}${item.name === 'projects' ? raw(`<span class="site-nav__count" data-project-count>${project.lotIds.length}</span>`) : ''}</a>`)}
          <a class="pill pill--quiet" href="${routes.signIn()}" data-sign-in ${raw(user ? 'hidden' : '')}>Sign in</a>
          <span class="site-nav__account" data-account ${raw(user ? '' : 'hidden')}>
            <span class="site-nav__user" data-account-name>${user ? user.name : ''}</span>
            <button class="pill pill--quiet" type="button" data-sign-out>Sign out</button>
          </span>
        </nav>
      </div>
    </header>`);

  header.querySelector('[data-search]').addEventListener('submit', (event) => {
    event.preventDefault();
    const q = header.querySelector('#site-search').value.trim();
    navigate(routes.textiles(filtersToQuery(withFilter(emptyFilters(), 'q', q))));
  });
  header.querySelector('[data-sign-out]').addEventListener('click', () => onSignOut && onSignOut());
  return header;
}

export function syncHeader(header, { routeName, project, query, user = null }) {
  header.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === routeName) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  header.querySelector('[data-project-count]').textContent = String(project.lotIds.length);
  header.querySelector('[data-sign-in]').hidden = Boolean(user);
  header.querySelector('[data-account]').hidden = !user;
  header.querySelector('[data-account-name]').textContent = user ? user.name : '';
  const input = header.querySelector('#site-search');
  if (document.activeElement !== input) input.value = query || '';
}
