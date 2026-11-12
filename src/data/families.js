/**
 * The 12 palette families from the GIX Practicum Master Specification.
 * Loaded from the API at start (see src/bootstrap.js); FAMILIES is a live binding that
 * hydrateFamilies replaces, so modules importing it see the loaded list.
 */
export let FAMILIES = Object.freeze([]);

export const TONES = Object.freeze(['Light', 'Medium', 'Dark']);

export function hydrateFamilies(families) {
  if (!Array.isArray(families)) throw new TypeError('Color families must be a list.');
  FAMILIES = Object.freeze(families.map((f, index) => Object.freeze({ ...f, index })));
  return FAMILIES;
}

export function familyAt(index) {
  return FAMILIES[index] || null;
}

export function toneOf(familyIndex, shadeIndex) {
  const family = familyAt(familyIndex);
  return family ? family.tones[shadeIndex] || null : null;
}
