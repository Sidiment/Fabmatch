/**
 * Fabmatch yardage estimator (ES module port of 06-Yardage-Estimates/yardage-estimator.js).
 * Estimates how many units of a product a lot of remnant fabric can supply.
 * All dimensions are in inches. Yardage is converted at 36 inches per yard.
 * Product sizes other than the 12 x 17 and 18 x 18 pillows are placeholders to be confirmed.
 * Default allowances are assumptions to be confirmed with workrooms.
 */
import assumptionsJson from '../data/assumptions.json';

const INCHES_PER_YARD = 36;
const EPSILON = 1e-9;
const MAX_UNITS = 100000;

export const DEFAULT_ASSUMPTIONS = Object.freeze({
  method: assumptionsJson.method,
  selvage: assumptionsJson.selvage,
  seam: assumptionsJson.seam,
  wrap: assumptionsJson.wrap,
  cutLoss: assumptionsJson.cutLoss,
  repeat: assumptionsJson.repeat,
});

const pillow = (w, h) => ({
  id: `pillow-${w}x${h}`,
  name: `${w} x ${h} in pillow cover`,
  unit: 'pillow covers',
  placeholder: false,
  pieces: (a) => [{ label: 'Front and back panels', w: w + 2 * a.seam, h: h + 2 * a.seam, count: 2 }],
});

const panel = (w, h) => ({
  id: `art-panel-${w}x${h}`,
  name: `${w} x ${h} in stretched art panel`,
  unit: 'panels',
  placeholder: true,
  pieces: (a) => [{ label: 'Stretched panel', w: w + 2 * a.wrap, h: h + 2 * a.wrap, count: 1 }],
});

const triptych = (w, h) => ({
  id: `art-triptych-3x${w}x${h}`,
  name: `Triptych, three ${w} x ${h} in panels`,
  unit: 'triptychs',
  placeholder: true,
  pieces: (a) => [{ label: 'Stretched panels', w: w + 2 * a.wrap, h: h + 2 * a.wrap, count: 3 }],
});

const bolster = (d, len) => ({
  id: `bolster-${d}x${len}`,
  name: `${d} in diameter x ${len} in bolster cover`,
  unit: 'bolster covers',
  placeholder: true,
  pieces: (a) => [
    { label: 'Body', w: len + 2 * a.seam, h: Math.PI * d + 2 * a.seam, count: 1 },
    { label: 'End caps', w: d + 2 * a.seam, h: d + 2 * a.seam, count: 2 },
  ],
});

export const PRODUCTS = Object.freeze([
  pillow(12, 17), pillow(18, 18),
  panel(24, 36), panel(24, 48), triptych(24, 48),
  bolster(8, 24),
]);

export function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

/** Returns a new assumptions object with defaults filled in and the method normalized. */
export function mergeAssumptions(overrides) {
  const merged = { ...DEFAULT_ASSUMPTIONS };
  Object.entries(overrides || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'method') merged.method = String(value).toUpperCase();
    else if (key in DEFAULT_ASSUMPTIONS) merged[key] = Number(value);
  });
  if (merged.method !== 'B') merged.method = 'A';
  return merged;
}

/** Best way to place one piece on the usable width. Returns null when it does not fit. */
export function layout(piece, usableWidth, directional) {
  const options = [{ across: piece.w, row: piece.h, rotated: false }];
  if (!directional) options.push({ across: piece.h, row: piece.w, rotated: true });
  return options.reduce((best, option) => {
    const n = Math.floor(usableWidth / option.across + EPSILON);
    if (n < 1) return best;
    const lengthPerPiece = option.row / n;
    if (best && best.lengthPerPiece <= lengthPerPiece) return best;
    return { n, across: option.across, row: option.row, rotated: option.rotated, lengthPerPiece };
  }, null);
}

export function usableWidthFor(width, assumptions) {
  return assumptions.method === 'B' ? width : width - 2 * assumptions.selvage;
}

function buildPlan(parts, usableWidth, directional) {
  const plan = [];
  for (const part of parts) {
    const placed = layout(part, usableWidth, directional);
    if (!placed) {
      return { plan: null, reason: `${part.label} is wider than the ${usableWidth.toFixed(1)} in usable width` };
    }
    plan.push({
      label: part.label, cutWidth: part.w, cutLength: part.h, count: part.count,
      across: placed.n, row: placed.row, rotated: placed.rotated,
    });
  }
  return { plan, reason: null };
}

function lengthNeeded(plan, quantity, repeat) {
  return plan.reduce((total, step) => {
    const rows = Math.ceil((quantity * step.count) / step.across - EPSILON);
    return total + rows * (step.row + repeat);
  }, 0);
}

function largestQuantityThatFits(plan, availableLength, repeat) {
  let lo = 0;
  let hi = MAX_UNITS;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (lengthNeeded(plan, mid, repeat) <= availableLength + EPSILON) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * lot: { width: in, yd: number | pieces: [yd, ...], directional: bool }
 * Returns { fits, quantity, usableWidth, plan, yardsPerUnit, totalYards, assumptions } or { fits: false, reason }.
 */
export function estimate(lot, product, assumptions) {
  const a = mergeAssumptions(assumptions);
  const usableWidth = usableWidthFor(lot.width, a);
  const rolls = lot.pieces || [lot.yd];
  const { plan, reason } = buildPlan(product.pieces(a), usableWidth, Boolean(lot.directional));
  if (!plan) return { fits: false, reason, quantity: 0, usableWidth };

  const perRoll = rolls.map((yd) => {
    const available = yd * INCHES_PER_YARD * (1 - a.cutLoss / 100);
    const quantity = largestQuantityThatFits(plan, available, a.repeat);
    return { quantity, usedLength: lengthNeeded(plan, quantity, a.repeat) };
  });
  const quantity = perRoll.reduce((s, r) => s + r.quantity, 0);
  const usedLength = perRoll.reduce((s, r) => s + r.usedLength, 0);

  return {
    fits: true,
    quantity,
    usableWidth,
    plan,
    yardsPerUnit: quantity ? usedLength / quantity / INCHES_PER_YARD : null,
    totalYards: rolls.reduce((s, y) => s + y, 0),
    assumptions: a,
  };
}

/** Panels of cut size cw x ch that a measured piece w x h yields, turned if the fabric is not directional. */
export function gridCount(w, h, cw, ch, directional) {
  const upright = Math.floor(w / cw + EPSILON) * Math.floor(h / ch + EPSILON);
  if (directional) return upright;
  const turned = Math.floor(w / ch + EPSILON) * Math.floor(h / cw + EPSILON);
  return Math.max(upright, turned);
}

/** Piece mode: a lot made of measured remnant pieces. pieces: [{ w, h, qty, directional }]. */
export function estimatePieces(pieces, product, assumptions) {
  const a = mergeAssumptions(assumptions);
  const trim = Number((assumptions && assumptions.pieceTrim) || 0);
  const parts = product.pieces(a);
  const panels = parts.map((part) => pieces.reduce((sum, p) => {
    const w = p.w - 2 * trim;
    const h = p.h - 2 * trim;
    return sum + (p.qty || 1) * gridCount(w, h, part.w, part.h, Boolean(p.directional));
  }, 0));
  const units = parts.reduce((min, part, i) => Math.min(min, Math.floor(panels[i] / part.count + EPSILON)), Infinity);
  return {
    quantity: units === Infinity ? 0 : units,
    panels: parts.map((part, i) => ({
      label: part.label, cutWidth: part.w, cutLength: part.h, panelsFromLot: panels[i], perUnit: part.count,
    })),
  };
}
