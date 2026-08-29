import { describe, expect, it } from 'vitest';
import {
  INDEX_CEILING, XRD_SAMPLES, XRD_SOURCES, braggIndexBound, computePattern, familyLabel,
  formatIntensity, isAllowed, latticeParameter, multiplicity, structureFactorSquared,
} from './diffraction';

/**
 * The module's own doc comment claims specific peak positions against
 * literature. Those claims are the test.
 */
describe('powder pattern positions', () => {
  const cuKa = 0.15406;

  it('reproduces copper’s first four lines (literature 43.3, 50.4, 74.1, 90.0°)', () => {
    const cu = XRD_SAMPLES.find((s) => s.id === 'cu')!;
    const peaks = computePattern(cu.lattice, cu.a, cuKa);
    const first4 = peaks.slice(0, 4).map((p) => Number(p.twoTheta.toFixed(2)));
    expect(first4).toEqual([43.32, 50.45, 74.13, 89.95]);
    // and they are the FCC sequence 111, 200, 220, 311
    expect(peaks.slice(0, 4).map((p) => `${p.h}${p.k}${p.l}`)).toEqual(['111', '200', '220', '311']);
  });

  it('puts silicon’s (111) at 28.44°', () => {
    const si = XRD_SAMPLES.find((s) => s.id === 'si')!;
    const peaks = computePattern(si.lattice, si.a, cuKa);
    expect(Number(peaks[0].twoTheta.toFixed(2))).toBe(28.44);
    expect(`${peaks[0].h}${peaks[0].k}${peaks[0].l}`).toBe('111');
  });

  it('opens BCC on 110, not 111 — the module’s stated eyeball test', () => {
    const fe = XRD_SAMPLES.find((s) => s.id === 'fe')!;
    const peaks = computePattern(fe.lattice, fe.a, cuKa);
    expect(`${peaks[0].h}${peaks[0].k}${peaks[0].l}`).toBe('110');
  });

  it('keeps copper’s (111) the strongest line', () => {
    const cu = XRD_SAMPLES.find((s) => s.id === 'cu')!;
    const peaks = computePattern(cu.lattice, cu.a, cuKa);
    const strongest = peaks.reduce((a, b) => (b.intensity > a.intensity ? b : a));
    expect(`${strongest.h}${strongest.k}${strongest.l}`).toBe('111');
    expect(strongest.intensity).toBeCloseTo(100, 6);
  });
});

describe('reflection rules', () => {
  it('BCC allows h+k+l even only', () => {
    expect(isAllowed('bcc', 1, 1, 0)).toBe(true);
    expect(isAllowed('bcc', 1, 0, 0)).toBe(false);
    expect(isAllowed('bcc', 1, 1, 1)).toBe(false);
  });
  it('FCC allows all-odd or all-even only', () => {
    expect(isAllowed('fcc', 1, 1, 1)).toBe(true);
    expect(isAllowed('fcc', 2, 0, 0)).toBe(true);
    expect(isAllowed('fcc', 1, 1, 0)).toBe(false);
  });
  it('diamond additionally kills all-even unless h+k+l ≡ 0 mod 4', () => {
    expect(isAllowed('diamond', 2, 0, 0)).toBe(false); // sum 2
    expect(isAllowed('diamond', 2, 2, 2)).toBe(false); // sum 6
    expect(isAllowed('diamond', 2, 2, 0)).toBe(true); // sum 4
    expect(isAllowed('diamond', 1, 1, 1)).toBe(true);
  });
  it('simple cubic allows everything', () => {
    expect(isAllowed('sc', 1, 0, 0)).toBe(true);
    expect(isAllowed('sc', 2, 1, 0)).toBe(true);
  });
  it('silicon shows no 200 or 222 line', () => {
    const si = XRD_SAMPLES.find((s) => s.id === 'si')!;
    const fams = computePattern(si.lattice, si.a, 0.15406).map((p) => `${p.h}${p.k}${p.l}`);
    expect(fams).not.toContain('200');
    expect(fams).not.toContain('222');
  });
});

