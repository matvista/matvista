import { describe, expect, it } from 'vitest';
import {
  DULONG_PETIT,
  LORENZ_SOMMERFELD,
  R,
  deltaTForStress,
  dulongPetitSpecificHeat,
  expansionMeltProduct,
  lorenzNumber,
  thermalShockResistance,
  thermalStress,
} from './model';
import {
  CERAMICS,
  DEBYE_STIFF,
  MEASURED_SPECIFIC_HEAT,
  METALS,
  THERMAL_MATERIALS,
} from './materials';
import { element } from './elements';
import { SELECTION_MATERIALS } from '../selection/materials';
import { FRACTURE_ALLOYS } from '../failure/materials';
import { criticalCrackSize } from '../failure/model';

describe('Dulong–Petit', () => {
  it('is 3R, and 3R is 24.9 J/mol·K', () => {
    expect(DULONG_PETIT).toBeCloseTo(24.94, 2);
    expect(DULONG_PETIT / R).toBe(3);
  });

  /**
   * The rule checked against measurement, over the app's own atomic masses.
   * Nine metals, none of them more than 7% out — which is what makes the three
   * failures below a result rather than a caveat.
   */
  it('predicts every metal’s specific heat to within 7%', () => {
    for (const m of METALS) {
      const measured = MEASURED_SPECIFIC_HEAT[m.element!];
      expect(measured, `no measured c for ${m.element}`).toBeDefined();
      const predicted = dulongPetitSpecificHeat(element(m.element!).atomic_mass);
      expect(Math.abs(predicted / measured - 1), `${m.label}`).toBeLessThan(0.07);
    }
  });

  it('overshoots badly for the light, stiffly-bonded solids, which is the point', () => {
    for (const s of DEBYE_STIFF) {
      const predicted = dulongPetitSpecificHeat(element(s.symbol).atomic_mass);
      expect(predicted / s.measured, s.label).toBeGreaterThan(1.2);
    }
    // Diamond is the extreme: threefold out, because its Debye temperature is
    // above 2000 K and room temperature is nowhere near the classical limit.
    const diamond = DEBYE_STIFF.find((s) => s.symbol === 'C')!;
    expect(dulongPetitSpecificHeat(element('C').atomic_mass) / diamond.measured)
      .toBeGreaterThan(2.5);
  });

  it('says heat capacity per gram falls as atomic mass rises, exactly', () => {
    // c·A = 3R for every element by construction — the whole content of the
    // rule, and the reason a mole of anything takes the same heat.
    for (const sym of ['Al', 'Cu', 'W', 'Pb', 'Li']) {
      const a = element(sym).atomic_mass;
      expect(dulongPetitSpecificHeat(a) * a).toBeCloseTo(DULONG_PETIT, 9);
    }
  });
});

describe('Wiedemann–Franz, which is what checks the conductivities', () => {
  it('puts every metal in the band real metals occupy', () => {
    for (const m of METALS) {
      const L = lorenzNumber(m.conductivity, m.resistivity!, 300);
      expect(L, `${m.label} L = ${L.toExponential(2)}`).toBeGreaterThan(2.0e-8);
      expect(L, `${m.label} L = ${L.toExponential(2)}`).toBeLessThan(3.4e-8);
    }
  });

  it('clusters them on Sommerfeld’s value rather than merely inside a band', () => {
    const ls = METALS.map((m) => lorenzNumber(m.conductivity, m.resistivity!, 300));
    const mean = ls.reduce((s, v) => s + v, 0) / ls.length;
    expect(Math.abs(mean / LORENZ_SOMMERFELD - 1)).toBeLessThan(0.15);
  });

  /**
   * The check has to be able to fail, or it is decoration. A conductivity
   * wrong by a factor of two takes its metal out of the band — asserted, so
   * that the band cannot quietly be widened until nothing can fail it.
   */
  it('rejects a conductivity that is wrong by a factor of two', () => {
    const cu = METALS.find((m) => m.id === 'cu')!;
    expect(lorenzNumber(cu.conductivity * 2, cu.resistivity!, 300)).toBeGreaterThan(3.4e-8);
    expect(lorenzNumber(cu.conductivity / 2, cu.resistivity!, 300)).toBeLessThan(2.0e-8);
  });

  it('falls with temperature at fixed k and ρ, since L is k/σT', () => {
    const cu = METALS.find((m) => m.id === 'cu')!;
    expect(lorenzNumber(cu.conductivity, cu.resistivity!, 600))
      .toBeCloseTo(lorenzNumber(cu.conductivity, cu.resistivity!, 300) / 2, 12);
  });
});

describe('α·T_melt, which is what checks the expansion coefficients', () => {
  it('lands near 0.02 for every metal, on the app’s own melting points', () => {
    for (const m of METALS) {
      const melt = element(m.element!).melt;
      expect(melt, `${m.label} has no melting point`).not.toBeNull();
      const product = expansionMeltProduct(m.alpha, melt!);
      expect(product, `${m.label} at ${product.toFixed(4)}`).toBeGreaterThan(0.012);
      expect(product, `${m.label} at ${product.toFixed(4)}`).toBeLessThan(0.030);
    }
  });

  it('holds while α itself ranges five-fold, which is what makes it a rule', () => {
    const alphas = METALS.map((m) => m.alpha);
    expect(Math.max(...alphas) / Math.min(...alphas)).toBeGreaterThan(4);
  });

  it('rejects a misplaced decimal', () => {
    const w = METALS.find((m) => m.id === 'w')!;
    const melt = element('W').melt!;
    expect(expansionMeltProduct(w.alpha * 10, melt)).toBeGreaterThan(0.03);
    expect(expansionMeltProduct(w.alpha / 10, melt)).toBeLessThan(0.012);
  });
});

