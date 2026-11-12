import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOTS, findLot } from '../src/data/lots.js';
import { renderLotCard, cardMarkup, supportsLine, performanceParts, syncAddButtons } from '../src/components/lotCard.js';
import { renderFilterRail, nextFiltersFromInput } from '../src/components/filterRail.js';
import { emptyFilters, toggleValue, withFilter } from '../src/lib/filters.js';
import { renderEstimateSection, readAssumptions, planSummary, methodSentence } from '../src/components/estimateTable.js';
import { validateAsk, renderAskForm } from '../src/components/askForm.js';
import { renderPalette, familyHref } from '../src/components/palette.js';
import { createToast, TOAST_EXIT_MS } from '../src/components/toast.js';
import { renderHeader, syncHeader } from '../src/components/header.js';
import { renderFooter } from '../src/components/footer.js';
import { emptyProject, addLot } from '../src/lib/project.js';
import { estimate, findProduct } from '../src/lib/estimator.js';

const lot = LOTS[0];

describe('lot card', () => {
  it('carries the fields the guide asks for', () => {
    const card = renderLotCard(lot, { inProject: false });
    const text = card.textContent;
    expect(card.querySelector('.lot-card__type').textContent).toBe('Upholstery');
    expect(card.querySelector('.lot-card__title').textContent).toBe('Herringbone wool, Camel');
    expect(text).toContain('Wool, 54 in wide');
    expect(text).toContain('42 yd');
    expect(text).toContain('Verified: Sample Mill A');
    expect(text).toContain('ASTM E84 Class A');
    expect(text).toContain('+1 more');
    expect(performanceParts(lot)).toContain('Wyzenbeek 50,000');
    expect(text).toContain('3 docs on file');
    expect(supportsLine(lot)).toBe('Supports about 71 pillow covers or 25 art panels');
    expect(text).toContain('Confirmed Oct 28');
    expect(card.querySelector('img').alt).toBe('Camel herringbone wool, placeholder texture');
    expect(card.querySelector('[data-lot-add]').textContent).toBe('Add to project');
  });
  it('shows the added state and syncs buttons from the project', () => {
    const wrap = document.createElement('div');
    wrap.append(renderLotCard(lot, { inProject: true }), renderLotCard(LOTS[1], { inProject: false }));
    expect(wrap.querySelector('[data-lot-add="FM-0101"]').getAttribute('aria-pressed')).toBe('true');
    syncAddButtons(wrap, addLot(emptyProject(), 'FM-0102'));
    expect(wrap.querySelector('[data-lot-add="FM-0101"]').textContent).toBe('Add to project');
    expect(wrap.querySelector('[data-lot-add="FM-0102"]').textContent).toBe('Added to project');
  });
  it('handles lots with no ratings and lots too narrow for the card products', () => {
    const noRatings = { ...lot, fire: [], rubs: null, nrc: null };
    expect(performanceParts(noRatings)).toEqual([]);
    expect(String(cardMarkup(noRatings, { inProject: false }))).toContain('No ratings listed');
    expect(supportsLine({ ...lot, width: 12 })).toBe('Too narrow for the listed products');
    const sheer = findLot('FM-0113');
    expect(supportsLine(sheer)).toMatch(/^Supports about/);
  });
});

describe('filter rail', () => {
  it('renders every group and reports changes as new filter objects', () => {
    const onChange = vi.fn();
    const rail = renderFilterRail(emptyFilters(), onChange);
    expect(rail.querySelectorAll('details').length).toBe(11);
    const wool = rail.querySelector('[data-filter-key="fiber"][data-filter-value="Wool"]');
    wool.checked = true;
    wool.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(toggleValue(emptyFilters(), 'fiber', 'Wool'));
    const rubs = rail.querySelector('[data-filter-key="rubs"][data-filter-value="30000"]');
    rubs.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(withFilter(emptyFilters(), 'rubs', 30000));
  });
  it('coerces family values to numbers and offers Clear all when filters are active', () => {
    const filters = toggleValue(emptyFilters(), 'fam', 3);
    const onChange = vi.fn();
    const rail = renderFilterRail(filters, onChange);
    expect(rail.querySelector('[data-filter-key="fam"][data-filter-value="3"]').checked).toBe(true);
    expect(nextFiltersFromInput(filters, rail.querySelector('[data-filter-key="fam"][data-filter-value="4"]')).fam).toEqual([3, 4]);
    rail.querySelector('[data-filter-clear]').click();
    expect(onChange).toHaveBeenCalledWith(emptyFilters());
  });
});

