import { describe, it, expect, vi } from 'vitest';
import { emptyProject, loadProject, saveProject, addLot, removeLot, toggleLot, hasLot, renameProject, addMessage, STORAGE_KEY, DEFAULT_PROJECT_NAME } from '../src/lib/project.js';
import { createStore } from '../src/lib/store.js';
import { buildSpecMarkdown, specFileName } from '../src/lib/specExport.js';
import { LOTS } from '../src/data/lots.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; }, data };
}

describe('project state', () => {
  it('adds, removes, and toggles lots immutably', () => {
    const a = emptyProject();
    const b = addLot(a, 'FM-0101');
    expect(a.lotIds).toEqual([]);
    expect(b.lotIds).toEqual(['FM-0101']);
    expect(addLot(b, 'FM-0101')).toBe(b);
    expect(hasLot(toggleLot(b, 'FM-0101'), 'FM-0101')).toBe(false);
    expect(removeLot(b, 'FM-0101').lotIds).toEqual([]);
    expect(Object.isFrozen(b)).toBe(true);
  });
  it('renames with a fallback and records messages with a timestamp', () => {
    expect(renameProject(emptyProject(), '  Lobby refresh ').name).toBe('Lobby refresh');
    expect(renameProject(emptyProject(), '   ').name).toBe(DEFAULT_PROJECT_NAME);
    const m = addMessage(emptyProject(), { lotId: 'FM-0101', note: 'Can this be cut as pillows?' });
    expect(m.messages).toHaveLength(1);
    expect(m.messages[0].sentAt).toMatch(/^\d{4}-/);
  });
  it('loads a saved project and ignores malformed storage', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ name: 'Lobby', lotIds: ['FM-0101', 7], messages: 'x' }) });
    expect(loadProject(storage)).toEqual({ name: 'Lobby', lotIds: ['FM-0101'], messages: [] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadProject(memoryStorage({ [STORAGE_KEY]: '{bad json' }))).toEqual(emptyProject());
    expect(loadProject(null)).toEqual(emptyProject());
    expect(loadProject(memoryStorage({ [STORAGE_KEY]: '"string"' }))).toEqual(emptyProject());
    warn.mockRestore();
  });
  it('saves and reports storage failures without throwing', () => {
    const storage = memoryStorage();
    expect(saveProject(addLot(emptyProject(), 'FM-0101'), storage)).toBe(true);
    expect(JSON.parse(storage.data[STORAGE_KEY]).lotIds).toEqual(['FM-0101']);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(saveProject(emptyProject(), { setItem: () => { throw new Error('full'); } })).toBe(false);
    expect(saveProject(emptyProject(), null)).toBe(true);
    warn.mockRestore();
  });
});

describe('store', () => {
  it('notifies subscribers and persists on change only', () => {
    const persist = vi.fn();
    const store = createStore(emptyProject(), persist);
    const seen = [];
    const unsubscribe = store.subscribe((p) => seen.push(p.lotIds.length));
    store.update((p) => addLot(p, 'FM-0101'));
    store.set(store.get());
    expect(seen).toEqual([1]);
    expect(persist).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.update((p) => addLot(p, 'FM-0102'));
    expect(seen).toEqual([1]);
  });
});

describe('spec export', () => {
  it('writes a section per lot with documentation, estimates, and the method', () => {
    const project = renameProject(addLot(emptyProject(), 'FM-0101'), 'Lobby refresh');
    const md = buildSpecMarkdown(project, [LOTS[0]], { date: new Date('2026-10-30T00:00:00Z') });
    expect(md).toContain('# Lobby refresh: textile specification');
    expect(md).toContain('## Herringbone wool, Camel (FM-0101)');
    expect(md).toContain('Documentation on file: Technical data, Fiber content, Fire test report');
    expect(md).toContain('18 x 18 in pillow cover: 71 pillow covers');
    expect(md).toContain('Method A');
    expect(md).toContain('No diversion figure is shown until the method is verified.');
    expect(md).not.toContain('—');
    expect(specFileName(project, new Date('2026-10-30T00:00:00Z'))).toBe('fabmatch-spec-lobby-refresh-2026-10-30.md');
    expect(specFileName(renameProject(project, '!!!'), new Date('2026-10-30T00:00:00Z'))).toBe('fabmatch-spec-project-2026-10-30.md');
  });
});
