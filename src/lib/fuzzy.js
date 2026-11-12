/**
 * Typo-tolerant word matching for site search. A search word matches when it appears exactly in
 * the text, or when it is within a few typos of a word in the text (or of the start of one, so a
 * half-typed word with a typo still matches). Short words get no typo allowance, because a single
 * wrong letter in a short word usually means a different word.
 */

/** Words shorter than this get no typos; words at least LONG_WORD letters long get two. */
const MIN_FUZZY_LENGTH = 4;
const LONG_WORD = 8;

export function typoBudget(word) {
  const length = [...word].length;
  if (length < MIN_FUZZY_LENGTH) return 0;
  return length < LONG_WORD ? 1 : 2;
}

/**
 * Edit distance where inserting, deleting, or changing a letter, or swapping two neighboring
 * letters, each count as one edit. Returns limit + 1 as soon as the distance must exceed limit.
 */
export function editDistance(a, b, limit = Infinity) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (before && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, before[j - 2] + 1);
      }
      row.push(best);
    }
    if (Math.min(...row) > limit) return limit + 1;
    before = prev;
    prev = row;
  }
  return prev[b.length];
}

export function tokenize(text) {
  return String(text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function closeTo(word, token, budget) {
  if (editDistance(word, token, budget) <= budget) return true;
  return token.length > word.length && editDistance(word, token.slice(0, word.length), budget) <= budget;
}

/** word is lowercase; haystack is the lowercase text; tokens is tokenize(haystack). */
export function fuzzyWordMatch(word, haystack, tokens) {
  if (haystack.includes(word)) return true;
  const budget = typoBudget(word);
  return budget > 0 && tokens.some((token) => closeTo(word, token, budget));
}
