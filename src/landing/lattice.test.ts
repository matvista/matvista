import { describe, expect, it } from 'vitest';
import { depthSort, fccLattice, project, rotate, type Vec3 } from './lattice';

const NEAREST = Math.SQRT1_2;

function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function key(v: Vec3): string {
  return `${Math.round(v.x * 2)},${Math.round(v.y * 2)},${Math.round(v.z * 2)}`;
}

describe('fccLattice builds a shared-site FCC block', () => {
  /**
   * The counts are the whole point of de-duplication. A naive build that emitted
   * 8 corners and 6 face centres per cell would give 8n³ + 6n³ atoms — 112 at
   * cells = 2 instead of 63 — and every shared site would be drawn twice, which
   * shows up as a subtly wrong highlight rather than as an obvious error.
   */
  it('gives 14 atoms for a single cell: 8 corners and 6 face centres', () => {
    const { atoms } = fccLattice(1);
    expect(atoms).toHaveLength(14);
    expect(atoms.filter((a) => a.kind === 0)).toHaveLength(8);
    expect(atoms.filter((a) => a.kind === 1)).toHaveLength(6);
  });

  it('gives 63 atoms for 2×2×2: (n+1)³ corners and 3n²(n+1) face centres', () => {
    const { atoms } = fccLattice(2);
    expect(atoms).toHaveLength(27 + 36);
    expect(atoms.filter((a) => a.kind === 0)).toHaveLength(3 ** 3);
    expect(atoms.filter((a) => a.kind === 1)).toHaveLength(3 * 2 ** 2 * 3);
  });

  it('stays well under the 250-atom budget the hero draws each frame', () => {
    expect(fccLattice(2).atoms.length).toBeLessThan(250);
  });

  it.each([1, 2, 3])('cells=%i: no position appears twice', (cells) => {
    const { atoms } = fccLattice(cells);
    expect(new Set(atoms.map((a) => key(a.p))).size).toBe(atoms.length);
  });

  it.each([1, 2])('cells=%i: the block is centred on the origin', (cells) => {
    const { atoms } = fccLattice(cells);
    const sum = atoms.reduce(
      (acc, a) => ({ x: acc.x + a.p.x, y: acc.y + a.p.y, z: acc.z + a.p.z }),
      { x: 0, y: 0, z: 0 },
    );
    expect(length(sum)).toBeCloseTo(0, 9);
  });

  /** Corners sit on the integer grid, face centres on exactly two halves. */
  it('places each kind on the site the label claims', () => {
    for (const a of fccLattice(2).atoms) {
      const halves = [a.p.x, a.p.y, a.p.z].filter((c) => Math.abs(c % 1) > 1e-9).length;
      expect(halves).toBe(a.kind === 0 ? 0 : 2);
    }
  });
});

describe('bonds are the FCC first shell', () => {
  const { atoms, bonds } = fccLattice(2);

  it('draws some', () => {
    expect(bonds.length).toBeGreaterThan(0);
  });

  it('gives every bond the nearest-neighbour length √2/2', () => {
    for (const b of bonds) {
      const p = atoms[b.a].p;
      const q = atoms[b.b].p;
      expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeCloseTo(NEAREST, 9);
    }
  });

  it('references valid atoms and never bonds an atom to itself', () => {
    for (const b of bonds) {
      expect(b.a).toBeGreaterThanOrEqual(0);
      expect(b.b).toBeLessThan(atoms.length);
      expect(b.a).not.toBe(b.b);
    }
  });

  it('lists each pair exactly once', () => {
    const seen = bonds.map((b) => `${Math.min(b.a, b.b)}-${Math.max(b.a, b.b)}`);
    expect(new Set(seen).size).toBe(bonds.length);
  });

  /**
   * FCC has CN = 12, and the corner at the centre of a 2×2×2 block is the one
   * site with all twelve neighbours present. If the tolerance ever widened to
   * catch the second shell at 1.0, this count would jump to 18.
   */
  it('gives the fully surrounded central atom twelve neighbours', () => {
    const centre = atoms.findIndex((a) => length(a.p) < 1e-9);
    expect(centre).toBeGreaterThanOrEqual(0);
    const degree = bonds.filter((b) => b.a === centre || b.b === centre).length;
    expect(degree).toBe(12);
  });
});

