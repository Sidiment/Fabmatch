/**
 * Display helpers shared by the lot card, lot page, project list, and spec export, so a lot
 * with blank attributes (such as a Redesign Collective sample piece) reads the same everywhere.
 */
import { isPieceLot } from '../../shared/catalog.js';
import { estimate, estimatePieces } from './estimator.js';
import { textureDataUri, textureAlt } from './texture.js';
import { formatNumber, formatYards, pluralize } from './format.js';

export const NOT_RECORDED = 'Not recorded';

/** "42 yd" for a roll, "3 pieces" for sample pieces. */
export function amountLabel(lot) {
  if (isPieceLot(lot)) return pluralize(lot.qty, 'piece');
  return lot.yd === null || lot.yd === undefined ? NOT_RECORDED : formatYards(lot.yd);
}

/** Short badge for the card photo: "42 yd" or "3 pc". */
export function amountBadge(lot) {
  if (isPieceLot(lot)) return `${formatNumber(lot.qty)} pc`;
  return lot.yd === null || lot.yd === undefined ? '' : `${formatNumber(lot.yd)} yd`;
}

/** The photograph when the lot has one, otherwise the drawn placeholder texture. */
export function lotImage(lot, { card = false } = {}) {
  const photo = card ? lot.photoCard || lot.photo : lot.photo;
  if (photo) {
    return {
      src: photo,
      // Plain text: html`` escapes it where it is used.
      alt: `${lot.title}, photograph of the sample`,
      isPhoto: true,
    };
  }
  return { src: textureDataUri(lot), alt: textureAlt(lot), isPhoto: false };
}

/** Manufacturer line in words: verified manufacturer, a brand from the sample label, or not recorded. */
export function brandText(lot) {
  if (!lot.mfr) return 'Brand not recorded';
  return lot.mfrVerified === false ? `Brand: ${lot.mfr}` : `Verified: ${lot.mfr}`;
}

/**
 * Estimate for one product, for either kind of lot. Returns { fits, quantity, reason,
 * yardsPerUnit, panels }. Sample pieces use the estimator's piece mode; when the direction is
 * not recorded they are not turned, which is the cautious choice.
 */
export function estimateForLot(lot, product, assumptions) {
  if (isPieceLot(lot)) {
    if (!lot.remnants || !lot.remnants.length) return { fits: false, quantity: 0, reason: 'Piece size not recorded' };
    const pieces = lot.remnants.map((p) => ({ ...p, directional: lot.directional ?? true }));
    const result = estimatePieces(pieces, product, assumptions);
    const tooSmall = result.panels.find((p) => p.panelsFromLot === 0);
    if (tooSmall) {
      return { fits: false, quantity: 0, panels: result.panels, reason: `${tooSmall.label} (${tooSmall.cutWidth.toFixed(1)} x ${tooSmall.cutLength.toFixed(1)} in cut) is larger than a ${lot.size} piece` };
    }
    return { fits: true, quantity: result.quantity, panels: result.panels, yardsPerUnit: null, reason: null };
  }
  if (!lot.width || lot.yd === null || lot.yd === undefined) {
    return { fits: false, quantity: 0, reason: 'Width or yardage not recorded' };
  }
  return estimate({ width: lot.width, yd: lot.yd, directional: lot.directional }, product, assumptions);
}
