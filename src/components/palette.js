import { html, el } from '../lib/html.js';
import { FAMILIES } from '../data/families.js';
import { routes } from '../lib/router.js';
import { emptyFilters, withFilter, filtersToQuery } from '../lib/filters.js';

export function familyHref(familyIndex, tone) {
  let filters = withFilter(emptyFilters(), 'fam', [familyIndex]);
  if (tone) filters = withFilter(filters, 'tone', [tone]);
  return routes.textiles(filtersToQuery(filters));
}

/** One link per family: three tone bands and the family name. Tone is a filter on the results page. */
export function paletteMarkup() {
  return html`
    <ul class="palette" aria-label="Browse by color palette">
      ${FAMILIES.map((family) => html`
        <li>
          <a class="palette__family" href="${familyHref(family.index)}" aria-label="${family.name}: ${family.tones.map((t) => t.name).join(', ')}">
            <span class="palette__bands" aria-hidden="true">
              ${family.tones.map((tone) => html`<span class="palette__band" style="background:${tone.hex}"></span>`)}
            </span>
            <b class="palette__label">${family.name}</b>
          </a>
        </li>`)}
    </ul>`;
}

export const renderPalette = () => el(paletteMarkup());
