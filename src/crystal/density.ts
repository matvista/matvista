/**
 * Planar and linear density — how tightly atoms are packed on a plane and
 * along a direction.
 *
 * The module already knows (hkl), [uvw], the structure and a, and it already
 * asserts that FCC slips on {111}⟨110⟩. This is the reason: {111} is the
 * densest plane in FCC and ⟨110⟩ the densest direction in it, and slip happens
 * where atoms are closest together.
 *
 * **How the areal density is obtained.** Not by counting atoms in a drawn 2D
 * repeat cell and dividing by fractional shares — that arithmetic is where a
 * factor typically goes missing. Instead: every atom sits on one of a family of
 * parallel (hkl) planes, so if those occupied planes are spaced d apart, a slab
 * of thickness d holds exactly one plane's worth and
 *
 *     planar density = (atoms per volume) × d
 *
 * exactly. The only thing needing care is that d is the spacing of the
 * *occupied* planes, which centring halves: FCC's (100) planes are a/2 apart,
 * not a, because the face centres interleave. That falls out of projecting the
 * basis onto the plane normal and taking the smallest gap, so nothing has to
 * know which structures are centred.
 */
import type { StructureDef } from './structures';

const EPS = 1e-9;

export type Triple = [number, number, number];

/**
 * Bravais structures with one atom per lattice point. Diamond is left out on
 * purpose: it is FCC with a two-atom basis, its {111} planes are puckered
 * pairs rather than flat sheets, and "the atoms in the plane" stops having one
 * answer. HCP is out for the same reason it is out of `interstitial.ts` —
 * this module's hexagonal cell is a drawn prism, not a lattice frame — and a
 * compound has more than one species to count.
 */
const LATTICE_BASIS: Record<string, Triple[]> = {
  sc: [[0, 0, 0]],
  fcc: [
    [0, 0, 0],
    [0.5, 0.5, 0],
    [0.5, 0, 0.5],
    [0, 0.5, 0.5],
  ],
  bcc: [
    [0, 0, 0],
    [0.5, 0.5, 0.5],
  ],
};

export function latticeBasis(s: StructureDef): Triple[] | null {
  return LATTICE_BASIS[s.id] ?? null;
}

const norm = (v: Triple) => Math.hypot(v[0], v[1], v[2]);
const dot = (a: Triple, b: Triple) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Spacing of the *occupied* (hkl) planes, in units of a.
 *
 * The geometric spacing is a/√(h²+k²+l²). Centring subdivides it: project the
 * basis onto the normal, reduce mod one interplanar repeat, and the smallest
 * gap between distinct projections is the fraction of it that is actually
 * used. FCC (100) gives ½ and so a/2; FCC (111) gives 1 and so a/√3.
 */
export function occupiedSpacing(s: StructureDef, hkl: Triple): number | null {
  const basis = latticeBasis(s);
  if (basis == null) return null;
  const H = hkl[0] ** 2 + hkl[1] ** 2 + hkl[2] ** 2;
  if (H === 0) return null;

  const values = [...new Set(basis.map((p) => round(mod1(dot(hkl, p)))))].sort((a, b) => a - b);
  let gap = 1 - values[values.length - 1] + values[0];
  for (let i = 1; i < values.length; i++) gap = Math.min(gap, values[i] - values[i - 1]);
  return (gap / Math.sqrt(H)) * 1;
}

const mod1 = (x: number) => ((x % 1) + 1) % 1;
const round = (x: number) => Math.round(x / EPS) * EPS;

/** Atoms per unit area on (hkl), in atoms per a². */
export function planarDensity(s: StructureDef, hkl: Triple): number | null {
  const basis = latticeBasis(s);
  const d = occupiedSpacing(s, hkl);
  if (basis == null || d == null) return null;
  return basis.length * d; // (N / a³) × (d · a) → atoms per a²
}

/**
 * Atoms per unit length along [uvw], in atoms per a.
 *
 * A line through the origin along [uvw] passes through an atom wherever some
 * lattice point is a scalar multiple of it. The repeat is the smallest such
 * multiple, so the density is its reciprocal over the vector's length.
 */
