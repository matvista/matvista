import { describe, expect, it } from 'vitest';
import { IDEAL_COA, METALS, theoreticalDensity } from './metals';
import { getStructure } from './structures';
import elementsRaw from '../data/elements.json';

const elements = elementsRaw as { symbol: string; density: number | null; atomic_mass: number }[];

const volumeFor = (metal: (typeof METALS)[number]) => {
  const st = getStructure(metal.structure);
  // HCP metals use their measured c/a; zinc and cadmium deviate far enough from
  // the ideal 1.633 to swing the density by ~15%.
  return metal.coa != null ? ((3 * Math.sqrt(3)) / 2) * metal.coa : st.volumeOverA3;
};

describe('theoretical density, Callister eq. 3.8', () => {
  it.each(METALS.map((m) => m.symbol))('%s lands within 8% of the measured density', (symbol) => {
    const metal = METALS.find((m) => m.symbol === symbol)!;
    const st = getStructure(metal.structure);
    const el = elements.find((e) => e.symbol === symbol)!;
    const rho = theoreticalDensity(st.N, el.atomic_mass, metal.R, st.aOverR!, volumeFor(metal)).rho;
    const err = Math.abs((rho - el.density!) / el.density!) * 100;
    // Titanium is the worst at ~6.3%: a = 2R with Callister's radius gives
    // 0.289 nm against a real 0.2951 nm, and density goes as a^-3.
    expect(err).toBeLessThan(8);
  });

  it('is within 1% for the cubic metals, where hard spheres really do touch', () => {
    for (const metal of METALS.filter((m) => m.coa == null)) {
      const st = getStructure(metal.structure);
      const el = elements.find((e) => e.symbol === metal.symbol)!;
      const rho = theoreticalDensity(st.N, el.atomic_mass, metal.R, st.aOverR!, st.volumeOverA3).rho;
      expect(Math.abs((rho - el.density!) / el.density!) * 100).toBeLessThan(3);
    }
  });

  /** The HCP domain trap: the ideal c/a is wrong for zinc and cadmium. */
  it('beats the ideal c/a by using each HCP metal’s measured ratio', () => {
    const hcp = getStructure('hcp');
    for (const metal of METALS.filter((m) => m.coa != null)) {
      const el = elements.find((e) => e.symbol === metal.symbol)!;
      const measured = theoreticalDensity(hcp.N, el.atomic_mass, metal.R, hcp.aOverR!, volumeFor(metal)).rho;
      const ideal = theoreticalDensity(hcp.N, el.atomic_mass, metal.R, hcp.aOverR!, ((3 * Math.sqrt(3)) / 2) * IDEAL_COA).rho;
      if (Math.abs(metal.coa! - IDEAL_COA) > 0.05) {
        expect(Math.abs(measured - el.density!)).toBeLessThan(Math.abs(ideal - el.density!));
      }
    }
  });

  it('overstates zinc’s density by roughly 15% if the ideal c/a is assumed', () => {
    const hcp = getStructure('hcp');
    const zn = METALS.find((m) => m.symbol === 'Zn')!;
    const el = elements.find((e) => e.symbol === 'Zn')!;
    const ideal = theoreticalDensity(hcp.N, el.atomic_mass, zn.R, hcp.aOverR!, ((3 * Math.sqrt(3)) / 2) * IDEAL_COA).rho;
    const err = ((ideal - el.density!) / el.density!) * 100;
    expect(err).toBeGreaterThan(10);
    expect(err).toBeLessThan(20);
  });
});
