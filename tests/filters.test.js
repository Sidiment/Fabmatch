import { describe, it, expect } from 'vitest';
import { LOTS, findLot } from '../src/data/lots.js';
import {
  emptyFilters, toggleValue, withFilter, clearFilters, countActive, matchesLot, applyFilters, sortLots,
  activeChips, filtersToQuery, filtersFromQuery, yardageBucket, matchesQuery,
} from '../src/lib/filters.js';

describe('filter state', () => {
  it('starts empty and frozen', () => {
    const f = emptyFilters();
    expect(countActive(f)).toBe(0);
    expect(Object.isFrozen(f)).toBe(true);
  });
  it('toggles values without mutating the previous state', () => {
    const a = emptyFilters();
    const b = toggleValue(a, 'fiber', 'Wool');
    const c = toggleValue(b, 'fiber', 'Wool');
    expect(a.fiber).toEqual([]);
    expect(b.fiber).toEqual(['Wool']);
    expect(c.fiber).toEqual([]);
  });
  it('clears everything except the sort', () => {
    const f = withFilter(toggleValue(withFilter(emptyFilters(), 'sort', 'name'), 'fire', 'NFPA 701'), 'rubs', 30000);
    expect(countActive(f)).toBe(2);
    expect(clearFilters(f)).toEqual(withFilter(emptyFilters(), 'sort', 'name'));
  });
});

describe('matching', () => {
  const herringbone = LOTS[0];
  it('matches on fire rating, family, tone, fiber, pattern, yardage, and docs', () => {
    expect(matchesLot(herringbone, toggleValue(emptyFilters(), 'fire', 'ASTM E84 Class A'))).toBe(true);
    expect(matchesLot(herringbone, toggleValue(emptyFilters(), 'fire', 'NFPA 701'))).toBe(false);
    expect(matchesLot(herringbone, toggleValue(emptyFilters(), 'fam', 2))).toBe(true);
    expect(matchesLot(herringbone, toggleValue(emptyFilters(), 'tone', 'Dark'))).toBe(false);
    expect(matchesLot(herringbone, toggleValue(emptyFilters(), 'fiber', 'Wool'))).toBe(true);
    expect(matchesLot(herringbone, toggleValue(emptyFilters(), 'pattern', 'Plaid'))).toBe(false);
    expect(matchesLot(herringbone, toggleValue(emptyFilters(), 'yd', '25 to 50 yd'))).toBe(true);
    expect(matchesLot(herringbone, toggleValue(toggleValue(emptyFilters(), 'docs', 'Technical data'), 'docs', 'Cleaning guide'))).toBe(false);
  });
  it('treats a missing rating as not meeting a minimum', () => {
    const drapery = LOTS.find((l) => l.rubs === null);
    expect(matchesLot(drapery, withFilter(emptyFilters(), 'rubs', 15000))).toBe(false);
    expect(matchesLot(LOTS.find((l) => l.nrc === 0.55), withFilter(emptyFilters(), 'nrc', 0.6))).toBe(false);
    expect(matchesLot(LOTS.find((l) => l.nrc === 0.55), withFilter(emptyFilters(), 'nrc', 0.4))).toBe(true);
  });
  it('maps Art-ready to wallcovering lots and other categories to themselves', () => {
    expect(applyFilters(LOTS, withFilter(emptyFilters(), 'cat', 'Art-ready')).every((l) => l.cat === 'Wallcovering')).toBe(true);
    expect(applyFilters(LOTS, withFilter(emptyFilters(), 'cat', 'Acoustic'))).toHaveLength(2);
  });
  it('searches across name, fiber, manufacturer, family, and shade names', () => {
    expect(matchesQuery(herringbone, 'camel wool')).toBe(true);
    expect(matchesQuery(herringbone, 'ochre')).toBe(true);
    expect(matchesQuery(herringbone, 'mill a')).toBe(true);
    expect(matchesQuery(herringbone, 'sheer')).toBe(false);
    expect(matchesQuery(herringbone, '   ')).toBe(true);
  });
  it('tolerates small typos in search words when fuzzy matching is on', () => {
    const fuzzy = { fuzzy: true };
    expect(matchesQuery(herringbone, 'camle wool')).toBe(false);
    expect(matchesQuery(herringbone, 'camle wool', fuzzy)).toBe(true);
    expect(matchesQuery(herringbone, 'ocher', fuzzy)).toBe(true);
    expect(matchesQuery(herringbone, 'camel woool', fuzzy)).toBe(true);
    expect(matchesQuery(herringbone, 'camel sheer', fuzzy)).toBe(false);
    expect(matchesQuery(herringbone, 'xyzzy', fuzzy)).toBe(false);
  });
  it('falls back to typo matching only when a search finds nothing exactly', () => {
    const search = (q) => applyFilters(LOTS, withFilter(emptyFilters(), 'q', q));
    const plaid = search('plaid');
    expect(plaid.length).toBeGreaterThan(0);
    expect(plaid.every((l) => matchesQuery(l, 'plaid'))).toBe(true);
    expect(search('camle wool').map((l) => l.id)).toContain(herringbone.id);
    expect(search('xyzzy')).toHaveLength(0);
    expect(search('')).toHaveLength(LOTS.length);
  });
  it('buckets yardage at 25 and 50', () => {
    expect(yardageBucket(24.9)).toBe('Under 25 yd');
    expect(yardageBucket(25)).toBe('25 to 50 yd');
    expect(yardageBucket(50)).toBe('25 to 50 yd');
    expect(yardageBucket(51)).toBe('Over 50 yd');
  });
});

describe('sorting', () => {
  it('sorts by most yardage by default, by newest, and by name', () => {
    expect(sortLots(LOTS, 'yardage')[0].yd).toBe(64);
    expect(sortLots(LOTS, 'name')[0].title < sortLots(LOTS, 'name')[1].title).toBe(true);
    const newest = sortLots(LOTS, 'newest');
    expect(newest[0].lastConfirmed >= newest[1].lastConfirmed).toBe(true);
    expect(sortLots(LOTS, 'unknown')[0].yd).toBe(64);
    expect(LOTS[0].id).toBe('FM-0101');
  });
});

describe('chips and query strings', () => {
  it('builds removable chips whose next state drops the filter', () => {
    const f = withFilter(toggleValue(toggleValue(emptyFilters(), 'fam', 3), 'docs', 'Technical data'), 'nrc', 0.4);
    const chips = activeChips(f);
    expect(chips.map((c) => c.label)).toEqual(['Terracotta', 'Technical data on file', 'NRC 0.40+']);
    expect(countActive(chips[2].next)).toBe(2);
  });
  it('round-trips through a query string', () => {
    const f = withFilter(withFilter(toggleValue(toggleValue(emptyFilters(), 'fam', 3), 'fire', 'NFPA 701'), 'q', 'wool'), 'rubs', 30000);
    const back = filtersFromQuery(filtersToQuery(f));
    expect(back).toEqual(f);
    expect(filtersToQuery(emptyFilters())).toBe('');
  });
  it('ignores malformed query values', () => {
    const f = filtersFromQuery('fam=99|x|2&sort=bogus&rubs=abc');
    expect(f.fam).toEqual([2]);
    expect(f.sort).toBe('yardage');
    expect(f.rubs).toBe(0);
  });
  it('finds lots by id', () => {
    expect(findLot('FM-0101').name).toBe('Herringbone wool');
    expect(findLot('nope')).toBeNull();
  });
});
