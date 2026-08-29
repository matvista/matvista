/**
 * Geometry for the landing hero's rotating crystal.
 *
 * Deliberately dependency-free and DOM-free: the hero is decoration, so it must
 * not pull three.js into the first paint of the site's front door. Everything
 * here is plain arithmetic on plain objects, which also means the interesting
 * parts — the atom counts, the neighbour distance, the depth ordering — can be
 * asserted in a unit test rather than eyeballed in a browser.
 *
 * The lattice is FCC with a = 1, matching the convention in `crystal/structures`
 * where every distance is quoted as a fraction of the lattice parameter.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Two species, distinguished only so the renderer can draw them at different
 * sizes and colours. Real FCC metals are single-species — the split here is
 * corner versus face-centre, which is a visual device that makes the cell edges
 * legible while the structure turns, not a claim about chemistry.
 */
export interface Atom {
  p: Vec3;
  /** 0 = corner (large species), 1 = face centre (small species). */
  kind: 0 | 1;
}

/** Indices into the atom array rather than object references — the renderer
 * needs to look up a bond's endpoints in the *projected* array each frame, and
 * an index survives that mapping where a reference would not. */
export interface Bond {
  a: number;
  b: number;
}

/**
 * Nearest-neighbour separation in FCC with a = 1: half the face diagonal,
 * √2/2 ≈ 0.7071. This is the same first shell that `structures.ts` brackets
 * with its 0.75 bond cutoff for FCC.
 */
const NEAREST = Math.SQRT1_2;

/**
 * Bonding tolerance. Every coordinate is an exact multiple of a half, so squared
 * distances come out exact in binary floating point and this only needs to
 * absorb the last-bit noise of the subtraction — it is not a fuzzy cutoff, and
 * must stay far below the gap to the second shell at 1.0.
 */
const EPSILON = 1e-6;

/**
 * Build an FCC block spanning `cells` unit cells per axis, centred on the origin.
 *
 * Centring matters because the renderer rotates about the origin: an off-centre
 * block would orbit rather than spin. Corners and face centres are shared
 * between adjacent cells, so positions are de-duplicated on an exact key — the
 * grid is a half-integer lattice, so doubling every coordinate gives integers
 * and no epsilon is needed to decide whether two sites are the same site.
 *
 * Counts grow as (n+1)³ + 3n²(n+1): 14 atoms at cells = 1 and 63 at cells = 2,
 * which is what the hero uses. Cheap enough to re-project every frame without a
 * spatial index, and small enough that the O(n²) bond search below is free.
 */
export function fccLattice(cells: number): { atoms: Atom[]; bonds: Bond[] } {
  const n = Math.max(1, Math.floor(cells));
  const half = n / 2;
  const atoms: Atom[] = [];
  const seen = new Set<string>();

  const add = (x: number, y: number, z: number, kind: 0 | 1) => {
    const key = `${Math.round(x * 2)},${Math.round(y * 2)},${Math.round(z * 2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    atoms.push({ p: { x: x - half, y: y - half, z: z - half }, kind });
  };

  // Corners first, so the large species leads the array and reads as the frame
  // of the block; the loop runs to n inclusive because the far faces have them.
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      for (let k = 0; k <= n; k++) add(i, j, k, 0);
    }
  }

  // Six face centres per cell. The four shared with a neighbouring cell are
  // dropped by `add`, which is exactly the sharing rule that makes N = 4.
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        add(i + 0.5, j + 0.5, k, 1);
        add(i + 0.5, j + 0.5, k + 1, 1);
        add(i + 0.5, j, k + 0.5, 1);
        add(i + 0.5, j + 1, k + 0.5, 1);
        add(i, j + 0.5, k + 0.5, 1);
        add(i + 1, j + 0.5, k + 0.5, 1);
      }
    }
  }

  // Compared as squares to keep the inner loop free of sqrt; i < j visits every
  // unordered pair exactly once, so no bond is drawn twice and none is a loop.
  const lo = (NEAREST - EPSILON) ** 2;
  const hi = (NEAREST + EPSILON) ** 2;
  const bonds: Bond[] = [];
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const dx = atoms[i].p.x - atoms[j].p.x;
      const dy = atoms[i].p.y - atoms[j].p.y;
      const dz = atoms[i].p.z - atoms[j].p.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= lo && d2 <= hi) bonds.push({ a: i, b: j });
    }
  }

  return { atoms, bonds };
}

/**
 * Rotate about Y (yaw) and then about X (pitch).
 *
 * Order is fixed rather than configurable because rotations do not commute, and
 * this pairing is the one that reads as a turntable: yaw spins the block about
 * the vertical, pitch then tilts the whole turntable toward the viewer. Applying
 * pitch first would make the spin axis wobble with the tilt.
 *
 * A fresh object is returned rather than mutating in place — the caller keeps
 * the untransformed lattice and re-rotates it from scratch every frame, so
 * accumulating error is impossible.
 */
export function rotate(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x = p.x * cy + p.z * sy;
  const z = -p.x * sy + p.z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return {
    x,
    y: p.y * cp - z * sp,
    z: p.y * sp + z * cp,
  };
}

export interface Projected {
  x: number;
  y: number;
  /** Perspective factor fov/(dist+z) — multiply a world radius by it to size the atom. */
  scale: number;
  /** Rotated depth, carried through unchanged so the painter's sort can use it. */
  z: number;
}

/**
 * Perspective projection into canvas pixels.
 *
 * +z points away from the viewer, so the divisor grows with distance and far
 * atoms come out both closer to the centre and smaller — one factor, `scale`,
 * does the foreshortening and the sizing, which is why it is returned rather
 * than recomputed by the caller. The y axis is flipped because canvas y grows
 * downwards while the lattice's does not.
 *
 * The divisor is clamped to a small positive number: with a finite camera
 * distance an atom can in principle rotate behind the eye, and an unclamped
 * divide would send it to infinity — or flip it through the centre of the
 * screen, which looks far worse than a briefly oversized sphere.
 */
export function project(
  p: Vec3,
  opts: { fov: number; dist: number; cx: number; cy: number; zoom: number },
): Projected {
  const scale = opts.fov / Math.max(1e-3, opts.dist + p.z);
  return {
    x: opts.cx + p.x * scale * opts.zoom,
    y: opts.cy - p.y * scale * opts.zoom,
    scale,
    z: p.z,
  };
}

/**
 * Order for a painter's-algorithm draw: farthest first, nearest last.
 *
 * With the `project` convention above, +z is away from the viewer, so "farthest
 * first" means descending z. Painting in this order lets near atoms simply
 * overdraw the ones behind them, which is what buys depth without a z-buffer.
 *
 * Returns a copy — the caller holds one atom array for the lifetime of the
 * component and sorting it in place would scramble the indices that `Bond`
 * refers to. `Array.prototype.sort` is stable, so atoms at equal depth keep
 * their lattice order and the picture does not shimmer between frames.
 */
export function depthSort<T extends { z: number }>(items: T[]): T[] {
  return items.slice().sort((a, b) => b.z - a.z);
}
