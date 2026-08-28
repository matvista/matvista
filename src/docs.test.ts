import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, findItem, findItemOrNull } from './nav';
import { STRUCTURES } from './crystal/structures';
import { SLIP_MODES, slipSystems } from './crystal/miller';
import { MECH_MATERIALS } from './mechanical/materials';
import { INDICES, SELECTION_MATERIALS } from './selection/materials';
import { XRD_SAMPLES, XRD_SOURCES } from './xrd/diffraction';
import { PHASE_SYSTEMS } from './phase/systems';
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
