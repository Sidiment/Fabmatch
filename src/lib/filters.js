/**
 * Search filters for the textiles page. Every function returns a new object; nothing is mutated.
 * Filter groups follow guide section 8.4. A lot with no listed value for a rating does not match
 * a minimum filter for that rating.
 */
import { matchesCategory, kindLabel, KIND_LABELS } from '../data/lots.js';
import { FAMILIES } from '../data/families.js';
import { formatNumber } from './format.js';
import { tokenize, fuzzyWordMatch } from './fuzzy.js';

export const FIRE_RATINGS = Object.freeze(['ASTM E84 Class A', 'CAL TB 117-2013', 'NFPA 260 Class 1', 'NFPA 701']);
export const RUB_MINIMUMS = Object.freeze([15000, 30000, 50000, 100000]);
export const NRC_MINIMUMS = Object.freeze([0.2, 0.4, 0.6]);
export const YARDAGE_BUCKETS = Object.freeze(['Under 25 yd', '25 to 50 yd', 'Over 50 yd']);
export const KINDS = Object.freeze([KIND_LABELS.yardage, KIND_LABELS.piece]);
export const SORTS = Object.freeze([
  { id: 'yardage', label: 'Most yardage' },
  { id: 'newest', label: 'Newest' },
  { id: 'name', label: 'Name A to Z' },
]);

/** Multi-choice keys hold arrays of selected values; rubs and nrc hold a single minimum. */
export const MULTI_KEYS = Object.freeze(['fire', 'fam', 'tone', 'fiber', 'pattern', 'yd', 'docs', 'kind', 'mfr']);

export function emptyFilters() {
  return Object.freeze({
    q: '', cat: '', sort: 'yardage', rubs: 0, nrc: 0,
    fire: [], fam: [], tone: [], fiber: [], pattern: [], yd: [], docs: [], kind: [], mfr: [],
  });
}

export function yardageBucket(yd) {
  if (yd === null || yd === undefined) return null;
  if (yd < 25) return YARDAGE_BUCKETS[0];
  if (yd <= 50) return YARDAGE_BUCKETS[1];
  return YARDAGE_BUCKETS[2];
}

export function withFilter(filters, key, value) {
  return Object.freeze({ ...filters, [key]: value });
}

