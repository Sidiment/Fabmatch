import { html, raw, el } from '../lib/html.js';
import { ICONS } from '../lib/icons.js';
import { routes } from '../lib/router.js';
import { validateContact } from '../../shared/validators.js';

/** The contact rules live in shared/validators.js so the server checks the same things. */
export { validateContact };

export const CONTACT_RECEIVED = (name) => `Thank you, ${name}. The message was received. Replies come from the Redesign Collective team.`;
export const CONTACT_HELD = (name) => `Thank you, ${name}. The message is held on this device until the contact route opens.`;

export function aboutMarkup() {
  return html`
    <div class="wrap about">
      <div class="page-head">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="${routes.home()}">Home</a><span aria-hidden="true">/</span><span>About</span></nav>
        <h1>About Fabmatch</h1>
        <p class="lede">Fabmatch is the software platform for circular commercial interiors. It turns remnant textiles from verified manufacturers into searchable, spec-ready inventory linked to documentation, calculates what quantities of each product type the yardage can supply, and builds diversion data into every order. Fabmatch is a Redesign Collective company.</p>
      </div>

      <section class="section reading" aria-labelledby="why-title">
        <h2 id="why-title">Why remnants</h2>
        <p>A remnant is textile that was ordered for a commercial product and left stranded in a workroom after over-ordering. Clients do not want it back and workrooms do not sell it to the public. The problem is an infrastructure and visibility disconnect, not a material shortage, and Fabmatch is one tool for closing it.</p>
        <p>Fabmatch lets designers and project teams source regional textiles from a verified manufacturer, connects each remnant to the photographs and documentation the team needs and to the firm's own library swatches, and assesses the yardage to calculate which products, and how many of each, the yardage can supply.</p>
      </section>

      <section class="section reading" aria-labelledby="record-title">
        <h2 id="record-title">How a lot record is built</h2>
        <ol class="numbered">
          <li>The workroom owner photographs the label on the roll or bolt.</li>
          <li>The record fills in from the manufacturer information on the label and the documentation the manufacturer has published for that product.</li>
          <li>The date and time of the photograph are recorded with the owner's profile, and the owner's login supplies the signature.</li>
          <li>The owner reviews each drafted field, corrects what is wrong, sets the yardage, and publishes the lot.</li>
        </ol>
        <p>Each field states whether it was filled automatically, confirmed by the workroom, or comes from documentation on file, so a designer can judge how much to rely on it. Where textiles are held is proprietary and is not shown.</p>
      </section>

      <section class="section reading" aria-labelledby="stage-title">
        <h2 id="stage-title">Where the platform stands</h2>
        <p>Fabmatch is in R&amp;D and Pilot (2026-2027), with Commercial Beta planned for 2027-2028. Redesign Collective, a woman-owned circular design organization in Seattle, WA, founded by Lisa Hilbert, is building Fabmatch in research with the University of Washington Global Innovation Exchange (GIX) from 2026 to 2027.</p>
        <p>During R&amp;D and Pilot there are no prices, holds, or orders on the platform.</p>
      </section>

      <section class="section reading" id="contact" aria-labelledby="contact-title">
        <h2 id="contact-title">Contact</h2>
        <p class="section__lede">For questions about the platform, workroom onboarding, or the research. Messages go to the Redesign Collective team.</p>
        <form class="contact-form" data-contact novalidate>
          <div class="field"><label for="c-name">Name</label><input id="c-name" name="name" type="text" autocomplete="name"></div>
          <div class="field"><label for="c-email">Email address</label><input id="c-email" name="email" type="email" autocomplete="email"></div>
          <div class="field"><label for="c-message">Message</label><textarea id="c-message" name="message" rows="5"></textarea></div>
          <button class="btn btn--auto" type="submit">Send message</button>
          <p class="form__status" role="status" data-contact-status></p>
        </form>
      </section>
    </div>`;
}

function showErrors(form, errors) {
  form.querySelectorAll('.field').forEach((field) => {
    const input = field.querySelector('input, textarea');
    const existing = field.querySelector('.field__error');
    if (existing) existing.remove();
    const message = errors[input.name];
    field.classList.toggle('field--error', Boolean(message));
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `${input.id}-error`);
      field.insertAdjacentHTML('beforeend', html`<p class="field__error" id="${input.id}-error">${raw(ICONS.alert)}${message}</p>`);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  });
}

export function renderAbout({ api = null } = {}) {
  const node = el(aboutMarkup());
  const form = node.querySelector('[data-contact]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { errors, values } = validateContact(Object.fromEntries(new FormData(form).entries()));
    showErrors(form, errors);
    const status = form.querySelector('[data-contact-status]');
    if (Object.keys(errors).length) {
      status.textContent = '';
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }
    if (!api) {
      status.textContent = CONTACT_HELD(values.name);
      return;
    }
    sendContact(form, api, values);
  });
  return node;
}

async function sendContact(form, api, values) {
  const status = form.querySelector('[data-contact-status]');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = 'Sending…';
  try {
    await api.sendContact(values);
    form.reset();
    status.textContent = CONTACT_RECEIVED(values.name);
  } catch (error) {
    if (error.fields && Object.keys(error.fields).length) showErrors(form, error.fields);
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
