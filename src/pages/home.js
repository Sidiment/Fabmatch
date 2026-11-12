import { html, raw, el } from '../lib/html.js';
import { LOTS, CATEGORIES, MANUFACTURERS, KIND_LABELS, isPieceLot, SAMPLE_SOURCE } from '../data/lots.js';
import { routes } from '../lib/router.js';
import { emptyFilters, withFilter, filtersToQuery, FIRE_RATINGS, RUB_MINIMUMS, NRC_MINIMUMS, sortLots } from '../lib/filters.js';
import { formatNumber } from '../lib/format.js';
import { paletteMarkup } from '../components/palette.js';
import { cardMarkup } from '../components/lotCard.js';
import { hasLot } from '../lib/project.js';

const FEATURED_COUNT = 4;

const filterHref = (key, value) => routes.textiles(filtersToQuery(withFilter(emptyFilters(), key, value)));

const quickLinks = () => [
  ...(LOTS.some(isPieceLot) ? [{ label: `${SAMPLE_SOURCE} samples`, href: filterHref('kind', [KIND_LABELS.piece]) }] : []),
  { label: FIRE_RATINGS[0], href: filterHref('fire', [FIRE_RATINGS[0]]) },
  { label: '30,000+ double rubs', href: filterHref('rubs', 30000) },
  { label: 'NRC 0.40+', href: filterHref('nrc', 0.4) },
];

const performanceBoxes = () => [
  { title: 'Fire rating', blurb: 'As listed on the manufacturer\'s sheet', items: FIRE_RATINGS.map((f) => ({ label: f, href: filterHref('fire', [f]) })) },
  { title: 'Abrasion', blurb: 'Wyzenbeek double rubs, minimum', items: RUB_MINIMUMS.map((r) => ({ label: `${formatNumber(r)}+`, href: filterHref('rubs', r) })) },
  { title: 'Acoustic rating', blurb: 'Noise reduction coefficient, minimum', items: NRC_MINIMUMS.map((n) => ({ label: `${n.toFixed(2)}+`, href: filterHref('nrc', n) })) },
];

export function featuredLots() {
  return sortLots(LOTS, 'newest').slice(0, FEATURED_COUNT);
}

export function homeMarkup(project) {
  const totalYards = LOTS.reduce((s, l) => s + (l.yd || 0), 0);
  return html`
    <div class="wrap home">
      <section class="hero">
        <div class="hero__copy">
          <p class="hero__kicker">Match. Specify. Divert.</p>
          <h1>Reclaimed textiles, ready to specify</h1>
          <p class="hero__lede">Remnant textiles from verified manufacturers, with yardage, documentation on file, and the products each lot can supply.</p>
          <ul class="hero__quick" aria-label="Browse">
            <li><a class="pill pill--ink" href="${routes.textiles()}">Browse all ${LOTS.length} lots</a></li>
            ${quickLinks().map((q) => html`<li><a class="pill" href="${q.href}">${q.label}</a></li>`)}
          </ul>
        </div>
        <dl class="stats" aria-label="On hand">
          <div><dt>Lots on hand</dt><dd>${formatNumber(LOTS.length)}</dd></div>
          <div><dt>Verified manufacturers</dt><dd>${formatNumber(MANUFACTURERS.length)}</dd></div>
          <div><dt>Yards in all</dt><dd>${formatNumber(totalYards)}</dd></div>
        </dl>
      </section>

      <section class="section" aria-labelledby="featured-title">
        <div class="section-head">
          <h2 id="featured-title">Recently confirmed lots</h2>
          <a href="${routes.textiles()}">See all ${LOTS.length} lots</a>
        </div>
        <div class="lot-grid">${featuredLots().map((lot) => raw(cardMarkup(lot, { inProject: hasLot(project, lot.id) })))}</div>
      </section>

      <section class="section" aria-labelledby="app-title">
        <h2 id="app-title">Browse by application</h2>
        <ul class="apps">
          ${CATEGORIES.map((c) => html`<li><a class="apps__tile" href="${filterHref('cat', c.id)}"><b>${c.id}</b><span>${c.blurb}</span></a></li>`)}
        </ul>
      </section>

      <section class="section" aria-labelledby="palette-title">
        <div class="section-head">
          <h2 id="palette-title">Browse by color palette</h2>
          <p class="caption">Colors are approximate. Confirm with a physical swatch.</p>
        </div>
        ${raw(paletteMarkup())}
      </section>

      <section class="section" aria-labelledby="perf-title">
        <h2 id="perf-title">Filter by performance</h2>
        <div class="perf">
          ${performanceBoxes().map((box) => html`
            <div class="card perf__box">
              <h3>${box.title}</h3>
              <p class="caption">${box.blurb}</p>
              <ul class="perf__row">${box.items.map((i) => html`<li><a class="pill" href="${i.href}">${i.label}</a></li>`)}</ul>
            </div>`)}
        </div>
      </section>

      <section class="section" aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <ol class="steps">
          <li class="step"><b>Search and filter</b><p>Narrow by fiber, ratings, color, yardage, and documentation.</p></li>
          <li class="step"><b>Review the lot</b><p>Each rating with its test method, and what the yardage can make.</p></li>
          <li class="step"><b>Open manufacturer resources</b><p>Photographs, documents, and swatch ordering from the source.</p></li>
          <li class="step"><b>Add to project</b><p>Save the lot, ask the workroom, and export the spec.</p></li>
        </ol>
      </section>
    </div>`;
}

export function renderHome({ store }) {
  return el(homeMarkup(store.get()));
}
