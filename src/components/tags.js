import { html, raw } from '../lib/html.js';
import { ICONS } from '../lib/icons.js';
import { pluralize } from '../lib/format.js';

/** Tags carry an icon plus words. Status is never shown by color alone. */
export const verifiedTag = (lot) => html`<span class="tag tag--plain">${raw(ICONS.check)}<span>Verified manufacturer: <b>${lot.mfr}</b>, ${lot.region}</span></span>`;

/** Card version: the word Verified, then the manufacturer. Region is on the lot page. */
export const verifiedTagCompact = (lot) => html`<span class="tag tag--plain tag--compact" title="Verified manufacturer, ${lot.region}">${raw(ICONS.check)}<span>Verified · <b>${lot.mfr}</b></span></span>`;

export const docsTag = (lot) => (lot.docs.length
  ? html`<span class="tag">${raw(ICONS.document)}Documentation on file, ${pluralize(lot.docs.length, 'document')}</span>`
  : html`<span class="tag tag--muted">${raw(ICONS.alert)}No documentation on file yet</span>`);

/** Card version: "3 docs on file" or "No docs yet". */
export const docsTagCompact = (lot) => (lot.docs.length
  ? html`<span class="tag tag--plain tag--compact" title="Documentation on file">${raw(ICONS.document)}<span>${pluralize(lot.docs.length, 'doc')} on file</span></span>`
  : html`<span class="tag tag--plain tag--compact" title="No documentation on file yet">${raw(ICONS.alert)}<span>No docs yet</span></span>`);

export const confirmedTag = (dateText) => html`<span class="tag tag--plain">${raw(ICONS.clock)}Last confirmed ${dateText}</span>`;

export const colorDot = (hex, label) => html`<span class="dot" style="background:${hex}" role="img" aria-label="${label}"></span>`;
