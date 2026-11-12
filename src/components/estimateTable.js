import { html, raw, el } from '../lib/html.js';
import { ICONS } from '../lib/icons.js';
import { PRODUCTS, mergeAssumptions, usableWidthFor } from '../lib/estimator.js';
import { formatNumber, pluralize } from '../lib/format.js';
import { isPieceLot } from '../data/lots.js';
import { estimateForLot } from '../lib/lotView.js';

/** Allowances that apply when cutting whole sample pieces. Selvage, cutting loss, and repeat apply to rolls. */
const PIECE_FIELDS = Object.freeze(['seam', 'wrap']);

const FIELDS = Object.freeze([
  { key: 'selvage', label: 'Selvage, in per side', help: 'Unused fabric edge (Method A only)' },
  { key: 'seam', label: 'Seam allowance, in per edge', help: 'Sewn pieces' },
  { key: 'wrap', label: 'Wrap allowance, in per edge', help: 'Stretched panels' },
  { key: 'cutLoss', label: 'Cutting loss, % of length', help: 'Flaws, ends, labels' },
  { key: 'repeat', label: 'Pattern repeat, in per row', help: '0 for solids' },
]);

export function planSummary(result) {
  if (!result.fits) return result.reason;
  if (result.panels) {
    return result.panels.map((p) => `${p.label}: cut ${p.cutWidth.toFixed(1)} x ${p.cutLength.toFixed(1)} in, ${p.perUnit} per unit, ${p.panelsFromLot} from the pieces`).join('; ');
  }
  return result.plan.map((step) => `${step.label}: cut ${step.cutWidth.toFixed(1)} x ${step.cutLength.toFixed(1)} in, ${step.count} per unit, ${step.across} across${step.rotated ? ', turned' : ''}`).join('; ');
}

export function methodSentence(lot, assumptions) {
  const a = mergeAssumptions(assumptions);
  if (isPieceLot(lot)) {
    if (!lot.size) return 'The piece size is not recorded, so no estimate is shown. The workroom confirms what can be made.';
    const turn = lot.directional === false ? ', turned where that fits more' : lot.directional ? ', not turned' : ', not turned because the direction is not recorded';
    return `Estimate for ${pluralize(lot.qty, 'piece')} of ${lot.size}, with each panel cut whole from a piece${turn}, ${a.seam} in seams and ${a.wrap} in wrap for stretched panels. Allowances are assumptions to be confirmed with workrooms. The workroom confirms what can be made.`;
  }
  if (!lot.width || lot.yd === null || lot.yd === undefined) return 'The width or yardage is not recorded, so no estimate is shown. The workroom confirms what can be made.';
  const usable = usableWidthFor(lot.width, a);
  const direction = lot.directional ? ' that runs in one direction and is not turned' : '';
  return `Estimate for ${formatNumber(lot.yd)} yd on a ${lot.width} in wide fabric${direction}, less ${a.cutLoss}% of length for flaws and ends, with ${a.seam} in seams and a ${usable} in usable width (Method ${a.method}). Allowances are assumptions to be confirmed with workrooms. The workroom confirms what can be made.`;
}

const results = (lot, assumptions) => PRODUCTS.map((product) => ({ product, result: estimateForLot(lot, product, assumptions) }));

/** Third column: yardage each for a roll; panels cut from the pieces for sample pieces. */
function detailCell(result) {
  if (!result.fits) return '';
  if (result.panels) {
    const many = result.panels.length > 1;
    return result.panels.map((p) => `${many ? `${p.label}: ` : ''}${pluralize(p.panelsFromLot, 'panel')} (${p.perUnit} per unit)`).join('; ');
  }
  return result.yardsPerUnit ? `${result.yardsPerUnit.toFixed(2)} yd` : '';
}

function rowsMarkup(lot, assumptions) {
  return results(lot, assumptions).map(({ product, result }) => html`
      <tr>
        <th scope="row">${product.name}${product.placeholder ? html`<abbr class="table__flag" title="Size to be confirmed">*</abbr>` : ''}</th>
        <td class="table__num">${result.fits ? `${formatNumber(result.quantity)} ${product.unit}` : (/not recorded/.test(result.reason || '') ? 'Not recorded' : 'Does not fit')}</td>
        <td class="muted">${detailCell(result)}</td>
      </tr>`);
}

