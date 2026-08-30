import { describe, expect, it } from 'vitest';
import {
  CARBON_RADIUS,
  CARBON_SITE,
  interstitialSites,
  largestInterstitialRadius,
  siteFit,
} from './interstitial';
import { STRUCTURES, getStructure } from './structures';
import { METALS } from './metals';
import { FERRITE_MAX, GAMMA_MAX } from '../phase/systems';
import { distance, expandToSupercell } from './geometry';

const setOf = (id: string, kind: string) =>
  interstitialSites(getStructure(id))!.find((s) => s.kind === kind)!;

/** A site on a cell face/edge/corner is shared with the cells that touch it. */
const share = (p: [number, number, number]) =>
  1 / 2 ** p.filter((v) => v === 0 || v === 1).length;

/**
 * Host distances from a site, ascending. `expandToSupercell` is used rather
 * than `buildAtoms` because the latter duplicates a boundary atom onto the
 * opposite face for drawing, which would count the same neighbour twice.
 */
function hostDistances(s: Parameters<typeof largestInterstitialRadius>[0], p: [number, number, number]) {
  const centred: [number, number, number] = [p[0] - 0.5, p[1] - 0.5, p[2] - 0.5];
  return expandToSupercell(s)
    .map((q) => distance(q, centred))
    .sort((a, b) => a - b);
}

