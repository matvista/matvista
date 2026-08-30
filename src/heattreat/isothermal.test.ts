import { describe, expect, it } from 'vitest';
import { STEELS } from './steels';
import { TRACE_FRACTION, avramiFraction, buildTtt, isothermalHold } from './model';

const models = STEELS.map((s) => ({ steel: s, ttt: buildTtt(s) }));
const total = (o: { fractions: { fraction: number }[] }) =>
  o.fractions.reduce((t, f) => t + f.fraction, 0);

describe('the Avrami interpolation matches the curves it is fitted to', () => {
  /**
   * The start and finish curves are defined by the plot's own legend as
   * `TRACE_FRACTION` and 1 − `TRACE_FRACTION` transformed. The fit has to
   * reproduce that at the crossings rather than inventing a second convention.
   */
  it('reaches the trace fraction just past the start curve', () => {
    expect(avramiFraction(10, 1000, 10.0001)).toBeCloseTo(TRACE_FRACTION, 4);
  });

  it('reaches one minus the trace fraction just before the finish curve', () => {
    expect(avramiFraction(10, 1000, 999.9999)).toBeCloseTo(1 - TRACE_FRACTION, 4);
  });

  it('transforms nothing during incubation', () => {
    expect(avramiFraction(10, 1000, 9.999)).toBe(0);
    expect(avramiFraction(10, 1000, 1)).toBe(0);
  });

  it('rises monotonically and saturates at one', () => {
    let prev = -1;
    for (const t of [10, 20, 50, 100, 200, 500, 900, 1000, 5000]) {
      const f = avramiFraction(10, 1000, t);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
    expect(avramiFraction(10, 1000, 5000)).toBe(1);
  });

  it('refuses degenerate curves rather than returning a number', () => {
    expect(avramiFraction(0, 1000, 50)).toBe(0);
    expect(avramiFraction(100, 100, 50)).toBe(0);
    expect(avramiFraction(1000, 10, 50)).toBe(0);
  });
});

describe('the isothermal hold', () => {
  /**
   * Over the states the sliders can actually reach, not a chosen handful. A
   * six-by-six grid missed the case that mattered: a sub-trace product being
   * filtered out of the list took its mass with it, and the fractions summed
   * to 0.998 at 5140 / 560 °C / 34.7 s.
   */
  it.each(models.map((m) => m.steel.id))('%s: fractions sum to one everywhere reachable', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    let checked = 0;
    for (let T = 20; T <= Math.round(ttt.a1 - 5); T += 5) {
      for (let e = -1; e <= 6; e += 0.05) {
        const o = isothermalHold(steel, ttt, T, 10 ** e);
        expect(total(o), `${T} °C, ${(10 ** e).toFixed(2)} s`).toBeCloseTo(1, 9);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  /** And the specific state the review found. */
  it('sums to one at 5140, 560 °C, 34.7 s — the case the trace filter broke', () => {
    const { steel, ttt } = models.find((m) => m.steel.id === '5140')!;
    const o = isothermalHold(steel, ttt, 560, 34.7);
    expect(total(o)).toBeCloseTo(1, 12);
    expect(o.fractions.every((f) => f.fraction > 0)).toBe(true);
  });

  it.each(models.map((m) => m.steel.id))('%s: more time never means less product', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    const T = (ttt.ms + ttt.a1) / 2;
    let prev = -1;
    for (const t of [0.1, 1, 5, 20, 60, 300, 1200, 6000, 60000]) {
      const f = isothermalHold(steel, ttt, T, t).transformed;
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });

  it.each(models.map((m) => m.steel.id))('%s: above A₁ nothing transforms, ever', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    const o = isothermalHold(steel, ttt, ttt.a1 + 20, 1e6);
    expect(o.refusal).toBe('austenite is stable here');
    expect(o.transformed).toBe(0);
  });

  it.each(models.map((m) => m.steel.id))('%s: below Mˢ the construction is refused', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    const o = isothermalHold(steel, ttt, ttt.ms - 20, 1e6);
    expect(o.refusal).toBe('below Mˢ');
    expect(o.summary).toMatch(/[Mm]artemper/);
  });

  /**
   * The point of the whole feature: hold long enough in the bainite range and
   * the steel transforms completely at temperature, so the final quench forms
   * no martensite. That is austempering, and "no martensite" is the assertion
   * — not merely "less".
   */
  it.each(models.map((m) => m.steel.id))('%s: austempering leaves no martensite', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    // Comfortably in the bainite range *and* on the drawn diagram: 1080's Mˢ
    // sits below its own bainite floor, so Mˢ + 40 is off the curve for it.
    const T = (ttt.ms + steel.nose.temp) / 2;
    const o = isothermalHold(steel, ttt, T, 1e7);
    expect(o.transformed).toBe(1);
    expect(o.fractions.some((f) => f.product === 'martensite')).toBe(false);
    expect(o.summary).toMatch(/austemper/);
  });

  it.each(models.map((m) => m.steel.id))('%s: a short hold leaves it all austenite', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    const T = (ttt.ms + ttt.a1) / 2;
    const o = isothermalHold(steel, ttt, T, 1e-4);
    expect(o.transformed).toBe(0);
    expect(o.fractions).toEqual([{ product: 'martensite', fraction: 1 }]);
  });

  /**
   * Hardness has to sit between the two things it is a mixture of, at every
   * hold, or the mixing rule is wrong somewhere.
   */
  /**
   * The mixing rule itself, not merely its bounds. Swapping which term carries
   * `fraction` leaves every bound satisfied — a fully austempered 1080 would
   * print martensite's 65 HRC beside a summary saying no martensite formed —
   * so the two endpoints are pinned to the values they must take.
   */
  it.each(models.map((m) => m.steel.id))('%s: hardness is the product’s at full transformation', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    const T = Math.round((ttt.ms + steel.nose.temp) / 2);
    const full = isothermalHold(steel, ttt, T, 1e7);
    expect(full.transformed).toBe(1);
    // Bainite at this temperature, and nothing else.
    expect(full.hardness).toBeCloseTo(steel.hardness.bainite, 9);
    expect(full.hardness).toBeLessThan(steel.hardness.martensite);

    const none = isothermalHold(steel, ttt, T, 1e-4);
    expect(none.transformed).toBe(0);
    expect(none.hardness).toBeCloseTo(steel.hardness.martensite, 9);
  });

  it.each(models.map((m) => m.steel.id))('%s: hardness stays inside its own bounds', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    const lo = Math.min(
      steel.hardness.coarsePearlite,
      steel.hardness.finePearlite,
      steel.hardness.bainite,
    );
    for (const T of [ttt.ms + 30, 500, 600, 680]) {
      for (const t of [1, 100, 1e6]) {
        const h = isothermalHold(steel, ttt, T, t).hardness;
        expect(h).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(h).toBeLessThanOrEqual(steel.hardness.martensite + 1e-9);
      }
    }
  });

  /**
   * The nose is the shortest incubation on the diagram, by definition. If the
   * lookup were reading the wrong curve or interpolating the wrong way, this
   * is where it would show.
   */
  it.each(models.map((m) => m.steel.id))('%s: incubation is shortest at the nose', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    const atNose = isothermalHold(steel, ttt, steel.nose.temp, 1).tStart!;
    for (const dT of [-80, -40, 40, 80]) {
      const t = isothermalHold(steel, ttt, steel.nose.temp + dT, 1).tStart;
      if (t != null) expect(t).toBeGreaterThan(atNose - 1e-9);
    }
    expect(atNose).toBeCloseTo(steel.nose.time, 1);
  });

  /**
   * Interpolation between curve samples is in log t, and it is not a detail:
   * near A₁ the incubation time falls by more than an order of magnitude
   * across a single 2.9 °C sample step, where linear interpolation is 3×
   * wrong. Replacing the log interpolation with a linear one left the rest of
   * this file green, because nothing else probed that region.
   *
   * At a segment's midpoint the log form is exactly the geometric mean of the
   * two endpoints, which the arithmetic mean is not — so the two are told
   * apart directly, and the segment is chosen as the one where they differ
   * most rather than being assumed to differ at all.
   */
  it.each(models.map((m) => m.steel.id))('%s: interpolates in log time', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    let widest = 0;
    let seg: [(typeof ttt.start)[number], (typeof ttt.start)[number]] | null = null;
    for (let i = 1; i < ttt.start.length; i++) {
      const a = ttt.start[i - 1];
      const b = ttt.start[i];
      if (b.T <= ttt.ms) break;
      const ratio = Math.abs(Math.log(b.t / a.t));
      if (ratio > widest) {
        widest = ratio;
        seg = [a, b];
      }
    }
    const [a, b] = seg!;
    const geometric = Math.sqrt(a.t * b.t);
    const arithmetic = (a.t + b.t) / 2;
    // Not vacuous: the two candidate rules must actually disagree here.
    expect(Math.abs(arithmetic / geometric - 1)).toBeGreaterThan(0.5);

    const got = isothermalHold(steel, ttt, (a.T + b.T) / 2, 1).tStart!;
    expect(got / geometric).toBeCloseTo(1, 9);

    /**
     * The midpoint alone cannot see a reversed interpolation, because u = ½ is
     * symmetric. The quarter point is not: reversing u there moves tStart by a
     * factor of several.
     */
    const quarter = isothermalHold(steel, ttt, a.T - (a.T - b.T) / 4, 1).tStart!;
    expect(quarter / Math.exp(0.75 * Math.log(a.t) + 0.25 * Math.log(b.t))).toBeCloseTo(1, 9);
  });

  /**
   * The lowest segment of the curve is still part of the curve. Dropping it
   * makes the bottom few degrees read "off the diagram" instead of being
   * interpolated, and the 5 °C sweep above steps straight over a band that
   * narrow.
   */
  it.each(models.map((m) => m.steel.id))('%s: the coldest curve segment is still read', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    const last = ttt.start[ttt.start.length - 1];
    const prev = ttt.start[ttt.start.length - 2];
    const T = (last.T + prev.T) / 2;
    // Only meaningful where that band is above Mˢ and so actually reachable.
    if (T <= ttt.ms) return;
    const o = isothermalHold(steel, ttt, T, 1);
    expect(o.tStart, `${id} at ${T.toFixed(1)} °C`).not.toBeNull();
    expect(o.tStart!).toBeCloseTo(Math.sqrt(prev.t * last.t), 6);
  });

  it.each(models.map((m) => m.steel.id))('%s: the finish curve is always later', (id) => {
    const { steel, ttt } = models.find((m) => m.steel.id === id)!;
    for (const T of [ttt.ms + 20, 450, 550, 650, 690]) {
      const o = isothermalHold(steel, ttt, T, 1);
      if (o.tStart != null && o.tFinish != null) expect(o.tFinish).toBeGreaterThan(o.tStart);
    }
  });
});
