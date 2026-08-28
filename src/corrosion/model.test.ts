import { describe, expect, it } from 'vitest';
import {
  CPR_K_MILS_PER_YEAR, CPR_K_MM_PER_YEAR, OXYGEN_E0, areaRatioFactor, galvanicCouple,
  hydrogenLine, nernstPotential, nernstSlope, oxygenLine, penetrationRate,
} from './model';
import { EMF_SERIES, GALVANIC_SERIES, POURBAIX, getPourbaix, regionAt } from './data';

describe('the Nernst slope', () => {
  it('is 0.0592 V per decade at 25 °C', () => {
    expect(nernstSlope()).toBeCloseTo(0.0592, 4);
  });
  it('rises with temperature', () => {
    expect(nernstSlope(373)).toBeGreaterThan(nernstSlope(298.15));
  });
  it('leaves the standard potential unchanged at unit activity', () => {
    expect(nernstPotential(-0.763, 2, 1)).toBeCloseTo(-0.763, 12);
  });
  it('makes a metal more noble as its ion concentration rises', () => {
    expect(nernstPotential(-0.763, 2, 1)).toBeGreaterThan(nernstPotential(-0.763, 2, 1e-6));
  });
  it('shifts by 0.0592/n per decade', () => {
    const a = nernstPotential(0.34, 2, 1);
    const b = nernstPotential(0.34, 2, 0.1);
    expect(a - b).toBeCloseTo(0.0592 / 2, 4);
  });
});

