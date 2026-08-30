import { describe, expect, it } from 'vitest';
import {
  CARBON_RADIUS,
  interstitialSites,
  largestInterstitialRadius,
  siteFit,
} from './interstitial';
import { STRUCTURES, getStructure } from './structures';
import { METALS } from './metals';
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
    const ds = hostDistances(s, set.positions[0]);
    const touching = ds.filter((d) => Math.abs(d - ds[0]) < 1e-9).length;
    expect(touching).toBe(expected as number);
    // The declared field has to be the measured one, or it is a caption
    // nothing checks — the panel prints it.
    expect(set.contacts).toBe(touching);
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
    expect(withSites).toEqual(['sc', 'fcc', 'bcc']);
  });

  it('returns null rather than a radius where there is no single R', () => {
    for (const s of STRUCTURES.filter((x) => x.aOverR == null)) {
      expect(largestInterstitialRadius(s, [0.5, 0.5, 0.5])).toBeNull();
    }
  });
});
