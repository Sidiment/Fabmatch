/** Small HTML helpers. Every value that reaches markup passes through escapeHtml unless it is already SafeHtml. */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Markup that has already been escaped or built by html``. Behaves as a string. */
export class SafeHtml extends String {}

function renderValue(value) {
  if (value === undefined || value === null || value === false) return '';
  if (Array.isArray(value)) return value.map(renderValue).join('');
  if (value instanceof SafeHtml) return value.toString();
  return escapeHtml(value);
}

/** Tagged template that escapes interpolations. Nested html`` results and raw() values pass through. */
export function html(strings, ...values) {
  const out = strings.reduce((acc, str, i) => acc + renderValue(values[i - 1]) + str);
  return new SafeHtml(out);
}

export const raw = (markup) => new SafeHtml(String(markup));

export function el(markup) {
  const template = document.createElement('template');
  template.innerHTML = String(markup).trim();
  return template.content.firstElementChild;
}
