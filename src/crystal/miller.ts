/**
 * Miller index arithmetic, plane geometry and slip systems.
 * Conventions follow Callister & Rethwisch, ch. 3 (crystallographic points,
 * directions and planes) and ch. 7 (slip systems, resolved shear stress).
 *
 * Everything here is cubic unless stated. Hexagonal cells use the four-index
 * Miller–Bravais scheme, which `toMillerBravais` covers for display only.
 */

export type Triple = [number, number, number];

/** A plane (hkl) or a direction [uvw] — the arithmetic differs, so they are tagged. */
export type IndexKind = 'plane' | 'direction';

const EPS = 1e-9;

/* ------------------------------------------------------------------ parsing */

/**
 * Read indices from free text. Accepts the forms students actually type:
 * `111`, `1 1 1`, `1,1,1`, `(111)`, `[1-10]`, `-1 1 1`, and the overbar
 * notation `1̄11` (combining macron U+0304, or the standalone bar U+0305).
 */
export function parseIndices(text: string): Triple | null {
  const cleaned = text.trim().replace(/^[([<{]+|[)\]>}]+$/g, '').trim();
  if (!cleaned) return null;

  // Compact `111` has to mean three indices, while `10 2 0` has to mean one
  // index of ten — so a separator is what licenses multi-digit indices.
  const separated = /[\s,;]/.test(cleaned);
  const out = separated ? parseTokens(cleaned) : parseCompact(cleaned);

  if (!out || out.length !== 3) return null;
  if (out.every((v) => v === 0)) return null; // (000) is not a plane or a direction
  return out as Triple;
}

/** `10 2 0`, `-1 1 1`, `1̄ 1 1` — one token per index. */
function parseTokens(s: string): number[] | null {
  const out: number[] = [];
  for (const raw of s.split(/[\s,;]+/).filter(Boolean)) {
    let token = raw;
    let sign = 1;
    if (token.includes('̄') || token.includes('̅') || token.includes('¯')) {
      sign = -1;
      token = token.replace(/[̄̅¯]/g, '');
    }
    if (token.startsWith('-') || token.startsWith('−')) {
      sign = -sign;
      token = token.slice(1);
    }
    if (!/^\d+$/.test(token)) return null;
    out.push(sign * Number(token));
  }
  return out;
}

/** `111`, `1-10`, `1̄11` — one digit per index, bars applying to the digit before. */
function parseCompact(s: string): number[] | null {
  const out: number[] = [];
  let sign = 1;
  for (const ch of s) {
    if (ch === '̄' || ch === '̅' || ch === '¯') {
      // A bar sits after the digit it negates.
      if (out.length === 0) return null;
      out[out.length - 1] = -out[out.length - 1];
      continue;
    }
    if (ch === '-' || ch === '−') {
      sign = -1;
      continue;
    }
    if (/\d/.test(ch)) {
      out.push(sign * Number(ch));
      sign = 1;
      continue;
    }
    return null; // anything else is a typo, not an index
  }
  return out;
}

/**
 * Render with overbars, the way indices are written by hand.
 *
 * A double-digit index has to be spaced out, or `(10 2 0)` would collapse to
 * `(1020)` — which `parseIndices` rightly reads as four separate indices, so
 * the text would not survive a round trip back into the input box.
 */
export function formatIndices(idx: Triple, kind: IndexKind = 'plane'): string {
  const body = bareIndices(idx);
  return kind === 'plane' ? `(${body})` : `[${body}]`;
}

export function formatFamily(idx: Triple, kind: IndexKind = 'plane'): string {
  const body = bareIndices(idx);
  return kind === 'plane' ? `{${body}}` : `⟨${body}⟩`;
}

/** Index text without brackets — what an input box round-trips through. */
export function bareIndices(idx: Triple): string {
  const parts = idx.map((v) => (v < 0 ? `${Math.abs(v)}̄` : `${v}`));
  const multiDigit = idx.some((v) => Math.abs(v) > 9);
  return parts.join(multiDigit ? ' ' : '');
}

/* -------------------------------------------------------------- plane basics */

export interface Intercept {
  axis: 'a' | 'b' | 'c';
  index: number;
  /** Fractional intercept, or null when the plane runs parallel to the axis. */
  value: number | null;
}

