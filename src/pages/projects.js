import { html, raw, el } from '../lib/html.js';
import { ICONS } from '../lib/icons.js';
import { findLot, isPieceLot } from '../data/lots.js';
import { routes } from '../lib/router.js';
import { formatDate, formatNumber, pluralize, joinParts } from '../lib/format.js';
import { findProduct } from '../lib/estimator.js';
import { lotImage, amountLabel, estimateForLot } from '../lib/lotView.js';
import { removeLot, addLot, renameProject } from '../lib/project.js';
import { buildSpecMarkdown, specFileName, downloadText } from '../lib/specExport.js';

export const EMPTY_PROJECT_COPY = 'No saved lots yet. Search for a textile and select Add to project.';

export function projectLots(project) {
  return project.lotIds.map(findLot).filter(Boolean);
}

/** Rolls are summed up at 18 x 18 in; sample pieces at 12 x 17 in, the size a 27 in piece can make. */
function pillowLine(lot) {
  const id = isPieceLot(lot) ? 'pillow-12x17' : 'pillow-18x18';
  const size = isPieceLot(lot) ? '12 x 17 in' : '18 x 18 in';
  const r = estimateForLot(lot, findProduct(id));
  if (r.fits) return `supports about ${formatNumber(r.quantity)} pillow covers at ${size}`;
  if (/not recorded/.test(r.reason || '')) return 'no estimate until the size is recorded';
  return `${isPieceLot(lot) ? 'too small' : 'too narrow'} for ${size} pillow covers`;
}

function row(lot) {
  const image = lotImage(lot, { card: true });
  const confirmed = lot.lastConfirmed ? `last confirmed ${formatDate(lot.lastConfirmed)}` : 'not confirmed yet';
  return html`
    <li class="project-row card" data-project-row="${lot.id}">
      <img src="${image.src}" alt="${image.alt}" width="64" height="64">
      <div class="project-row__body">
        <h3><a href="${routes.lot(lot.id)}">${lot.title}</a></h3>
        <p class="caption">${joinParts([lot.mfr || 'Brand not recorded', `${amountLabel(lot)} on hand, ${confirmed}`, pillowLine(lot)])}</p>
        <p class="caption">${lot.docs.length ? `Documentation on file: ${lot.docs.join(', ')}` : 'No documentation on file yet'}</p>
      </div>
      <button class="pill" type="button" data-remove="${lot.id}" aria-label="Remove ${lot.title} from project">Remove</button>
    </li>`;
}

/** Where the project is kept, in words, for the lede and the messages note. */
export function storageLine(lotCount, signedIn) {
  return signedIn
    ? `${pluralize(lotCount, 'lot')} saved to the account. Saved lots and messages are kept across devices.`
    : `${pluralize(lotCount, 'lot')} saved.`;
}

function messages(project, signedIn) {
  if (!project.messages.length) return '';
  return html`
    <section class="section" aria-labelledby="msg-title">
      <h2 id="msg-title">Workroom messages</h2>
      <p class="section__lede">Messages saved ${signedIn ? 'to the account' : 'on this device'}. Sending to workrooms opens in the pilot.</p>
      <ul class="message-list">
        ${project.messages.map((m) => {
          const lot = findLot(m.lotId);
          return html`<li class="card message"><p><b>${lot ? lot.title : m.lotId}</b> <span class="tag">${raw(ICONS.check)}Saved</span></p><p>${m.note}</p><p class="caption">${m.quantity ? `${m.quantity} ${lot && isPieceLot(lot) ? 'pieces' : 'yd'}. ` : ''}${m.neededBy ? `Needed by ${formatDate(m.neededBy)}. ` : ''}Saved ${formatDate(String(m.sentAt).slice(0, 10))}.</p></li>`;
        })}
      </ul>
    </section>`;
}

function listMarkup(lots) {
  return lots.length
    ? html`<ul class="project-list" data-project-list>${lots.map(row)}</ul>`
    : html`<div class="empty" data-project-list><p>${EMPTY_PROJECT_COPY}</p><p><a href="${routes.textiles()}">Browse textiles</a></p></div>`;
}

/** Rebuilds the parts of the page that depend on the saved lots, keeping the name form and focus intact. */
function syncProjectsPage(node, project, signedIn) {
  const lots = projectLots(project);
  node.querySelector('[data-project-list]').replaceWith(el(listMarkup(lots)));
  node.querySelector('.lede').textContent = storageLine(lots.length, signedIn);
  node.querySelector('[data-export]').disabled = lots.length === 0;
}

export function projectsMarkup(project, { signedIn = false } = {}) {
  const lots = projectLots(project);
  return html`
    <div class="wrap projects">
      <div class="page-head">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="${routes.home()}">Home</a><span aria-hidden="true">/</span><span>Projects</span></nav>
        <h1>${project.name}</h1>
        <p class="lede">${storageLine(lots.length, signedIn)}</p>
      </div>
      <form class="project-name" data-rename>
        <div class="field">
          <label for="project-name">Project name</label>
          <input id="project-name" name="name" type="text" value="${project.name}" maxlength="80">
          <p class="field__help">Shared with a workroom when a message is sent.</p>
        </div>
        <button class="btn btn--secondary btn--auto" type="submit">Save name</button>
      </form>
      ${listMarkup(lots)}
      <div class="project-actions">
        <button class="btn btn--auto" type="button" data-export ${lots.length ? '' : 'disabled'}>Export spec</button>
        <a class="btn btn--secondary btn--auto" href="${routes.textiles()}">Add more textiles</a>
      </div>
      <p class="section__note">The export includes each lot's documentation and diversion estimate, as a Markdown file.</p>
      ${raw(messages(project, signedIn))}
    </div>`;
}

export function renderProjects({ store, session, toast }) {
  const isSignedIn = () => Boolean(session?.isSignedIn());
  const node = el(projectsMarkup(store.get(), { signedIn: isSignedIn() }));

  node.querySelector('[data-rename]').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = node.querySelector('#project-name').value;
    store.update((p) => renameProject(p, name));
    node.querySelector('h1').textContent = store.get().name;
    toast.show(`Project renamed to ${store.get().name}`);
  });

  node.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove]');
    if (!button) return;
    const lotId = button.dataset.remove;
    const lot = findLot(lotId);
    store.update((p) => removeLot(p, lotId));
    toast.show(`Removed ${lot ? lot.title : lotId} from ${store.get().name}`, { undo: () => store.update((p) => addLot(p, lotId)) });
  });

  const unsubscribe = store.subscribe((project) => {
    if (!node.isConnected) { unsubscribe(); return; }
    syncProjectsPage(node, project, isSignedIn());
  });

  node.querySelector('[data-export]').addEventListener('click', () => {
    const project = store.get();
    const text = buildSpecMarkdown(project, projectLots(project));
    downloadText(specFileName(project), text);
    toast.show('Specification exported');
  });
  return node;
}
