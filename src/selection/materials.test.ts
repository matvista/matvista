import { describe, expect, it } from 'vitest';
import { INDICES, SELECTION_MATERIALS, indexValue } from './materials';

describe('performance indices', () => {
  it('sets the guide-line slope to 1/exponent, or the line is not iso-index', () => {
    for (const idx of INDICES) expect(idx.slope).toBeCloseTo(1 / idx.exponent, 9);
  });

  it('covers exactly the two plotted properties', () => {
    expect([...new Set(INDICES.map((i) => i.property))].sort()).toEqual(['modulus', 'strength']);
  });

  /**
   * The chart selects materials in log space, but the ranking beside it uses
   * P^a/ρ. Those must agree, or the highlighted set and the list disagree.
   */
  it.each(INDICES.map((i) => i.id))('%s: the guide line selects exactly the top-N by index', (id) => {
    const idx = INDICES.find((i) => i.id === id)!;
    const values = SELECTION_MATERIALS.map(
      (m) => Math.log10(idx.property === 'modulus' ? m.modulus : m.strength) - idx.slope * Math.log10(m.density),
    );
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    for (const frac of [0.2, 0.5, 0.82, 0.95]) {
      const c = lo + (hi - lo) * frac;
      const passing = SELECTION_MATERIALS.filter((_, i) => values[i] >= c);
      const ranked = [...SELECTION_MATERIALS].sort((a, b) => indexValue(b, idx) - indexValue(a, idx));
      const topN = new Set(ranked.slice(0, passing.length).map((m) => m.name));
      for (const m of passing) expect(topN.has(m.name)).toBe(true);
    }
  });
});

describe('material data', () => {
  it('has positive density, modulus and strength throughout', () => {
    for (const m of SELECTION_MATERIALS) {
      expect(m.density).toBeGreaterThan(0);
      expect(m.modulus).toBeGreaterThan(0);
      expect(m.strength).toBeGreaterThan(0);
    }
  });

  it('keeps every material inside the chart’s fixed axes', () => {
    for (const m of SELECTION_MATERIALS) {
      expect(m.density).toBeGreaterThanOrEqual(0.3);
      expect(m.density).toBeLessThanOrEqual(30);
      expect(m.modulus).toBeGreaterThanOrEqual(0.001);
      expect(m.modulus).toBeLessThanOrEqual(1200);
      expect(m.strength).toBeGreaterThanOrEqual(10);
      expect(m.strength).toBeLessThanOrEqual(5000);
    }
  });
});
