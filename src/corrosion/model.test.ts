import { describe, expect, it } from 'vitest';
import {
  CPR_K_MILS_PER_YEAR, CPR_K_MM_PER_YEAR, G102_K_MILS_PER_YEAR, G102_K_MM_PER_YEAR,
  OXYGEN_E0, T25, areaRatioFactor, concentrationCell, currentDensityToCPR, equivalentWeight,
  galvanicCouple, hydrogenLine, nernstPotential, nernstSlope, oxygenLine, penetrationRate,
} from './model';
import {
  ELECTROCHEMISTRY, EMF_SERIES, GALVANIC_SERIES, POURBAIX, electrochemistryFor, getPourbaix,
  regionAt,
} from './data';
import elementsRaw from '../data/elements.json';

const elements = elementsRaw as { symbol: string; atomic_mass: number; density: number | null }[];

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

  /**
   * The two constants are **not** related by 1 mm = 39.37 mils alone, and both
   * an earlier version of this comment and the docstring on the constants said
   * they were. Callister's K = 534 wants the area in square inches; K = 87.6
   * wants it in square centimetres. Feed both the same cm² figure — which is
   * all this function's signature allows — and the mils answer comes out
   * 6.4516× short.
   */
  it('needs an area in square inches before K = 534 means mils per year', () => {
    const mm = penetrationRate(1000, 7.87, 100, 1000, CPR_K_MM_PER_YEAR);
    const milsIfCm2 = penetrationRate(1000, 7.87, 100, 1000, CPR_K_MILS_PER_YEAR);
    expect(milsIfCm2 / mm).toBeCloseTo(534 / 87.6, 6);
    expect(milsIfCm2 / mm).toBeCloseTo(6.096, 2);
    // The same specimen measured in in² — 100 cm² is 15.500 in².
    const mils = penetrationRate(1000, 7.87, 100 / 6.4516, 1000, CPR_K_MILS_PER_YEAR);
    expect(mils / mm).toBeCloseTo(39.37, 1);
  });

  /**
   * The arithmetic the corrected docstring on the constants now states, so the
   * comment cannot drift away from the code again. Both constants are an
   * 8766-hour year (365.25 days) carrying mg/(g·cm³·area) into a depth; the
   * mils one divides by 6.4516 cm²/in² and multiplies by 393.7008 mils/cm.
   */
  it('reproduces both published constants from the year and the units', () => {
    const hoursPerYear = 365.25 * 24;
    expect(hoursPerYear).toBe(8766);
    const milsPerCm = 1 / 2.54e-3;
    expect(milsPerCm).toBeCloseTo(393.7008, 4);
    const exactMm = 10 * hoursPerYear * 1e-3;
    const exactMils = (milsPerCm * hoursPerYear * 1e-3) / 6.4516;
    expect(exactMm).toBeCloseTo(87.66, 6);
    expect(exactMils).toBeCloseTo(534.934, 3);
    // Exact, the pair is 1 mm in mils. Published and rounded, it is not.
    expect((exactMils / exactMm) * 6.4516).toBeCloseTo(1 / 0.0254, 3);
    expect((CPR_K_MILS_PER_YEAR / CPR_K_MM_PER_YEAR) * 6.4516).toBeCloseTo(39.328, 3);
    expect(1 / 0.0254).toBeCloseTo(39.3701, 4);
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

/**
 * A10 — from a measured corrosion current density to millimetres per year.
 *
 * ASTM G102 eq. 1 / Callister eq. 17.24:  CR = K · (i_corr / ρ) · EW,
 * with i_corr in µA/cm², EW in g per mole of electrons and ρ in g/cm³.
 * K = 3.27 × 10⁻³ gives mm/yr; K = 1.288 × 10⁻¹ gives mils per year.
 */
describe('current density to penetration rate (ASTM G102)', () => {
  const FE_EW = 55.845 / 2;

  it('puts iron at 1 µA/cm² at 0.0116 mm/yr — the standard rule of thumb', () => {
    expect(currentDensityToCPR(1, FE_EW, 7.874)).toBeCloseTo(0.0116, 4);
  });

  /**
   * Unlike Callister's K pair for eq. 17.23, these two constants **are** the
   * same rate in two units: both take i in µA/cm², so nothing but mm → mils
   * separates them.
   */
  it('relates its two constants by 1 mm = 39.37 mils, to a tenth of a percent', () => {
    const ratio = G102_K_MILS_PER_YEAR / G102_K_MM_PER_YEAR;
    expect(ratio).toBeCloseTo(39.37, 0);
    expect(Math.abs(ratio - 39.3701) / 39.3701).toBeLessThan(0.001);
    const mm = currentDensityToCPR(1, FE_EW, 7.874, G102_K_MM_PER_YEAR);
    const mils = currentDensityToCPR(1, FE_EW, 7.874, G102_K_MILS_PER_YEAR);
    expect(mils / mm).toBeCloseTo(ratio, 9);
  });

  it('is linear in current density and inverse in density', () => {
    const base = currentDensityToCPR(10, FE_EW, 7.874);
    expect(currentDensityToCPR(100, FE_EW, 7.874)).toBeCloseTo(10 * base, 9);
    expect(currentDensityToCPR(10, FE_EW, 15.748)).toBeCloseTo(base / 2, 9);
  });

  /**
   * The whole reason the area ratio belongs in this readout. The same couple
   * and the same total current, with the anode 100× smaller, is two orders of
   * magnitude in penetration — not a rhetorical multiplier.
   */
  it('turns a 100 : 1 area ratio into two orders of magnitude of penetration', () => {
    const equal = currentDensityToCPR(1 * areaRatioFactor(10, 10), FE_EW, 7.874);
    const bad = currentDensityToCPR(1 * areaRatioFactor(100, 1), FE_EW, 7.874);
    expect(bad / equal).toBeCloseTo(100, 9);
    expect(equal).toBeCloseTo(0.0116, 4);
    expect(bad).toBeCloseTo(1.1596, 4);
  });

  it('refuses degenerate inputs rather than returning infinity', () => {
    expect(currentDensityToCPR(1, FE_EW, 0)).toBe(0);
    expect(currentDensityToCPR(1, FE_EW, -1)).toBe(0);
    expect(currentDensityToCPR(-1, FE_EW, 7.874)).toBe(0);
    expect(currentDensityToCPR(0, FE_EW, 7.874)).toBe(0);
  });
});

/**
 * The equivalent weights and densities the rate panel needs. Every entry is an
 * element dissolving to a single ionic species, so EW = A/n and both numbers
 * are cross-checked against the shipped `elements.json` rather than being a
 * second, drifting copy of it.
 */
describe('the electrochemistry table', () => {
  it('names only alloys that exist in the galvanic series', () => {
    for (const e of ELECTROCHEMISTRY) {
      expect(GALVANIC_SERIES.map((g) => g.name)).toContain(e.name);
    }
  });

  it.each(ELECTROCHEMISTRY.map((e) => e.name))(
    '%s: atomic mass and density agree with elements.json',
    (name) => {
      const e = electrochemistryFor(name)!;
      const el = elements.find((x) => x.symbol === e.symbol)!;
      expect(el).toBeDefined();
      expect(e.atomicMass).toBeCloseTo(el.atomic_mass, 3);
      expect(e.density).toBeCloseTo(el.density!, 3);
    },
  );

  /**
   * Against ASTM G102 table X1.1's published equivalent weights for the pure
   * elements. These are the numbers a student would look up.
   */
  it('reproduces the published equivalent weights', () => {
    // Tolerance is 0.05 g/eq — wide enough for the atomic-mass revisions
    // between editions (G102 quotes lead as 103.59 from A = 207.19; the
    // shipped elements.json carries 207.21) and nothing wider.
    const EXPECTED: [string, number][] = [
      ['Carbon steel', 27.92],
      ['Nickel (active)', 29.35],
      ['Nickel (passive)', 29.35],
      ['Copper', 31.77],
      ['Zinc', 32.69],
      ['Aluminium (commercially pure)', 8.99],
      ['Magnesium', 12.15],
      ['Lead', 103.6],
      ['Tin', 59.35],
      ['Cadmium', 56.21],
      ['Silver', 107.87],
    ];
    for (const [name, ew] of EXPECTED) {
      const e = electrochemistryFor(name)!;
      expect(e).not.toBeNull();
      expect(equivalentWeight(e.atomicMass, e.valence)).toBeCloseTo(ew, 1);
    }
    expect(EXPECTED).toHaveLength(ELECTROCHEMISTRY.length);
  });

  it('gives every entry a positive valence and density', () => {
    for (const e of ELECTROCHEMISTRY) {
      expect(e.valence).toBeGreaterThan(0);
      expect(e.density).toBeGreaterThan(0);
      expect(equivalentWeight(e.atomicMass, e.valence)).toBeGreaterThan(0);
    }
  });

  /**
   * The table is deliberately partial. Multi-phase alloys have an equivalent
   * weight that is a composition-weighted average, not A/n, and the noble
   * entries do not corrode at a measurable rate at all — so the panel must be
   * **absent** for them rather than quoting a fabricated number.
   */
  it('covers no alloy whose equivalent weight is not simply A/n', () => {
    for (const name of [
      'Brass', 'Bronze', 'Monel 400', 'Copper–nickel 70/30', '316 stainless (passive)',
      '304 stainless (active)', 'Aluminium 2024', 'Cast iron', 'Graphite', 'Gold', 'Titanium',
    ]) {
      expect(GALVANIC_SERIES.map((g) => g.name)).toContain(name);
      expect(electrochemistryFor(name)).toBeNull();
    }
  });

  it('covers the couple the module opens on', () => {
    const couple = galvanicCouple(
      GALVANIC_SERIES.find((g) => g.name === 'Carbon steel')!,
      GALVANIC_SERIES.find((g) => g.name === 'Copper')!,
    );
    expect(couple.anode).toBe('Carbon steel');
    expect(electrochemistryFor(couple.anode)).not.toBeNull();
  });
});

/**
 * A12 — the single most common corrosion misconception is that two different
 * metals are required. Crevice corrosion, pitting, waterline attack,
 * under-deposit attack and a buried pipe crossing two soil types are all
 * concentration cells: one metal, no couple, still corroding.
 */
describe('concentration cells', () => {
  /**
   * **Erratum for d294681**, whose body describes this case as "4 decades of
   * Fe²⁺ at n = 2 gives 0.0887 V" and quotes the slope as 0.059158. The cell
   * asserted here is `(2, 1, 1e-3)` — **three** decades, and 0.0887 V is right
   * for three; four decades is 0.118313 V, which the same message quotes two
   * paragraphs later as "118.3 mV". And the shipped slope is 0.0591563
   * (R = 8.314, F = 96485, T = 298.15); no constant/temperature pair gives
   * 0.059158. History is not being rewritten, so both figures are pinned here
   * instead, and the decade count is now in the title.
   */
  it('is exactly (0.0592/n)·log(a_high/a_low): three decades of Fe²⁺ at n = 2', () => {
    const cell = concentrationCell(2, 1, 1e-3)!;
    // 0.0592 is the textbook shorthand; the module computes the slope from R,
    // F and T and gets 0.0591563, so the two agree to 3 places and no further.
    expect(nernstSlope(T25)).toBeCloseTo(0.0591563, 7);
    expect(cell.emf).toBeCloseTo((0.0592 / 2) * 3, 3);
    expect(cell.emf).toBeCloseTo(0.0887, 4);
    expect(cell.emf).toBeCloseTo((nernstSlope(T25) / 2) * Math.log10(1 / 1e-3), 12);
    // Four decades, the figure that message meant, is a different number.
    expect(concentrationCell(2, 1, 1e-4)!.emf).toBeCloseTo(0.118313, 6);
  });

  /**
   * The identity that makes this the same model as the EMF panel's Nernst
   * shift rather than a second one: the cell voltage is the difference of two
   * half-cell potentials, whatever E° they are taken against — E° cancels.
   */
  it.each([-2.363, -0.763, -0.44, 0, 0.34, 1.42])(
    'is the Nernst difference of two identical electrodes at E° = %s',
    (E0) => {
      for (const [hi, lo] of [[1, 1e-2], [1e-1, 1e-5], [1e-3, 1e-6]]) {
        const n = 2;
        const cell = concentrationCell(n, hi, lo)!;
        expect(cell.emf).toBeCloseTo(
          nernstPotential(E0, n, hi) - nernstPotential(E0, n, lo),
          12,
        );
        expect(cell.eFirst - cell.eSecond).toBeCloseTo(cell.emf, 12);
      }
    },
  );

  /**
   * The mechanism, and the reason a crevice is dangerous: the *depleted* side
   * is the anode. Dilute the metal ion and the metal there becomes more
   * active, so it corrodes — against the identical metal a millimetre away.
   *
   * **Both argument orderings, deliberately.** This sweep used to run
   * `for (l = -6; l < h; …)`, visiting only the 78 pairs where the first
   * argument is already the more concentrated one — so it could not reach the
   * branch where the *first* electrode is the anode, which is the branch the
   * panel's two independent sliders reach whenever `ah < al`.
   */
  it('always makes the depleted side the anode, whichever argument it arrived as', () => {
    let firstAnodic = 0;
    let secondAnodic = 0;
    for (let h = -6; h <= 0; h += 0.5) {
      for (let l = -6; l <= 0; l += 0.5) {
        const cell = concentrationCell(2, 10 ** h, 10 ** l)!;
        if (h === l) {
          expect(cell.anode).toBe('neither');
          expect(cell.emf).toBe(0);
          continue;
        }
        expect(cell.anode).toBe(h < l ? 'first' : 'second');
        expect(cell.emf).toBeGreaterThan(0);
        const [eAnode, eCathode] =
          cell.anode === 'first' ? [cell.eFirst, cell.eSecond] : [cell.eSecond, cell.eFirst];
        expect(eAnode).toBeLessThan(eCathode);
        expect(eCathode - eAnode).toBeCloseTo(cell.emf, 12);
        if (cell.anode === 'first') firstAnodic++;
        else secondAnodic++;
      }
    }
    // Both branches have to be exercised, or this is the old sweep again.
    expect(firstAnodic).toBe(secondAnodic);
    expect(firstAnodic).toBeGreaterThan(0);
  });

  /**
   * The result the panel reads its two rows off. Each electrode's potential
   * belongs to *that* electrode: `eFirst`/`eSecond` are in argument order, not
   * sorted by activity, because the caller is the only party that knows which
   * side is the crevice.
   *
   * This is `#/corrosion?panel=cell&cm=Iron&ah=-4&al=0`, where the sliders put
   * the depleted electrode first.
   */
  it('keeps each electrode’s potential with that electrode', () => {
    const cell = concentrationCell(2, 1e-4, 1)!;
    expect(cell.eFirst * 1000).toBeCloseTo(-118.3125, 3);
    expect(cell.eSecond).toBe(0);
    expect(cell.anode).toBe('first');
    expect(cell.emf * 1000).toBeCloseTo(118.3125, 3);
    // …and mirrored, the same two numbers swap rows rather than staying put.
    const mirrored = concentrationCell(2, 1, 1e-4)!;
    expect(mirrored.eFirst).toBe(0);
    expect(mirrored.eSecond * 1000).toBeCloseTo(-118.3125, 3);
    expect(mirrored.anode).toBe('second');
  });

  it('gives exactly zero, and no anode, at equal activity', () => {
    for (const a of [1, 1e-2, 1e-6]) {
      const cell = concentrationCell(2, a, a)!;
      expect(cell.emf).toBe(0);
      expect(cell.anode).toBe('neither');
    }
  });

  it('reports the same cell whichever way round the two are given', () => {
    const a = concentrationCell(2, 1e-1, 1e-4)!;
    const b = concentrationCell(2, 1e-4, 1e-1)!;
    expect(b.emf).toBeCloseTo(a.emf, 12);
    expect(a.anode).toBe('second');
    expect(b.anode).toBe('first');
    expect(b.eFirst).toBe(a.eSecond);
    expect(b.eSecond).toBe(a.eFirst);
  });

  /**
   * **Erratum for d294681**, and for the title this test used to carry: both
   * said a trivalent metal shifts "a third" as far per decade as a divalent
   * one. (RT/nF) goes as 1/n, so n = 3 against n = 2 is **two-thirds** —
   * 19.719 mV per decade against 29.578. The assertion itself was always
   * right: the divalent cell is 1.5× the trivalent one.
   */
  it('falls with n — a trivalent metal shifts two-thirds as far per decade', () => {
    const two = concentrationCell(2, 1, 1e-3)!;
    const three = concentrationCell(3, 1, 1e-3)!;
    expect(two.emf / three.emf).toBeCloseTo(1.5, 12);
    expect((nernstSlope(T25) / 3) * 1000).toBeCloseTo(19.7188, 4);
    expect((nernstSlope(T25) / 2) * 1000).toBeCloseTo(29.5781, 4);
    expect(nernstSlope(T25) / 3 / (nernstSlope(T25) / 2)).toBeCloseTo(2 / 3, 12);
  });

  /**
   * Differential aeration is the same arithmetic with n = 4, over the oxygen
   * half-cell: two orders of magnitude in dissolved oxygen drives 29.6 mV.
   * Small, and quite enough — it is why a waterline rusts and why steel under
   * a wet leaf pits.
   */
  it('handles the differential-aeration case at n = 4', () => {
    const cell = concentrationCell(4, 1, 1e-2)!;
    expect(cell.emf).toBeCloseTo((0.0592 / 4) * 2, 4);
    expect(cell.emf).toBeCloseTo(0.0296, 4);
    expect(cell.anode).toBe('second');
  });

  it('scales with temperature exactly as the Nernst slope does', () => {
    const hot = concentrationCell(2, 1, 1e-3, 373.15)!;
    const cold = concentrationCell(2, 1, 1e-3, T25)!;
    expect(hot.emf / cold.emf).toBeCloseTo(nernstSlope(373.15) / nernstSlope(T25), 12);
  });

  it('refuses a non-physical activity or electron count', () => {
    expect(concentrationCell(2, 0, 1e-3)).toBeNull();
    expect(concentrationCell(2, 1, 0)).toBeNull();
    expect(concentrationCell(2, -1, 1e-3)).toBeNull();
    expect(concentrationCell(0, 1, 1e-3)).toBeNull();
  });
});

