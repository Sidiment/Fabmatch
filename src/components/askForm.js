import { html, raw, el } from '../lib/html.js';
import { ICONS } from '../lib/icons.js';
import { validateAsk } from '../../shared/validators.js';

/** The Ask the workroom rules live in shared/validators.js so the server checks the same things. */
export { validateAsk };

const fieldError = (id, message) => (message
  ? html`<p class="field__error" id="${id}-error">${raw(ICONS.alert)}${message}</p>`
  : '');

/** "Up to 42 yd on hand." or "Up to 3 pieces on hand.", then how to ask about the whole lot. */
export function quantityHelp(lot) {
  const whole = 'Leave blank to ask about the whole lot.';
  if (lot.kind === 'piece') return `Up to ${lot.qty} ${lot.qty === 1 ? 'piece' : 'pieces'} on hand. ${whole}`;
  if (lot.yd === null || lot.yd === undefined) return whole;
  return `Up to ${lot.yd} yd on hand. ${whole}`;
}

export function askFormMarkup(lot, { projectName = '', values = {}, errors = {}, heading = true } = {}) {
  const v = { project: projectName, quantity: '', note: '', neededBy: '', ...values };
  const invalid = (key) => (errors[key] ? 'aria-invalid="true"' : '');
  const describedBy = (key) => (errors[key] ? `aria-describedby="ask-${key}-error ask-${key}-help"` : `aria-describedby="ask-${key}-help"`);
  return html`
    <form class="ask-form" id="ask" data-ask-form novalidate>
      ${heading ? html`<h2>Ask the workroom</h2>` : ''}
      <p class="section__lede">The workroom sees the project name and city. Add more detail only if it helps.</p>
      <div class="field ${errors.project ? 'field--error' : ''}">
        <label for="ask-project">Project name</label>
        <input id="ask-project" name="project" type="text" value="${v.project}" ${raw(invalid('project'))} ${raw(describedBy('project'))}>
        <p class="field__help" id="ask-project-help">Shared with the workroom.</p>
        ${raw(fieldError('ask-project', errors.project))}
      </div>
      <div class="field ${errors.quantity ? 'field--error' : ''}">
        <label for="ask-quantity">Quantity, ${lot.kind === 'piece' ? 'pieces' : 'yd'}</label>
        <input id="ask-quantity" name="quantity" type="text" inputmode="decimal" value="${v.quantity}" ${raw(invalid('quantity'))} ${raw(describedBy('quantity'))}>
        <p class="field__help" id="ask-quantity-help">${quantityHelp(lot)}</p>
        ${raw(fieldError('ask-quantity', errors.quantity))}
      </div>
      <div class="field">
        <label for="ask-needed">Needed by</label>
        <input id="ask-needed" name="neededBy" type="date" value="${v.neededBy}" ${raw(invalid('neededBy'))} ${raw(describedBy('neededBy'))}>
        <p class="field__help" id="ask-needed-help">Optional.</p>
        ${raw(fieldError('ask-needed', errors.neededBy))}
      </div>
      <div class="field ${errors.note ? 'field--error' : ''}">
        <label for="ask-note">Note to the workroom</label>
        <textarea id="ask-note" name="note" rows="4" ${raw(invalid('note'))} ${raw(describedBy('note'))}>${v.note}</textarea>
        <p class="field__help" id="ask-note-help">${lot.kind === 'piece' ? 'For example, can these pieces be cut as 12 x 17 in pillow covers?' : 'For example, can this yardage be cut as 18 x 18 in pillow covers?'}</p>
        ${raw(fieldError('ask-note', errors.note))}
      </div>
      <button class="btn btn--secondary btn--auto" type="submit">Send message</button>
      <p class="form__status" role="status" data-ask-status></p>
    </form>`;
}

/** The confirmation under the form. Delivery to workrooms opens in the pilot either way. */
export function savedCopy(projectName, signedIn) {
  return signedIn
    ? `Message saved to the account with ${projectName}. Workroom messaging opens in the pilot, so nothing was sent yet.`
    : `Message saved with ${projectName}. Workroom messaging opens in the pilot, so nothing was sent yet.`;
}

export function renderAskForm(lot, { projectName, onSend, heading = true, signedIn = false }) {
  let state = { projectName, values: {}, errors: {}, heading };
  const node = el(askFormMarkup(lot, state));

  const rerender = () => {
    const fresh = el(askFormMarkup(lot, state));
    node.replaceChildren(...fresh.childNodes);
  };

  node.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(node).entries());
    const { errors, values } = validateAsk(data, lot);
    state = { ...state, values, errors };
    rerender();
    if (Object.keys(errors).length) {
      const firstInvalid = node.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    onSend(values);
    node.querySelector('[data-ask-status]').textContent = savedCopy(values.project, signedIn);
  });
  return node;
}