/** Adds or removes one value in a multi-choice group. */
export function toggleValue(filters, key, value) {
  const current = filters[key] || [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return withFilter(filters, key, next);
}

export function clearFilters(filters) {
  return withFilter(emptyFilters(), 'sort', filters.sort);
}

export function countActive(filters) {
  const multi = MULTI_KEYS.reduce((n, key) => n + filters[key].length, 0);
  return multi + (filters.rubs ? 1 : 0) + (filters.nrc ? 1 : 0);
}

function searchHaystack(lot) {
  const family = lot.family ? [lot.family.name, lot.family.fullName, ...lot.family.shades] : [];
  return [lot.name, lot.title, lot.id, lot.fiber, lot.mfr, lot.cat, lot.pattern, lot.source, ...family]
    .filter(Boolean).join(' ').toLowerCase();
}

function queryWords(query) {
  return String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
}

/** With fuzzy on, each word may also match a word in the lot that is a typo or two away. */
export function matchesQuery(lot, query, { fuzzy = false } = {}) {
  const words = queryWords(query);
  if (!words.length) return true;
  const hay = searchHaystack(lot);
  if (!fuzzy) return words.every((w) => hay.includes(w));
  const tokens = tokenize(hay);
  return words.every((w) => fuzzyWordMatch(w, hay, tokens));
}

export function matchesLot(lot, filters, options = {}) {
  if (!matchesCategory(lot, filters.cat)) return false;
  if (filters.fire.length && !filters.fire.some((f) => lot.fire.includes(f))) return false;
  if (filters.fam.length && !filters.fam.includes(lot.fam)) return false;
  if (filters.tone.length && !(lot.tone && filters.tone.includes(lot.tone.tone))) return false;
  if (filters.fiber.length && !filters.fiber.includes(lot.fiber)) return false;
  if (filters.pattern.length && !filters.pattern.includes(lot.pattern)) return false;
  if (filters.yd.length && !filters.yd.includes(yardageBucket(lot.yd))) return false;
  if (filters.docs.length && !filters.docs.every((d) => lot.docs.includes(d))) return false;
  if (filters.kind.length && !filters.kind.includes(kindLabel(lot))) return false;
  if (filters.mfr.length && !filters.mfr.includes(lot.mfr)) return false;
  if (filters.rubs && !(lot.rubs && lot.rubs >= filters.rubs)) return false;
  if (filters.nrc && !(lot.nrc && lot.nrc >= filters.nrc)) return false;
  return matchesQuery(lot, filters.q, options);
}

/** Titles compare with numbers in order, so "sample 2" comes before "sample 10". */
const byTitle = (a, b) => a.title.localeCompare(b.title, 'en', { numeric: true });
/** Lots with no yardage recorded (sample pieces) sort after every roll, by pieces on hand. */
const amount = (lot) => (lot.yd === null || lot.yd === undefined ? -1 : lot.yd);

const COMPARATORS = {
  yardage: (a, b) => amount(b) - amount(a) || (b.qty || 0) - (a.qty || 0) || byTitle(a, b),
  newest: (a, b) => (b.lastConfirmed || '').localeCompare(a.lastConfirmed || '') || byTitle(a, b),
  name: byTitle,
};

export function sortLots(lots, sortId) {
  const compare = COMPARATORS[sortId] || COMPARATORS.yardage;
  return [...lots].sort(compare);
}

/**
 * Exact matches win. Typo-tolerant matching runs only when a search finds nothing exactly, so a
 * correct word like "plaid" never pulls in near-misses like "plain".
 */
export function applyFilters(lots, filters) {
  const exact = lots.filter((lot) => matchesLot(lot, filters));
  const shown = exact.length || !queryWords(filters.q).length
    ? exact
    : lots.filter((lot) => matchesLot(lot, filters, { fuzzy: true }));
  return sortLots(shown, filters.sort);
}

/** Removable chips for the active filters, each with the filters that result from removing it. */
export function activeChips(filters) {
  const chips = [];
  const push = (label, next) => chips.push({ label, next });
  filters.fire.forEach((v) => push(v, toggleValue(filters, 'fire', v)));
  filters.fam.forEach((v) => push(FAMILIES[v].name, toggleValue(filters, 'fam', v)));
  filters.tone.forEach((v) => push(`${v} tone`, toggleValue(filters, 'tone', v)));
  filters.fiber.forEach((v) => push(v, toggleValue(filters, 'fiber', v)));
  filters.pattern.forEach((v) => push(v, toggleValue(filters, 'pattern', v)));
  filters.yd.forEach((v) => push(v, toggleValue(filters, 'yd', v)));
  filters.docs.forEach((v) => push(`${v} on file`, toggleValue(filters, 'docs', v)));
  filters.kind.forEach((v) => push(v, toggleValue(filters, 'kind', v)));
  filters.mfr.forEach((v) => push(v, toggleValue(filters, 'mfr', v)));
  if (filters.rubs) push(`${formatNumber(filters.rubs)}+ double rubs`, withFilter(filters, 'rubs', 0));
  if (filters.nrc) push(`NRC ${filters.nrc.toFixed(2)}+`, withFilter(filters, 'nrc', 0));
  return chips;
}

/* URL query string round trip, so a filtered view can be linked and shared. */
export function filtersToQuery(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.cat) params.set('cat', filters.cat);
  if (filters.sort && filters.sort !== 'yardage') params.set('sort', filters.sort);
  if (filters.rubs) params.set('rubs', String(filters.rubs));
  if (filters.nrc) params.set('nrc', String(filters.nrc));
  MULTI_KEYS.forEach((key) => { if (filters[key].length) params.set(key, filters[key].join('|')); });
  return params.toString();
}

export function filtersFromQuery(queryString) {
  const params = new URLSearchParams(queryString || '');
  const base = emptyFilters();
  const list = (key) => (params.get(key) ? params.get(key).split('|').filter(Boolean) : []);
  return Object.freeze({
    ...base,
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    sort: SORTS.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'yardage',
    rubs: Number(params.get('rubs')) || 0,
    nrc: Number(params.get('nrc')) || 0,
    fire: list('fire'),
    fam: list('fam').map(Number).filter((n) => Number.isInteger(n) && FAMILIES[n]),
    tone: list('tone'),
    fiber: list('fiber'),
    pattern: list('pattern'),
    yd: list('yd'),
    docs: list('docs'),
    kind: list('kind').filter((v) => KINDS.includes(v)),
    mfr: list('mfr'),
  });
}
