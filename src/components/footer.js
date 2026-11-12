import { html, el } from '../lib/html.js';
import { routes } from '../lib/router.js';

export function renderFooter() {
  return el(html`
    <footer class="site-footer">
      <div class="wrap site-footer__row">
        <p class="site-footer__brand">Fabmatch, a Redesign Collective company</p>
        <nav aria-label="Footer">
          <a href="${routes.about()}#contact">Contact form</a>
          <a href="${routes.about()}">About Fabmatch</a>
        </nav>
      </div>
      <div class="wrap site-footer__fine">
        <p>Match. Specify. Divert.</p>
      </div>
    </footer>`);
}
