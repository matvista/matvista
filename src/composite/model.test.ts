import { describe, expect, it } from 'vitest';
import {
  ORIENTATIONS,
  criticalLength,
  discontinuousStrength,
  fibreLoadFraction,
  loadRatio,
  longitudinalModulus,
  longitudinalStrain,
  longitudinalStrength,
  matrixStressAtFibreFailure,
  mixtureDensity,
  orientationModulus,
  transverseModulus,
} from './model';
import type { Constituent } from './model';
import { FIBRES, MATRICES, agreement } from './materials';
import { SELECTION_MATERIALS, indexValue, INDICES } from '../selection/materials';

/**
 * Callister & Rethwisch's worked example on a continuous aligned glass-fibre
 * composite: 40 vol% glass at 69 GPa in a polyester at 3.4 GPa, then 50 MPa
 * applied to a 250 mm² section.
 *
 * The constituents are written out here rather than taken from `FIBRES` —
 * the example's 69 GPa and 3.4 GPa are the book's numbers for its own problem,
 * and Appendix B's E-glass is 72.5. Substituting the app's data would be
 * checking the model against a *different* problem and calling it agreement.
 */
const GLASS: Constituent = { name: 'glass (worked example)', modulus: 69, density: 2.5, strength: 3450 };
const POLYESTER: Constituent = { name: 'polyester (worked example)', modulus: 3.4, density: 1.25, strength: 66 };

describe('the worked example the rule of mixtures is taught with', () => {
  it('gives the longitudinal modulus the book gives', () => {
    // 3.4(0.6) + 69(0.4) = 29.6 GPa.
    expect(longitudinalModulus(GLASS, POLYESTER, 0.4)).toBeCloseTo(29.64, 2);
  });

  it('splits the load 13.5 to 1 between fibre and matrix', () => {
    expect(loadRatio(GLASS, POLYESTER, 0.4)).toBeCloseTo(13.53, 2);
    // ...and 12 500 N total lands as 11 640 N on the fibres, 860 N on the matrix.
    const total = 50 * 250;
    const fibre = total * fibreLoadFraction(GLASS, POLYESTER, 0.4);
    expect(fibre).toBeCloseTo(11640, 0);
    expect(total - fibre).toBeCloseTo(860, 0);
  });

  it('strains both phases equally, at 1.69e-3', () => {
    expect(longitudinalStrain(GLASS, POLYESTER, 0.4, 50)).toBeCloseTo(1.69e-3, 5);
  });

  it('puts the transverse modulus an order below the longitudinal one', () => {
    // 5.49 GPa against 29.6 — the anisotropy is the design problem, not a detail.
    expect(transverseModulus(GLASS, POLYESTER, 0.4)).toBeCloseTo(5.486, 3);
  });
});

