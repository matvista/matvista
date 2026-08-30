import { describe, expect, it } from 'vitest';
import {
  HARDNESS_SCALES,
  KNOOP_CONSTANT,
  TS_PER_HB,
  VICKERS_CONSTANT,
  brinell,
  convertScale,
  isFerrous,
  knoop,
  tensileFromBrinell,
  vickers,
} from './hardness';
import { MECH_MATERIALS } from './materials';

describe('each scale is its own definition', () => {
  /**
   * The Vickers constant is 2·sin(136°/2) — the indenter's apex angle, not a
   * fitted number. Quoting 1.854 as a magic constant is how it comes to look
   * empirical.
   */
  it('derives the Vickers constant from the 136° apex angle', () => {
    expect(VICKERS_CONSTANT).toBeCloseTo(1.8544, 4);
    expect(VICKERS_CONSTANT).toBeCloseTo(2 * Math.sin((136 / 2) * (Math.PI / 180)), 15);
  });

  /**
   * A pyramid makes geometrically similar impressions, so Vickers is
   * load-independent: double the load, the diagonal grows by √2, the number
   * does not move. That is the property Brinell does not have.
   */
  it('makes Vickers independent of load', () => {
    const base = vickers(10, 0.2)!;
    for (const k of [2, 5, 20]) {
      expect(vickers(10 * k, 0.2 * Math.sqrt(k))!).toBeCloseTo(base, 9);
    }
  });

  it('makes Knoop independent of load too', () => {
    const base = knoop(1, 0.1)!;
    expect(knoop(4, 0.2)!).toBeCloseTo(base, 9);
    expect(KNOOP_CONSTANT).toBeCloseTo(14.229, 3);
  });

  /**
   * Brinell is an area measure over a spherical cap, so it is *not*
   * load-independent — which is why the standard fixes F/D².
   */
  it('leaves Brinell dependent on load, which is why F/D² is standardised', () => {
    const a = brinell(3000, 10, 4)!;
    const b = brinell(1500, 10, 4)!;
    expect(b).toBeCloseTo(a / 2, 9);
  });

  it('reproduces a worked Brinell impression', () => {
    // 3000 kgf on a 10 mm ball leaving a 4.0 mm impression.
    const hb = brinell(3000, 10, 4)!;
    expect(hb).toBeGreaterThan(220);
    expect(hb).toBeLessThan(240);
    // The cap area form: HB = 2F / (πD(D − √(D²−d²))).
    const cap = 10 - Math.sqrt(100 - 16);
    expect(hb).toBeCloseTo((2 * 3000) / (Math.PI * 10 * cap), 12);
  });

  it('refuses impressions that are not physical', () => {
    expect(brinell(3000, 10, 10)).toBeNull();
    expect(brinell(3000, 10, 12)).toBeNull();
    expect(brinell(0, 10, 4)).toBeNull();
    expect(vickers(10, 0)).toBeNull();
    expect(knoop(1, -0.1)).toBeNull();
  });

  it('describes three scales, each with its own indenter', () => {
    expect(HARDNESS_SCALES).toHaveLength(3);
    expect(new Set(HARDNESS_SCALES.map((s) => s.id)).size).toBe(3);
    for (const s of HARDNESS_SCALES) {
      expect(s.indenter.length).toBeGreaterThan(0);
      expect(s.note.length).toBeGreaterThan(20);
    }
  });
});

describe('the correlation, and the refusal', () => {
  /** Callister eq. 6.20a — and it is a correlation, not a law. */
  it('estimates tensile strength from Brinell for steels', () => {
    expect(TS_PER_HB).toBe(3.45);
    expect(tensileFromBrinell(200, true)).toBeCloseTo(690, 9);
  });

  /**
   * The lesson: E140's own scope says conversions are not transferable
   * between material classes. Refusing is the behaviour; a footnote is not.
   */
  it('refuses the estimate for anything that is not a steel', () => {
    expect(tensileFromBrinell(200, false)).toBeNull();
    expect(tensileFromBrinell(0, true)).toBeNull();
  });

  it('knows which shipped materials the correlation applies to', () => {
    const ferrous = MECH_MATERIALS.filter((m) => isFerrous(m.id)).map((m) => m.id);
    expect(ferrous.sort()).toEqual(['fe', 'steel1020']);
    for (const m of MECH_MATERIALS) {
      expect(tensileFromBrinell(200, isFerrous(m.id)) == null).toBe(!isFerrous(m.id));
    }
  });

  /**
   * Cross-scale conversion is not offered at all. This asserts the absence,
   * so nobody adds an invented ladder later without the test noticing.
   */
  it('offers no cross-scale conversion', () => {
    expect(convertScale()).toBeNull();
  });
});
