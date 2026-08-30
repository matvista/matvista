import { describe, expect, it } from 'vitest';
import {
  BOND_LENGTH,
  chainDimensions,
  crystalDensity,
  dispersity,
  displayRange,
  histogram,
  livingDispersity,
  livingGrowth,
  numberAverageDp,
  percentCrystallinity,
  stepGrowth,
  stepGrowthDispersity,
  weightAverageDp,
  weightFractions,
} from './model';
import type { Bin } from './model';

/**
 * The two distributions exist because they have *closed-form* dispersity, so
 * the general weighted-average code can be checked against an exact answer
 * rather than against a table restated from memory. That is the whole
 * verification strategy of this module: everything below is either an analytic
 * identity or an inequality that holds for every distribution.
 */
describe('the averages, against distributions whose answers are known exactly', () => {
  it('reproduces Flory’s most-probable distribution: Xn = 1/(1−p), Đ = 1 + p', () => {
    for (const p of [0.9, 0.95, 0.98, 0.99]) {
      // Bin-free: the identity is about the distribution, not about the histogram.
      const bins: Bin[] = Array.from({ length: Math.ceil(20 / (1 - p)) }, (_, i) => ({
        dp: i + 1,
        x: (1 - p) * Math.pow(p, i),
      }));
      expect(numberAverageDp(bins), `Xn at p=${p}`).toBeCloseTo(1 / (1 - p), 4);
      expect(weightAverageDp(bins), `Xw at p=${p}`).toBeCloseTo((1 + p) / (1 - p), 3);
      expect(dispersity(bins), `Đ at p=${p}`).toBeCloseTo(stepGrowthDispersity(p), 5);
    }
  });

  it('reproduces the Poisson living-growth result: Xn = ν + 1, Đ = 1 + ν/(1+ν)²', () => {
    for (const nu of [20, 100, 500]) {
      const bins = livingGrowth(nu);
      expect(numberAverageDp(bins), `Xn at ν=${nu}`).toBeCloseTo(nu + 1, 3);
      expect(dispersity(bins), `Đ at ν=${nu}`).toBeCloseTo(livingDispersity(nu), 6);
    }
  });

  /**
   * The step-growth trap, and the reason condensation chemistry is a purity
   * problem: `Xn = 1/(1−p)` means a hundred-mer needs 99% conversion and a
   * thousand-mer needs 99.9%.
   */
  it('needs 99% conversion for a hundred-mer', () => {
    expect(numberAverageDp(stepGrowth(0.99))).toBeCloseTo(100, 0);
    expect(numberAverageDp(stepGrowth(0.999))).toBeCloseTo(1000, -1);
  });

  /**
   * The defect this module was built with, kept as a test.
   *
   * The first version binned the distribution *before* averaging it, on the
   * assumption that a histogram fine enough is the distribution. It is not,
   * for the second moment: collapsing a bar to its mean discards the variance
   * inside it, so a binned `X̄w` is biased low and the bias grows with bar
   * width. At twelve bars over p = 0.95 it read Đ = 1.81 against a true 1.95 —
   * still inside [1, 2], still monotone in p, still passing every inequality
   * in this file.
   *
   * So the bias is asserted rather than left as a comment: it must exist, it
   * must shrink as the bars narrow, and the true value must be the one the
   * bars converge towards. That is what makes `histogram` display-only.
   */
  it('is lowered by binning, which is why the averages never touch a histogram', () => {
    const dist = stepGrowth(0.95);
    const truth = stepGrowthDispersity(0.95);
    expect(dispersity(dist)).toBeCloseTo(truth, 4);

    const binned = (bars: number) =>
      dispersity(histogram(dist, bars).map((b) => ({ dp: b.dp, x: b.x })));
    expect(binned(12)).toBeLessThan(truth - 0.05);
    expect(binned(60)).toBeLessThan(truth);
    // Narrower bars, smaller bias — the ordering is the evidence that this is
    // a binning artefact rather than a different distribution.
    expect(truth - binned(60)).toBeLessThan(truth - binned(12));
    expect(truth - binned(400)).toBeLessThan(truth - binned(60));
  });

  it('draws a histogram whose two series each sum to one', () => {
    for (const dist of [stepGrowth(0.95), livingGrowth(100)]) {
      for (const bars of [12, 40]) {
        // Narrowed to the display range as well as full width: folding the
        // tail into the last bar has to conserve both series, or the plot
        // would be showing fractions of a sample it had silently shortened.
        for (const upTo of [undefined, displayRange(dist)]) {
          const h = histogram(dist, bars, upTo);
          expect(h.reduce((s, b) => s + b.x, 0)).toBeCloseTo(1, 6);
          expect(h.reduce((s, b) => s + b.w, 0)).toBeCloseTo(1, 6);
        }
      }
    }
  });

  it('draws to where the weight runs out, not to where the tail does', () => {
    const dist = stepGrowth(0.95);
    const full = dist[dist.length - 1].dp;
    const shown = displayRange(dist);
    // The summation range is several times the drawn one, and the drawn one
    // still comfortably contains the weight-average it has to show.
    expect(shown).toBeLessThan(full / 2);
    expect(shown).toBeGreaterThan(weightAverageDp(dist));
  });
});

