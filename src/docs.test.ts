import { describe, expect, it } from 'vitest';
// Read as text through Vite's `?raw`, not `node:fs`: the app tsconfig sets
// `types: ["vite/client"]`, so Node's built-ins are not in this program.
import landingSource from './components/Landing.tsx?raw';
import roadmapSource from '../ROADMAP.md?raw';
import fatiguePlate from './assets/figures/FatigueFigure.tsx?raw';
import { NAV_GROUPS, findItem, findItemOrNull } from './nav';
import { STRUCTURES } from './crystal/structures';
import { SLIP_MODES, slipSystems } from './crystal/miller';
import { MECH_MATERIALS } from './mechanical/materials';
import { INDICES, SELECTION_MATERIALS } from './selection/materials';
import { XRD_SAMPLES, XRD_SOURCES } from './xrd/diffraction';
import { CEMENTITE_X, EUTECTOID_T, EUTECTOID_X, FERRITE_MAX, PHASE_SYSTEMS, lever, steelMicrostructure } from './phase/systems';
import { JOMINY_DISTANCES, JOMINY_RATES, STEELS } from './heattreat/steels';
import { DIFFUSION_SYSTEMS } from './diffusion/model';
import { BRITTLE_SOLIDS, FATIGUE_BEHAVIOUR, FRACTURE_ALLOYS, GROWTH_CLASSES } from './failure/materials';
import { EMF_SERIES, GALVANIC_SERIES, POURBAIX } from './corrosion/data';
import { DOPABLE, SEMICONDUCTORS } from './electronic/materials';
import elementsRaw from './data/elements.json';

/**
 * Numbers written into the README, ROADMAP or the landing page, asserted
 * against the data they describe. A README that quietly starts lying is the
 * cheapest kind of wrong thing to ship, and the hardest to notice.
 */