describe('multiplicity is the count of distinct signed permutations', () => {
  it.each([
    [[1, 0, 0], 6],
    [[1, 1, 0], 12],
    [[1, 1, 1], 8],
    [[2, 1, 0], 24],
    [[3, 2, 1], 48],
    [[2, 2, 1], 24],
  ])('{%s} has %i members', (hkl, expected) => {
    expect(multiplicity(hkl[0], hkl[1], hkl[2])).toBe(expected);
  });
});

describe('structure factors', () => {
  it('gives |F|² of 4f² for BCC and 16f² for FCC', () => {
    expect(structureFactorSquared('bcc', 1, 1, 0)).toBe(4);
    expect(structureFactorSquared('fcc', 1, 1, 1)).toBe(16);
  });
  it('gives 32f² for diamond all-odd and 64f² for the surviving all-even', () => {
    expect(structureFactorSquared('diamond', 1, 1, 1)).toBe(32);
    expect(structureFactorSquared('diamond', 2, 2, 0)).toBe(64);
  });
});

describe('lattice parameters from atomic radius', () => {
  it('follows the Callister ch. 3 relations', () => {
    expect(latticeParameter('fcc', 0.1278)).toBeCloseTo(2 * 0.1278 * Math.SQRT2, 12);
    expect(latticeParameter('bcc', 0.1241)).toBeCloseTo((4 * 0.1241) / Math.sqrt(3), 12);
    expect(latticeParameter('sc', 0.168)).toBeCloseTo(0.336, 12);
    expect(latticeParameter('diamond', 0.1)).toBeCloseTo(0.8 / Math.sqrt(3), 12);
  });
});

describe('domain guard', () => {
  it('every shipped sample is cubic, because dSpacing is the cubic formula', () => {
    for (const s of XRD_SAMPLES) {
      expect(['sc', 'bcc', 'fcc', 'diamond']).toContain(s.lattice);
    }
  });
  it('every source has a positive wavelength', () => {
    for (const s of XRD_SOURCES) expect(s.lambda).toBeGreaterThan(0);
  });
  it('peaks come out sorted and normalised to 100', () => {
    for (const s of XRD_SAMPLES) {
      const peaks = computePattern(s.lattice, s.a, 0.15406);
      expect(peaks.length).toBeGreaterThan(0);
      for (let i = 1; i < peaks.length; i++) {
        expect(peaks[i].twoTheta).toBeGreaterThanOrEqual(peaks[i - 1].twoTheta);
      }
      expect(Math.max(...peaks.map((p) => p.intensity))).toBeCloseTo(100, 6);
    }
  });
});

/**
 * The reachable reflection index is set by the Bragg limit, not by a constant.
 * d = a/√(h²+k²+l²) and sin θ = λ/2d ≤ 1 together give
 *
 *     √(h²+k²+l²) ≤ 2a/λ,
 *
 * so no index can exceed 2a/λ. A fixed cap truncates the pattern whenever
 * 2a/λ runs past it — measured: silicon (a = 0.5431 nm) with Mo Kα
 * (λ = 0.07107 nm) has 2a/λ ≈ 15.3, so a cap of 8 silently drops 41 of its
 * 79 lines.
 */
