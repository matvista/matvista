/**
 * Interstitial sites — the holes between the atoms.
 *
 * This is the mechanism underneath the Fe–Fe₃C diagram. Austenite dissolves
 * 2.14 wt% C and ferrite 0.022 wt%, a hundredfold difference between two
 * structures whose packing factors run the *other* way: FCC is 0.74, denser
 * than BCC's 0.68. The denser structure holds far more carbon.
 *
 * The resolution is that packing factor counts the total void space and says
 * nothing about how it is divided. FCC gathers its smaller void into four
 * roomy octahedral holes per cell (r/R = 0.414); BCC scatters more void into
 * six cramped ones (r/R = 0.155). Carbon fits the first far better than the
 * second, which is why quenching austenite traps carbon it cannot shed and
 * makes martensite.
 */
import type { StructureDef } from './structures';
import { distance, expandToSupercell } from './geometry';

/**
 * The shape of the hole, named for the polyhedron its touching neighbours
 * form. `cubic` is the eight-cornered hole at the centre of a simple cubic
 * cell — the same coordination CsCl takes, which is why the radius ratio
 * below is the one the radius-ratio rule quotes for it.
 */
export type InterstitialKind = 'octahedral' | 'tetrahedral' | 'cubic';

export interface InterstitialSet {
  kind: InterstitialKind;
  /** Fractional cell coordinates, before the −½ shift `buildAtoms` applies. */
  positions: [number, number, number][];
  /** Sites per conventional cell, after sharing with neighbouring cells. */
  perCell: number;
  /** Largest sphere that fits without pushing the hosts apart, in units of R. */
  radiusRatio: number;
  /** Host atoms at the touching distance. */
  contacts: number;
  /**
   * Set where the hole is not the regular polyhedron its name implies. The
   * BCC "octahedral" site has two hosts at a/2 and four at a/√2, so the
   * sphere that fits is set by the near pair alone and the site is squashed,
   * not octahedral. The name is the textbook's and is kept; the caption is
   * this flag's job.
   */
  distorted: boolean;
}

/**
 * Only the elemental cubic structures. HCP has the same close-packed holes as
 * FCC, but this module's hexagonal cell is a drawn prism rather than a
 * lattice-vector frame, so siting them there would be a second geometry to get
 * right for no new physics. Diamond's voids are not the octahedral/tetrahedral
 * pair at all, and the compounds' interstices are already occupied — that is
 * what makes them compounds.
 */
const SITES: Record<string, InterstitialSet[]> = {
  sc: [
    {
      kind: 'cubic',
      positions: [[0.5, 0.5, 0.5]],
      perCell: 1,
      radiusRatio: Math.sqrt(3) - 1,
      contacts: 8,
      distorted: false,
    },
  ],
  fcc: [
    {
      kind: 'octahedral',
      // The body centre, plus the twelve edge midpoints at a quarter each.
      positions: [
        [0.5, 0.5, 0.5],
        ...edgeMidpoints(),
      ],
      perCell: 4,
      radiusRatio: Math.SQRT2 - 1,
      contacts: 6,
      distorted: false,
    },
    {
      kind: 'tetrahedral',
      positions: corners(0.25, 0.75),
      perCell: 8,
      radiusRatio: Math.sqrt(6) / 2 - 1,
      contacts: 4,
      distorted: false,
    },
  ],
  bcc: [
    {
      kind: 'octahedral',
      // Six face centres at a half each, twelve edge midpoints at a quarter.
      positions: [...faceCentres(), ...edgeMidpoints()],
      perCell: 6,
      radiusRatio: 2 / Math.sqrt(3) - 1,
      contacts: 2,
      distorted: true,
    },
    {
      kind: 'tetrahedral',
      positions: faceQuarters(),
      perCell: 12,
      radiusRatio: Math.sqrt(5) / Math.sqrt(3) - 1,
      contacts: 4,
      distorted: false,
    },
  ],
};

/** The twelve edge midpoints of the cube. */
function edgeMidpoints(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const [a, b] of [
    [0, 1],
    [1, 2],
    [2, 0],
  ] as const) {
    for (const u of [0, 1]) {
      for (const v of [0, 1]) {
        const p: [number, number, number] = [0, 0, 0];
        p[a] = u;
        p[b] = v;
        p[3 - a - b] = 0.5;
        out.push(p);
      }
    }
  }
  return out;
}

/** The six face centres. */
function faceCentres(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const u of [0, 1]) {
      const p: [number, number, number] = [0.5, 0.5, 0.5];
      p[axis] = u;
      out.push(p);
    }
  }
  return out;
}

/** The eight interior points with every coordinate at a or b. */
function corners(a: number, b: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const x of [a, b]) for (const y of [a, b]) for (const z of [a, b]) out.push([x, y, z]);
  return out;
}

/** Four points per face at (½, ¼) and its rotations — BCC's tetrahedral set. */
function faceQuarters(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let normal = 0; normal < 3; normal++) {
    const [u, v] = [0, 1, 2].filter((i) => i !== normal);
    for (const face of [0, 1]) {
      for (const q of [0.25, 0.75]) {
        for (const [big, small] of [
          [u, v],
          [v, u],
        ]) {
          const p: [number, number, number] = [0, 0, 0];
          p[normal] = face;
          p[big] = 0.5;
          p[small] = q;
          out.push(p);
        }
      }
    }
  }
  return out;
}

/** The interstitial sets for a structure, or null where none is defined. */
export function interstitialSites(s: StructureDef): InterstitialSet[] | null {
  return SITES[s.id] ?? null;
}

/**
 * The largest sphere that fits at `site`, in units of the host radius R,
 * measured rather than looked up: the nearest host in a 3×3×3 tiling sets it.
 *
 * With a = 1 the host radius is 1/(a/R), so a touching distance d gives
 * r/R = d·(a/R) − 1. Structures with no `aOverR` — the compounds — have no
 * single R for this to be in units of, and return null.
 */
export function largestInterstitialRadius(
  s: StructureDef,
  site: [number, number, number],
): number | null {
  if (s.aOverR == null) return null;
  const centred: [number, number, number] = [site[0] - 0.5, site[1] - 0.5, site[2] - 0.5];
  const cloud = expandToSupercell(s);
  let min = Infinity;
  for (const p of cloud) {
    const d = distance(p, centred);
    if (d < min) min = d;
  }
  return min * s.aOverR - 1;
}

/** Carbon's radius in steel, nm — the value Callister uses for this comparison. */
export const CARBON_RADIUS = 0.071;

/**
 * How a solute of radius `rSolute` compares with the largest sphere the site
 * will take, for a host of radius `rHost`. Above 1 the lattice must strain.
 */
export function siteFit(ratio: number, rHost: number, rSolute: number) {
  const fits = ratio * rHost;
  return { fits, strain: rSolute / fits };
}
