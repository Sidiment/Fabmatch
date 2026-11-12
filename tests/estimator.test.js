import { describe, it, expect } from 'vitest';
import { PRODUCTS, estimate, estimatePieces, layout, mergeAssumptions, findProduct, gridCount, DEFAULT_ASSUMPTIONS } from '../src/lib/estimator.js';

const lot = { width: 54, yd: 42, directional: false };
const p12 = findProduct('pillow-12x17');
const p18 = findProduct('pillow-18x18');
const panel48 = findProduct('art-panel-24x48');

describe('estimate (hand checks from 06-Yardage-Estimates/test.js)', () => {
  it('gives 71 covers at 18 x 18 in and 150 at 12 x 17 in for a 42 yd, 54 in lot', () => {
    expect(estimate(lot, p18).quantity).toBe(71);
    expect(estimate(lot, p12).quantity).toBe(150);
  });
  it('gives 25 panels at 24 x 48 in and 8 triptychs', () => {
    expect(estimate(lot, panel48).quantity).toBe(25);
    expect(estimate(lot, findProduct('art-triptych-3x24x48')).quantity).toBe(8);
  });
  it('does not turn a directional fabric and still fits 150 lumbar covers', () => {
    expect(estimate({ ...lot, directional: true }, p12).quantity).toBe(150);
  });
  it('reports a product that is too wide as not fitting with a reason', () => {
    const r = estimate({ width: 30, yd: 42 }, panel48);
    expect(r.fits).toBe(false);
    expect(r.reason).toMatch(/wider than the 28.0 in usable width/);
    expect(estimate({ width: 36, yd: 42 }, panel48).fits).toBe(true);
  });
  it('adds separate pieces instead of joining them', () => {
    const two = estimate({ width: 54, pieces: [10, 10] }, p18).quantity;
    const one = estimate({ width: 54, yd: 20 }, p18).quantity;
    expect(two).toBeLessThanOrEqual(one);
    expect(estimate({ width: 54, pieces: [10, 10] }, p18).totalYards).toBe(20);
  });
  it('Method B uses the recorded width and fits 2 across on a 39 in fabric', () => {
    expect(estimate({ width: 39, yd: 42 }, p18).quantity).toBe(35);
    expect(estimate({ width: 39, yd: 42 }, p18, { method: 'B' }).quantity).toBe(71);
    expect(estimate(lot, p18, { method: 'b' }).usableWidth).toBe(54);
  });
  it('returns yards per unit and keeps the plan immutable from inputs', () => {
    const r = estimate(lot, p18);
    expect(r.yardsPerUnit).toBeCloseTo(0.53, 1);
    expect(r.plan[0]).toMatchObject({ across: 2, count: 2, rotated: false });
    expect(lot).toEqual({ width: 54, yd: 42, directional: false });
  });
  it('returns zero quantity and a null yards-per-unit for a lot with no usable yardage', () => {
    const r = estimate({ width: 54, yd: 0 }, p18);
    expect(r.quantity).toBe(0);
    expect(r.yardsPerUnit).toBeNull();
  });
});

describe('mergeAssumptions', () => {
  it('fills defaults, coerces numbers, and normalizes the method', () => {
    expect(mergeAssumptions()).toEqual(DEFAULT_ASSUMPTIONS);
    expect(mergeAssumptions({ seam: '1', method: 'x', unknown: 9 })).toMatchObject({ seam: 1, method: 'A' });
    expect(mergeAssumptions({ selvage: null, cutLoss: undefined })).toEqual(DEFAULT_ASSUMPTIONS);
  });
  it('does not mutate the defaults', () => {
    const before = { ...DEFAULT_ASSUMPTIONS };
    mergeAssumptions({ seam: 2 });
    expect(DEFAULT_ASSUMPTIONS).toEqual(before);
  });
});

describe('layout and gridCount', () => {
  it('turns a non-directional piece when that uses less length', () => {
    expect(layout({ w: 30, h: 42 }, 52, false)).toMatchObject({ rotated: true, n: 1 });
    expect(layout({ w: 30, h: 42 }, 52, true)).toMatchObject({ rotated: false, n: 1 });
    expect(layout({ w: 60, h: 60 }, 52, false)).toBeNull();
  });
  it('counts panels from a measured piece, turned when allowed', () => {
    expect(gridCount(24, 40, 13, 18, true)).toBe(2);
    expect(gridCount(24, 40, 13, 18, false)).toBe(3);
  });
});

describe('estimatePieces (piece mode)', () => {
  it('needs two 27 x 27 in pieces for one 18 x 18 in cover', () => {
    expect(estimatePieces([{ w: 27, h: 27, qty: 1 }], p18).quantity).toBe(0);
    expect(estimatePieces([{ w: 27, h: 27, qty: 2 }], p18).quantity).toBe(1);
  });
  it('gives one 12 x 17 in cover per 27 x 27 in piece and applies edge trim', () => {
    expect(estimatePieces([{ w: 27, h: 27 }], p12).quantity).toBe(1);
    expect(estimatePieces([{ w: 27, h: 27 }], p12, { pieceTrim: 1 }).panels[0].panelsFromLot).toBe(1);
  });
  it('lists the six products with placeholders flagged', () => {
    expect(PRODUCTS).toHaveLength(6);
    expect(PRODUCTS.filter((p) => p.placeholder)).toHaveLength(4);
    expect(findProduct('nope')).toBeNull();
  });
});
