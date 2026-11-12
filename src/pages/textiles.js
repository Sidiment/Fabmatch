import { html, raw, el } from '../lib/html.js';
import { LOTS, CATEGORIES, lotsInCategory, isPieceLot, REGION, SAMPLE_SOURCE } from '../data/lots.js';
import { routes, navigate } from '../lib/router.js';
import { applyFilters, filtersFromQuery, filtersToQuery, activeChips, withFilter, SORTS } from '../lib/filters.js';
import { pluralize } from '../lib/format.js';
import { ICONS } from '../lib/icons.js';
import { renderFilterRail } from '../components/filterRail.js';
import { cardMarkup } from '../components/lotCard.js';
import { hasLot } from '../lib/project.js';

export const EMPTY_COPY = 'No remnants match these filters yet. Widen the yardage range or remove a filter.';

function categoryChips(filters) {
  const all = [{ id: '', label: 'All textiles' }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.id }))];
  return html`
    <nav class="chips" aria-label="Product type">
      ${all.map((c) => html`<a class="pill" href="${routes.textiles(filtersToQuery(withFilter(filters, 'cat', c.id)))}" aria-current="${filters.cat === c.id ? 'true' : 'false'}">${c.label}<small>${lotsInCategory(c.id).length}</small></a>`)}
    </nav>`;
}

/** "14 lots from 3 verified manufacturers in the Seattle region", adding how many are sample pieces. */
export function resultsCountText(shown) {
  const pieces = shown.filter(isPieceLot).length;
  const rolls = shown.filter((l) => !isPieceLot(l));
  const manufacturers = new Set(rolls.map((l) => l.mfr).filter(Boolean)).size;
  const parts = [];
  if (rolls.length || !pieces) parts.push(`from ${pluralize(manufacturers, 'verified manufacturer')} in the ${REGION}`);
  if (pieces && rolls.length) parts.push(`including ${pluralize(pieces, 'sample piece')} from ${SAMPLE_SOURCE}`);
  else if (pieces) parts.push(`of sample pieces from ${SAMPLE_SOURCE}`);
  return parts.join(', ');
}

function resultsBar(filters, shown) {
  return html`
    <div class="results-bar">
      <p class="results-bar__count" role="status"><b>${pluralize(shown.length, 'lot')}</b> ${resultsCountText(shown)}${filters.q ? html` for "${filters.q}"` : ''}</p>
      <label class="results-bar__sort">
        <span>Sort</span>
        <select data-sort>${SORTS.map((s) => html`<option value="${s.id}" ${filters.sort === s.id ? 'selected' : ''}>${s.label}</option>`)}</select>
      </label>
    </div>`;
}

function chipsRow(filters) {
  const chips = activeChips(filters);
  const queryChip = filters.q ? [{ label: `Search: ${filters.q}`, next: withFilter(filters, 'q', '') }] : [];
  const all = [...queryChip, ...chips];
  if (!all.length) return '';
  return html`
    <ul class="active-chips" aria-label="Active filters">
      ${all.map((chip, i) => html`<li><a class="active-chip" href="${routes.textiles(filtersToQuery(chip.next))}" aria-label="Remove filter ${chip.label}">${chip.label}${raw(ICONS.close)}</a></li>`)}
    </ul>`;
}

export function textilesMarkup(filters, project) {
  const shown = applyFilters(LOTS, filters);
  return html`
    <div class="wrap textiles">
      <div class="page-head">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="${routes.home()}">Home</a><span aria-hidden="true">/</span><span>Textiles</span></nav>
        <h1>Textiles</h1>
      </div>
      ${raw(categoryChips(filters))}
      <div class="textiles__layout">
        <details class="rail-drawer" data-rail-drawer>
          <summary class="pill">Filters</summary>
          <div data-rail-slot></div>
        </details>
        <div class="textiles__results">
          ${raw(resultsBar(filters, shown))}
          ${raw(chipsRow(filters))}
          ${shown.length
            ? html`<div class="lot-grid" data-results>${shown.map((lot) => raw(cardMarkup(lot, { inProject: hasLot(project, lot.id) })))}</div>`
            : html`<div class="empty" data-results><p>${EMPTY_COPY}</p><p><a href="${routes.textiles()}">Clear all filters</a></p></div>`}
        </div>
      </div>
    </div>`;
}

export function renderTextiles({ store, route }) {
  const filters = filtersFromQuery(route.query);
  const node = el(textilesMarkup(filters, store.get()));
  const go = (next) => navigate(routes.textiles(filtersToQuery(next)));

  node.querySelector('[data-rail-slot]').replaceWith(renderFilterRail(filters, go));
  keepDrawerOpenOnDesktop(node.querySelector('[data-rail-drawer]'));
  node.querySelector('[data-sort]').addEventListener('change', (event) => go(withFilter(filters, 'sort', event.target.value)));
  return node;
}

const DESKTOP_QUERY = '(min-width: 1024px)';

/** The filter rail is a drawer below 1024 px and always open above it. */
function desktopMedia() {
  if (typeof window.matchMedia === 'function') return window.matchMedia(DESKTOP_QUERY);
  return { matches: true, addEventListener: () => {} };
}

export function keepDrawerOpenOnDesktop(drawer, media = desktopMedia()) {
  const apply = () => { if (media.matches) drawer.open = true; };
  apply();
  media.addEventListener('change', apply);
}
