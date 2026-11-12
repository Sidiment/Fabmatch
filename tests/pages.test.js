import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from '../src/lib/store.js';
import { emptyProject, addLot } from '../src/lib/project.js';
import { renderHome, featuredLots } from '../src/pages/home.js';
import { renderTextiles, EMPTY_COPY, keepDrawerOpenOnDesktop } from '../src/pages/textiles.js';
import { renderLot } from '../src/pages/lot.js';
import { renderProjects, EMPTY_PROJECT_COPY, projectLots } from '../src/pages/projects.js';
import { renderAbout, validateContact } from '../src/pages/about.js';
import { renderNotFound } from '../src/pages/notFound.js';
import { createApp } from '../src/app.js';
import * as specExport from '../src/lib/specExport.js';

const noop = () => {};
const toast = { show: vi.fn(), hide: noop };
const makeStore = (project = emptyProject()) => createStore(project, noop);

beforeEach(() => { document.body.innerHTML = ''; window.location.hash = ''; toast.show.mockClear(); window.scrollTo = noop; });

describe('home', () => {
  it('renders the palette, performance filters, applications, and recent lots', () => {
    const page = renderHome({ store: makeStore() });
    expect(page.querySelector('h1').textContent).toBe('Reclaimed textiles, ready to specify');
    expect(page.querySelectorAll('.palette__family')).toHaveLength(12);
    expect(page.querySelectorAll('.apps__tile')).toHaveLength(5);
    expect(page.querySelectorAll('.lot-card')).toHaveLength(4);
    expect(featuredLots()[0].lastConfirmed >= featuredLots()[3].lastConfirmed).toBe(true);
    expect(page.textContent).not.toContain('—');
  });
});

describe('textiles', () => {
  it('lists every lot with no filters and shows the empty copy when nothing matches', () => {
    const all = renderTextiles({ store: makeStore(), route: { query: '' } });
    expect(all.querySelectorAll('.lot-card')).toHaveLength(14);
    expect(all.querySelector('.results-bar__count').textContent).toContain('14 lots');
    const none = renderTextiles({ store: makeStore(), route: { query: 'q=zzz' } });
    expect(none.textContent).toContain(EMPTY_COPY);
    expect(none.querySelector('.active-chip').textContent).toContain('Search: zzz');
  });
  it('changes the sort through the hash and opens the drawer on desktop', () => {
    const page = renderTextiles({ store: makeStore(), route: { query: 'cat=Drapery' } });
    expect(page.querySelectorAll('.lot-card')).toHaveLength(3);
    const select = page.querySelector('[data-sort]');
    select.value = 'name';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.location.hash).toBe('#/textiles?cat=Drapery&sort=name');
    const drawer = document.createElement('details');
    const listeners = [];
    keepDrawerOpenOnDesktop(drawer, { matches: false, addEventListener: (_, fn) => listeners.push(fn) });
    expect(drawer.open).toBe(false);
    keepDrawerOpenOnDesktop(drawer, { matches: true, addEventListener: noop });
    expect(drawer.open).toBe(true);
  });
});

