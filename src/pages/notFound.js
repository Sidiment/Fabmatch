import { html, el } from '../lib/html.js';
import { routes } from '../lib/router.js';

export function renderNotFound({ route }) {
  return el(html`
    <div class="wrap">
      <div class="page-head"><h1>That page was not found</h1>
      <p class="lede">Nothing is listed at "${route.param || route.name}". The lot may have sold through or the link may be out of date.</p></div>
      <p><a class="btn btn--auto" href="${routes.textiles()}">Browse all textiles</a></p>
    </div>`);
}