describe('documented counts', () => {
  it('118 elements', () => expect((elementsRaw as unknown[]).length).toBe(118));
  it('twelve modules', () => expect(NAV_GROUPS.flatMap((g) => g.items)).toHaveLength(12));
  it('8 crystal structures', () => expect(STRUCTURES).toHaveLength(8));
  it('12 FCC slip systems', () =>
    expect(slipSystems(SLIP_MODES.find((m) => m.id === 'fcc')!)).toHaveLength(12));
  it('48 BCC slip systems', () =>
    expect(slipSystems(SLIP_MODES.find((m) => m.id === 'bcc')!)).toHaveLength(48));
  it('7 mechanical metals', () => expect(MECH_MATERIALS).toHaveLength(7));
  it('54 Ashby materials', () => expect(SELECTION_MATERIALS).toHaveLength(54));
  it('5 performance indices', () => expect(INDICES).toHaveLength(5));
  it('4 X-ray sources', () => expect(XRD_SOURCES).toHaveLength(4));
  it('4 lattice types across the XRD samples', () =>
    expect([...new Set(XRD_SAMPLES.map((s) => s.lattice))].sort()).toEqual(['bcc', 'diamond', 'fcc', 'sc']));
  it('3 phase systems: Cu–Ni, Pb–Sn, Fe–Fe₃C', () =>
    expect(PHASE_SYSTEMS.map((p) => p.id)).toEqual(['cu-ni', 'pb-sn', 'fe-c']));
  it('3 steels: 1080, 5140, 4340', () =>
    expect(STEELS.map((s) => s.id)).toEqual(['1080', '5140', '4340']));
  it('13-point Jominy curves', () => {
    expect(JOMINY_DISTANCES).toHaveLength(13);
    expect(JOMINY_RATES).toHaveLength(13);
    for (const s of STEELS) expect(s.jominy).toHaveLength(13);
  });
  it('7 diffusion systems', () => expect(DIFFUSION_SYSTEMS).toHaveLength(7));
  it('5 fracture alloys, 3 brittle solids, 3 crack-growth classes', () => {
    expect(FRACTURE_ALLOYS).toHaveLength(5);
    expect(BRITTLE_SOLIDS).toHaveLength(3);
    expect(GROWTH_CLASSES).toHaveLength(3);
  });
  it('20 EMF entries, 25 galvanic alloys, 3 Pourbaix metals', () => {
    expect(EMF_SERIES).toHaveLength(20);
    expect(GALVANIC_SERIES).toHaveLength(25);
    expect(POURBAIX).toHaveLength(3);
    expect(POURBAIX.map((p) => p.id)).toEqual(['fe', 'al', 'zn']);
  });
  it('7 semiconductors, 4 of them with full carrier data', () => {
    expect(SEMICONDUCTORS).toHaveLength(7);
    expect(DOPABLE).toHaveLength(4);
    expect(DOPABLE.map((s) => s.id).sort()).toEqual(['gaas', 'ge', 'insb', 'si']);
  });
  /**
   * The bundle table's per-module chunk count is one per lazy route, and it had
   * drifted to "eleven" with twelve modules shipped — the same drift the table
   * itself records having had at eleven modules. A count nothing checks is the
   * class this file exists to close, so this one is checked.
   *
   * The sizes beside it cannot be asserted here: they come from a real build,
   * which vitest has no access to. This guards the count alone, and says so.
   */
  it('the ROADMAP bundle table counts one per-module chunk per module', () => {
    const WORDS = [
      'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
      'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    ];
    const n = NAV_GROUPS.flatMap((g) => g.items).length;
    expect(WORDS[n]).toBeDefined();
    expect(roadmapSource).toContain(`| ${WORDS[n]} per-module chunks |`);
    expect(roadmapSource).toContain(`(${WORDS[n]} of them total`);
  });

  it('fatigue behaviour is defined for every mechanical metal', () => {
    expect(FATIGUE_BEHAVIOUR).toHaveLength(MECH_MATERIALS.length);
    for (const f of FATIGUE_BEHAVIOUR) {
      expect(MECH_MATERIALS.some((m) => m.id === f.id)).toBe(true);
    }
  });
});

describe('navigation model', () => {
  it('resolves every module to a group', () => {
    for (const item of NAV_GROUPS.flatMap((g) => g.items)) {
      expect(findItem(item.id).group).toBeDefined();
    }
  });
  it('returns null for the landing page rather than throwing', () => {
    expect(findItemOrNull('home')).toBeNull();
  });
  it('keeps module ids unique', () => {
    const ids = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('gives every module a label and a blurb', () => {
    for (const item of NAV_GROUPS.flatMap((g) => g.items)) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.blurb.length).toBeGreaterThan(0);
    }
  });
});

/**
 * The landing page prints four counts in its stats strip. They are the most
 * visible numbers in the product, so they are asserted like any other.
 */
describe('landing page stats strip', () => {
  it('12 modules, 118 elements, 54 Ashby materials, 8 crystal structures', () => {
    expect(NAV_GROUPS.flatMap((g) => g.items)).toHaveLength(12);
    expect((elementsRaw as unknown[]).length).toBe(118);
    expect(SELECTION_MATERIALS).toHaveLength(54);
    expect(STRUCTURES).toHaveLength(8);
  });
});

/**
 * The landing page shows a worked example — Fe–0.4 wt% C just below the
 * eutectoid — and prints the four fractions it produces. Those numerals are
 * written into `Landing.tsx` rather than computed there, to keep `phase/systems`
 * out of the eagerly-loaded chunk. This is the price of that: the front page's
 * arithmetic is asserted against the function the phase module actually calls,
 * so a change to the model breaks the suite instead of quietly leaving a wrong
 * number on the most-read page in the product.
 */
describe('landing page worked example — Fe–0.4 wt% C', () => {
  const C0 = 0.4;
  const result = steelMicrostructure(C0);

  /** Percentages as the page prints them: one decimal place. */
  const pct = (fraction: number): string => `${(fraction * 100).toFixed(1)} %`;

  it('is a hypoeutectoid steel, so the proeutectoid phase is ferrite', () => {
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('hypoeutectoid');
    expect(result!.proeutectoid).toBe('α (ferrite)');
  });

  it('prints 48.8 % proeutectoid ferrite and 51.2 % pearlite', () => {
    expect(pct(result!.proeutectoidFraction)).toBe('48.8 %');
    expect(pct(result!.pearlite)).toBe('51.2 %');
  });

  it('prints 94.3 % total ferrite and 5.7 % total cementite', () => {
    expect(pct(result!.totalFerrite)).toBe('94.3 %');
    expect(pct(result!.totalCementite)).toBe('5.7 %');
  });

  it('agrees with the lever rule taken directly across the α + Fe₃C field', () => {
    expect(result!.totalFerrite).toBeCloseTo(lever(C0, FERRITE_MAX, CEMENTITE_X), 12);
  });

  it('quotes the eutectoid the caption names: 0.76 wt% C at 727 °C', () => {
    expect(EUTECTOID_X).toBe(0.76);
    expect(EUTECTOID_T).toBe(727);
  });

  it('sits below the eutectoid composition, which is what makes it hypoeutectoid', () => {
    expect(C0).toBeLessThan(EUTECTOID_X);
    expect(C0).toBeGreaterThan(FERRITE_MAX);
  });
});

/**
 * Two things the landing page depends on that nothing else was checking.
 *
 * The first is structural: the module index is built by walking `NAV_GROUPS`
 * and looking each id up in the page's own `CARDS`. A module added to the nav
 * without a card would render nothing for it — on the one view that is loaded
 * eagerly.
 *
 * The second is a claim. Figure 3's caption names the alloys the plate draws,
 * and an earlier draft named aluminium while the generator plotted nickel — a
 * factual error on the page whose whole argument is that its figures are real.
 * The figure test checks that *some* alloy has a fatigue limit and *some* does
 * not; this checks that the ones named in the prose are the ones on the plate.
 */
describe('landing page and the data behind it', () => {
  it('has a card for every module in the navigation', () => {
    for (const item of NAV_GROUPS.flatMap((g) => g.items)) {
      expect(landingSource).toContain(`id: '${item.id}'`);
    }
  });

  it("names, in Fig. 3's caption, the alloys the plate actually draws", () => {
    const source = landingSource;
    const plate = fatiguePlate;

    // The alloys the generator chose, as the plate labels them.
    const plotted = ['Titanium', 'Steel (1020)', 'Nickel'];
    for (const alloy of plotted) expect(plate).toContain(`>${alloy}<`);
    expect(plate).toContain('no fatigue limit');

    // Fig. 3's caption alone — not the whole file, where "steel" appears in
    // half a dozen unrelated sentences and would make this pass for free.
    const entry = source.slice(source.indexOf('n: 3,'), source.indexOf('n: 4,'));
    const body = entry.slice(entry.indexOf("body:"), entry.indexOf('href:'));
    expect(body.length).toBeGreaterThan(80);

    // Every alloy the caption names must be one the plate draws, and the
    // caption must name at least the two that carry its point.
    const mentioned = ['Aluminium', 'Copper', 'Brass', 'Titanium', 'Steel', 'Nickel'].filter((a) =>
      body.includes(a),
    );
    expect(mentioned).not.toHaveLength(0);
    for (const alloy of mentioned) {
      expect(plotted.some((p) => p.startsWith(alloy))).toBe(true);
    }
    expect(mentioned).toContain('Nickel');
  });
});
