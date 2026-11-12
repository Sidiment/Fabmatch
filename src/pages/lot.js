import { html, raw, el } from '../lib/html.js';
import { findLot, isPieceLot } from '../data/lots.js';
import { routes } from '../lib/router.js';
import { formatYards, formatInches, formatRubs, formatNrc, formatDate, pluralize } from '../lib/format.js';
import { lotImage, amountLabel, NOT_RECORDED } from '../lib/lotView.js';
import { ICONS } from '../lib/icons.js';
import { verifiedTag, colorDot } from '../components/tags.js';
import { renderEstimateSection } from '../components/estimateTable.js';
import { renderAskForm } from '../components/askForm.js';
import { hasLot, addMessage } from '../lib/project.js';
import { renderNotFound } from './notFound.js';

/** Publisher of each flammability standard, as guide section 4.1 requires. */
const FIRE_PUBLISHERS = Object.freeze({
  'ASTM E84 Class A': 'ASTM International',
  'CAL TB 117-2013': 'California Bureau of Household Goods and Services',
  'NFPA 260 Class 1': 'National Fire Protection Association',
  'NFPA 701': 'National Fire Protection Association',
});

export function firePublishers(fire) {
  const names = [...new Set(fire.map((f) => FIRE_PUBLISHERS[f]).filter(Boolean))];
  return names.length ? names.join('; ') : 'Publisher not listed';
}

const orBlank = (value) => (value === null || value === undefined || value === '' ? NOT_RECORDED : value);

function keyFacts(lot) {
  const status = ['Status', html`<span class="fact-status">${raw(ICONS.check)}${lot.status}</span>`];
  if (isPieceLot(lot)) {
    return [
      ['Pieces on hand', amountLabel(lot)],
      ['Piece size', orBlank(lot.size)],
      ['Fiber', orBlank(lot.fiber)],
      ['Lot ID', lot.id],
      ['Last confirmed', lot.lastConfirmed ? formatDate(lot.lastConfirmed) : 'Not confirmed yet'],
      status,
    ];
  }
  return [
    ['Yardage on hand', lot.yd === null || lot.yd === undefined ? NOT_RECORDED : formatYards(lot.yd)],
    ['Width', lot.width ? formatInches(lot.width) : NOT_RECORDED],
    ['Fiber', orBlank(lot.fiber)],
    ['Lot ID', lot.id],
    ['Last confirmed', lot.lastConfirmed ? formatDate(lot.lastConfirmed) : 'Not confirmed yet'],
    status,
  ];
}

/** The manufacturer tag: verified for handoff lots, the sample label's brand for sample pieces. */
function manufacturerTag(lot) {
  if (lot.mfr && lot.mfrVerified !== false) return verifiedTag(lot);
  return html`<span class="tag tag--plain">${raw(ICONS.tag)}<span>${lot.mfr ? html`Brand: <b>${lot.mfr}</b>, from the sample label, not verified` : 'Brand not recorded'}</span></span>`;
}

function performanceRows(lot) {
  return [
    { label: 'Flammability', value: lot.fire.length ? lot.fire.join(', ') : 'Not listed', source: lot.fire.length ? firePublishers(lot.fire) : '' },
    { label: 'Abrasion', value: lot.rubs ? formatRubs(lot.rubs) : 'Not listed', source: lot.rubs ? 'ACT Voluntary Performance Guidelines, Association for Contract Textiles' : '' },
    { label: 'Acoustic', value: lot.nrc ? formatNrc(lot.nrc) : 'Not listed', source: lot.nrc ? `Noise reduction coefficient, reported by ${lot.mfr || 'the manufacturer'}` : '' },
  ];
}

function directionText(lot) {
  if (lot.directional === null || lot.directional === undefined) return NOT_RECORDED;
  return lot.directional ? 'One direction, not turned' : 'Not directional, may be turned';
}

function characteristics(lot) {
  const color = lot.family
    ? [
      ['Color family', `${lot.family.fullName} (${lot.family.code})`, `${lot.tone.name}, ${lot.tone.tone.toLowerCase()} tone`],
      ['Pantone reference', lot.family.pantoneReference, 'From the specification, not yet checked against swatches'],
    ]
    : [['Color family', NOT_RECORDED, 'See the photograph']];
  const rows = [
    ...color,
    ['Pattern', orBlank(lot.pattern)],
    ['Direction', directionText(lot), isPieceLot(lot) && lot.directional == null ? 'Estimates do not turn the pieces until this is recorded' : ''],
    ['Application', orBlank(lot.cat)],
    ['Hand and construction', 'Not yet confirmed'],
  ];
  if (isPieceLot(lot)) {
    rows.push(
      ['Source', lot.source, lot.sourceRow ? `Inventory spreadsheet, row ${lot.sourceRow}` : ''],
      ['Inventory code', orBlank(lot.inventoryCode)],
      ['NAICS code', orBlank(lot.naics)],
    );
    if (lot.unitNote) rows.push(['Unit in the spreadsheet', lot.unitNote, 'Differs from the piece size; to be checked']);
  }
  return rows;
}

const detailList = (rows) => html`<dl class="detail-list">${rows.map(([k, v, note]) => html`<div><dt>${k}</dt><dd>${v}${note ? html`<span class="caption">${note}</span>` : ''}</dd></div>`)}</dl>`;

const specSection = (id, title, body, { open = false, count = '' } = {}) => html`
  <details class="spec" id="${id}" ${open ? 'open' : ''}>
    <summary><h2>${title}${count ? html` <span class="spec__count">${count}</span>` : ''}</h2>${raw(ICONS.chevron)}</summary>
    <div class="spec__body">${body}</div>
  </details>`;

