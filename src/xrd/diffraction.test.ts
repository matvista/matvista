import { describe, expect, it } from 'vitest';
import {
  XRD_SAMPLES, XRD_SOURCES, computePattern, isAllowed, latticeParameter,
  multiplicity, structureFactorSquared,
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