export function linearDensity(s: StructureDef, uvw: Triple): number | null {
  const basis = latticeBasis(s);
  if (basis == null) return null;
  const len = norm(uvw);
  if (len === 0) return null;

  let smallest = 1; // t = 1 always works: [uvw] itself is a lattice translation.
  for (const p of basis) {
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        for (let k = -2; k <= 2; k++) {
          const q: Triple = [p[0] + i, p[1] + j, p[2] + k];
          if (norm(q) < EPS) continue;
          // Collinear with [uvw], and in the same sense.
          const t = dot(q, uvw) / (len * len);
          if (t <= EPS) continue;
          const proj: Triple = [t * uvw[0] - q[0], t * uvw[1] - q[1], t * uvw[2] - q[2]];
          if (norm(proj) < 1e-9 && t < smallest) smallest = t;
        }
      }
    }
  }
  return 1 / (smallest * len);
}

/** The low-index planes, ranked densest first. */
export function rankPlanes(s: StructureDef, planes: Triple[]) {
  return planes
    .map((hkl) => ({ hkl, density: planarDensity(s, hkl) }))
    .filter((r): r is { hkl: Triple; density: number } => r.density != null)
    .sort((a, b) => b.density - a.density);
}

export interface PlaneMap {
  /** In-plane atom centres, in units of a, on an orthonormal 2D frame. */
  points: [number, number][];
  /** The 2D repeat cell, as two in-plane vectors in the same frame. */
  cell: [[number, number], [number, number]];
  /** Area of that repeat cell, in a². */
  cellArea: number;
  /** Atoms it contains — `cellArea × planarDensity`, and a whole number. */
  atomsPerCell: number;
}

/**
 * Atom centres lying in the (hkl) plane through the origin, projected onto a
 * 2D frame, with the smallest repeat cell of that 2D net.
 *
 * The cell is found by taking the two shortest independent in-plane lattice
 * vectors. It is drawn for the reader; the density does not come from it —
 * see the note at the top of the file — but `atomsPerCell` closes the loop
 * between the two, and is asserted to be a whole number.
 */
export function planeMap(s: StructureDef, hkl: Triple, extent = 2): PlaneMap | null {
  const basis = latticeBasis(s);
  const pd = planarDensity(s, hkl);
  if (basis == null || pd == null) return null;

  const n: Triple = [hkl[0], hkl[1], hkl[2]];
  const nlen = norm(n);
  const unit: Triple = [n[0] / nlen, n[1] / nlen, n[2] / nlen];

  // Any vector not parallel to the normal gives a first in-plane axis.
  const seed: Triple = Math.abs(unit[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1raw: Triple = [
    seed[0] - dot(seed, unit) * unit[0],
    seed[1] - dot(seed, unit) * unit[1],
    seed[2] - dot(seed, unit) * unit[2],
  ];
  const e1len = norm(e1raw);
  const e1: Triple = [e1raw[0] / e1len, e1raw[1] / e1len, e1raw[2] / e1len];
  const e2: Triple = [
    unit[1] * e1[2] - unit[2] * e1[1],
    unit[2] * e1[0] - unit[0] * e1[2],
    unit[0] * e1[1] - unit[1] * e1[0],
  ];

  const points: [number, number][] = [];
  const inPlane: [number, number][] = [];
  for (let i = -extent; i <= extent; i++) {
    for (let j = -extent; j <= extent; j++) {
      for (let k = -extent; k <= extent; k++) {
        for (const p of basis) {
          const q: Triple = [p[0] + i, p[1] + j, p[2] + k];
          if (Math.abs(dot(q, unit)) > 1e-9) continue;
          const xy: [number, number] = [dot(q, e1), dot(q, e2)];
          points.push(xy);
          if (norm(q) > EPS) inPlane.push(xy);
        }
      }
    }
  }

  // Two shortest independent in-plane vectors.
  const sorted = [...inPlane].sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  const v1 = sorted[0];
  const v2 = sorted.find((v) => Math.abs(v[0] * v1[1] - v[1] * v1[0]) > 1e-9);
  if (v1 == null || v2 == null) return null;

  const cellArea = Math.abs(v1[0] * v2[1] - v1[1] * v2[0]);
  return {
    points,
    cell: [v1, v2],
    cellArea,
    atomsPerCell: cellArea * pd,
  };
}
