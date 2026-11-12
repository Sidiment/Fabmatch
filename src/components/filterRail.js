import { html, raw, el } from '../lib/html.js';
import { FAMILIES, TONES } from '../data/families.js';
import { FIBERS, DOC_TYPES, PATTERN_NAMES, BRANDS } from '../data/lots.js';
import { FIRE_RATINGS, RUB_MINIMUMS, NRC_MINIMUMS, YARDAGE_BUCKETS, KINDS, toggleValue, withFilter, clearFilters, countActive } from '../lib/filters.js';
import { formatNumber } from '../lib/format.js';
import { colorDot } from './tags.js';

const checkboxGroup = (id, title, key, items, filters, { open = true, hint = '' } = {}) => html`
  <details class="rail__group" ${open ? 'open' : ''}>
    <summary>${title}</summary>
    <div class="rail__options" role="group" aria-label="${title}">
      ${items.map((item) => html`
        <label class="rail__option">
          <input type="checkbox" data-filter-key="${key}" data-filter-value="${item.value}" ${filters[key].includes(item.value) ? 'checked' : ''}>
          ${item.dot ? raw(colorDot(item.dot, `${item.label} swatch`)) : ''}<span>${item.label}</span>
        </label>`)}
    </div>
    ${hint ? html`<p class="rail__hint">${hint}</p>` : ''}
  </details>`;

const radioGroup = (id, title, key, items, filters, hint, { open = true } = {}) => html`
  <details class="rail__group" ${open ? 'open' : ''}>
    <summary>${title}</summary>
    <div class="rail__options" role="radiogroup" aria-label="${title}">
      <label class="rail__option"><input type="radio" name="${id}" data-filter-key="${key}" data-filter-value="0" ${!filters[key] ? 'checked' : ''}><span>Any</span></label>
      ${items.map((item) => html`<label class="rail__option"><input type="radio" name="${id}" data-filter-key="${key}" data-filter-value="${item.value}" ${filters[key] === item.value ? 'checked' : ''}><span>${item.label}</span></label>`)}
    </div>
    <p class="rail__hint">${hint}</p>
  </details>`;

export function railMarkup(filters) {
  const active = countActive(filters);
  const has = (key) => (Array.isArray(filters[key]) ? filters[key].length > 0 : Boolean(filters[key]));
  return html`
    <aside class="rail" aria-label="Search filters">
      <div class="rail__head">
        <h2 class="rail__title">Search filters</h2>
        ${active ? html`<button class="link-button" type="button" data-filter-clear>Clear all (${active})</button>` : ''}
      </div>
      ${raw(checkboxGroup('kind', 'Lot type', 'kind', KINDS.map((v) => ({ value: v, label: v })), filters, { hint: 'Sample pieces are from the Redesign Collective inventory.' }))}
      ${raw(checkboxGroup('fire', 'Fire rating', 'fire', FIRE_RATINGS.map((v) => ({ value: v, label: v })), filters))}
      ${raw(radioGroup('rubs', 'Abrasion', 'rubs', RUB_MINIMUMS.map((v) => ({ value: v, label: `${formatNumber(v)}+` })), filters, 'Wyzenbeek double rubs, minimum.'))}
      ${raw(checkboxGroup('yd', 'Yardage on hand', 'yd', YARDAGE_BUCKETS.map((v) => ({ value: v, label: v })), filters))}
      ${raw(radioGroup('nrc', 'Acoustic rating', 'nrc', NRC_MINIMUMS.map((v) => ({ value: v, label: `${v.toFixed(2)}+` })), filters, 'Noise reduction coefficient, minimum.', { open: has('nrc') }))}
      ${raw(checkboxGroup('fam', 'Color family', 'fam', FAMILIES.map((f) => ({ value: f.index, label: f.name, dot: f.tones[1].hex })), filters, { open: has('fam') }))}
      ${raw(checkboxGroup('tone', 'Tone', 'tone', TONES.map((v) => ({ value: v, label: v })), filters, { open: has('tone') }))}
      ${raw(checkboxGroup('fiber', 'Fiber', 'fiber', FIBERS.map((v) => ({ value: v, label: v })), filters, { open: has('fiber') }))}
      ${raw(checkboxGroup('pattern', 'Pattern', 'pattern', Object.values(PATTERN_NAMES).map((v) => ({ value: v, label: v })), filters, { open: has('pattern') }))}
      ${raw(checkboxGroup('mfr', 'Manufacturer or brand', 'mfr', BRANDS.map((v) => ({ value: v, label: v })), filters, { open: has('mfr') }))}
      ${raw(checkboxGroup('docs', 'Documentation on file', 'docs', DOC_TYPES.map((v) => ({ value: v, label: v })), filters, { open: has('docs') }))}
    </aside>`;
}

/** Parses a checkbox or radio change into the next filters object. */
export function nextFiltersFromInput(filters, input) {
  const key = input.dataset.filterKey;
  const rawValue = input.dataset.filterValue;
  if (input.type === 'radio') return withFilter(filters, key, Number(rawValue));
  const value = key === 'fam' ? Number(rawValue) : rawValue;
  return toggleValue(filters, key, value);
}

export function renderFilterRail(filters, onChange) {
  const node = el(railMarkup(filters));
  node.addEventListener('change', (event) => {
    const input = event.target.closest('[data-filter-key]');
    if (input) onChange(nextFiltersFromInput(filters, input));
  });
  node.addEventListener('click', (event) => {
    if (event.target.closest('[data-filter-clear]')) onChange(clearFilters(filters));
  });
  return node;
}