describe('the pattern is bounded by Bragg, not by a fixed index cap', () => {
  /**
   * A second enumeration, used as the oracle for completeness.
   *
   * **What it does and does not check.** It shares `isAllowed` with the module
   * under test and repeats the same cubic d-spacing and the same
   * one-representative-per-family rule, so it cannot catch an error in the
   * reflection conditions or in d = a/√(h²+k²+l²). What it is independent of
   * is the thing that was wrong: the *bound*. It sweeps well past any index
   * either the old constant or the new bound would reach and lets the physical
   * filters (sinθ ≤ 1, 2θ ≤ max) decide what survives.
   *
   * Its own limit is derived from the Bragg reach rather than hardcoded —
   * hardcoding it would reintroduce, in the test, exactly the defect being
   * fixed in the source — with slack on top, and `notBinding` below asserts
   * the slack was never needed.
   */
  function bruteForceFamilies(
    lattice: 'sc' | 'bcc' | 'fcc' | 'diamond',
    a: number,
    lambda: number,
    maxTwoTheta = 140,
  ): Set<string> {
    // √(h²+k²+l²) ≤ 2a/λ bounds every index; +6 is slack the oracle proves
    // it never uses.
    const BRUTE_INDEX = Math.ceil((2 * a) / lambda) + 6;
    const fams = new Set<string>();
    for (let h = 0; h <= BRUTE_INDEX; h++) {
      for (let k = 0; k <= h; k++) {
        for (let l = 0; l <= k; l++) {
          if (h + k + l === 0) continue;
          if (!isAllowed(lattice, h, k, l)) continue;
          const d = a / Math.sqrt(h * h + k * k + l * l);
          const sinTheta = lambda / (2 * d);
          if (sinTheta > 1) continue;
          const twoTheta = (2 * Math.asin(sinTheta) * 180) / Math.PI;
          if (twoTheta > maxTwoTheta) continue;
          fams.add(`${h},${k},${l}`);
        }
      }
    }
    return fams;
  }

  for (const sample of XRD_SAMPLES) {
    for (const source of XRD_SOURCES) {
      it(`${sample.id} × ${source.id}: every Bragg-reachable family is returned`, () => {
        const peaks = computePattern(sample.lattice, sample.a, source.lambda);
        const keys = peaks.map((p) => `${p.h},${p.k},${p.l}`);
        const got = new Set(keys);
        const want = bruteForceFamilies(sample.lattice, sample.a, source.lambda);
        // Comparing sets alone cannot see a family emitted twice, so check the
        // count before collapsing.
        expect(got.size).toBe(peaks.length);
        // Same set, both directions — no misses and no spurious extras.
        expect([...got].sort()).toEqual([...want].sort());
        // The oracle's slack was never load-bearing: nothing survives at or
        // near its own ceiling, so it did not truncate either.
        const reach = Math.max(...peaks.map((p) => p.h), 0);
        expect(reach).toBeLessThan(Math.ceil((2 * sample.a) / source.lambda) + 6);
      });
    }
  }

  it('recovers silicon’s 79 lines under Mo Kα (shipped cap of 8 returned 38)', () => {
    const si = XRD_SAMPLES.find((s) => s.id === 'si')!;
    const mo = XRD_SOURCES.find((s) => s.id === 'mo')!;
    expect(computePattern(si.lattice, si.a, mo.lambda)).toHaveLength(79);
  });

  it('recovers copper’s (911) and (931) under Mo Kα', () => {
    const cu = XRD_SAMPLES.find((s) => s.id === 'cu')!;
    const mo = XRD_SOURCES.find((s) => s.id === 'mo')!;
    const peaks = computePattern(cu.lattice, cu.a, mo.lambda);
    const fams = peaks.map((p) => `${p.h}${p.k}${p.l}`);
    expect(fams).toContain('911');
    expect(fams).toContain('931');
    expect(peaks).toHaveLength(40);
  });

  it('never returns a spacing below the Bragg limit d_min = λ/2', () => {
    for (const sample of XRD_SAMPLES) {
      for (const source of XRD_SOURCES) {
        const peaks = computePattern(sample.lattice, sample.a, source.lambda, 180);
        for (const p of peaks) {
          expect(p.d).toBeGreaterThanOrEqual(source.lambda / 2);
        }
      }
    }
  });

  it('reaches d_min = λ/2 exactly when a family lands on it', () => {
    // sinθ = 1 requires d = λ/2 exactly. Simple cubic with a = λ/2 puts
    // (100) precisely on the limit, so the pattern must still contain it.
    const lambda = 0.15406;
    const peaks = computePattern('sc', lambda / 2, lambda, 180);
    const first = peaks.find((p) => `${p.h}${p.k}${p.l}` === '100')!;
    expect(first).toBeDefined();
    expect(first.d).toBeCloseTo(lambda / 2, 15);
    expect(first.twoTheta).toBeCloseTo(180, 6);
  });
});

/**
 * Labelling families once the index can exceed 9.
 *
 * `${h}${k}${l}` is fine while every index is a single digit and was fine
 * while the sweep stopped at 8. It is not fine now: silicon under Mo Kα
 * reaches index 15, so 28 of its 79 rows printed something that reads as a
 * different reflection — "1111" for (11,1,1), sitting in the same column as
 * the genuine (111), and aluminium's (10,0,0) printing as "1000", which reads
 * as (100).
 */
