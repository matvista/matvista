import { describe, expect, it } from 'vitest';
import { STRUCTURES, getStructure } from './structures';
import { buildAtoms, buildBonds, coordinationShell, distance } from './geometry';

/** Structures built from a single species of touching hard sphere. */
const ELEMENTAL = STRUCTURES.filter((s) => s.aOverR != null);

describe('structure data is self-consistent', () => {
  /**
   * APF is not independent data — it follows from N, the a↔R relation and the
   * cell volume. If a stated value disagrees with the geometry, one of them is
   * wrong and the module is teaching a number it does not compute.
   */
  it.each(ELEMENTAL.map((s) => s.id))('%s: stated APF matches the geometry', (id) => {
    const s = getStructure(id);
    const R = 1;
    const a = s.aOverR! * R;
    const cellVolume = s.volumeOverA3 * a ** 3;
    const sphereVolume = s.N * (4 / 3) * Math.PI * R ** 3;
    expect(sphereVolume / cellVolume).toBeCloseTo(s.APF, 2);
  });

  it('gives FCC and HCP the same APF — they differ only in stacking', () => {
    const fcc = getStructure('fcc');
    const hcp = getStructure('hcp');
    expect(fcc.APF).toBe(hcp.APF);
    expect(fcc.CN).toBe(hcp.CN);
  });

  it.each(STRUCTURES.filter((s) => s.cell === 'cubic').map((s) => s.id))(
    '%s: the basis lists exactly N atoms',
    (id) => {
      const s = getStructure(id);
      expect(s.basis).toHaveLength(s.N);
    },
  );

  it.each(ELEMENTAL.map((s) => s.id))('%s: a/R matches the relation in the label', (id) => {
    const s = getStructure(id);
    const expected: Record<string, number> = {
      sc: 2,
      fcc: 2 * Math.SQRT2,
      bcc: 4 / Math.sqrt(3),
      hcp: 2,
      diamond: 8 / Math.sqrt(3),
    };
    expect(s.aOverR!).toBeCloseTo(expected[id], 12);
  });
});

describe('geometry agrees with the data', () => {
  /**
   * The space-filling radius must be exactly half the nearest-neighbour
   * distance, or the "spheres just touch" view either overlaps or leaves gaps.
   */
  it.each(ELEMENTAL.map((s) => s.id))('%s: fillRadius is half the nearest approach', (id) => {
    const s = getStructure(id);
    const atoms = buildAtoms(s);
    let min = Infinity;
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const d = distance(atoms[i].pos, atoms[j].pos);
        if (d > 1e-6 && d < min) min = d;
      }
    }
    expect(s.species.M.fillRadius).toBeCloseTo(min / 2, 4);
  });

  /** A bond cutoff must reach the first shell and stop short of the second. */
  it.each(STRUCTURES.filter((s) => s.bondCutoff != null).map((s) => s.id))(
    '%s: bondCutoff sits between the first and second shell',
    (id) => {
      const s = getStructure(id);
      const atoms = buildAtoms(s);
      const ds: number[] = [];
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const d = distance(atoms[i].pos, atoms[j].pos);
          if (d > 1e-6) ds.push(d);
        }
      }
      ds.sort((a, b) => a - b);
      const first = ds[0];
      const second = ds.find((d) => d > first + 1e-3)!;
      expect(s.bondCutoff!).toBeGreaterThanOrEqual(first - 1e-9);
      expect(s.bondCutoff!).toBeLessThan(second);
    },
  );

  it('draws at least one bond wherever a cutoff is given', () => {
    for (const s of STRUCTURES.filter((x) => x.bondCutoff != null)) {
      // buildBonds takes (atoms, cutoff) — passing the structure itself makes
      // every count silently zero, which is how this test first "failed".
      expect(buildBonds(buildAtoms(s), s.bondCutoff).length).toBeGreaterThan(0);
    }
  });

  it('bonds only atoms within the cutoff, and never an atom to itself', () => {
    for (const s of STRUCTURES.filter((x) => x.bondCutoff != null)) {
      const atoms = buildAtoms(s);
      for (const [a, b] of buildBonds(atoms, s.bondCutoff)) {
        const d = distance(a.pos, b.pos);
        expect(d).toBeGreaterThan(0);
        expect(d).toBeLessThanOrEqual(s.bondCutoff! + 1e-6);
      }
    }
  });

  it('draws no bonds when the cutoff is null', () => {
    expect(buildBonds(buildAtoms(getStructure('fcc')), null)).toHaveLength(0);
  });
});

/**
 * The checkbox is labelled "Coordination shell (CN = {n})". If the highlight
 * does not contain exactly that many atoms, the label contradicts the picture.
 */
describe('the coordination shell contains exactly CN atoms', () => {
  it.each(ELEMENTAL.map((s) => s.id))('%s', (id) => {
    const s = getStructure(id);
    const shell = coordinationShell(s);
    expect(shell).not.toBeNull();
    expect(shell!.neighbours).toHaveLength(s.CN);
  });

  it.each(STRUCTURES.filter((s) => s.aOverR == null).map((s) => s.id))(
    '%s (compound): the shell is the stated CN too',
    (id) => {
      const s = getStructure(id);
      const shell = coordinationShell(s);
      if (shell) expect(shell.neighbours.length).toBe(s.CN);
    },
  );
});

describe('HCP is built as the conventional hexagonal prism', () => {
  const hcp = getStructure('hcp');
  const atoms = buildAtoms(hcp);

  it('draws 12 shared corners and 5 atoms of its own', () => {
    expect(atoms.filter((a) => a.image)).toHaveLength(12);
    expect(atoms.filter((a) => !a.image)).toHaveLength(5);
  });

  it('accounts for N = 6 by the usual sharing rules', () => {
    // 12 corners shared six ways, 2 basal centres shared two ways, 3 interior.
    expect(12 / 6 + 2 / 2 + 3).toBe(hcp.N);
  });

  it('puts the midplane atoms a/√3 from the prism axis', () => {
    const mid = atoms.filter((a) => !a.image && Math.abs(a.pos[1]) < 1e-9);
    expect(mid).toHaveLength(3);
    for (const m of mid) {
      expect(Math.hypot(m.pos[0], m.pos[2])).toBeCloseTo(1 / Math.sqrt(3), 9);
    }
  });
});