export function lotMarkup(lot, project) {
  const inProject = hasLot(project, lot.id);
  const image = lotImage(lot);
  return html`
    <article class="wrap lot" data-lot-page="${lot.id}">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="${routes.home()}">Home</a><span aria-hidden="true">/</span><a href="${routes.textiles()}">Textiles</a><span aria-hidden="true">/</span><span>${lot.cat || (isPieceLot(lot) ? 'Sample pieces' : 'Application not recorded')}</span></nav>
      <div class="lot__top">
        <div class="lot__gallery">
          <img class="lot__photo" src="${image.src}" alt="${image.alt}" width="240" height="240">
          <p class="caption">${image.isPhoto ? `Photograph from the ${lot.source || 'workroom'} inventory.` : 'Placeholder texture until the workroom adds photographs.'}</p>
        </div>
        <div class="lot__summary">
          <p class="lot__type">${lot.cat || (isPieceLot(lot) ? 'Sample piece' : 'Application not recorded')}</p>
          <h1>${lot.title}</h1>
          ${lot.tone
            ? html`<p class="lot__color">${raw(colorDot(lot.tone.hex, `${lot.tone.name} swatch`))}${lot.family.fullName}, ${lot.tone.tone.toLowerCase()} tone</p>`
            : html`<p class="lot__color">Color family not recorded</p>`}
          <p class="lot__mfr">${raw(manufacturerTag(lot))}</p>
          <dl class="facts">${keyFacts(lot).map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
          <div class="lot__actions">
            <button class="btn" type="button" data-lot-add="${lot.id}" aria-pressed="${inProject ? 'true' : 'false'}">${inProject ? 'Added to project' : 'Add to project'}</button>
            <a class="btn btn--secondary" href="${routes.lot(lot.id, 'ask')}" data-ask-open>Ask the workroom</a>
          </div>
          <div class="card resources">
            <h2>Manufacturer resources</h2>
            <ul>
              <li><a href="#resources" data-resource>Product page ${raw(ICONS.external)}</a></li>
              <li><a href="#resources" data-resource>Order a swatch ${raw(ICONS.external)}</a></li>
              <li><a href="${routes.lot(lot.id, 'docs')}" data-docs-open>${raw(ICONS.document)} ${lot.docs.length ? `${pluralize(lot.docs.length, 'document')} on file` : 'No documentation on file yet'}</a></li>
            </ul>
            <p class="caption" id="resources" role="status" data-resource-note hidden>Manufacturer links open once link-out permissions are confirmed.</p>
          </div>
        </div>
      </div>

      <div class="lot__specs">
        ${raw(specSection('perf', 'Performance', html`
          <dl class="detail-list detail-list--sourced">
            ${performanceRows(lot).map((r) => html`<div><dt>${r.label}</dt><dd>${r.value}${r.source ? html`<span class="caption">${r.source}</span>` : ''}</dd></div>`)}
          </dl>
          <p class="section__note">Shown as listed. The rating a project requires is confirmed with its team. ACT notes abrasion results on some woven structures can vary by 60 percent or more.</p>`, { open: true }))}

        <div data-estimate-slot></div>

        ${raw(specSection('char', 'Characteristics', detailList(characteristics(lot))))}

        ${raw(specSection('docs', 'Documentation', lot.docs.length
          ? html`<ul class="doc-list">${lot.docs.map((d) => html`<li class="doc-list__item">${raw(ICONS.document)}<span><b>${d}</b><span class="caption">On file from ${lot.mfr || 'the manufacturer'}</span></span></li>`)}</ul>`
          : html`<p class="muted">No documentation is on file for this lot yet. Test results can be added by the workroom.</p>`,
        { count: lot.docs.length ? String(lot.docs.length) : '' }))}

        ${raw(specSection('div', 'Estimated diversion', html`<p class="muted reading">Based on ${isPieceLot(lot) ? 'piece size' : 'yardage'} and fiber content. The avoided-carbon method is still being verified, so no figure is shown for this lot yet.</p>`))}

        <details class="spec" id="ask-drawer" data-ask-drawer>
          <summary><h2>Ask the workroom</h2>${raw(ICONS.chevron)}</summary>
          <div class="spec__body"><div data-ask-slot></div></div>
        </details>
      </div>
    </article>`;
}

export function renderLot({ store, session, route, toast }) {
  const lot = findLot(route.param);
  if (!lot) return renderNotFound({ route });
  const node = el(lotMarkup(lot, store.get()));

  node.querySelector('[data-estimate-slot]').replaceWith(renderEstimateSection(lot, {}));
  node.querySelector('[data-ask-slot]').replaceWith(renderAskForm(lot, {
    heading: false,
    projectName: store.get().name,
    signedIn: Boolean(session?.isSignedIn()),
    onSend: (values) => {
      store.update((p) => addMessage(p, { lotId: lot.id, ...values }));
      toast.show(`Message saved with ${values.project}`);
    },
  }));
  const drawer = node.querySelector('[data-ask-drawer]');
  if (route.anchor === 'ask') drawer.open = true;
  node.querySelector('[data-ask-open]').addEventListener('click', (event) => {
    event.preventDefault();
    drawer.open = true;
    drawer.scrollIntoView?.({ block: 'start' });
    drawer.querySelector('#ask-project')?.focus({ preventScroll: true });
  });
  node.querySelector('[data-docs-open]').addEventListener('click', (event) => {
    event.preventDefault();
    const docs = node.querySelector('#docs');
    docs.open = true;
    docs.scrollIntoView?.({ block: 'start' });
    docs.querySelector('summary')?.focus({ preventScroll: true });
  });
  node.querySelectorAll('[data-resource]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    node.querySelector('[data-resource-note]').hidden = false;
  }));
  return node;
}