describe('family labels', () => {
  it('leaves single-digit families exactly as they were', () => {
    expect(familyLabel(1, 1, 1)).toBe('111');
    expect(familyLabel(3, 1, 1)).toBe('311');
    expect(familyLabel(9, 3, 1)).toBe('931');
  });

  it('separates the moment any index reaches double digits', () => {
    expect(familyLabel(11, 1, 1)).toBe('11,1,1');
    expect(familyLabel(10, 0, 0)).toBe('10,0,0');
    // (14,2,0) is real — it is the top of silicon's Mo Kα pattern.
    expect(familyLabel(14, 2, 0)).toBe('14,2,0');
    // and the formatter is not limited to families any shipped sample reaches
    expect(familyLabel(15, 5, 3)).toBe('15,5,3');
  });

  it('never collides — a label identifies exactly one family', () => {
    expect(familyLabel(11, 1, 1)).not.toBe(familyLabel(1, 1, 1));
    expect(familyLabel(10, 0, 0)).not.toBe(familyLabel(1, 0, 0));
    expect(familyLabel(1, 11, 1)).not.toBe(familyLabel(11, 1, 1));
  });

  it('is injective across every shipped sample × source', () => {
    for (const sample of XRD_SAMPLES) {
      for (const source of XRD_SOURCES) {
        const peaks = computePattern(sample.lattice, sample.a, source.lambda);
        const labels = peaks.map((p) => familyLabel(p.h, p.k, p.l));
        expect(new Set(labels).size).toBe(peaks.length);
      }
    }
  });
});

/**
 * Guards on the bound itself.
 *
 * The completeness test above proves the pattern is not truncated, but it
 * cannot fail a bound that is merely *too generous* — mutation testing
 * confirmed that `braggIndexBound` returning a constant 25, or a constant 16,
 * or using `floor`, all passed it. These assertions reach the function
 * directly so the claim in that block's title ("bounded by Bragg, not by a
 * fixed index cap") is actually gated.
 */
