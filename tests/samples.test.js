/**
 * Redesign Collective sample pieces (converted from DATASET_FABRIC_SAMPLES.xlsx): lot records
 * with blank attributes, counted in pieces. This file loads them next to the handoff lots.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import samplesJson from '../server/data/seed/redesign-collective-samples.json';
import { SEED_FAMILIES, SEED_LOTS } from './setup.js';
import { buildSampleRecord, buildSampleRecords, missingAttributes, sampleIdFor } from '../shared/catalog.js';
import { hydrateCatalog, findLot, LOTS, BRANDS, MANUFACTURERS, KIND_LABELS } from '../src/data/lots.js';
import { validateAsk } from '../shared/validators.js';
import { applyFilters, emptyFilters, withFilter, filtersFromQuery, filtersToQuery, sortLots, matchesQuery, activeChips } from '../src/lib/filters.js';
import { cardMarkup, supportsLine } from '../src/components/lotCard.js';
import { estimateForLot, amountLabel, lotImage } from '../src/lib/lotView.js';
import { findProduct } from '../src/lib/estimator.js';
import { renderLot } from '../src/pages/lot.js';
import { renderTextiles, resultsCountText } from '../src/pages/textiles.js';
import { renderHome } from '../src/pages/home.js';
import { renderProjects } from '../src/pages/projects.js';
import { buildSpecMarkdown } from '../src/lib/specExport.js';
import { createStore } from '../src/lib/store.js';
import { emptyProject, addLot } from '../src/lib/project.js';
import { el } from '../src/lib/html.js';

const SAMPLES = buildSampleRecords(samplesJson.samples);
hydrateCatalog({ families: SEED_FAMILIES, lots: [...SEED_LOTS, ...SAMPLES] });

const toast = { show: vi.fn(), hide: () => {} };
const makeStore = (project = emptyProject()) => createStore(project, () => {});
beforeEach(() => { document.body.innerHTML = ''; window.scrollTo = () => {}; });

describe('sample records', () => {
  it('builds one lot per spreadsheet row, with blanks where the sheet has nothing', () => {
    expect(SAMPLES).toHaveLength(91);
    expect(new Set(SAMPLES.map((s) => s.id)).size).toBe(91);
    const first = findLot('RC-0001');
    expect(first).toMatchObject({ kind: 'piece', title: 'Hickory Chair sample 1', mfr: 'Hickory Chair', mfrVerified: false, qty: 1, size: '18 x 27 in', family: null, tone: null, fiber: null, yd: null });
    expect(first.photo).toBe('samples/rc-0001.jpg');
    expect(SAMPLES.filter((s) => s.photo)).toHaveLength(85);
  });

  it('names a sample with no brand and keeps every record to the minimum fields', () => {
    const lot = buildSampleRecord({ brand: null, w: 27, h: 27, qty: 0 }, 4);
    expect(lot).toMatchObject({ id: 'RC-0005', title: 'Sample 5, brand not recorded', name: 'Sample', qty: 1, photo: null });
    expect(sampleIdFor(0)).toBe('RC-0001');
    SAMPLES.forEach((s) => {
      expect(Boolean(s.id && s.name && s.title && s.kind && s.qty > 0)).toBe(true);
    });
  });

  it('lists what each sample is missing', () => {
    const missing = missingAttributes(findLot('RC-0001'));
    expect(missing).toContain('Fiber content');
    expect(missing).toContain('Fire rating');
    expect(missing).not.toContain('Piece size');
    expect(missing).not.toContain('Brand or manufacturer');
    expect(missingAttributes(buildSampleRecord({}, 0))).toContain('Photograph');
    expect(missingAttributes(SEED_LOTS[0])).not.toContain('Fiber content');
  });

  it('keeps brands apart from verified manufacturers', () => {
    expect(BRANDS).toContain('Pindler');
    expect(MANUFACTURERS).not.toContain('Pindler');
    expect(LOTS).toHaveLength(SEED_LOTS.length + 91);
  });
});

describe('sample pieces in the site', () => {
  it('estimates products from whole pieces, not turned while the direction is unknown', () => {
    const lot = findLot('RC-0021'); // one 27 x 27 in piece
    const small = estimateForLot(lot, findProduct('pillow-12x17'));
    expect(small).toMatchObject({ fits: true, quantity: 1 });
    expect(estimateForLot(lot, findProduct('pillow-18x18'))).toMatchObject({ fits: true, quantity: 0 });
    expect(estimateForLot(lot, findProduct('art-panel-24x48')).fits).toBe(false);
    expect(supportsLine(lot)).toBe('Too small for the listed products');
    expect(amountLabel(lot)).toBe('1 piece');
    expect(estimateForLot(buildSampleRecord({}, 0), findProduct('pillow-12x17')).reason).toMatch(/not recorded/);
  });

  it('renders a card with the photo, piece count, and brand from the label', () => {
    const card = el(cardMarkup(findLot('RC-0048'), { inProject: false }));
    expect(card.querySelector('img').getAttribute('src')).toBe('samples/rc-0048-card.jpg');
    expect(card.querySelector('.lot-card__badge').textContent).toBe('4 pc');
    expect(card.querySelector('.lot-card__type').textContent).toBe('Sample piece');
    expect(card.textContent).toContain('Brand: Pindler');
    expect(card.textContent).toContain('27 x 27 in each');
    expect(card.textContent).toContain('Not confirmed yet');
    const noPhoto = el(cardMarkup(findLot('RC-0015'), { inProject: false }));
    expect(noPhoto.querySelector('img').getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(lotImage(findLot('RC-0015')).isPhoto).toBe(false);
  });

  it('renders the lot page with Not recorded in place of blanks', () => {
    const page = renderLot({ store: makeStore(), session: null, route: { param: 'RC-0027', query: '' }, toast });
    expect(page.querySelector('h1').textContent).toBe('Thibaut sample 27');
    expect(page.textContent).toContain('Not recorded');
    expect(page.textContent).toContain('Color family not recorded');
    expect(page.textContent).toContain('Products these pieces can support');
    expect(page.textContent).toContain('Inventory spreadsheet, row 28');
    expect(page.textContent).toContain('3 yd');
    expect(page.querySelector('#ask-quantity').closest('.field').textContent).toContain('pieces');
    expect(page.textContent).not.toContain('undefined');
    expect(page.textContent).not.toContain('null');
  });

  it('checks a workroom question in pieces', () => {
    const lot = findLot('RC-0048');
    expect(validateAsk({ project: 'P', note: 'n', quantity: '4' }, lot).errors).toEqual({});
    expect(validateAsk({ project: 'P', note: 'n', quantity: '5' }, lot).errors.quantity).toMatch(/4 or fewer/);
    expect(validateAsk({ project: 'P', note: 'n', quantity: '1.5' }, lot).errors.quantity).toMatch(/whole number/);
  });

  it('filters by lot type and brand, and sorts pieces after rolls', () => {
    const pieces = applyFilters(LOTS, withFilter(emptyFilters(), 'kind', [KIND_LABELS.piece]));
    expect(pieces).toHaveLength(91);
    const rolls = applyFilters(LOTS, withFilter(emptyFilters(), 'kind', [KIND_LABELS.yardage]));
    expect(rolls).toHaveLength(SEED_LOTS.length);
    expect(applyFilters(LOTS, withFilter(emptyFilters(), 'mfr', ['Schumacher']))).toHaveLength(9);
    expect(applyFilters(LOTS, withFilter(emptyFilters(), 'yd', ['Under 25 yd'])).every((l) => l.kind !== 'piece')).toBe(true);
    expect(applyFilters(LOTS, withFilter(emptyFilters(), 'tone', ['Light'])).every((l) => l.tone)).toBe(true);
    const sorted = sortLots(LOTS, 'yardage');
    expect(sorted[SEED_LOTS.length].kind).toBe('piece');
    expect(sortLots(LOTS, 'newest')[0].kind).not.toBe('piece');
    expect(sortLots(pieces, 'name').map((l) => l.title).indexOf('Pindler sample 23')).toBeLessThan(sortLots(pieces, 'name').map((l) => l.title).indexOf('Pindler sample 100'.replace('100', '41')));
    expect(matchesQuery(findLot('RC-0001'), 'hickory')).toBe(true);
    expect(matchesQuery(findLot('RC-0001'), 'rc-0001')).toBe(true);
    const round = filtersFromQuery(filtersToQuery(withFilter(withFilter(emptyFilters(), 'kind', [KIND_LABELS.piece]), 'mfr', ['Morris & Co'])));
    expect(round.kind).toEqual([KIND_LABELS.piece]);
    expect(round.mfr).toEqual(['Morris & Co']);
    expect(filtersFromQuery('kind=Nonsense').kind).toEqual([]);
    expect(activeChips(round).map((c) => c.label)).toEqual(['Sample pieces', 'Morris & Co']);
  });

  it('counts pieces in the textiles page and links them from home', () => {
    const page = renderTextiles({ store: makeStore(), route: { query: '' } });
    expect(page.querySelectorAll('.lot-card')).toHaveLength(LOTS.length);
    expect(page.querySelector('.results-bar__count').textContent).toContain('including 91 sample pieces from Redesign Collective');
    expect(resultsCountText(SAMPLES.slice(0, 2))).toBe('of sample pieces from Redesign Collective');
    const home = renderHome({ store: makeStore() });
    expect(home.textContent).toContain('Redesign Collective samples');
    expect(home.textContent).not.toContain('NaN');
  });

  it('lists pieces in a project and in the spec export', () => {
    const project = addLot(addLot(emptyProject(), 'RC-0048'), 'FM-0101');
    const page = renderProjects({ store: makeStore(project), session: null, toast });
    expect(page.textContent).toContain('4 pieces on hand, not confirmed yet');
    expect(page.textContent).toContain('pillow covers at 12 x 17 in');
    const md = buildSpecMarkdown(project, [findLot('RC-0048'), findLot('FM-0101')], { date: new Date('2026-11-09') });
    expect(md).toContain('- Brand (from the sample label, not verified): Pindler');
    expect(md).toContain('- Piece size: 27 x 27 in');
    expect(md).toContain('- Fiber: Not recorded');
    expect(md).toContain('### Products these pieces can support');
    expect(md).toContain('- Verified manufacturer: Sample Mill A, Seattle region');
    expect(md).not.toContain('undefined');
    expect(md).not.toContain('null');
  });
});
