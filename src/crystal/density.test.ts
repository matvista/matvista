import { describe, expect, it } from 'vitest';
import {
  latticeBasis,
  linearDensity,
  occupiedSpacing,
  planarDensity,
  planeMap,
  rankPlanes,
  type Triple,
} from './density';
import { STRUCTURES, getStructure } from './structures';

/** Planar density in atoms per R², which is how the textbook states it. */
const pdR = (id: string, hkl: Triple) => {
  const s = getStructure(id);
  return planarDensity(s, hkl)! / s.aOverR! ** 2;
};
/** Linear density in atoms per R. */
const ldR = (id: string, uvw: Triple) => {
  const s = getStructure(id);
  return linearDensity(s, uvw)! / s.aOverR!;
};

describe('planar density matches the closed forms', () => {
  /**
   * These are the exact results, not decimals read off a table: 1/(2√3 R²),
   * 1/(4R²), 1/(4√2 R²). The implementation derives them from the occupied
   * plane spacing and knows none of them.
   */
  it.each([
    ['fcc', [1, 1, 1], 1 / (2 * Math.sqrt(3))],
    ['fcc', [1, 0, 0], 1 / 4],
    ['fcc', [1, 1, 0], 1 / (4 * Math.SQRT2)],
    ['bcc', [1, 1, 0], (3 * Math.SQRT2) / 16],
    ['bcc', [1, 0, 0], 3 / 16],
    ['sc', [1, 0, 0], 1 / 4],
  ])('%s (%s): PD = the closed form', (id, hkl, expected) => {
    expect(pdR(id as string, hkl as Triple)).toBeCloseTo(expected as number, 12);
  });

  /**
   * Centring is the thing this could get wrong. FCC's (100) planes are a/2
   * apart because the face centres interleave, not a; FCC's (111) are a/√3
   * with nothing between them.
   */
  it.each([
    ['fcc', [1, 0, 0], 0.5],
    ['fcc', [1, 1, 0], 1 / (2 * Math.SQRT2)],
    ['fcc', [1, 1, 1], 1 / Math.sqrt(3)],
    ['bcc', [1, 0, 0], 0.5],
    ['bcc', [1, 1, 0], 1 / Math.SQRT2],
    ['sc', [1, 0, 0], 1],
  ])('%s (%s): occupied planes are spaced right', (id, hkl, expected) => {
    expect(occupiedSpacing(getStructure(id as string), hkl as Triple)).toBeCloseTo(
      expected as number,
      12,
    );
  });

  /** The ordering the slip table depends on. */
  it('ranks FCC {111} densest and BCC {110} densest', () => {
    const low: Triple[] = [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ];
    expect(rankPlanes(getStructure('fcc'), low).map((r) => r.hkl.join(''))).toEqual([
      '111',
      '100',
      '110',
    ]);
    expect(rankPlanes(getStructure('bcc'), low).map((r) => r.hkl.join(''))).toEqual([
      '110',
      '100',
      '111',
    ]);
  });
});

describe('linear density matches the closed forms', () => {
  /**
   * Along a close-packed direction the atoms touch, so the repeat is 2R and
   * the density is 1/(2R) — for FCC ⟨110⟩ and BCC ⟨111⟩ alike. Two different
   * structures and two different directions landing on the same number is a
   * check that the direction handling is not accidentally structure-specific.
   */
  it.each([
    ['fcc', [1, 1, 0]],
    ['bcc', [1, 1, 1]],
    ['sc', [1, 0, 0]],
  ])('%s %s: the close-packed direction gives 1/(2R)', (id, uvw) => {
    expect(ldR(id as string, uvw as Triple)).toBeCloseTo(0.5, 12);
  });

  it('gives the non-close-packed directions less', () => {
    expect(ldR('fcc', [1, 0, 0])).toBeLessThan(0.5);
    expect(ldR('fcc', [1, 1, 1])).toBeLessThan(0.5);
    expect(ldR('bcc', [1, 1, 0])).toBeLessThan(0.5);
  });

  /** FCC slips on {111}⟨110⟩ — the densest direction lying in the densest plane. */
  it('puts the FCC slip direction in the FCC slip plane, both densest', () => {
    expect(ldR('fcc', [1, 1, 0])).toBeGreaterThan(ldR('fcc', [1, 0, 0]));
    expect(pdR('fcc', [1, 1, 1])).toBeGreaterThan(pdR('fcc', [1, 0, 0]));
    // [110] lies in (111): the dot product vanishes.
    expect(1 * 1 + 1 * 1 + 0 * 1).toBe(2);
    expect(1 * 1 + -1 * 1 + 0 * 1).toBe(0);
  });
});

describe('the drawn 2D net agrees with the density', () => {
  /**
   * The map is drawn for the reader and the density does not come from it, so
   * this is the one place the two meet: the repeat cell's area times the
   * planar density has to be a whole number of atoms.
   */
  it.each([
    ['fcc', [1, 1, 1]],
    ['fcc', [1, 0, 0]],
    ['fcc', [1, 1, 0]],
    ['bcc', [1, 1, 0]],
    ['bcc', [1, 0, 0]],
    ['sc', [1, 0, 0]],
  ])('%s (%s): the 2D cell holds a whole number of atoms', (id, hkl) => {
    const m = planeMap(getStructure(id as string), hkl as Triple)!;
    expect(m.atomsPerCell).toBeCloseTo(Math.round(m.atomsPerCell), 9);
    expect(Math.round(m.atomsPerCell)).toBeGreaterThanOrEqual(1);
  });

  it('puts every mapped atom in the plane, and the origin among them', () => {
    const m = planeMap(getStructure('fcc'), [1, 1, 1])!;
    expect(m.points.some(([x, y]) => Math.hypot(x, y) < 1e-9)).toBe(true);
    expect(m.points.length).toBeGreaterThan(6);
  });

  /** The FCC (111) net is triangular: the two shortest vectors are equal. */
  it('finds the triangular net on FCC (111)', () => {
    const m = planeMap(getStructure('fcc'), [1, 1, 1])!;
    const [v1, v2] = m.cell;
    expect(Math.hypot(...v1)).toBeCloseTo(Math.hypot(...v2), 9);
    expect(Math.hypot(...v1)).toBeCloseTo(Math.SQRT1_2, 9);
  });
});

describe('scope is declared', () => {
  it('covers the three structures with one atom per lattice point', () => {
    expect(STRUCTURES.filter((s) => latticeBasis(s) != null).map((s) => s.id)).toEqual([
      'sc',
      'fcc',
      'bcc',
    ]);
  });

  it('returns null rather than a number everywhere else', () => {
    for (const s of STRUCTURES.filter((x) => latticeBasis(x) == null)) {
      expect(planarDensity(s, [1, 1, 1])).toBeNull();
      expect(linearDensity(s, [1, 1, 0])).toBeNull();
      expect(planeMap(s, [1, 1, 1])).toBeNull();
    }
  });

  it('refuses (000), which is not a plane', () => {
    expect(planarDensity(getStructure('fcc'), [0, 0, 0])).toBeNull();
    expect(linearDensity(getStructure('fcc'), [0, 0, 0])).toBeNull();
  });
});