describe('braggIndexBound is derived from λ and a, not fixed', () => {
  it('is exactly ceil(2a/λ) across four decades of a/λ', () => {
    for (const a of [0.05, 0.2, 0.3615, 0.5431, 1.2]) {
      for (const lambda of [0.02, 0.07107, 0.15406, 0.22897, 0.4]) {
        const exact = (2 * a) / lambda;
        const bound = braggIndexBound(a, lambda);
        // At or above the physical reach — this is what `floor` fails.
        expect(bound).toBeGreaterThanOrEqual(exact);
        // And no more generous than it has to be — this is what a constant
        // 25 or 16 fails.
        expect(bound).toBeLessThan(exact + 1);
      }
    }
  });

  it('rejects a non-physical lattice parameter or wavelength', () => {
    expect(braggIndexBound(0, 0.15406)).toBe(0);
    expect(braggIndexBound(0.3615, 0)).toBe(0);
    expect(braggIndexBound(-1, 0.15406)).toBe(0);
    expect(braggIndexBound(0.3615, Number.NaN)).toBe(0);
  });

  /**
   * The real reason the bound rounds up. `floor` is not wrong by the algebra —
   * for an exact integer ratio floor and ceil agree — it is wrong in floating
   * point: 2 × 0.53921 / 0.15406 evaluates to 6.999999999999999, so `floor`
   * drops the (700) family that sits precisely on sinθ = 1.
   */
  it('keeps a family that lands on sinθ = 1 through a floating-point shortfall', () => {
    const a = 0.53921;
    const lambda = 0.15406;
    expect((2 * a) / lambda).toBeLessThan(7); // 6.999999999999999
    expect(Math.floor((2 * a) / lambda)).toBe(6);
    expect(braggIndexBound(a, lambda)).toBe(7);
    const fams = computePattern('sc', a, lambda, 180).map((p) => familyLabel(p.h, p.k, p.l));
    expect(fams).toContain('700');
  });

  /**
   * The defensive ceiling must not become the defect it guards against. A
   * fixed cap that silently drops reflections is exactly what this whole
   * change removed, so past the ceiling the module refuses rather than
   * returning a plausible-looking short pattern.
   */
  it('refuses rather than truncating past the defensive ceiling', () => {
    // 2a/λ = 200, far past any laboratory combination.
    expect(() => computePattern('sc', 0.1, 0.001)).toThrow(/ceiling/i);
    // and the message says what it saw, so the failure is diagnosable
    expect(() => computePattern('sc', 0.1, 0.001)).toThrow(/200/);
  });

  /**
   * The ceiling itself has to be gated. Mutating it to 16 — the exact index
   * silicon with Mo Kα needs — passed the whole suite, leaving the widest
   * shipped combination sitting on the limit with no margin at all.
   */
  it('keeps real headroom over the widest shipped combination', () => {
    const widest = Math.max(
      ...XRD_SAMPLES.flatMap((s) => XRD_SOURCES.map((src) => (2 * s.a) / src.lambda)),
    );
    expect(widest).toBeCloseTo(15.284, 3); // silicon × Mo Kα
    expect(INDEX_CEILING).toBeGreaterThanOrEqual(4 * Math.ceil(widest));
    // and behaviourally: twice the widest shipped ratio is still fine
    expect(() => computePattern('sc', 0.3615, 0.3615 * 2 / (2 * widest))).not.toThrow();
  });

  /**
   * The comparison is `>`, not `>=`: a ratio landing exactly on the ceiling is
   * inside the domain. Mutating it to `>=` passed the whole suite.
   */
  it('admits a ratio sitting exactly on the ceiling, and refuses one past it', () => {
    // 2a/λ = 64 exactly → bound 64, which is the ceiling and must be allowed.
    expect(braggIndexBound(3.2, 0.1)).toBe(INDEX_CEILING);
    expect(() => computePattern('sc', 3.2, 0.1, 180)).not.toThrow();
    // 2a/λ = 65 → bound 65, one past.
    expect(braggIndexBound(3.25, 0.1)).toBe(INDEX_CEILING + 1);
    expect(() => computePattern('sc', 3.25, 0.1, 180)).toThrow(/ceiling/i);
  });

  it('lets every shipped sample × source through untouched', () => {
    for (const sample of XRD_SAMPLES) {
      for (const source of XRD_SOURCES) {
        expect(() => computePattern(sample.lattice, sample.a, source.lambda)).not.toThrow();
        // The widest shipped case is silicon with Mo Kα at 2a/λ ≈ 15.3.
        expect((2 * sample.a) / source.lambda).toBeLessThan(16);
      }
    }
  });
});

/**
 * Reporting a vanishingly weak reflection.
 *
 * Lifting the index cap recovered 50 real reflections whose intensity, once
 * normalised against the (111) line, rounds to zero — the angular damping
 * term falls by orders of magnitude across the pattern. Printing "0" in the
 * intensity column puts them in the same visual class as the systematic
 * absences the module goes out of its way to explain, which is the opposite
 * of what they are: present, and too weak to see.
 */
describe('intensity formatting', () => {
  it('rounds normally above the floor', () => {
    expect(formatIntensity(100)).toBe('100');
    expect(formatIntensity(49.6)).toBe('50');
    expect(formatIntensity(1.2)).toBe('1');
    expect(formatIntensity(0.5)).toBe('1');
  });

  it('never prints a present reflection as absent', () => {
    expect(formatIntensity(0.4)).toBe('<1');
    expect(formatIntensity(1e-9)).toBe('<1');
    expect(formatIntensity(0)).toBe('0');
  });

  it('marks silicon’s weak Mo Kα lines as weak, not missing', () => {
    const si = XRD_SAMPLES.find((s) => s.id === 'si')!;
    const mo = XRD_SOURCES.find((s) => s.id === 'mo')!;
    const peaks = computePattern(si.lattice, si.a, mo.lambda);
    const shown = peaks.map((p) => formatIntensity(p.intensity));
    // Every one is a real reflection, so none may read as a bare zero.
    expect(shown).not.toContain('0');
    expect(shown.filter((x) => x === '<1').length).toBe(62);
    // and the strongest line is still 100.
    expect(shown).toContain('100');
  });
});