/**
 * Where the plane cuts each axis, by definition: intercept = 1/index. The whole
 * point of the Miller scheme is that the index is the *reciprocal* of the
 * intercept, so a zero index means the plane never meets that axis.
 *
 * These are the textbook intercepts, which for a negative index fall outside
 * the cell — that is precisely why the drawing shifts the origin. Use
 * `drawnOffset` for the plane actually rendered, and say so in the UI rather
 * than quietly showing one and drawing the other.
 */
export function intercepts(hkl: Triple): Intercept[] {
  const axes: ('a' | 'b' | 'c')[] = ['a', 'b', 'c'];
  return hkl.map((index, i) => ({
    axis: axes[i],
    index,
    value: index === 0 ? null : 1 / index,
  }));
}

/**
 * Which plane of the parallel set to draw, as the n in h·x + k·y + l·z = n.
 *
 * Callister's rule for a negative index is to shift the origin to the corner
 * that makes every intercept positive, which is exactly n = (sum of the
 * negative indices) + 1. For all-positive indices that is the familiar n = 1.
 *
 * Picking n by symmetry rather than by "nearest to 1" matters: every member of
 * a family must come out congruent, or the app would draw {123} members as
 * visibly different shapes while telling students they are identical.
 */
export function drawnOffset(hkl: Triple): number {
  return hkl.reduce((sum, v) => sum + Math.min(v, 0), 0) + 1;
}

/** Interplanar spacing for a cubic lattice: d = a / √(h²+k²+l²). */
export function dSpacing(hkl: Triple, a: number): number {
  return a / Math.sqrt(hkl[0] ** 2 + hkl[1] ** 2 + hkl[2] ** 2);
}

/** Reduce to lowest terms — (222) and (111) describe parallel planes. */
export function reduce(idx: Triple): Triple {
  const g = idx.reduce((acc, v) => gcd(acc, Math.abs(v)), 0);
  return g > 1 ? (idx.map((v) => v / g) as Triple) : idx;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Angle in degrees between two planes (via their normals) or two directions.
 * Valid for cubic cells, where the (hkl) normal is parallel to [hkl].
 */
export function angleBetween(u: Triple, v: Triple): number {
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const nu = Math.hypot(...u);
  const nv = Math.hypot(...v);
  if (nu < EPS || nv < EPS) return NaN;
  const c = Math.max(-1, Math.min(1, dot / (nu * nv)));
  return (Math.acos(c) * 180) / Math.PI;
}

/** True when a direction lies in a plane — the condition for a slip system. */
export function liesInPlane(hkl: Triple, uvw: Triple): boolean {
  return Math.abs(hkl[0] * uvw[0] + hkl[1] * uvw[1] + hkl[2] * uvw[2]) < EPS;
}

/* -------------------------------------------------------------------- family */

/**
 * The members of a family: every permutation of the indices with every
 * combination of signs. A plane and its negative are the same plane, and a
 * slip direction and its reverse are the same slip direction, so members are
 * deduplicated by ± pair — which is why {100} has 3 members and not 6.
 */
export function family(idx: Triple): Triple[] {
  const [p, q, r] = idx.map(Math.abs);
  const perms = permutations([p, q, r]);
  const seen = new Set<string>();
  const out: Triple[] = [];

  for (const perm of perms) {
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        for (const sz of [1, -1]) {
          const cand: Triple = [perm[0] * sx, perm[1] * sy, perm[2] * sz];
          if (cand.every((v) => v === 0)) continue;
          const key = canonicalKey(cand);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(cand);
        }
      }
    }
  }
  return out;
}

/** Collapse ±v to one key, so [110] and [1̄1̄0] are recognised as one member. */
function canonicalKey(v: Triple): string {
  const neg: Triple = [-v[0], -v[1], -v[2]];
  const a = v.join(',');
  const b = neg.join(',');
  return a < b ? a : b;
}

function permutations(v: number[]): number[][] {
  const out: number[][] = [];
  const seen = new Set<string>();
  const walk = (rest: number[], acc: number[]) => {
    if (rest.length === 0) {
      const key = acc.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        out.push([...acc]);
      }
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      walk([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, rest[i]]);
    }
  };
  walk(v, []);
  return out;
}

/* ------------------------------------------------- Miller–Bravais (hexagonal) */

/**
 * Three-index (hkl) to four-index (hkil), with i = −(h+k).
 * The redundant third index makes the symmetry of the hexagonal basal plane
 * visible: members of a family become permutations of the first three digits.
 */