describe('critical fibre length', () => {
  it('reproduces the 0.23 mm of the book’s example', () => {
    // 3450 MPa fibre, 0.010 mm filament, 75 MPa interface.
    expect(criticalLength(3450, 0.01, 75)).toBeCloseTo(0.23, 5);
  });

  it('scales with the fibre strength and the diameter, and inversely with the bond', () => {
    expect(criticalLength(6900, 0.01, 75)).toBeCloseTo(0.46, 5);
    expect(criticalLength(3450, 0.02, 75)).toBeCloseTo(0.46, 5);
    expect(criticalLength(3450, 0.01, 150)).toBeCloseTo(0.115, 5);
  });

  /**
   * The two discontinuous regimes are separate expressions and they must not
   * disagree at the boundary. Below l_c the shear transfer sets the ceiling;
   * above it the fibre reaches its strength over all but its ends. At exactly
   * l_c both reduce to half the fibre's contribution, and a step here would
   * put a discontinuity in the middle of a slider.
   */
  it('meets itself at l = l_c', () => {
    const f = FIBRES[0];
    const m = MATRICES[0];
    const lc = criticalLength(f.strength, f.diameter, 75);
    const gapAt = (eps: number): number => {
      const below = discontinuousStrength(f, m, 0.4, lc * (1 - eps), f.diameter, 75);
      const above = discontinuousStrength(f, m, 0.4, lc * (1 + eps), f.diameter, 75);
      expect(below.regime).toBe('below');
      expect(above.regime).toBe('above');
      return Math.abs(below.strength / above.strength - 1);
    };

    // Probed either side of l_c, the two branches differ by *the probe*: the
    // gap shrinks in proportion to ε. A real step would not — it would sit
    // there unchanged as ε fell, which is what distinguishes the two and what
    // a fixed tolerance at one ε could not tell apart.
    expect(gapAt(1e-6)).toBeLessThan(1e-5);
    expect(gapAt(1e-9)).toBeLessThan(1e-8);
    expect(gapAt(1e-9)).toBeLessThan(gapAt(1e-6) / 100);
  });

  it('never reaches the continuous strength, and approaches it from below', () => {
    const f = FIBRES[0];
    const m = MATRICES[0];
    const continuous = longitudinalStrength(f, m, 0.4);
    const lc = criticalLength(f.strength, f.diameter, 75);
    const at10 = discontinuousStrength(f, m, 0.4, 10 * lc, f.diameter, 75).strength;
    const at1000 = discontinuousStrength(f, m, 0.4, 1000 * lc, f.diameter, 75).strength;
    expect(at10).toBeLessThan(continuous);
    expect(at1000).toBeLessThan(continuous);
    expect(at1000).toBeGreaterThan(at10);
    expect(at1000 / continuous).toBeGreaterThan(0.999);
  });
});

describe('the bounds are bounds', () => {
  const cases = FIBRES.flatMap((f) => MATRICES.map((m) => [f, m] as const));

  it('brackets every constituent pair at every volume fraction', () => {
    for (const [f, m] of cases) {
      for (let vf = 0; vf <= 1.0001; vf += 0.01) {
        const upper = longitudinalModulus(f, m, vf);
        const lower = transverseModulus(f, m, vf);
        expect(lower).toBeLessThanOrEqual(upper + 1e-9);
      }
    }
  });

  it('meets at both ends, where there is only one phase left', () => {
    for (const [f, m] of cases) {
      expect(transverseModulus(f, m, 0)).toBeCloseTo(m.modulus, 9);
      expect(longitudinalModulus(f, m, 0)).toBeCloseTo(m.modulus, 9);
      expect(transverseModulus(f, m, 1)).toBeCloseTo(f.modulus, 9);
      expect(longitudinalModulus(f, m, 1)).toBeCloseTo(f.modulus, 9);
    }
  });

  it('is monotone in the fibre fraction, both bounds', () => {
    for (const [f, m] of cases) {
      let lastUp = -Infinity;
      let lastLow = -Infinity;
      for (let vf = 0; vf <= 1.0001; vf += 0.01) {
        const up = longitudinalModulus(f, m, vf);
        const low = transverseModulus(f, m, vf);
        expect(up).toBeGreaterThanOrEqual(lastUp - 1e-9);
        expect(low).toBeGreaterThanOrEqual(lastLow - 1e-9);
        lastUp = up;
        lastLow = low;
      }
    }
  });

  it('ranks the orientation factors, and aligned is the only one that is 1', () => {
    const f = FIBRES[1];
    const m = MATRICES[0];
    const [aligned, plane, space] = ORIENTATIONS.map((o) => orientationModulus(f, m, 0.4, o.k));
    expect(aligned).toBeGreaterThan(plane);
    expect(plane).toBeGreaterThan(space);
    expect(aligned).toBeCloseTo(longitudinalModulus(f, m, 0.4), 9);
    expect(ORIENTATIONS.filter((o) => o.k === 1)).toHaveLength(1);
  });
});