function plansMarkup(lot, assumptions) {
  return results(lot, assumptions).map(({ product, result }) => html`<li><b>${product.name}:</b> ${planSummary(result)}</li>`);
}

function assumptionsForm(lot, assumptions) {
  const a = mergeAssumptions(assumptions);
  const piece = isPieceLot(lot);
  const hide = (key) => (piece && !PIECE_FIELDS.includes(key) ? 'hidden' : '');
  return html`
    <details class="assume">
      <summary><span>How this was estimated</span>${raw(ICONS.chevron)}</summary>
      <p class="section__note" data-estimate-method>${methodSentence(lot, assumptions)}</p>
      <ul class="assume__plans caption" data-estimate-plans aria-label="Cutting plan for each product">${plansMarkup(lot, assumptions)}</ul>
      <form class="assume__form" data-assume-form>
        <fieldset class="field field--wide" ${piece ? 'hidden' : ''}>
          <legend>Width method</legend>
          <label class="choice"><input type="radio" name="method" value="A" ${a.method === 'A' ? 'checked' : ''}> Method A: trim the selvage from each side of the recorded width</label>
          <label class="choice"><input type="radio" name="method" value="B" ${a.method === 'B' ? 'checked' : ''}> Method B: use the recorded width as is, cutting to the selvage edge</label>
          <p class="field__help">A workroom is to confirm which method matches its practice.</p>
        </fieldset>
        ${FIELDS.map((f) => html`
          <div class="field" ${hide(f.key)}>
            <label for="assume-${f.key}">${f.label}</label>
            <input id="assume-${f.key}" name="${f.key}" type="number" min="0" step="0.25" inputmode="decimal" value="${a[f.key]}" ${f.key === 'selvage' && a.method === 'B' ? 'disabled' : ''}>
            <p class="field__help">${f.help}</p>
          </div>`)}
      </form>
    </details>`;
}

export function estimateSectionMarkup(lot, assumptions) {
  return html`
    <details class="spec" id="estimate" open>
      <summary><h2 id="estimate-title">${isPieceLot(lot) ? 'Products these pieces can support' : 'Products this yardage can support'}</h2>${raw(ICONS.chevron)}</summary>
      <div class="spec__body">
        <div class="table-wrap">
          <table class="table table--estimate">
            <caption class="visually-hidden">Estimated quantity of each product from this lot</caption>
            <thead><tr><th scope="col">Product</th><th scope="col">Estimated quantity</th><th scope="col">${isPieceLot(lot) ? 'Panels from the pieces' : 'Yardage each'}</th></tr></thead>
            <tbody data-estimate-rows>${rowsMarkup(lot, assumptions)}</tbody>
          </table>
        </div>
        <p class="section__note">Estimate only. The workroom confirms what can be made. * Size to be confirmed.</p>
        ${assumptionsForm(lot, assumptions)}
      </div>
    </details>`;
}

/** Reads the assumptions form into a new assumptions object. */
export function readAssumptions(form) {
  const data = new FormData(form);
  const number = (key, fallback) => {
    const value = parseFloat(data.get(key));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const base = mergeAssumptions({});
  return mergeAssumptions({
    method: data.get('method') || 'A',
    selvage: form.elements.selvage.disabled ? base.selvage : number('selvage', base.selvage),
    seam: number('seam', base.seam),
    wrap: number('wrap', base.wrap),
    cutLoss: Math.min(number('cutLoss', base.cutLoss), 100),
    repeat: number('repeat', base.repeat),
  });
}

export function renderEstimateSection(lot, initialAssumptions) {
  let assumptions = mergeAssumptions(initialAssumptions);
  const node = el(estimateSectionMarkup(lot, assumptions));
  const form = node.querySelector('[data-assume-form]');
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', () => {
    assumptions = readAssumptions(form);
    form.elements.selvage.disabled = assumptions.method === 'B';
    node.querySelector('[data-estimate-rows]').innerHTML = html`${rowsMarkup(lot, assumptions)}`;
    node.querySelector('[data-estimate-plans]').innerHTML = html`${plansMarkup(lot, assumptions)}`;
    node.querySelector('[data-estimate-method]').textContent = methodSentence(lot, assumptions);
  });
  return node;
}
