import { describe, it, expect } from 'vitest';
import { typoBudget, editDistance, tokenize, fuzzyWordMatch } from '../src/lib/fuzzy.js';

describe('typoBudget', () => {
  it('allows no typos in short words, one in medium words, two in long words', () => {
    expect(typoBudget('wol')).toBe(0);
    expect(typoBudget('wool')).toBe(1);
    expect(typoBudget('velvets')).toBe(1);
    expect(typoBudget('herringb')).toBe(2);
  });
});

describe('editDistance', () => {
  it('counts insertions, deletions, substitutions, and swapped neighbors as one edit each', () => {
    expect(editDistance('wool', 'wool')).toBe(0);
    expect(editDistance('wool', 'woool')).toBe(1);
    expect(editDistance('wool', 'wol')).toBe(1);
    expect(editDistance('velvit', 'velvet')).toBe(1);
    expect(editDistance('camle', 'camel')).toBe(1);
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
  });
  it('stops early once the distance passes the limit', () => {
    expect(editDistance('aaaaaaaa', 'bbbbbbbb', 2)).toBe(3);
  });
});

describe('tokenize', () => {
  it('lowercases and splits on anything that is not a letter or digit', () => {
    expect(tokenize('Camel-Wool / Mill A, 2024')).toEqual(['camel', 'wool', 'mill', 'a', '2024']);
    expect(tokenize('')).toEqual([]);
  });
});

describe('fuzzyWordMatch', () => {
  const text = 'herringbone camel wool mill a ochre';
  const tokens = tokenize(text);
  it('matches exact pieces of text', () => {
    expect(fuzzyWordMatch('ring', text, tokens)).toBe(true);
  });
  it('matches whole words with typos within budget', () => {
    expect(fuzzyWordMatch('camle', text, tokens)).toBe(true);
    expect(fuzzyWordMatch('wools', text, tokens)).toBe(true);
    expect(fuzzyWordMatch('herrinbone', text, tokens)).toBe(true);
  });
  it('matches the start of a word typed with a typo', () => {
    expect(fuzzyWordMatch('herrign', text, tokens)).toBe(true);
  });
  it('rejects words that are too far off or too short to guess', () => {
    expect(fuzzyWordMatch('xol', text, tokens)).toBe(false);
    expect(fuzzyWordMatch('velvet', text, tokens)).toBe(false);
  });
});