describe('estimate section', () => {
  it('lists six products and updates when an assumption changes', () => {
    const section = renderEstimateSection(lot, {});
    expect(section.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(section.textContent).toContain('71 pillow covers');
    const form = section.querySelector('[data-assume-form]');
    form.elements.cutLoss.value = '50';
    form.dispatchEvent(new Event('input', { bubbles: true }));
    expect(section.textContent).toContain('39 pillow covers');
    const strayText = (parent) => [...parent.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.includes(','));
    expect(strayText(section.querySelector('[data-estimate-rows]'))).toHaveLength(0);
    expect(strayText(section.querySelector('[data-estimate-plans]'))).toHaveLength(0);
    expect(section.querySelectorAll('[data-estimate-plans] > li')).toHaveLength(6);
    expect(section.querySelector('[data-estimate-method]').textContent).toContain('less 50% of length');
    form.elements.method[1].checked = true;
    form.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.elements.selvage.disabled).toBe(true);
    expect(readAssumptions(form)).toMatchObject({ method: 'B', cutLoss: 50, selvage: 1 });
    form.elements.seam.value = '-3';
    expect(readAssumptions(form).seam).toBe(0.5);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  it('describes the plan and the method in words', () => {
    const r = estimate({ width: 54, yd: 42 }, findProduct('pillow-18x18'));
    expect(planSummary(r)).toBe('Front and back panels: cut 19.0 x 19.0 in, 2 per unit, 2 across');
    expect(planSummary(estimate({ width: 20, yd: 42 }, findProduct('art-panel-24x48')))).toMatch(/wider than/);
    expect(methodSentence(lot, {})).toContain('runs in one direction');
    expect(methodSentence(LOTS[1], { method: 'B' })).toContain('54 in usable width (Method B)');
  });
});

describe('ask the workroom form', () => {
  it('validates the project name, quantity, and note', () => {
    expect(Object.keys(validateAsk({}, lot).errors).sort()).toEqual(['note', 'project']);
    expect(validateAsk({ project: 'Lobby', note: 'x', quantity: '60' }, lot).errors.quantity).toBe('Enter 42 yd or less. This lot has 42 yd on hand.');
    expect(validateAsk({ project: 'Lobby', note: 'x', quantity: 'abc' }, lot).errors.quantity).toMatch(/number of yards/);
    expect(validateAsk({ project: 'Lobby', note: 'x', neededBy: 'nope' }, lot).errors.neededBy).toBeDefined();
    expect(validateAsk({ project: 'Lobby', note: 'x', quantity: '10', neededBy: '2026-12-01' }, lot).errors).toEqual({});
  });
  it('shows errors on submit, then saves when valid', () => {
    const onSend = vi.fn();
    const form = renderAskForm(lot, { projectName: '', onSend });
    document.body.append(form);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(form.querySelectorAll('.field__error')).toHaveLength(2);
    expect(onSend).not.toHaveBeenCalled();
    form.querySelector('#ask-project').value = 'Lobby refresh';
    form.querySelector('#ask-note').value = 'Can this be cut as 18 x 18 in covers?';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ project: 'Lobby refresh' }));
    expect(form.querySelector('[data-ask-status]').textContent).toContain('Message saved with Lobby refresh');
    form.remove();
  });
});

describe('palette, toast, header, footer', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  it('links each family and tone to a filtered textiles view', () => {
    const palette = renderPalette();
    expect(palette.querySelectorAll('.palette__family')).toHaveLength(12);
    expect(familyHref(2, 'Dark')).toBe('#/textiles?fam=2&tone=Dark');
    expect(familyHref(2)).toBe('#/textiles?fam=2');
  });
  it('shows a toast with an undo action and hides after the duration', () => {
    vi.useFakeTimers();
    const toast = createToast(document.body);
    const undo = vi.fn();
    toast.show('Added to project', { undo });
    expect(toast.node.hidden).toBe(false);
    toast.node.querySelector('[data-toast-undo]').click();
    expect(undo).toHaveBeenCalled();
    expect(toast.node.classList.contains('toast--leaving')).toBe(true);
    expect(toast.node.hidden).toBe(false);
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(toast.node.hidden).toBe(true);
    expect(toast.node.classList.contains('toast--leaving')).toBe(false);
    toast.show('Plain');
    expect(toast.node.querySelector('[data-toast-undo]').hidden).toBe(true);
    vi.advanceTimersByTime(5000 + TOAST_EXIT_MS);
    expect(toast.node.hidden).toBe(true);
    vi.useRealTimers();
  });
  it('cancels the exit animation when a new toast arrives mid-exit', () => {
    vi.useFakeTimers();
    const toast = createToast(document.body);
    toast.show('First');
    toast.hide();
    expect(toast.node.classList.contains('toast--leaving')).toBe(true);
    toast.show('Second');
    expect(toast.node.classList.contains('toast--leaving')).toBe(false);
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(toast.node.hidden).toBe(false);
    expect(toast.node.textContent).toContain('Second');
    vi.useRealTimers();
  });
  it('renders the header with search, nav, and the project count', () => {
    const onSignOut = vi.fn();
    const header = renderHeader({ project: addLot(emptyProject(), 'FM-0101'), onSignOut });
    document.body.append(header);
    expect(header.querySelector('[data-project-count]').textContent).toBe('1');
    expect(header.querySelector('[data-sign-in]').getAttribute('href')).toBe('#/signin');
    expect(header.querySelector('[data-account]').hidden).toBe(true);
    syncHeader(header, { routeName: 'home', project: emptyProject(), user: { name: 'Ada Lovelace' } });
    expect(header.querySelector('[data-sign-in]').hidden).toBe(true);
    expect(header.querySelector('[data-account-name]').textContent).toBe('Ada Lovelace');
    header.querySelector('[data-sign-out]').click();
    expect(onSignOut).toHaveBeenCalled();
    header.querySelector('#site-search').value = 'wool';
    header.querySelector('[data-search]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(window.location.hash).toBe('#/textiles?q=wool');
    syncHeader(header, { routeName: 'textiles', project: emptyProject(), query: 'wool' });
    expect(header.querySelector('[data-nav="textiles"]').getAttribute('aria-current')).toBe('page');
    expect(header.querySelector('[data-project-count]').textContent).toBe('0');
    expect(renderFooter().textContent).toContain('Fabmatch, a Redesign Collective company');
  });
});
