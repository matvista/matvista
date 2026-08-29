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

/**
 * A8 — where the index comes from.
 *
 * Students memorise "E^⅓/ρ for panels" without knowing why the exponent
 * changes, and cannot derive an index for a function that is not on the list —
 * which is precisely what an exam asks. Every index here is one method applied
 * to a different section:
 *
 *   objective   mass goes as x^p
 *   constraint  the constrained property goes as x^q
 *   eliminate   x ∝ P^(−1/q), so mass ∝ ρ·P^(−p/q)
 *   ⟹ maximise P^(p/q)/ρ, and the exponent is p/q.
 *
 * The exponent is therefore not five remembered numbers but one ratio.
 */
describe('index derivations', () => {
  it('gives every index a complete derivation', () => {
    for (const idx of INDICES) {
      const d = idx.derivation;
      expect(d.functionName.length).toBeGreaterThan(0);
      expect(d.objective.length).toBeGreaterThan(0);
      expect(d.constraint.length).toBeGreaterThan(0);
      expect(d.freeVar.length).toBeGreaterThan(0);
      expect(d.steps.length).toBeGreaterThan(0);
      expect(d.massPower).toBeGreaterThan(0);
      expect(d.constraintPower).toBeGreaterThan(0);
    }
  });

  /**
   * The claim the whole panel rests on. If the stated exponent were not the
   * ratio of the two powers, the derivation on screen would not produce the
   * index beside it.
   */
  it.each(INDICES.map((i) => i.id))('%s: the exponent is massPower / constraintPower', (id) => {
    const idx = INDICES.find((i) => i.id === id)!;
    expect(idx.derivation.massPower / idx.derivation.constraintPower).toBeCloseTo(idx.exponent, 12);
  });

  /**
   * The elimination itself, done numerically rather than restated. Solve the
   * constraint for the free variable, put it back into the mass, and the
   * result must be proportional to 1/`indexValue` — the shipped function.
   */
  it.each(INDICES.map((i) => i.id))('%s: eliminating the free variable gives the index', (id) => {
    const idx = INDICES.find((i) => i.id === id)!;
    const { massPower: p, constraintPower: q } = idx.derivation;
    for (const P of [1, 10, 100, 500]) {
      // The constraint fixes x^q ∝ 1/P …
      const x = P ** (-1 / q);
      // … and the mass goes as ρ·x^p, taken at ρ = 1.
      const mass = x ** p;
      expect(1 / mass).toBeCloseTo(P ** idx.exponent, 9);
    }
  });

  /** And against `indexValue`, which is what the chart and the ranking use. */
  it.each(INDICES.map((i) => i.id))('%s: mass ∝ 1/index for a real material', (id) => {
    const idx = INDICES.find((i) => i.id === id)!;
    const { massPower: p, constraintPower: q } = idx.derivation;
    for (const m of SELECTION_MATERIALS.slice(0, 12)) {
      const P = idx.property === 'modulus' ? m.modulus : m.strength;
      const mass = m.density * (P ** (-1 / q)) ** p;
      expect(mass * indexValue(m, idx)).toBeCloseTo(1, 9);
    }
  });

  /**
   * The five memorised exponents, each shown to be one ratio of section
   * powers. This is the table a student is otherwise asked to remember.
   */
  it('recovers the five textbook exponents from section geometry alone', () => {
    const EXPECTED: Record<string, [number, number, number]> = {
      // id: [mass power, constraint power, exponent]
      'e-rho': [1, 1, 1], // tie: mass ∝ A, stiffness ∝ A
      'e12-rho': [2, 4, 0.5], // square beam: mass ∝ b², EI ∝ b⁴
      'e13-rho': [1, 3, 1 / 3], // panel: mass ∝ t, EI ∝ t³
      's-rho': [1, 1, 1], // tie: mass ∝ A, load ∝ A
      's23-rho': [2, 3, 2 / 3], // square beam: mass ∝ b², moment ∝ b³
    };
    expect(Object.keys(EXPECTED).sort()).toEqual(INDICES.map((i) => i.id).sort());
    for (const idx of INDICES) {
      const [p, q, a] = EXPECTED[idx.id];
      expect(idx.derivation.massPower).toBe(p);
      expect(idx.derivation.constraintPower).toBe(q);
      expect(idx.exponent).toBeCloseTo(a, 12);
      expect(idx.slope).toBeCloseTo(q / p, 12);
    }
  });

  /**
   * The log–log slope the code comments already state and the UI never showed:
   * a line of constant M = P^a/ρ has slope 1/a. Checked by construction — two
   * materials on one guide line must have the same index.
   */
  it.each(INDICES.map((i) => i.id))('%s: the guide-line slope really is iso-index', (id) => {
    const idx = INDICES.find((i) => i.id === id)!;
    const rho1 = 1;
    const P1 = 100;
    for (const rho2 of [2, 5, 0.4]) {
      // Move along a line of slope 1/exponent in (log ρ, log P).
      const P2 = P1 * (rho2 / rho1) ** idx.slope;
      const m1 = { density: rho1, modulus: P1, strength: P1 } as (typeof SELECTION_MATERIALS)[0];
      const m2 = { density: rho2, modulus: P2, strength: P2 } as (typeof SELECTION_MATERIALS)[0];
      expect(indexValue(m2, idx)).toBeCloseTo(indexValue(m1, idx), 9);
    }
  });
});