describe('lot page', () => {
  it('shows key facts, performance sources, documentation, estimates, and the ask form', () => {
    const page = renderLot({ store: makeStore(), route: { param: 'FM-0104', query: '' }, toast });
    const text = page.textContent;
    expect(page.querySelector('h1').textContent).toBe('Felted wool, Pewter');
    expect(text).toContain('Yardage on hand');
    expect(text).toContain('NRC 0.45');
    expect(text).toContain('Association for Contract Textiles');
    expect(text).toContain('Cleaning guide');
    expect(page.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(page.querySelector('[data-ask-form]')).not.toBeNull();
    expect(text).toContain('no figure is shown for this lot yet');
    page.querySelector('[data-resource]').click();
    expect(page.querySelector('[data-resource-note]').hidden).toBe(false);
  });
  it('saves a workroom message to the project store', () => {
    const store = makeStore();
    const page = renderLot({ store, route: { param: 'FM-0101', query: '' }, toast });
    document.body.append(page);
    page.querySelector('#ask-project').value = 'Lobby';
    page.querySelector('#ask-note').value = 'Pillows?';
    page.querySelector('[data-ask-form]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(store.get().messages).toHaveLength(1);
    expect(toast.show).toHaveBeenCalledWith('Message saved with Lobby');
  });
  it('falls back to not found for an unknown lot', () => {
    const page = renderLot({ store: makeStore(), route: { param: 'FM-9999', query: '', name: 'lot' }, toast });
    expect(page.querySelector('h1').textContent).toBe('That page was not found');
    expect(renderNotFound({ route: { name: 'notFound', param: '' } }).textContent).toContain('notFound');
  });
});

describe('projects page', () => {
  it('shows the empty state and disables export with no lots', () => {
    const page = renderProjects({ store: makeStore(), toast });
    expect(page.textContent).toContain(EMPTY_PROJECT_COPY);
    expect(page.querySelector('[data-export]').disabled).toBe(true);
  });
  it('lists saved lots, removes with undo, renames, and exports', () => {
    const store = makeStore(addLot(addLot(emptyProject(), 'FM-0101'), 'FM-0104'));
    const page = renderProjects({ store, toast });
    document.body.append(page);
    expect(projectLots(store.get())).toHaveLength(2);
    expect(page.querySelectorAll('[data-project-row]')).toHaveLength(2);

    page.querySelector('[data-remove="FM-0101"]').click();
    expect(store.get().lotIds).toEqual(['FM-0104']);
    expect(page.querySelectorAll('[data-project-row]')).toHaveLength(1);
    expect(page.querySelector('.lede').textContent).toContain('1 lot saved');
    const [, options] = toast.show.mock.calls.at(-1);
    options.undo();
    expect(store.get().lotIds).toEqual(['FM-0104', 'FM-0101']);
    expect(page.querySelectorAll('[data-project-row]')).toHaveLength(2);
    expect(page.querySelector('.lede').textContent).toContain('2 lots saved');

    page.querySelector('[data-remove="FM-0101"]').click();
    page.querySelector('[data-remove="FM-0104"]').click();
    expect(page.textContent).toContain(EMPTY_PROJECT_COPY);
    expect(page.querySelector('[data-export]').disabled).toBe(true);
    toast.show.mock.calls.at(-1)[1].undo();
    toast.show.mock.calls.at(-2)[1].undo();
    expect(page.querySelectorAll('[data-project-row]')).toHaveLength(2);
    expect(page.querySelector('[data-export]').disabled).toBe(false);

    page.querySelector('#project-name').value = 'Lobby refresh';
    page.querySelector('[data-rename]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(store.get().name).toBe('Lobby refresh');
    expect(page.querySelector('h1').textContent).toBe('Lobby refresh');

    const download = vi.spyOn(specExport, 'downloadText').mockImplementation(noop);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    page.querySelector('[data-export]').click();
    expect(toast.show).toHaveBeenLastCalledWith('Specification exported');
    download.mockRestore();
  });
  it('downloads a text file through a temporary link', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(noop);
    specExport.downloadText('a.md', '# a');
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});

describe('about page', () => {
  it('validates the contact form and confirms on this device', () => {
    expect(Object.keys(validateContact({}).errors).sort()).toEqual(['email', 'message', 'name']);
    expect(validateContact({ name: 'A', email: 'bad', message: 'm' }).errors.email).toMatch(/name@example.com/);
    const page = renderAbout();
    document.body.append(page);
    const form = page.querySelector('[data-contact]');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(form.querySelectorAll('.field__error')).toHaveLength(3);
    form.querySelector('#c-name').value = 'Sam';
    form.querySelector('#c-email').value = 'sam@example.com';
    form.querySelector('#c-message').value = 'Hello';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(form.querySelectorAll('.field__error')).toHaveLength(0);
    expect(form.querySelector('[data-contact-status]').textContent).toContain('Thank you, Sam');
    expect(page.textContent).toContain('R&D and Pilot (2026-2027)');
  });
});

describe('app shell', () => {
  it('routes between pages, toggles lots from any card, and keeps the header in sync', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const app = createApp(root, { store: makeStore() });
    expect(root.querySelector('main h1').textContent).toBe('Reclaimed textiles, ready to specify');
    expect(root.querySelector('[data-announcement]')).toBeNull();
    window.location.hash = '#/lots/%E0%A4%A';
    expect(() => app.render()).not.toThrow();
    expect(document.title).toBe('Page not found | Fabmatch');
    window.location.hash = '#/';
    app.render();

    root.querySelector('[data-lot-add]').click();
    expect(app.store.get().lotIds).toHaveLength(1);
    expect(root.querySelector('[data-project-count]').textContent).toBe('1');
    expect(root.querySelector('[data-lot-add]').textContent).toBe('Added to project');

    window.location.hash = '#/lots/FM-0101';
    app.render();
    expect(document.title).toBe('Herringbone wool, Camel | Fabmatch');
    window.location.hash = '#/about#contact';
    app.render();
    expect(root.querySelector('[data-nav="about"]').getAttribute('aria-current')).toBe('page');
    window.location.hash = '#/nowhere';
    app.render();
    expect(document.title).toBe('Page not found | Fabmatch');
    window.location.hash = '#/signin';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(document.title).toBe('Sign in | Fabmatch');
    expect(root.querySelector('[data-auth-form]')).not.toBeNull();
  });
});