describe('thermal stress', () => {
  it('is E·α·ΔT, and does not depend on the size of the part', () => {
    // 100 GPa, 20e-6/K, 100 K → 200 MPa. Nothing about geometry enters, which
    // is why making the section thicker does not help.
    expect(thermalStress(100, 20, 100)).toBeCloseTo(200, 9);
  });

  it('inverts', () => {
    for (const m of THERMAL_MATERIALS) {
      const dT = deltaTForStress(m.modulus, m.alpha, 150);
      expect(thermalStress(m.modulus, m.alpha, dT)).toBeCloseTo(150, 6);
    }
  });

  it('takes aluminium to its own yield strength in a modest temperature swing', () => {
    // Constrained 1100 aluminium: E = 69 GPa, α = 23.6e-6. It is annealed and
    // soft, so it does not take much.
    const al = METALS.find((m) => m.id === 'al')!;
    const yieldish = SELECTION_MATERIALS.find((s) => s.name === al.selectionName)!.strength;
    const dT = deltaTForStress(al.modulus, al.alpha, yieldish);
    expect(dT).toBeGreaterThan(20);
    expect(dT).toBeLessThan(120);
  });

  /**
   * The loop into the failure module: a thermal stress is a stress, so a ΔT
   * has a critical crack size attached to it through the *same*
   * `criticalCrackSize` that module computes with. Nothing is re-implemented
   * here.
   */
  it('hands a ΔT to the failure module as a critical crack size', () => {
    const al = METALS.find((m) => m.id === 'al')!;
    const alloy = FRACTURE_ALLOYS[0];
    const small = thermalStress(al.modulus, al.alpha, 50);
    const large = thermalStress(al.modulus, al.alpha, 200);
    expect(large).toBeCloseTo(small * 4, 6);
    // Critical crack size goes as 1/σ², so quadrupling the stress divides it
    // by sixteen — the reason a thermal transient is a fracture problem.
    const ac = (sigma: number) => criticalCrackSize(alloy.kic, sigma, 1);
    expect(ac(small) / ac(large)).toBeCloseTo(16, 4);
  });
});

describe('thermal shock resistance', () => {
  it('ranks the three glasses the way every kitchen already knows', () => {
    const tsr = (id: string) => {
      const m = CERAMICS.find((c) => c.id === id)!;
      return thermalShockResistance(m.strength, m.conductivity, m.modulus, m.alpha);
    };
    expect(tsr('silica')).toBeGreaterThan(tsr('pyrex'));
    expect(tsr('pyrex')).toBeGreaterThan(tsr('soda'));
    // And not narrowly: borosilicate is comfortably better than soda-lime, and
    // fused silica is in another category entirely.
    expect(tsr('pyrex') / tsr('soda')).toBeGreaterThan(1.5);
    expect(tsr('silica') / tsr('soda')).toBeGreaterThan(10);
  });

  it('is expansion that does it, not strength', () => {
    // Soda-lime and borosilicate have the same flexural strength and nearly
    // the same modulus in Appendix B, so the whole difference between them is
    // the α in the denominator. That is the isolated variable, and it is the
    // reason the comparison teaches anything.
    const soda = CERAMICS.find((c) => c.id === 'soda')!;
    const pyrex = CERAMICS.find((c) => c.id === 'pyrex')!;
    expect(pyrex.strength).toBe(soda.strength);
    expect(Math.abs(pyrex.modulus / soda.modulus - 1)).toBeLessThan(0.05);
    expect(soda.alpha / pyrex.alpha).toBeGreaterThan(2.5);
  });

  it('rises with conductivity and strength, falls with modulus and expansion', () => {
    const base = thermalShockResistance(100, 10, 100, 10);
    expect(thermalShockResistance(200, 10, 100, 10)).toBeCloseTo(base * 2, 9);
    expect(thermalShockResistance(100, 20, 100, 10)).toBeCloseTo(base * 2, 9);
    expect(thermalShockResistance(100, 10, 200, 10)).toBeCloseTo(base / 2, 9);
    expect(thermalShockResistance(100, 10, 100, 20)).toBeCloseTo(base / 2, 9);
  });
});

describe('the joins', () => {
  it('takes modulus, strength and density from Appendix B, not a second copy', () => {
    for (const m of THERMAL_MATERIALS) {
      const row = SELECTION_MATERIALS.find((s) => s.name === m.selectionName);
      expect(row, m.selectionName).toBeDefined();
      expect(m.modulus).toBe(row!.modulus);
      expect(m.strength).toBe(row!.strength);
      expect(m.density).toBe(row!.density);
    }
  });

  it('gives every metal an element row and a resistivity, and no ceramic either', () => {
    // The asymmetry is deliberate and is what the two checks rest on, so it is
    // asserted rather than left to the comment that explains it.
    for (const m of METALS) {
      expect(m.element, m.label).toBeDefined();
      expect(m.resistivity, m.label).toBeGreaterThan(0);
      expect(element(m.element!).melt).not.toBeNull();
    }
    for (const c of CERAMICS) {
      expect(c.element, c.label).toBeUndefined();
      expect(c.resistivity, c.label).toBeUndefined();
    }
  });
});