export function toMillerBravais(hkl: Triple): [number, number, number, number] {
  const [h, k, l] = hkl;
  return [h, k, -(h + k), l];
}

/* ------------------------------------------------------- plane as a polygon */

/**
 * The plane's cross-section through the unit cell, as an ordered polygon in
 * scene coordinates (the cell spans −0.5…0.5 on each axis, matching
 * `buildCellEdges`).
 *
 * The plane drawn is the one `drawnOffset` selects — the origin-shifted plane
 * that keeps every intercept positive, so that all members of a family come out
 * congruent.
 */
export function planePolygon(hkl: Triple): {
  vertices: Triple[];
  /** The n in h·x + k·y + l·z = n that was drawn, in fractional coordinates. */
  n: number;
} | null {
  const n = drawnOffset(hkl);
  const verts = cutCell(hkl, n);
  return verts.length >= 3 ? { vertices: verts, n } : null;
}

/**
 * Clip the plane against the 12 cell edges and order the hits into a convex
 * polygon. Working edge by edge keeps this exact for the face-coincident cases
 * — (100) lands precisely on a cell face rather than missing it by a rounding
 * error.
 */
function cutCell(hkl: Triple, n: number): Triple[] {
  const [h, k, l] = hkl;
  // Scene coordinates: X = x − 0.5, so the offset shifts by half the index sum.
  const c = n - 0.5 * (h + k + l);

  const v: Triple[] = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
  ];
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  const f = (p: Triple) => h * p[0] + k * p[1] + l * p[2] - c;
  const hits: Triple[] = [];
  const seen = new Set<string>();

  const add = (p: Triple) => {
    const key = p.map((q) => q.toFixed(6)).join(',');
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(p);
  };

  for (const [i, j] of edges) {
    const a = v[i];
    const b = v[j];
    const fa = f(a);
    const fb = f(b);
    if (Math.abs(fa) < 1e-9) add(a);
    if (Math.abs(fb) < 1e-9) add(b);
    if (fa * fb < 0) {
      const t = fa / (fa - fb);
      add([
        a[0] + t * (b[0] - a[0]),
        a[1] + t * (b[1] - a[1]),
        a[2] + t * (b[2] - a[2]),
      ]);
    }
  }

  if (hits.length < 3) return [];
  return orderAroundCentroid(hits, hkl);
}

