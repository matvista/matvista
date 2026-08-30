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
import { XRD_SAMPLES, XRD_SOURCES, braggReach, braggTwoTheta, isAllowed } from './xrd/diffraction';
import { dSpacing } from './crystal/miller';
import { PROPERTIES } from './types';
import { CEMENTITE_X, EUTECTOID_T, EUTECTOID_X, FERRITE_MAX, PHASE_SYSTEMS, lever, steelMicrostructure } from './phase/systems';
import { JOMINY_DISTANCES, JOMINY_RATES, STEELS } from './heattreat/steels';
import { DIFFUSION_SYSTEMS } from './diffusion/model';
import { BRITTLE_SOLIDS, FATIGUE_BEHAVIOUR, FRACTURE_ALLOYS, GROWTH_CLASSES } from './failure/materials';
import { CRACK_GEOMETRIES, geometryFactor } from './failure/model';
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

  /**
   * The README says "five named crack geometries … plus a free-Y fallback".
   * Named means the closed form is in the table, so the count is the number of
   * entries that return a Y — not the length of the array, which would go on
   * matching if a geometry lost its formula and became a second free slider.
   */
  it('5 named crack geometries with a closed-form Y, plus the custom fallback', () => {
    const named = CRACK_GEOMETRIES.filter((g) => geometryFactor(g, 0.3) != null);
    expect(named).toHaveLength(5);
    expect(CRACK_GEOMETRIES).toHaveLength(6);
    expect(CRACK_GEOMETRIES.filter((g) => geometryFactor(g, 0.3) == null).map((g) => g.id))
      .toEqual(['custom']);
  });

  /**
   * The README's link table offers `#/xrd?sample=fe&source=cr` as the case
   * "where the λ ≤ 2d limit bites". That is a claim about the physics, not a
   * spelling of a URL, so it is checked as one: the ids must exist, and the
   * chromium anode must actually reach fewer of iron's families than the
   * copper anode the module opens on. A link that no longer demonstrated
   * anything would be worse than no link.
   */
  it('the README’s λ ≤ 2d link is a sample and anode where peaks are lost', () => {
    const fe = XRD_SAMPLES.find((s) => s.id === 'fe');
    const cr = XRD_SOURCES.find((s) => s.id === 'cr');
    const cu = XRD_SOURCES.find((s) => s.id === 'cu');
    expect(fe).toBeDefined();
    expect(cr).toBeDefined();
    expect(cu).toBeDefined();
    const onCr = braggReach(fe!.lattice, fe!.a, cr!.lambda);
    const onCu = braggReach(fe!.lattice, fe!.a, cu!.lambda);
    expect(onCr.reachable).toBeLessThan(onCu.reachable);
    expect(onCr.smallestD).not.toBeNull();
    expect(onCr.smallestD!).toBeGreaterThanOrEqual(onCr.dMin);
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
 * The landing page's worked example — Fe–0.4 wt% C just below the eutectoid.
 *
 * It used to be four numerals written into `Landing.tsx`, and this block
 * asserted the strings against the model. It is now computed on the page, from
 * `phase/eutectoid.ts`, so those string assertions would be the model checked
 * against itself and would guard nothing: what a reader sees is checked by
 * rendering it, in `lever-rule.behaviour.test.tsx`.
 *
 * What is left here is the part that is still a claim about the *prose* — the
 * copy says 0.76 wt% C and 727 °C, and calls the example hypoeutectoid — plus
 * the agreement between the two paths through the lever rule.
 */
describe('landing page worked example — Fe–0.4 wt% C', () => {
  const C0 = 0.4;
  const result = steelMicrostructure(C0);

  it('is a hypoeutectoid steel, so the proeutectoid phase is ferrite', () => {
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('hypoeutectoid');
    expect(result!.proeutectoid).toBe('α (ferrite)');
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
 * The second is a claim. Figure 4's caption names the alloys the plate draws,
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

  /**
   * "The same reflection, from both ends."
   *
   * The page prints five numbers for copper's (111) and (100), and the whole
   * point of printing them is that they are computed rather than remembered.
   * So they are checked against the two modules' own functions, with the
   * lattice parameter and the wavelength read out of the data rather than
   * restated — copper's *a* comes from an atomic radius of 0.1278 nm through
   * `latticeParameter`, and hard-coding 0.3615 here would stop guarding that.
   *
   * The trap this closes is a real one, caught in review: the page first said
   * 43.30°, which is the *literature* value the README quotes. The model
   * computes 43.32, and `xrd/diffraction.ts` says so in its own header. A front
   * page that rounds its computed answer towards the textbook has given up the
   * only claim it was making.
   */
  it('prints copper’s (111) and (100) as the two modules actually compute them', () => {
    const copper = XRD_SAMPLES.find((s) => s.id === 'cu')!;
    const anode = XRD_SOURCES.find((s) => s.id === 'cu')!;
    expect(copper.lattice).toBe('fcc');

    const source = landingSource;
    expect(source).toContain(`a: '${copper.a.toFixed(4)}'`);
    expect(source).toContain(`lambda: '${anode.lambda}'`);

    // (111) — allowed, and the first line of the pattern.
    const d111 = dSpacing([1, 1, 1], copper.a);
    const twoTheta111 = braggTwoTheta(d111, anode.lambda);
    expect(isAllowed(copper.lattice, 1, 1, 1)).toBe(true);
    expect(twoTheta111).not.toBeNull();
    expect(source).toContain(`d: '${d111.toFixed(4)}'`);
    expect(source).toContain(`twoTheta: '${twoTheta111!.toFixed(2)}'`);

    // (100) — extinct, but not for want of an angle. Both numbers are on the
    // page precisely because "absent" and "unreachable" are different things.
    const d100 = dSpacing([1, 0, 0], copper.a);
    const twoTheta100 = braggTwoTheta(d100, anode.lambda);
    expect(isAllowed(copper.lattice, 1, 0, 0)).toBe(false);
    expect(twoTheta100).not.toBeNull();
    expect(source).toContain(`d: '${d100.toFixed(4)}'`);
    expect(source).toContain(`twoTheta: '${twoTheta100!.toFixed(2)}'`);

    // Miller's d-spacing and XRD's are the agreement the section claims.
    expect(d111).toBeCloseTo(copper.a / Math.sqrt(3), 12);
  });

  /**
   * "Hand it to a class" puts six deep links on the page.
   *
   * Checking that the route segment resolves would be the easy version and the
   * useless one: route names are stable, and the failure this repo has actually
   * had was a cross-module *parameter* leak found by working through the
   * README's own examples. So every id in every query below is looked up in the
   * data that defines it, and a link that stopped meaning anything fails here.
   */
  it('every shareable link resolves to a real route with real parameters', () => {
    const tabs = new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id as string)));
    /*
     * Both spellings. `href: '#/…'` catches the two data tables — the module
     * cards and the shareable links — and `href="#/…"` catches the ones written
     * straight into the markup, which is where the "two modules agree" section
     * and every call to action lives. Matching only the first form left seven
     * links on the page unchecked, including the two that section added.
     */
    const links = [
      ...[...landingSource.matchAll(/href: '(#\/[^']+)'/g)].map((m) => m[1]),
      ...[...landingSource.matchAll(/href="(#\/[^"]+)"/g)].map((m) => m[1]),
    ];
    expect(links.length).toBeGreaterThanOrEqual(20);
    // Both forms are present, so neither half of the regex can rot unnoticed.
    expect(links.filter((l) => l.includes('?')).length).toBeGreaterThanOrEqual(8);
    expect(links).toContain('#/miller?plane=111');
    expect(links).toContain('#/xrd?sample=cu&source=cu');

    /** Which data each parameter key is drawn from, per module. */
    const VALID: Record<string, Record<string, Set<string>>> = {
      heattreat: { steel: new Set(STEELS.map((s) => s.id)) },
      miller: { s: new Set(STRUCTURES.map((s) => s.id)) },
      phase: { sys: new Set(PHASE_SYSTEMS.map((s) => s.id)) },
      trends: {
        prop: new Set(PROPERTIES.map((p) => p.key)),
        el: new Set((elementsRaw as { symbol: string }[]).map((e) => e.symbol)),
      },
      failure: { geom: new Set(CRACK_GEOMETRIES.map((g) => g.id)) },
      xrd: {
        sample: new Set(XRD_SAMPLES.map((x) => x.id)),
        source: new Set(XRD_SOURCES.map((x) => x.id)),
      },
    };

    let checkedParams = 0;
    for (const link of links) {
      const [path, query = ''] = link.slice(2).split('?');
      expect(tabs, `${link} is not a module`).toContain(path);
      for (const [key, value] of new URLSearchParams(query)) {
        const allowed = VALID[path]?.[key];
        if (!allowed) continue; // numeric parameters: range, not membership
        expect(allowed, `${link}: ${key}=${value}`).toContain(value);
        checkedParams++;
      }
    }
    // The loop is only evidence if it checked something.
    expect(checkedParams).toBeGreaterThanOrEqual(10);
  });

  it("names, in Fig. 4's caption, the alloys the plate actually draws", () => {
    const source = landingSource;
    const plate = fatiguePlate;

    // The alloys the generator chose, as the plate labels them.
    const plotted = ['Titanium', 'Steel (1020)', 'Nickel'];
    for (const alloy of plotted) expect(plate).toContain(`>${alloy}<`);
    expect(plate).toContain('no fatigue limit');

    // Fig. 3's caption alone — not the whole file, where "steel" appears in
    // half a dozen unrelated sentences and would make this pass for free.
    const entry = source.slice(source.indexOf('n: 4,'), source.indexOf('n: 5,'));
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
