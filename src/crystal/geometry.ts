import type { StructureDef } from './structures';

export interface Atom {
  pos: [number, number, number];
  species: string;
  /** True for periodic images added only so the cell looks complete. */
  image: boolean;
}

const EPS = 1e-6;

/**
 * Cartesian atom positions for one unit cell, centred on the origin.
 * Basis atoms lying on a cell face/edge/corner are duplicated onto the
 * opposite side so the cell renders the way textbooks draw it.
 */
export function buildAtoms(s: StructureDef): Atom[] {
  return s.cell === 'hexagonal' ? buildHexAtoms(s) : buildCubicAtoms(s);
}

function buildCubicAtoms(s: StructureDef): Atom[] {
  const out: Atom[] = [];
  for (const { pos, species } of s.basis) {
    // Each coordinate sitting at 0 also appears at 1 in the neighbouring cell.
    const axes = pos.map((v) => (Math.abs(v) < EPS ? [0, 1] : [v]));
    for (const x of axes[0]) {
      for (const y of axes[1]) {
        for (const z of axes[2]) {
          const isImage = x !== pos[0] || y !== pos[1] || z !== pos[2];
          out.push({ pos: [x - 0.5, y - 0.5, z - 0.5], species, image: isImage });
        }
      }
    }
  }
  return out;
}

/**
 * The conventional HCP cell as Callister draws it: a hexagonal prism with
 * 12 corner atoms, 2 basal-face centres, and 3 midplane interior atoms — the
 * arrangement that gives N = 3 + 2/2 + 12/6 = 6.
 */
function buildHexAtoms(s: StructureDef): Atom[] {
  const coa = s.coa ?? 1.633;
  const c = coa; // with a = 1
  const out: Atom[] = [];

  // Hexagon corners, radius a = 1 in the basal plane.
  for (const level of [-c / 2, c / 2]) {
    for (let k = 0; k < 6; k++) {
      const th = (Math.PI / 3) * k;
      out.push({
        pos: [Math.cos(th), level, Math.sin(th)],
        species: 'M',
        image: true,
      });
    }
    out.push({ pos: [0, level, 0], species: 'M', image: false });
  }

  // Three midplane atoms, sitting over alternating triangular interstices.
  for (let k = 0; k < 3; k++) {
    const th = (Math.PI / 3) * (2 * k) + Math.PI / 6;
    const r = 1 / Math.sqrt(3);
    out.push({
      pos: [r * Math.cos(th), 0, r * Math.sin(th)],
      species: 'M',
      image: false,
    });
  }

  return out;
}

/** Cell wireframe segments as flat [x1,y1,z1, x2,y2,z2, …] in cell units. */
export function buildCellEdges(s: StructureDef): Float32Array {
  if (s.cell === 'hexagonal') {
    const c = s.coa ?? 1.633;
    const pts: number[] = [];
    const corner = (k: number, y: number): [number, number, number] => {
      const th = (Math.PI / 3) * k;
      return [Math.cos(th), y, Math.sin(th)];
    };
    for (const y of [-c / 2, c / 2]) {
      for (let k = 0; k < 6; k++) {
        pts.push(...corner(k, y), ...corner((k + 1) % 6, y));
      }
    }
    for (let k = 0; k < 6; k++) {
      pts.push(...corner(k, -c / 2), ...corner(k, c / 2));
    }
    return new Float32Array(pts);
  }

  const v: [number, number, number][] = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const pts: number[] = [];
  for (const [i, j] of edges) pts.push(...v[i], ...v[j]);
  return new Float32Array(pts);
}

/** Nearest-neighbour bonds between displayed atoms, within the structure's cutoff. */
export function buildBonds(atoms: Atom[], cutoff: number | null): [Atom, Atom][] {
  if (cutoff == null) return [];
  const out: [Atom, Atom][] = [];
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      if (distance(atoms[i].pos, atoms[j].pos) <= cutoff + EPS) {
        out.push([atoms[i], atoms[j]]);
      }
    }
  }
  return out;
}

/**
 * The coordination shell of the most central atom: its nearest neighbours,
 * found by taking every atom at (approximately) the minimum separation.
 * Uses a supercell so neighbours outside the drawn cell are still counted —
 * without that, an atom on the cell boundary appears under-coordinated.
 */
export function coordinationShell(s: StructureDef): {
  centre: [number, number, number];
  neighbours: [number, number, number][];
  distance: number;
} | null {
  const cloud = expandToSupercell(s);
  if (cloud.length === 0) return null;

  // Pick the atom nearest the cell centre as the reference.
  let centre = cloud[0];
  let best = Infinity;
  for (const p of cloud) {
    const d = distance(p, [0, 0, 0]);
    if (d < best) {
      best = d;
      centre = p;
    }
  }

  let min = Infinity;
  for (const p of cloud) {
    const d = distance(p, centre);
    if (d > EPS && d < min) min = d;
  }

  const neighbours = cloud.filter((p) => {
    const d = distance(p, centre);
    return d > EPS && d < min * 1.08;
  });

  return { centre, neighbours, distance: min };
}

/** 3×3×3 tiling of the cell, so boundary atoms have their full neighbour set. */
function expandToSupercell(s: StructureDef): [number, number, number][] {
  const base = buildAtoms(s);
  const out: [number, number, number][] = [];
  const seen = new Set<string>();

  if (s.cell === 'hexagonal') {
    const c = s.coa ?? 1.633;
    // Basal-plane lattice vectors for the hexagonal cell (a = 1).
    const a1: [number, number, number] = [1.5, 0, Math.sqrt(3) / 2];
    const a2: [number, number, number] = [1.5, 0, -Math.sqrt(3) / 2];
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          for (const at of base) {
            push(out, seen, [
              at.pos[0] + i * a1[0] + j * a2[0],
              at.pos[1] + k * c,
              at.pos[2] + i * a1[2] + j * a2[2],
            ]);
          }
        }
      }
    }
    return out;
  }

  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (let k = -1; k <= 1; k++) {
        for (const at of base) {
          push(out, seen, [at.pos[0] + i, at.pos[1] + j, at.pos[2] + k]);
        }
      }
    }
  }
  return out;
}

function push(
  out: [number, number, number][],
  seen: Set<string>,
  p: [number, number, number],
) {
  const key = p.map((v) => v.toFixed(4)).join(',');
  if (seen.has(key)) return;
  seen.add(key);
  out.push(p);
}

export function distance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