/** Sort coplanar points by angle about their centroid, giving a drawable ring. */
function orderAroundCentroid(pts: Triple[], normal: Triple): Triple[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;

  const nn = norm(normal);
  // Any vector not parallel to the normal seeds an in-plane basis.
  const seed: Triple = Math.abs(nn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = norm(cross(nn, seed));
  const e2 = cross(nn, e1);

  return [...pts].sort((p, q) => angleOf(p) - angleOf(q));

  function angleOf(p: Triple): number {
    const d: Triple = [p[0] - cx, p[1] - cy, p[2] - cz];
    return Math.atan2(dot(d, e2), dot(d, e1));
  }
}

function cross(a: Triple, b: Triple): Triple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Triple, b: Triple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function norm(a: Triple): Triple {
  const m = Math.hypot(...a);
  return m < EPS ? a : [a[0] / m, a[1] / m, a[2] / m];
}

/**
 * A direction [uvw] drawn as a segment inside the cell, scaled so the longest
 * component just reaches the cell wall. Directions are drawn from the cell
 * origin corner, which is how the vector is constructed by hand.
 */
export function directionSegment(uvw: Triple): { from: Triple; to: Triple } {
  const maxComp = Math.max(...uvw.map(Math.abs));
  const s = maxComp > 0 ? 1 / maxComp : 1;
  // Start at the corner the vector points away from, so it stays inside the cell.
  const from: Triple = [
    uvw[0] >= 0 ? -0.5 : 0.5,
    uvw[1] >= 0 ? -0.5 : 0.5,
    uvw[2] >= 0 ? -0.5 : 0.5,
  ];
  return {
    from,
    to: [
      from[0] + uvw[0] * s,
      from[1] + uvw[1] * s,
      from[2] + uvw[2] * s,
    ],
  };
}

/* --------------------------------------------------------------- slip systems */

export interface SlipSystem {
  plane: Triple;
  direction: Triple;
  /** Family label, e.g. "{111}⟨110⟩". */
  familyLabel: string;
}

export interface SlipFamily {
  planeFamily: Triple;
  directionFamily: Triple;
  label: string;
  note: string;
}

export interface SlipMode {
  id: string;
  /** Structure ids from `crystal/structures.ts` this mode applies to. */
  structure: string;
  name: string;
  families: SlipFamily[];
  note: string;
}

export const SLIP_MODES: SlipMode[] = [
  {
    id: 'fcc',
    structure: 'fcc',
    name: 'FCC — {111}⟨110⟩',
    families: [
      {
        planeFamily: [1, 1, 1],
        directionFamily: [1, 1, 0],
        label: '{111}⟨110⟩',
        note: 'The close-packed planes, slipping along close-packed directions.',
      },
    ],
    note: 'Four {111} planes, each carrying three ⟨110⟩ directions: 12 systems, all of them close-packed. Plenty of independent systems at any orientation is what makes copper and aluminium so ductile.',
  },
  {
    id: 'bcc',
    structure: 'bcc',
    name: 'BCC — ⟨111⟩ on three plane families',
    families: [
      {
        planeFamily: [1, 1, 0],
        directionFamily: [1, 1, 1],
        label: '{110}⟨111⟩',
        note: 'The densest planes available in BCC — dominant at low temperature.',
      },
      {
        planeFamily: [1, 1, 2],
        directionFamily: [1, 1, 1],
        label: '{112}⟨111⟩',
        note: 'Activates as temperature rises.',
      },
      {
        planeFamily: [1, 2, 3],
        directionFamily: [1, 1, 1],
        label: '{123}⟨111⟩',
        note: 'The last family to activate; contributes at high temperature.',
      },
    ],
    note: 'BCC has 48 systems — four times FCC — yet BCC metals are the less ductile pair. No BCC plane is truly close-packed, so the shear stress needed to move a dislocation is far higher, and it climbs steeply as temperature falls. That temperature sensitivity is the ductile-to-brittle transition.',
  },
];

/** Every distinct system for a mode, generated from its families. */
export function slipSystems(mode: SlipMode): SlipSystem[] {
  const out: SlipSystem[] = [];
  for (const fam of mode.families) {
    for (const plane of family(fam.planeFamily)) {
      for (const direction of family(fam.directionFamily)) {
        if (!liesInPlane(plane, direction)) continue;
        out.push({ plane, direction, familyLabel: fam.label });
      }
    }
  }
  return out;
}

/**
 * Schmid factor m = cos φ · cos λ, where φ is the angle between the tensile
 * axis and the slip-plane normal, and λ the angle between the axis and the slip
 * direction. The resolved shear stress on the system is τ = σ·m, so the system
 * with the largest m yields first.
 */
export function schmidFactor(axis: Triple, plane: Triple, direction: Triple): number {
  const cosPhi = Math.cos((angleBetween(axis, plane) * Math.PI) / 180);
  const cosLambda = Math.cos((angleBetween(axis, direction) * Math.PI) / 180);
  return Math.abs(cosPhi * cosLambda);
}

export interface RankedSystem extends SlipSystem {
  m: number;
  phi: number;
  lambda: number;
}

/**
 * Fold an angle into 0…90°. Which end of a plane normal, or which way along a
 * slip direction, is a free choice, so the supplementary angle describes the
 * same geometry — and |cos| is unchanged by the fold, so the reported φ and λ
 * stay consistent with the reported m. Textbooks quote the acute value.
 */
export function acute(deg: number): number {
  return deg > 90 ? 180 - deg : deg;
}

/** Every system ranked by Schmid factor; the head of the list slips first. */
export function rankSystems(mode: SlipMode, axis: Triple): RankedSystem[] {
  return slipSystems(mode)
    .map((s) => ({
      ...s,
      m: schmidFactor(axis, s.plane, s.direction),
      phi: acute(angleBetween(axis, s.plane)),
      lambda: acute(angleBetween(axis, s.direction)),
    }))
    .sort((a, b) => b.m - a.m);
}

/**
 * Resolved shear stress on a system carrying Schmid factor m under an applied
 * stress σ: τ = σ·m. Evaluated at yield with m_max this is the CRSS, but the
 * slider drives it at any σ, so the name stays general.
 */
export function resolvedShearStress(sigma: number, m: number): number {
  return sigma * m;
}