describe('the matrix stress the strength rule needs is not the matrix strength', () => {
  it('is E_m times the fibre’s failure strain, while the matrix survives it', () => {
    // A stiff matrix and a low-strain fibre: 0.5% strain, well inside epoxy.
    const brittle: Constituent = { name: 'x', modulus: 200, density: 2, strength: 1000 };
    const m = MATRICES[0];
    const r = matrixStressAtFibreFailure(brittle, m);
    expect(r.fibreFailureStrain).toBeCloseTo(0.005, 6);
    expect(r.matrixFailsFirst).toBe(false);
    expect(r.stress).toBeCloseTo(m.modulus * 1000 * 0.005, 6);
  });

  it('caps at the matrix strength, and says so, when the fibre outlasts it', () => {
    // E-glass fails at 3450/72500 = 4.8% strain. Epoxy does not get there.
    const r = matrixStressAtFibreFailure(FIBRES[0], MATRICES[0]);
    expect(r.fibreFailureStrain).toBeCloseTo(0.0476, 4);
    expect(r.matrixFailsFirst).toBe(true);
    expect(r.stress).toBe(MATRICES[0].strength);
  });
});

/**
 * The cross-dataset check, and the reason this module was built first.
 *
 * Appendix B carries the three bare fibres *and* the three measured
 * composites made from them at Vf = 0.60. Those are independent rows of a
 * published table; the model links them. So the mixtures are checked against
 * the app's own data rather than against a number restated from memory, and
 * the two disagreements are as informative as the agreements.
 */
describe('the mixtures against Appendix B’s own measured composites', () => {
  it('predicts the modulus of all three within 5%', () => {
    for (const a of agreement()) {
      expect(Math.abs(a.modulus.ratio - 1), `${a.name} modulus`).toBeLessThan(0.05);
    }
  });

  it('predicts the density of all three within 3%', () => {
    for (const a of agreement()) {
      expect(Math.abs(a.density.ratio - 1), `${a.name} density`).toBeLessThan(0.03);
    }
  });

  /**
   * And the one that does not agree, asserted as the overprediction it is.
   *
   * Every one of the three overshoots, by between 1.5× and 2.2×, because the
   * `σ*_f` the rule of mixtures wants is the fibre strength *in the composite*
   * and Appendix B's is a pristine filament. Bounding it in both directions is
   * the point: a one-sided check would keep passing if the gap grew, and a
   * model that started *under*predicting would mean the caveat on screen had
   * become wrong in the other direction.
   */
  it('overshoots the strength of all three, every time, by 1.5× to 2.2×', () => {
    for (const a of agreement()) {
      expect(a.strength.ratio, `${a.name} strength`).toBeGreaterThan(1.5);
      expect(a.strength.ratio, `${a.name} strength`).toBeLessThan(2.2);
    }
  });
});

/**
 * The loop into the Ashby module: a composite specified here is a point among
 * the 54, ranked by the same `indexValue` the chart's guide line uses.
 */
describe('a specified composite is an Ashby point', () => {
  it('beats every metal in the set on E^½/ρ', () => {
    const f = FIBRES.find((x) => x.id === 'carbon')!;
    const m = MATRICES.find((x) => x.id === 'epoxy')!;
    const idx = INDICES.find((i) => i.id === 'e12-rho')!;
    const built = {
      name: 'carbon–epoxy, as specified',
      cls: 'composite' as const,
      density: mixtureDensity(f, m, 0.6),
      modulus: longitudinalModulus(f, m, 0.6),
      strength: longitudinalStrength(f, m, 0.6),
    };
    const mine = indexValue(built, idx);
    for (const other of SELECTION_MATERIALS.filter((x) => x.cls === 'metal')) {
      expect(mine, `beaten by ${other.name}`).toBeGreaterThan(indexValue(other, idx));
    }
  });

  it('lands on the tabulated composite it is a model of', () => {
    // Not a tautology: `built` comes from the two *fibre* rows and the epoxy
    // row, and is compared with the separate composite row.
    const f = FIBRES.find((x) => x.id === 'e-glass')!;
    const m = MATRICES.find((x) => x.id === 'epoxy')!;
    const idx = INDICES.find((i) => i.id === 'e12-rho')!;
    const tabulated = SELECTION_MATERIALS.find((x) => x.name === 'E-glass–epoxy (longitudinal)')!;
    const built = {
      name: 'built',
      cls: 'composite' as const,
      density: mixtureDensity(f, m, 0.6),
      modulus: longitudinalModulus(f, m, 0.6),
      strength: tabulated.strength,
    };
    expect(indexValue(built, idx) / indexValue(tabulated, idx)).toBeCloseTo(1, 1);
  });
});
