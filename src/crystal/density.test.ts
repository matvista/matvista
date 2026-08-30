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
import { latticeBasis as basisOf } from './density';

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

  /**
   * FCC slips on {111}⟨110⟩: the densest direction, lying in the densest
   * plane. The member of ⟨110⟩ that lies in (111) is [1̄10] — a direction is
   * in a plane when it is perpendicular to that plane's normal — and it
   * carries the close-packed 1/(2R).
   */
  it('puts the FCC slip direction in the FCC slip plane, both densest', () => {
    const dot = (u: Triple, v: Triple) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    expect(dot([1, -1, 0], [1, 1, 1])).toBe(0);
    expect(dot([1, 1, 0], [1, 1, 1])).not.toBe(0);

    expect(ldR('fcc', [1, -1, 0])).toBeCloseTo(0.5, 12);
    expect(pdR('fcc', [1, 1, 1])).toBeGreaterThan(pdR('fcc', [1, 0, 0]));
    expect(ldR('fcc', [1, -1, 0])).toBeGreaterThan(ldR('fcc', [1, 0, 0]));
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
    // Exactly one, not merely a whole number. These are Bravais lattices, so
    // the *smallest* 2D repeat holds a single atom — "an integer ≥ 1" also
    // admits a non-primitive cell, which is what a second-shortest basis
    // vector or too small a search extent would silently produce.
    expect(m.atomsPerCell).toBeCloseTo(1, 9);
  });

  /**
   * `atomsPerCell` is the field the picture and the number meet at, so it has
   * to be the product it claims to be. Rounding it — which looks harmless
   * while the value is exactly 1 — would hide a non-primitive cell.
   */
  it.each([
    ['fcc', [1, 1, 1]],
    ['bcc', [1, 1, 0]],
    ['sc', [1, 0, 0]],
  ])('%s (%s): atomsPerCell is cellArea × planar density, not a rounding of it', (id, hkl) => {
    const s = getStructure(id as string);
    const m = planeMap(s, hkl as Triple)!;
    expect(m.atomsPerCell).toBe(m.cellArea * planarDensity(s, hkl as Triple)!);
  });

  /**
   * The net is drawn into a viewBox spanning −1.6…1.6 in units of a, whose
   * corners are 1.6√2 ≈ 2.263 from the origin. A net that stops short of that
   * leaves visibly empty corners — which is what a smaller search extent
   * produces, while every other assertion here stays green because the repeat
   * cell is found either way.
   */
  it.each([
    ['fcc', [1, 1, 1]],
    ['fcc', [1, 0, 0]],
    ['fcc', [1, 1, 0]],
    ['bcc', [1, 1, 0]],
    ['bcc', [1, 0, 0]],
    ['sc', [1, 0, 0]],
  ])('%s (%s): the net fills the drawn box to its corners', (id, hkl) => {
    const m = planeMap(getStructure(id as string), hkl as Triple)!;
    const maxR = Math.max(...m.points.map(([x, y]) => Math.hypot(x, y)));
    expect(maxR).toBeGreaterThanOrEqual(1.6 * Math.SQRT2);
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

describe('a plane is a plane, whatever multiple of its indices is typed', () => {
  /**
   * (222) names the same plane as (111). The unreduced form matters for a
   * *reflection* — `dSpacing` and the extinction rules use it deliberately —
   * but planar density is a property of the plane, and reporting half of
   * (111) for (222) is simply wrong. The XRD module links here with exactly
   * these indices: its candidate list contains 200, 220, 222, 400 and 300.
   */
  it.each([
    ['fcc', [1, 1, 1], [2, 2, 2]],
    ['fcc', [1, 1, 1], [3, 3, 3]],
    ['fcc', [1, 1, 1], [4, 4, 4]],
    ['fcc', [1, 0, 0], [2, 0, 0]],
    ['fcc', [1, 1, 0], [2, 2, 0]],
    ['bcc', [1, 1, 0], [2, 2, 0]],
    ['bcc', [1, 1, 1], [3, 3, 3]],
    ['bcc', [1, 0, 0], [4, 0, 0]],
    ['sc', [1, 0, 0], [2, 0, 0]],
    ['sc', [1, 1, 1], [2, 2, 2]],
  ])('%s: (%s) and (%s) have the same planar density', (id, low, high) => {
    const s = getStructure(id as string);
    expect(planarDensity(s, high as Triple)).toBeCloseTo(planarDensity(s, low as Triple)!, 12);
  });

  it('reduces in the 2D net too, so the picture and the number agree', () => {
    const s = getStructure('fcc');
    const a = planeMap(s, [1, 1, 1])!;
    const b = planeMap(s, [2, 2, 2])!;
    expect(b.points.length).toBe(a.points.length);
    expect(b.cellArea).toBeCloseTo(a.cellArea, 12);
    expect(b.atomsPerCell).toBeCloseTo(a.atomsPerCell, 12);
  });
});

describe('linear density reaches directions with large components', () => {
  /**
   * A reference that searches far more widely than the implementation, so the
   * two are independent. The implementation bounded its search at ±2 and fell
   * back to the full repeat for anything reaching further, halving the answer
   * for directions the index input accepts — [116], [136], [431], [532].
   */
  function reference(id: string, uvw: Triple): number {
    const basis = basisOf(getStructure(id))!;
    const len = Math.hypot(...uvw);
    let smallest = 1;
    const B = 14;
    for (const p of basis) {
      for (let i = -B; i <= B; i++)
        for (let j = -B; j <= B; j++)
          for (let k = -B; k <= B; k++) {
            const q: Triple = [p[0] + i, p[1] + j, p[2] + k];
            if (Math.hypot(...q) < 1e-9) continue;
            const t = (q[0] * uvw[0] + q[1] * uvw[1] + q[2] * uvw[2]) / (len * len);
            if (t <= 1e-9) continue;
            const off = Math.hypot(t * uvw[0] - q[0], t * uvw[1] - q[1], t * uvw[2] - q[2]);
            if (off < 1e-9 && t < smallest) smallest = t;
          }
    }
    return 1 / (smallest * len);
  }

  it.each([
    ['fcc', [1, 1, 6]],
    ['fcc', [1, 3, 6]],
    ['fcc', [4, 3, 1]],
    ['fcc', [5, 3, 2]],
    ['bcc', [5, 5, 1]],
    ['bcc', [1, 1, 6]],
    ['sc', [3, 4, 5]],
  ])('%s [%s]', (id, uvw) => {
    expect(linearDensity(getStructure(id as string), uvw as Triple)).toBeCloseTo(
      reference(id as string, uvw as Triple),
      12,
    );
  });

  it('agrees with the reference across a sweep, not only on chosen cases', () => {
    for (const id of ['fcc', 'bcc', 'sc']) {
      for (let u = 0; u <= 4; u++)
        for (let v = 0; v <= 4; v++)
          for (let w = 0; w <= 4; w++) {
            if (u + v + w === 0) continue;
            const uvw: Triple = [u, v, w];
            expect(linearDensity(getStructure(id), uvw), `${id} ${uvw}`).toBeCloseTo(
              reference(id, uvw),
              12,
            );
          }
    }
  });
});
