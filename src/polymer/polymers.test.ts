import { describe, expect, it } from 'vitest';
import {
  PE_AMORPHOUS,
  PE_CELL,
  PE_GRADES,
  POLYMERS,
  peCrystallineDensity,
  repeatUnitMass,
} from './polymers';
import { percentCrystallinity } from './model';
import { SELECTION_MATERIALS } from '../selection/materials';

/**
 * Repeat-unit masses are *computed* from `data/elements.json`, so this checks
 * the arithmetic against the masses these polymers are published with. Two
 * decimals is the precision those are quoted to; more would be asserting the
 * dataset's atomic masses rather than the formula.
 */
describe('repeat unit masses, computed from the app’s own element data', () => {
  const PUBLISHED: Record<string, number> = {
    pe: 28.05,
    pvc: 62.5,
    pp: 42.08,
    ps: 104.14,
    ptfe: 100.02,
    pmma: 100.12,
    nylon66: 226.32,
    pet: 192.17,
    pc: 254.28,
  };

  it('lands on the published mass for every polymer', () => {
    for (const p of POLYMERS) {
      expect(PUBLISHED[p.id], `no published mass listed for ${p.id}`).toBeDefined();
      expect(p.mass, `${p.label} (${p.formula})`).toBeCloseTo(PUBLISHED[p.id], 1);
    }
    expect(Object.keys(PUBLISHED).sort()).toEqual(POLYMERS.map((p) => p.id).sort());
  });

  it('refuses a formula it cannot read rather than weighing it short', () => {
    // A silently-ignored fragment would put every degree of polymerisation out
    // by a factor, and nothing downstream would look wrong.
    expect(() => repeatUnitMass('C2H4)')).toThrow();
    expect(() => repeatUnitMass('Xx2')).toThrow();
    expect(() => repeatUnitMass('c2h4')).toThrow();
  });

  it('counts the backbone bonds each repeat unit contributes', () => {
    // Vinyls put two carbons in the chain whatever hangs off them; the
    // condensation polymers put in as many as their repeat unit is long.
    for (const id of ['pe', 'pvc', 'pp', 'ps', 'ptfe', 'pmma']) {
      expect(POLYMERS.find((p) => p.id === id)!.backboneBonds, id).toBe(2);
    }
    expect(POLYMERS.find((p) => p.id === 'nylon66')!.backboneBonds).toBeGreaterThan(2);
  });
});

describe('the join onto Appendix B', () => {
  it('resolves every named entry, and leaves the rest without a density', () => {
    const names = new Set(SELECTION_MATERIALS.map((m) => m.name));
    for (const p of POLYMERS) {
      if (p.selectionName) {
        expect(names.has(p.selectionName), p.selectionName).toBe(true);
        expect(p.density).toBeGreaterThan(0);
      } else {
        expect(p.density).toBeUndefined();
      }
    }
    // Three of the nine have no Appendix B row. That is the `DOPABLE` shape:
    // the structure is known for all of them, a measured density is not.
    expect(POLYMERS.filter((p) => p.density === undefined).map((p) => p.id).sort())
      .toEqual(['ps', 'ptfe', 'pvc']);
  });
});

/**
 * The crystallinity data corroborating itself, which is why this module could
 * be built without a property table to type in.
 */
describe('crystalline and amorphous polyethylene', () => {
  it('derives ρc from the unit cell, and lands on the published 0.998 g/cm³', () => {
    // Two ethylene repeat units in an orthorhombic cell, through the same
    // nA/(V·N_A) `crystal/geometry.ts` uses for a metal. The cell parameters
    // are checkable by what they produce: a wrong edge would not land here.
    expect(peCrystallineDensity()).toBeCloseTo(0.998, 3);
    expect(PE_CELL.unitsPerCell).toBe(2);
  });

  it('is denser as a crystal than as a glass, and than any real grade', () => {
    const rhoC = peCrystallineDensity();
    expect(rhoC).toBeGreaterThan(PE_AMORPHOUS);
    for (const g of PE_GRADES) {
      expect(g.density, `${g.label} outside [ρa, ρc]`).toBeGreaterThan(PE_AMORPHOUS);
      expect(g.density, `${g.label} outside [ρa, ρc]`).toBeLessThan(rhoC);
    }
  });

  /**
   * And the check that corroborates ρa, the one measured number in the
   * dataset. With ρc derived above, the three polyethylene grades Appendix B
   * carries have to come out at the crystallinities those grades are known
   * for — 40–55% for LDPE, 65–80% for HDPE. A ρa wrong by much would push one
   * of the three out of its range, so the number is not standing on its own.
   */
  it('puts all three Appendix B grades inside their published ranges', () => {
    const rhoC = peCrystallineDensity();
    for (const g of PE_GRADES) {
      const c = percentCrystallinity(g.density, PE_AMORPHOUS, rhoC);
      expect(c, `${g.label} at ${c.toFixed(1)}%`).toBeGreaterThanOrEqual(g.expected[0]);
      expect(c, `${g.label} at ${c.toFixed(1)}%`).toBeLessThanOrEqual(g.expected[1]);
    }
  });

  it('ranks them low, medium, high — which is what the grades mean', () => {
    const rhoC = peCrystallineDensity();
    const [ldpe, uhmwpe, hdpe] = PE_GRADES.map((g) =>
      percentCrystallinity(g.density, PE_AMORPHOUS, rhoC),
    );
    expect(ldpe).toBeLessThan(uhmwpe);
    expect(uhmwpe).toBeLessThan(hdpe);
    // The branching story in one comparison: LDPE's side chains keep it from
    // packing, and it comes out around 25 points less crystalline than HDPE.
    expect(hdpe - ldpe).toBeGreaterThan(20);
  });
});