describe('what holds for every distribution', () => {
  const samples: Bin[][] = [
    stepGrowth(0.9),
    stepGrowth(0.99),
    livingGrowth(50),
    livingGrowth(300),
    [{ dp: 10, x: 1 }, { dp: 1000, x: 1 }],
    [{ dp: 5, x: 3 }, { dp: 50, x: 1 }, { dp: 500, x: 0.1 }],
  ];

  it('never lets Xw fall below Xn', () => {
    for (const bins of samples) {
      expect(weightAverageDp(bins)).toBeGreaterThanOrEqual(numberAverageDp(bins) - 1e-9);
      expect(dispersity(bins)).toBeGreaterThanOrEqual(1 - 1e-9);
    }
  });

  it('reaches Đ = 1 only when every chain is the same length', () => {
    expect(dispersity([{ dp: 400, x: 1 }])).toBeCloseTo(1, 12);
    expect(dispersity([{ dp: 400, x: 0.3 }, { dp: 400, x: 0.7 }])).toBeCloseTo(1, 12);
    // One chain of a different length is enough to push it off 1.
    expect(dispersity([{ dp: 400, x: 0.999 }, { dp: 401, x: 0.001 }])).toBeGreaterThan(1);
  });

  it('is unchanged by scaling the counts, since the fractions are what matter', () => {
    for (const bins of samples) {
      const scaled = bins.map((b) => ({ ...b, x: b.x * 137 }));
      expect(dispersity(scaled)).toBeCloseTo(dispersity(bins), 10);
      expect(numberAverageDp(scaled)).toBeCloseTo(numberAverageDp(bins), 8);
    }
  });

  it('gives weight fractions that sum to one and outweigh the number fractions', () => {
    for (const bins of samples) {
      const w = weightFractions(bins);
      expect(w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
      // The weight histogram is the number histogram pushed towards the long
      // chains — which is the same fact as Xw ≥ Xn, seen bin by bin.
      const total = bins.reduce((s, b) => s + b.x, 0);
      const shifted = bins.reduce((s, b, i) => s + (w[i] - b.x / total) * b.dp, 0);
      expect(shifted).toBeGreaterThanOrEqual(-1e-9);
    }
  });
});

describe('chain dimensions', () => {
  /**
   * Pure geometry — a C–C bond length and a tetrahedral angle — so there is
   * nothing here to be sourced and nothing to go stale.
   */
  it('projects the zig-zag onto its own axis', () => {
    // sin(109.5°/2) = 0.8165, so each bond advances 0.1257 nm, not 0.154.
    const { contour } = chainDimensions(1);
    expect(contour).toBeCloseTo(0.154 * Math.sin((109.5 * Math.PI) / 360), 12);
    expect(contour).toBeCloseTo(0.1258, 4);
    expect(contour).toBeLessThan(BOND_LENGTH);
  });

  it('makes a 1000-mer of polyethylene 252 nm long and 6.9 nm across', () => {
    const { contour, endToEnd } = chainDimensions(2000);
    expect(contour).toBeCloseTo(251.5, 1);
    expect(endToEnd).toBeCloseTo(6.887, 3);
  });

  /**
   * The one that matters: contour grows with N and the coil with √N, so the
   * ratio between them grows without bound. A longer chain is not a longer
   * object — it is a denser tangle.
   */
  it('separates contour from coil as √N, so the ratio keeps growing', () => {
    const small = chainDimensions(200);
    const big = chainDimensions(20000);
    expect(big.contour / small.contour).toBeCloseTo(100, 6);
    expect(big.endToEnd / small.endToEnd).toBeCloseTo(10, 6);
    expect(big.contour / big.endToEnd).toBeCloseTo((small.contour / small.endToEnd) * 10, 6);
  });
});

describe('crystallinity', () => {
  it('is 0 at the amorphous density and 100 at the crystalline one', () => {
    expect(percentCrystallinity(0.87, 0.87, 0.998)).toBeCloseTo(0, 9);
    expect(percentCrystallinity(0.998, 0.87, 0.998)).toBeCloseTo(100, 9);
  });

  it('stays inside 0–100 and rises with density across the whole range', () => {
    let last = -Infinity;
    for (let rho = 0.87; rho <= 0.998001; rho += 0.001) {
      const c = percentCrystallinity(rho, 0.87, 0.998);
      expect(c).toBeGreaterThanOrEqual(-1e-9);
      expect(c).toBeLessThanOrEqual(100 + 1e-9);
      expect(c).toBeGreaterThan(last);
      last = c;
    }
  });

  /**
   * It is *not* linear interpolation, and the difference is the point of the
   * expression: the ρ_c and ρ_s outside the bracket turn a volume mixture read
   * through a mass measurement into the right answer. At the midpoint density
   * the crystalline fraction is above half, because crystal is denser and so
   * half the mass is less than half the volume.
   */
  it('is not a straight line between the two densities', () => {
    const mid = (0.87 + 0.998) / 2;
    const c = percentCrystallinity(mid, 0.87, 0.998);
    expect(c).toBeGreaterThan(50);
    expect(c).toBeCloseTo(53.4, 1);
  });

  it('derives a crystalline density with the same nA/VN_A a metal uses', () => {
    // Two ethylene units in a 0.741 × 0.494 × 0.255 nm orthorhombic cell.
    const rho = crystalDensity(2, 28.054, 0.741 * 0.494 * 0.255);
    expect(rho).toBeCloseTo(0.998, 3);
  });
});