describe('the Daniell cell', () => {
  const cu = EMF_SERIES.find((e) => e.metal === 'Copper')!;
  const zn = EMF_SERIES.find((e) => e.metal === 'Zinc')!;

  it('carries the textbook standard potentials', () => {
    expect(cu.E0).toBeCloseTo(0.34, 3);
    expect(zn.E0).toBeCloseTo(-0.763, 3);
  });

  it('gives 1.10 V at standard conditions', () => {
    const c = galvanicCouple({ name: 'Cu', potential: cu.E0 }, { name: 'Zn', potential: zn.E0 });
    expect(c.emf).toBeCloseTo(1.103, 3);
  });

  it('corrodes the zinc, not the copper', () => {
    const c = galvanicCouple({ name: 'Cu', potential: cu.E0 }, { name: 'Zn', potential: zn.E0 });
    expect(c.anode).toBe('Zn');
    expect(c.cathode).toBe('Cu');
  });

  it('gives the same answer whichever order the electrodes are passed', () => {
    const a = galvanicCouple({ name: 'Cu', potential: cu.E0 }, { name: 'Zn', potential: zn.E0 });
    const b = galvanicCouple({ name: 'Zn', potential: zn.E0 }, { name: 'Cu', potential: cu.E0 });
    expect(a).toEqual(b);
  });

  it('never reports a negative driving voltage', () => {
    for (const x of EMF_SERIES) {
      for (const y of EMF_SERIES) {
        expect(galvanicCouple({ name: 'x', potential: x.E0 }, { name: 'y', potential: y.E0 }).emf)
          .toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('the galvanic series in seawater', () => {
  it('is ordered from noble to active', () => {
    // The list is quoted most-cathodic-first; the active stainless entries are
    // deliberate exceptions, sitting where their unfilmed surface puts them.
    const steel = GALVANIC_SERIES.find((g) => g.name === 'Carbon steel')!;
    const zinc = GALVANIC_SERIES.find((g) => g.name === 'Zinc')!;
    const copper = GALVANIC_SERIES.find((g) => g.name === 'Copper')!;
    const mg = GALVANIC_SERIES.find((g) => g.name === 'Magnesium')!;
    expect(zinc.potential).toBeLessThan(steel.potential);
    expect(steel.potential).toBeLessThan(copper.potential);
    expect(mg.potential).toBeLessThan(zinc.potential);
  });

  it('makes zinc sacrificial to steel — the basis of galvanising', () => {
    const steel = GALVANIC_SERIES.find((g) => g.name === 'Carbon steel')!;
    const zinc = GALVANIC_SERIES.find((g) => g.name === 'Zinc')!;
    expect(galvanicCouple(zinc, steel).anode).toBe('Zinc');
  });

  it('makes steel sacrificial to copper — why a steel bolt in a copper plate fails', () => {
    const steel = GALVANIC_SERIES.find((g) => g.name === 'Carbon steel')!;
    const copper = GALVANIC_SERIES.find((g) => g.name === 'Copper')!;
    expect(galvanicCouple(steel, copper).anode).toBe('Carbon steel');
  });

  /** Passivity is a surface film, not a standard potential. */
  it('drops stainless by ~0.5 V when it goes active in a crevice', () => {
    const passive = GALVANIC_SERIES.find((g) => g.name === '316 stainless (passive)')!;
    const active = GALVANIC_SERIES.find((g) => g.name === '316 stainless (active)')!;
    expect(passive.potential - active.potential).toBeGreaterThan(0.4);
    expect(galvanicCouple(passive, active).anode).toBe('316 stainless (active)');
  });

  it('disagrees with the EMF series, which is why both are kept', () => {
    // Passive 316 is more noble than copper in seawater. Chromium and iron,
    // its main constituents, are both far below copper in the EMF series.
    const s316 = GALVANIC_SERIES.find((g) => g.name === '316 stainless (passive)')!;
    const cuSea = GALVANIC_SERIES.find((g) => g.name === 'Copper')!;
    expect(s316.potential).toBeGreaterThan(cuSea.potential);
    const cr = EMF_SERIES.find((e) => e.metal === 'Chromium')!;
    const cuEmf = EMF_SERIES.find((e) => e.metal === 'Copper')!;
    expect(cr.E0).toBeLessThan(cuEmf.E0);
  });

  it('has a unique name for every entry', () => {
    const names = GALVANIC_SERIES.map((g) => g.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('the area ratio effect', () => {
  it('is 1 for equal areas', () => expect(areaRatioFactor(10, 10)).toBe(1));
  it('multiplies the anodic current density as the anode shrinks', () => {
    expect(areaRatioFactor(100, 1)).toBe(100);
    expect(areaRatioFactor(1, 100)).toBeCloseTo(0.01, 12);
  });
  it('makes a small anode with a large cathode the dangerous arrangement', () => {
    const smallAnode = areaRatioFactor(100, 1);
    const largeAnode = areaRatioFactor(1, 100);
    expect(smallAnode).toBeGreaterThan(largeAnode);
  });
});

describe('corrosion penetration rate (Callister eq. 17.23)', () => {
  it('uses K = 87.6 for mm/yr and 534 for mils/yr', () => {
    expect(CPR_K_MM_PER_YEAR).toBe(87.6);
    expect(CPR_K_MILS_PER_YEAR).toBe(534);
  });

  it('computes CPR = KW/(ρAt)', () => {
    // 1000 mg lost from 100 cm2 of steel (7.87 g/cm3) over 1000 h
    expect(penetrationRate(1000, 7.87, 100, 1000)).toBeCloseTo((87.6 * 1000) / (7.87 * 100 * 1000), 9);
  });

  it('scales linearly with mass loss and inversely with time', () => {
    const base = penetrationRate(1000, 7.87, 100, 1000);
    expect(penetrationRate(2000, 7.87, 100, 1000)).toBeCloseTo(2 * base, 9);
    expect(penetrationRate(1000, 7.87, 100, 2000)).toBeCloseTo(base / 2, 9);
  });

  it('gives mils per year about 6.1x the mm/yr figure', () => {
    const mm = penetrationRate(1000, 7.87, 100, 1000, CPR_K_MM_PER_YEAR);
    const mils = penetrationRate(1000, 7.87, 100, 1000, CPR_K_MILS_PER_YEAR);
    expect(mils / mm).toBeCloseTo(534 / 87.6, 6);
    // and that ratio is just mm -> mils (1 mm = 39.37 mils), within rounding
    expect(mils / mm).toBeCloseTo(6.096, 2);
  });

  it('returns zero rather than infinity for degenerate inputs', () => {
    expect(penetrationRate(100, 0, 10, 10)).toBe(0);
    expect(penetrationRate(100, 7.87, 0, 10)).toBe(0);
    expect(penetrationRate(100, 7.87, 10, 0)).toBe(0);
  });
});

describe('water stability lines', () => {
  it('puts the hydrogen line at 0 V at pH 0 and −0.414 V at pH 7', () => {
    expect(hydrogenLine(0)).toBeCloseTo(0, 12);
    expect(hydrogenLine(7)).toBeCloseTo(-0.414, 3);
  });

  it('puts the oxygen line at 1.229 V at pH 0 and 0.815 V at pH 7', () => {
    expect(oxygenLine(0)).toBeCloseTo(OXYGEN_E0, 12);
    expect(oxygenLine(7)).toBeCloseTo(0.815, 3);
  });

  it('keeps the lines parallel, 1.229 V apart at every pH', () => {
    for (let pH = 0; pH <= 14; pH += 0.5) {
      expect(oxygenLine(pH) - hydrogenLine(pH)).toBeCloseTo(OXYGEN_E0, 12);
    }
  });

  it('keeps oxygen above hydrogen everywhere', () => {
    for (let pH = 0; pH <= 14; pH += 0.5) {
      expect(oxygenLine(pH)).toBeGreaterThan(hydrogenLine(pH));
    }
  });
});

describe('Pourbaix regions', () => {
  it.each(POURBAIX.map((p) => p.id))('%s: regions cover the diagram without gaps', (id) => {
    const metal = getPourbaix(id);
    for (let pH = 0.25; pH < 14; pH += 0.5) {
      for (let E = -1.5; E < 1.2; E += 0.1) {
        const r = regionAt(metal, pH, E);
        // Below the immunity band there is nothing to report; inside the mapped
        // band every point must resolve to exactly one named region.
        if (E > -1.0 && E < 1.1) expect(r).not.toBeNull();
      }
    }
  });

  it('makes iron immune when held low, corroding in acid, passive in alkali', () => {
    const fe = getPourbaix('fe');
    expect(regionAt(fe, 7, -0.9)!.kind).toBe('immunity');
    expect(regionAt(fe, 2, 0.2)!.kind).toBe('corrosion');
    expect(regionAt(fe, 12, 0.2)!.kind).toBe('passivation');
  });

  /** Aluminium and zinc are amphoteric: they corrode at BOTH ends of the pH scale. */
  it.each(['al', 'zn'])('%s corrodes at both pH extremes', (id) => {
    const m = getPourbaix(id);
    expect(regionAt(m, 1, 0.2)!.kind).toBe('corrosion');
    expect(regionAt(m, 13.5, 0.2)!.kind).toBe('corrosion');
    // and passivates somewhere in between
    const mid = m.regions.filter((r) => r.kind === 'passivation');
    expect(mid.length).toBeGreaterThan(0);
  });

  it('gives iron a passive band where aluminium has none — pH 13, alkaline', () => {
    expect(regionAt(getPourbaix('fe'), 13, 0.2)!.kind).toBe('passivation');
    expect(regionAt(getPourbaix('al'), 13, 0.2)!.kind).toBe('corrosion');
  });
});
