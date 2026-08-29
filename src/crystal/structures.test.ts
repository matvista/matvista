import { describe, expect, it } from 'vitest';
import { STRUCTURES, getStructure, packingFactor } from './structures';
import { buildAtoms, buildBonds, coordinationShell, distance } from './geometry';
import { METALS } from './metals';

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
    expect(packingFactor(s)!.apf).toBeCloseTo(s.APF, 2);
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

/**
 * S7 — APF is derived on screen rather than tabulated, so the derivation has
 * to hold to more places than the two decimals `STRUCTURES` stores.
 * Reference values: Callister & Rethwisch ch. 3 — FCC and HCP 0.74, BCC 0.68,
 * simple cubic 0.52, diamond cubic 0.34.
 */
describe('packingFactor derives APF from the geometry', () => {
  const EXPECTED: Record<string, number> = {
    sc: 0.5236,
    fcc: 0.7405,
    bcc: 0.6802,
    hcp: 0.7405,
    diamond: 0.3401,
  };

  it.each(Object.keys(EXPECTED))('%s lands on the published value', (id) => {
    expect(packingFactor(getStructure(id))!.apf).toBeCloseTo(EXPECTED[id], 4);
  });

  it('reports the two volumes the quotient is taken over, in units of R³', () => {
    const fcc = packingFactor(getStructure('fcc'))!;
    expect(fcc.N).toBe(4);
    expect(fcc.sphereVolume).toBeCloseTo(4 * (4 / 3) * Math.PI, 12);
    expect(fcc.cellVolume).toBeCloseTo((2 * Math.SQRT2) ** 3, 12);
    expect(fcc.sphereVolume / fcc.cellVolume).toBe(fcc.apf);
  });

  it('uses the hexagonal prism volume for HCP, not a³', () => {
    const hcp = packingFactor(getStructure('hcp'))!;
    expect(hcp.cellVolume).toBeCloseTo(((3 * Math.sqrt(3)) / 2) * 1.633 * 2 ** 3, 12);
  });

  /**
   * The whole point of the derivation: R cancels. Copper and lead are both
   * FCC with radii 37% apart and must give the identical number.
   */
  it('is independent of R — copper and lead agree exactly', () => {
    const fcc = getStructure('fcc');
    const apfAt = (R: number) => {
      const a = fcc.aOverR! * R;
      return (fcc.N * (4 / 3) * Math.PI * R ** 3) / (fcc.volumeOverA3 * a ** 3);
    };
    const cu = METALS.find((m) => m.symbol === 'Cu')!;
    const pb = METALS.find((m) => m.symbol === 'Pb')!;
    expect(cu.R).toBe(0.1278);
    expect(pb.R).toBe(0.175);
    expect(apfAt(cu.R)).toBeCloseTo(apfAt(pb.R), 15);
    expect(apfAt(cu.R)).toBeCloseTo(packingFactor(fcc)!.apf, 15);
  });

  /**
   * The substitution the panel prints for copper:
   * 4 × (4/3)π(0.1278 nm)³ ÷ (0.3615 nm)³ = 0.740.
   */
  it('reproduces the copper substitution the panel shows', () => {
    const fcc = getStructure('fcc');
    const R = METALS.find((m) => m.symbol === 'Cu')!.R;
    const a = fcc.aOverR! * R;
    expect(a).toBeCloseTo(0.3615, 4);
    const spheres = fcc.N * (4 / 3) * Math.PI * R ** 3;
    const cell = a ** 3;
    expect(spheres).toBeCloseTo(0.03497, 5);
    expect(cell).toBeCloseTo(0.04723, 5);
    expect(spheres / cell).toBeCloseTo(0.740, 3);
  });

  it('ranks the four cubic structures the way the packing does', () => {
    const apf = (id: string) => packingFactor(getStructure(id))!.apf;
    expect(apf('fcc')).toBeGreaterThan(apf('bcc'));
    expect(apf('bcc')).toBeGreaterThan(apf('sc'));
    expect(apf('sc')).toBeGreaterThan(apf('diamond'));
  });

  /**
   * Rock salt, CsCl and perovskite have no single R, so there is no hard-sphere
   * derivation to show. They must return null, not a plausible-looking number
   * built from a radius that does not exist.
   */
  it.each(STRUCTURES.filter((s) => s.aOverR == null).map((s) => s.id))(
    '%s (compound): refuses to derive an APF',
    (id) => {
      expect(packingFactor(getStructure(id))).toBeNull();
    },
  );
});