describe('the textbook radius ratios come out of the geometry', () => {
  /**
   * These five numbers are the point of the module. They are declared in
   * `SITES` and *also* measured off the atom cloud by
   * `largestInterstitialRadius`, which knows nothing about them — so this
   * compares two independent routes to the same quantity, not a value against
   * its own copy.
   */
  it.each([
    ['fcc', 'octahedral', 0.414],
    ['fcc', 'tetrahedral', 0.225],
    ['bcc', 'octahedral', 0.155],
    ['bcc', 'tetrahedral', 0.291],
    ['sc', 'cubic', 0.732],
  ])('%s %s: r/R = %s', (id, kind, expected) => {
    const set = setOf(id, kind);
    expect(set.radiusRatio).toBeCloseTo(expected as number, 3);
    // The declared ratio and the measured one must agree to floating point,
    // not merely to the three decimals the textbook prints.
    for (const p of set.positions) {
      expect(largestInterstitialRadius(getStructure(id), p)).toBeCloseTo(set.radiusRatio, 12);
    }
  });

  it.each([
    ['fcc', 'octahedral', 4],
    ['fcc', 'tetrahedral', 8],
    ['bcc', 'octahedral', 6],
    ['bcc', 'tetrahedral', 12],
    ['sc', 'cubic', 1],
  ])('%s %s: %s per cell once sharing is counted', (id, kind, expected) => {
    const set = setOf(id, kind);
    const summed = set.positions.reduce((t, p) => t + share(p), 0);
    expect(summed).toBeCloseTo(expected as number, 12);
    expect(set.perCell).toBe(expected);
  });

  it('declares each site once', () => {
    for (const s of STRUCTURES) {
      for (const set of interstitialSites(s) ?? []) {
        const keys = set.positions.map((p) => p.join(','));
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  /**
   * A site is a hole, not an atom. Anything landing on a host would give a
   * negative radius and would mean the position table is wrong.
   */
  it('puts no site on top of a host atom', () => {
    for (const s of STRUCTURES) {
      for (const set of interstitialSites(s) ?? []) {
        for (const p of set.positions) {
          expect(largestInterstitialRadius(s, p)!).toBeGreaterThan(0);
        }
      }
    }
  });

  it.each([
    ['fcc', 'octahedral', 6],
    ['fcc', 'tetrahedral', 4],
    ['bcc', 'octahedral', 2],
    ['bcc', 'tetrahedral', 4],
    ['sc', 'cubic', 8],
  ])('%s %s: %s hosts at the touching distance', (id, kind, expected) => {
    const s = getStructure(id);
    const set = setOf(id, kind);
    // Every position, not just the first: the sites in a set are supposed to
    // be symmetry-equivalent, and that is the assertion rather than the
    // assumption.
    for (const p of set.positions) {
      const ds = hostDistances(s, p);
      const touching = ds.filter((d) => Math.abs(d - ds[0]) < 1e-9).length;
      expect(touching, `${id} ${kind} at ${p.join(',')}`).toBe(expected as number);
      // The declared field has to be the measured one, or it is a caption
      // nothing checks — the panel prints it.
      expect(set.contacts).toBe(touching);
    }
  });

  /**
   * The BCC octahedral hole is not octahedral. Two hosts sit at a/2 and four
   * at a/√2, so the near pair alone sets the sphere that fits — which is why
   * 0.155 is so much smaller than FCC's 0.414 despite BCC being the more open
   * structure. Flagged in the data so the panel can say so.
   */
  it('flags the BCC octahedral site as distorted, and only that one', () => {
    const distorted = STRUCTURES.flatMap((s) =>
      (interstitialSites(s) ?? []).filter((set) => set.distorted).map((set) => `${s.id}/${set.kind}`),
    );
    expect(distorted).toEqual(['bcc/octahedral']);

    const ds = hostDistances(getStructure('bcc'), setOf('bcc', 'octahedral').positions[0]);
    const near = ds.filter((d) => Math.abs(d - 0.5) < 1e-9);
    const far = ds.filter((d) => Math.abs(d - Math.SQRT1_2) < 1e-9);
    expect([near.length, far.length]).toEqual([2, 4]);
  });
});

describe('the packing factor does not predict the hole', () => {
  /**
   * The misconception this module exists to break: FCC is the denser packing
   * and still takes the larger interstitial. Packing factor totals the void;
   * it says nothing about how the void is divided.
   */
  it('gives the denser structure the roomier hole', () => {
    const fcc = getStructure('fcc');
    const bcc = getStructure('bcc');
    expect(fcc.APF).toBeGreaterThan(bcc.APF);
    expect(setOf('fcc', 'octahedral').radiusRatio).toBeGreaterThan(
      setOf('bcc', 'octahedral').radiusRatio,
    );
  });

  it('makes the FCC octahedral hole roughly 2.7× the BCC one', () => {
    const r = setOf('fcc', 'octahedral').radiusRatio / setOf('bcc', 'octahedral').radiusRatio;
    expect(r).toBeCloseTo(2.68, 2);
  });

  /**
   * Carbon in iron, using the one iron radius this repo carries so the
   * comparison isolates the geometry. Both are a squeeze; only one is close.
   */
  it('shows why austenite dissolves carbon and ferrite does not', () => {
    const R = METALS.find((m) => m.symbol === 'Fe')!.R;
    const bcc = siteFit(setOf('bcc', 'octahedral').radiusRatio, R, CARBON_RADIUS);
    const fcc = siteFit(setOf('fcc', 'octahedral').radiusRatio, R, CARBON_RADIUS);
    expect(bcc.fits).toBeCloseTo(0.0192, 4);
    expect(fcc.fits).toBeCloseTo(0.0514, 4);
    expect(bcc.strain).toBeGreaterThan(3);
    expect(fcc.strain).toBeLessThan(1.5);
  });
});

describe('scope is declared, not implied', () => {
  it('offers sites for exactly the three elemental cubic structures', () => {
    const withSites = STRUCTURES.filter((s) => interstitialSites(s) != null).map((s) => s.id);
    // Sorted: which structures are covered is the claim, not what order
    // `STRUCTURES` happens to list them in.
    expect([...withSites].sort()).toEqual(['bcc', 'fcc', 'sc']);
  });

  it('returns null rather than a radius where there is no single R', () => {
    for (const s of STRUCTURES.filter((x) => x.aOverR == null)) {
      expect(largestInterstitialRadius(s, [0.5, 0.5, 0.5])).toBeNull();
    }
  });
});

describe('the constants are pinned, not merely bounded', () => {
  /**
   * `CARBON_RADIUS` reaches the panel as printed text. It was previously
   * constrained only by two inequalities on the resulting strain, which left
   * it free anywhere in 0.0576–0.0771 nm — a band containing nitrogen (0.065)
   * and oxygen (0.060). It could have stopped being carbon with the suite
   * green.
   */
  it('carbon is carbon', () => {
    expect(CARBON_RADIUS).toBe(0.071);
  });

  /**
   * Carbon takes the octahedral site in both irons. This is named data, not
   * derived, precisely because deriving it as "the largest" would be wrong in
   * BCC — so the wrongness of that derivation is asserted here, to stop anyone
   * "simplifying" the constant away later.
   */
  it('names the octahedral site, which is not the largest one in BCC', () => {
    expect(CARBON_SITE).toBe('octahedral');
    const bcc = interstitialSites(getStructure('bcc'))!;
    const oct = bcc.find((s) => s.kind === 'octahedral')!;
    const tet = bcc.find((s) => s.kind === 'tetrahedral')!;
    expect(tet.radiusRatio).toBeGreaterThan(oct.radiusRatio);
    expect(oct.radiusRatio).toBeLessThan(Math.max(...bcc.map((s) => s.radiusRatio)));

    // And BCC's tetrahedral hole is larger than FCC's, so "BCC has smaller
    // holes" is false as a general statement.
    const fccTet = interstitialSites(getStructure('fcc'))!.find((s) => s.kind === 'tetrahedral')!;
    expect(tet.radiusRatio).toBeGreaterThan(fccTet.radiusRatio);
  });

  /** The solubilities quoted in this file's header are the ones the phase module uses. */
  it('quotes the phase module’s own solubility limits', () => {
    expect(GAMMA_MAX).toBe(2.14);
    expect(FERRITE_MAX).toBe(0.022);
    expect(GAMMA_MAX / FERRITE_MAX).toBeGreaterThan(90);
  });
});

describe('the declared sites are all of them', () => {
  /**
   * Clearance at a point: distance to the nearest host, in units of a. The
   * cloud is built once per structure rather than per sample — rebuilding it
   * inside the grid loop cost seconds.
   */
  const clouds = new Map<string, [number, number, number][]>();
  function clearance(s: ReturnType<typeof getStructure>, p: [number, number, number]) {
    let cloud = clouds.get(s.id);
    if (cloud == null) {
      cloud = expandToSupercell(s);
      clouds.set(s.id, cloud);
    }
    let min = Infinity;
    for (const q of cloud) {
      const d = distance(q, p);
      if (d < min) min = d;
    }
    return min;
  }

  /** All 26 adjacent cells. A 6-neighbour test reports ridge points as maxima. */
  const NEIGHBOURS: [number, number, number][] = [];
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++)
      for (let c = -1; c <= 1; c++) if (a || b || c) NEIGHBOURS.push([a, b, c]);

  /**
   * A declared set can be *added* without any of the per-site tests noticing,
   * because each one only checks the sites it is given. This scans the void
   * field on a grid and pulls out every local maximum, which depends on
   * nothing the module declares.
   */
  it.each(['sc', 'fcc', 'bcc'])('%s: every local maximum of the void field is declared', (id) => {
    const s = getStructure(id);
    // 24 divides every declared coordinate (¼, ½, ¾), so each true site is
    // itself a grid point and the match below can be tight.
    const N = 24;
    const at = (i: number, j: number, k: number): [number, number, number] => [
      i / N - 0.5,
      j / N - 0.5,
      k / N - 0.5,
    ];
    const field: number[] = [];
    const idx = (i: number, j: number, k: number) =>
      ((i + N) % N) * N * N + ((j + N) % N) * N + ((k + N) % N);
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++)
        for (let k = 0; k < N; k++) field[idx(i, j, k)] = clearance(s, at(i, j, k));

    const declared = (interstitialSites(s) ?? []).flatMap((set) =>
      set.positions.map((q) => [q[0] - 0.5, q[1] - 0.5, q[2] - 0.5] as [number, number, number]),
    );

    let maxima = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        for (let k = 0; k < N; k++) {
          const v = field[idx(i, j, k)];
          let peak = true;
          for (const [di, dj, dk] of NEIGHBOURS) {
            if (field[idx(i + di, j + dj, k + dk)] > v) peak = false;
          }
          if (!peak) continue;
          maxima++;
          const p = at(i, j, k);
          // Within one grid step of a declared site, wrapped for periodicity.
          const near = declared.some((q) =>
            [-1, 0, 1].some((wx) =>
              [-1, 0, 1].some((wy) =>
                [-1, 0, 1].some(
                  (wz) => distance([q[0] + wx, q[1] + wy, q[2] + wz], p) <= 1.001 / N,
                ),
              ),
            ),
          );
          expect(near, `${id}: undeclared void maximum at ${p.map((x) => x.toFixed(3))}`).toBe(true);
        }
      }
    }
    expect(maxima).toBeGreaterThan(0);
  });

  /**
   * The BCC octahedral site is the one declared site that is *not* a maximum:
   * moving off it in the plane perpendicular to its near pair increases the
   * clearance. That is the same fact `distorted` records, measured rather than
   * asserted — and it is why the scan above cannot be the only gate.
   */
  it('bcc octahedral is a saddle, which is what distorted means', () => {
    const s = getStructure('bcc');
    const p = setOf('bcc', 'octahedral').positions[0];
    const c: [number, number, number] = [p[0] - 0.5, p[1] - 0.5, p[2] - 0.5];
    const base = clearance(s, c);
    const e = 0.01;
    const moved = ([dx, dy, dz]: number[]) => clearance(s, [c[0] + dx * e, c[1] + dy * e, c[2] + dz * e]);
    const dirs = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [-1, 0, 0],
      [0, -1, 0],
      [0, 0, -1],
    ];
    const ups = dirs.filter((d) => moved(d) > base + 1e-12);
    const downs = dirs.filter((d) => moved(d) < base - 1e-12);
    expect(ups.length).toBeGreaterThan(0);
    expect(downs.length).toBeGreaterThan(0);
    expect(setOf('bcc', 'octahedral').distorted).toBe(true);
  });

  /**
   * Every declared set, not a hard-coded four: an *added* set is the one
   * mutation the per-site tests cannot see, because each only checks the
   * sites it is handed. `distorted` is the classifier — false must mean a
   * genuine local maximum, true must mean a saddle — so a fabricated set has
   * to be one or the other and can be neither.
   */
  it.each(
    STRUCTURES.flatMap((st) =>
      (interstitialSites(st) ?? []).map((set) => [st.id, set.kind] as [string, string]),
    ),
  )('%s %s is classified correctly by its distorted flag', (id, kind) => {
    const s = getStructure(id);
    const set = setOf(id, kind);
    for (const p of set.positions) {
      const c: [number, number, number] = [p[0] - 0.5, p[1] - 0.5, p[2] - 0.5];
      const base = clearance(s, c);
      let rose = false;
      for (const d of NEIGHBOURS) {
        const n = Math.hypot(d[0], d[1], d[2]);
        const q: [number, number, number] = [
          c[0] + (d[0] / n) * 0.01,
          c[1] + (d[1] / n) * 0.01,
          c[2] + (d[2] / n) * 0.01,
        ];
        if (clearance(s, q) > base + 1e-12) rose = true;
      }
      // A hole you can grow by sliding sideways is not a site.
      expect(rose, `${id} ${kind} at ${p.join(',')}`).toBe(set.distorted);
    }
  });
});
