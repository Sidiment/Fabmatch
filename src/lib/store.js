/**
 * A tiny observable holder for the project. Subscribers get the new project after each change.
 * persist(next, previous) runs on every change made through set or update; reset replaces the
 * project without persisting, for state that came from the server.
 */
import { loadProject, saveProject } from './project.js';

export function createStore(initial = loadProject(), persist = saveProject) {
  let current = initial;
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn(current));
  return Object.freeze({
    get: () => current,
    set(next) {
      if (next === current) return current;
      const previous = current;
      current = next;
      persist(current, previous);
      notify();
      return current;
    },
    update(fn) {
      return this.set(fn(current));
    },
    reset(next) {
      current = next;
      notify();
      return current;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  });
}
