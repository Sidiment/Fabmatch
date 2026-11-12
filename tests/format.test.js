import { describe, it, expect } from 'vitest';
import { formatNumber, formatYards, formatRubs, formatNrc, pluralize, formatDate, formatShortDate, factLine, joinParts } from '../src/lib/format.js';
import { escapeHtml, html, raw, el } from '../src/lib/html.js';
import { parseHash, routes } from '../src/lib/router.js';
import { textureDataUri, textureAlt, textureSvg } from '../src/lib/texture.js';
import { LOTS } from '../src/data/lots.js';
import { toneOf, familyAt } from '../src/data/families.js';

describe('format', () => {
  it('formats numbers, yards, rubs, and NRC as the guide displays them', () => {
    expect(formatNumber(50000)).toBe('50,000');
    expect(formatYards(42)).toBe('42 yd');
    expect(formatRubs(30000)).toBe('30,000 Wyzenbeek double rubs');
    expect(formatNrc(0.4)).toBe('NRC 0.40');
    expect(pluralize(1, 'lot')).toBe('1 lot');
    expect(pluralize(3, 'lot')).toBe('3 lots');
  });
  it('formats dates and tolerates missing ones', () => {
    expect(formatDate('2026-10-14')).toBe('Oct 14, 2026');
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
  it('writes the card fact line as fiber, width, yardage', () => {
    expect(factLine(LOTS[0])).toBe('Wool, 54 in, 42 yd');
    expect(joinParts(['a', null, 'b'])).toBe('a · b');
  });
});

describe('html helpers', () => {
  it('escapes interpolations and leaves raw markup alone', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
    expect(String(html`<p>${'<i>'}</p>`)).toBe('<p>&lt;i&gt;</p>');
    expect(String(html`<p>${raw('<i>')}</p>`)).toBe('<p><i></p>');
    expect(String(html`<ul>${['a', 'b'].map((x) => html`<li>${x}</li>`)}</ul>`)).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(String(html`<p>${html`<b>${'<'}</b>`}</p>`)).toBe('<p><b>&lt;</b></p>');
    expect(String(html`<p>${null}${false}${undefined}</p>`)).toBe('<p></p>');
    expect(el('<div class="x"></div>').className).toBe('x');
  });
});

describe('router', () => {
  it('parses every route and keeps the query and anchor', () => {
    expect(parseHash('')).toMatchObject({ name: 'home' });
    expect(parseHash('#/')).toMatchObject({ name: 'home' });
    expect(parseHash('#/textiles?q=wool&fam=2')).toMatchObject({ name: 'textiles', query: 'q=wool&fam=2' });
    expect(parseHash('#/lots/FM-0101#ask')).toMatchObject({ name: 'lot', param: 'FM-0101', anchor: 'ask' });
    expect(parseHash('#/projects')).toMatchObject({ name: 'projects' });
    expect(parseHash('#/about#contact')).toMatchObject({ name: 'about', anchor: 'contact' });
    expect(parseHash('#/nothing/here')).toMatchObject({ name: 'notFound', param: 'nothing/here' });
    expect(parseHash('#/lots')).toMatchObject({ name: 'notFound' });
    expect(parseHash('#/lots/%E0%A4%A')).toMatchObject({ name: 'notFound' });
    expect(parseHash('#/lots/FM%2D0101')).toMatchObject({ name: 'lot', param: 'FM-0101' });
  });
  it('builds hrefs', () => {
    expect(routes.textiles('q=a')).toBe('#/textiles?q=a');
    expect(routes.textiles()).toBe('#/textiles');
    expect(routes.lot('FM 1', 'ask')).toBe('#/lots/FM%201#ask');
    expect(routes.about()).toBe('#/about');
  });
});

describe('textures and families', () => {
  it('draws one weave per pattern code in the lot tone', () => {
    const codes = new Set(LOTS.map((l) => l.tex));
    expect([...codes].sort()).toEqual(['b', 'f', 'h', 'p', 't']);
    LOTS.forEach((lot) => {
      const svg = textureSvg(lot);
      expect(svg).toContain(lot.tone.hex);
      expect(textureDataUri(lot).startsWith('data:image/svg+xml')).toBe(true);
    });
    expect(textureAlt(LOTS[0])).toBe('Camel herringbone wool, placeholder texture');
  });
  it('exposes the 12 families and their tones', () => {
    expect(familyAt(11).code).toBe('BKT-12');
    expect(familyAt(12)).toBeNull();
    expect(toneOf(0, 0).name).toBe('Chalk');
    expect(toneOf(0, 9)).toBeNull();
    expect(toneOf(99, 0)).toBeNull();
  });
});

describe('formatShortDate', () => {
  it('drops the year and tolerates bad input', () => {
    expect(formatShortDate('2026-10-14')).toBe('Oct 14');
    expect(formatShortDate('')).toBe('');
    expect(formatShortDate('nope')).toBe('');
  });
});