describe('rotate', () => {
  const p: Vec3 = { x: 0.7, y: -0.4, z: 0.25 };

  it('is rigid — the length never changes', () => {
    for (const yaw of [0, 0.3, 1.1, -2.4]) {
      for (const pitch of [0, 0.2, -1.5]) {
        expect(length(rotate(p, yaw, pitch))).toBeCloseTo(length(p), 12);
      }
    }
  });

  it('returns the point to where it started after a full turn', () => {
    const t = Math.PI * 2;
    const back = rotate(p, t, t);
    expect(back.x).toBeCloseTo(p.x, 12);
    expect(back.y).toBeCloseTo(p.y, 12);
    expect(back.z).toBeCloseTo(p.z, 12);
  });

  it('leaves each rotation axis alone', () => {
    const up = rotate({ x: 0, y: 1, z: 0 }, 1.2, 0);
    expect(up.y).toBeCloseTo(1, 12);
    const side = rotate({ x: 1, y: 0, z: 0 }, 0, 0.9);
    expect(side.x).toBeCloseTo(1, 12);
  });

  it('yaws about Y before pitching, so the two do not commute', () => {
    const a = rotate(p, 0.8, 0.5);
    const b = rotate(rotate(p, 0, 0.5), 0.8, 0);
    expect(length(a)).toBeCloseTo(length(b), 12);
    expect(a.y).not.toBeCloseTo(b.y, 6);
  });
});

describe('project', () => {
  const opts = { fov: 1, dist: 4, cx: 100, cy: 50, zoom: 200 };

  it('shrinks distant points and pulls them toward the centre', () => {
    const near = project({ x: 1, y: 1, z: -1 }, opts);
    const far = project({ x: 1, y: 1, z: 1 }, opts);
    expect(far.scale).toBeLessThan(near.scale);
    expect(far.x - opts.cx).toBeLessThan(near.x - opts.cx);
    expect(opts.cy - far.y).toBeLessThan(opts.cy - near.y);
  });

  it('puts the origin at the given centre and flips the y axis', () => {
    const o = project({ x: 0, y: 0, z: 0 }, opts);
    expect(o.x).toBe(opts.cx);
    expect(o.y).toBe(opts.cy);
    expect(project({ x: 0, y: 1, z: 0 }, opts).y).toBeLessThan(opts.cy);
  });

  it('carries depth through untouched, for the sort to use', () => {
    expect(project({ x: 3, y: 3, z: -0.42 }, opts).z).toBe(-0.42);
  });

  it('stays finite when a point rotates behind the camera', () => {
    const behind = project({ x: 1, y: 1, z: -opts.dist - 5 }, opts);
    expect(Number.isFinite(behind.x)).toBe(true);
    expect(Number.isFinite(behind.y)).toBe(true);
    expect(behind.scale).toBeGreaterThan(0);
  });
});

describe('depthSort', () => {
  it('orders far to near — descending z, since +z is away from the viewer', () => {
    const out = depthSort([{ z: -1 }, { z: 2 }, { z: 0 }]);
    expect(out.map((i) => i.z)).toEqual([2, 0, -1]);
  });

  it('does not mutate or alias its input', () => {
    const input = [{ z: 1 }, { z: 5 }, { z: 3 }];
    const out = depthSort(input);
    expect(input.map((i) => i.z)).toEqual([1, 5, 3]);
    expect(out).not.toBe(input);
    expect(out[0]).toBe(input[1]);
  });

  it('is stable, so equal depths keep their lattice order', () => {
    const input = [
      { z: 0, tag: 'a' },
      { z: 1, tag: 'b' },
      { z: 0, tag: 'c' },
      { z: 1, tag: 'd' },
    ];
    expect(depthSort(input).map((i) => i.tag)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('handles the empty case', () => {
    expect(depthSort([])).toEqual([]);
  });
});
