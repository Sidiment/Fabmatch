import { html, raw, el } from '../lib/html.js';
import { routes } from '../lib/router.js';
import { formatNrc, formatShortDate, formatNumber, formatInches } from '../lib/format.js';
import { findProduct } from '../lib/estimator.js';
import { ICONS } from '../lib/icons.js';
import { isPieceLot } from '../data/lots.js';
import { lotImage, amountBadge, brandText, estimateForLot } from '../lib/lotView.js';

const CARD_PRODUCTS = Object.freeze([
  { id: 'pillow-18x18', short: 'pillow covers' },
  { id: 'art-panel-24x48', short: 'art panels' },
]);

/** "Supports about 71 pillow covers or 25 art panels". Used by the project list; the lot page has the full table. */
export function supportsLine(lot) {
  const parts = CARD_PRODUCTS.map(({ id, short }) => {
    const result = estimateForLot(lot, findProduct(id));
    return result.fits && result.quantity > 0 ? `${formatNumber(result.quantity)} ${short}` : null;
  }).filter(Boolean);
  if (parts.length) return `Supports about ${parts.join(' or ')}`;
  if (isPieceLot(lot)) return 'Too small for the listed products';
  return lot.width ? 'Too narrow for the listed products' : 'Width or yardage not recorded';
}

const CARD_CHIP_LIMIT = 2;

/** Short rating labels for the card, each naming its method. The lot page adds the publisher. */
export function performanceParts(lot) {
  return [
    ...lot.fire,
    lot.rubs ? `Wyzenbeek ${formatNumber(lot.rubs)}` : null,
    lot.nrc ? formatNrc(lot.nrc) : null,
  ].filter(Boolean);
}

/** The first two ratings as chips, then "+1 more" so every card stays one chip row. */
function ratingChips(lot, perf) {
  const shown = perf.slice(0, CARD_CHIP_LIMIT);
  const rest = perf.slice(CARD_CHIP_LIMIT);
  return html`
    <ul class="lot-card__perf" aria-label="Ratings on the manufacturer's sheet">
      ${shown.map((p) => html`<li class="chip">${p}</li>`)}
      ${rest.length ? html`<li><a class="chip chip--more" href="${routes.lot(lot.id, 'perf')}" aria-label="${rest.length} more ratings: ${rest.join(', ')}">+${rest.length} more</a></li>` : ''}
    </ul>`;
}

/**
 * Provenance: a Verified line (or the brand from a sample label, which is not verified), then
 * documents and last confirmed. Icon plus words, never color alone.
 */
function provenanceRows(lot) {
  const docs = lot.docs.length ? `${formatNumber(lot.docs.length)} ${lot.docs.length === 1 ? 'doc' : 'docs'} on file` : 'No docs yet';
  const verified = lot.mfr && lot.mfrVerified !== false;
  const brandLine = verified
    ? html`<p class="lot-card__meta-item" title="Verified manufacturer, ${lot.region}">${raw(ICONS.check)}<span>${brandText(lot)}</span></p>`
    : html`<p class="lot-card__meta-item" title="From the sample label, not verified">${raw(ICONS.tag)}<span>${brandText(lot)}</span></p>`;
  const when = lot.lastConfirmed
    ? html`<span class="lot-card__meta-item" title="Last confirmed by the workroom">${raw(ICONS.clock)}<span>Confirmed ${formatShortDate(lot.lastConfirmed)}</span></span>`
    : html`<span class="lot-card__meta-item" title="Lot ID">${raw(ICONS.clock)}<span>Not confirmed yet</span></span>`;
  return html`
    <div class="lot-card__meta">
      ${raw(brandLine)}
      <p class="lot-card__meta-row">
        <span class="lot-card__meta-item">${raw(lot.docs.length ? ICONS.document : ICONS.alert)}<span>${docs}</span></span>
        ${raw(when)}
      </p>
    </div>`;
}

/** "Wool, 54 in wide" for a roll; "27 x 27 in each" for sample pieces. Blank parts are left out. */
export function cardFacts(lot) {
  if (isPieceLot(lot)) return [lot.fiber, lot.size ? `${lot.size} each` : 'Size not recorded'].filter(Boolean).join(', ');
  return [lot.fiber, lot.width ? `${formatInches(lot.width)} wide` : null].filter(Boolean).join(', ') || 'Fiber and width not recorded';
}

export function cardMarkup(lot, { inProject }) {
  const href = routes.lot(lot.id);
  const perf = performanceParts(lot);
  const image = lotImage(lot, { card: true });
  const badge = amountBadge(lot);
  return html`
    <article class="lot-card" data-lot-card="${lot.id}">
      <a class="lot-card__photo" href="${href}" tabindex="-1">
        <img src="${image.src}" alt="${image.alt}" loading="lazy" width="240" height="240">
        ${badge ? html`<span class="lot-card__badge">${badge}</span>` : ''}
      </a>
      <div class="lot-card__body">
        <p class="lot-card__type">${lot.cat || (isPieceLot(lot) ? 'Sample piece' : 'Application not recorded')}</p>
        <h3 class="lot-card__title"><a href="${href}">${lot.title}</a></h3>
        <p class="lot-card__facts">${cardFacts(lot)}</p>
        ${perf.length ? raw(ratingChips(lot, perf)) : html`<p class="lot-card__perf-none">No ratings listed</p>`}
        ${raw(provenanceRows(lot))}
      </div>
      <button class="btn btn--card" type="button" data-lot-add="${lot.id}" aria-pressed="${inProject ? 'true' : 'false'}">${inProject ? 'Added to project' : 'Add to project'}</button>
    </article>`;
}

export function renderLotCard(lot, options) {
  return el(cardMarkup(lot, options));
}

/** Updates every add button under root to match the project, without re-rendering the cards. */
export function syncAddButtons(root, project) {
  root.querySelectorAll('[data-lot-add]').forEach((button) => {
    const inProject = project.lotIds.includes(button.dataset.lotAdd);
    button.setAttribute('aria-pressed', inProject ? 'true' : 'false');
    button.textContent = inProject ? 'Added to project' : 'Add to project';
  });
}
