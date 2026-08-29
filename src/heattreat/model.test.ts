import { describe, expect, it } from 'vitest';
import { STEELS, getSteel, martensiteStart, martensiteFractionTemp } from './steels';
import {
  TRACE_FRACTION, buildTtt, criticalCoolingRate, equilibriumFerriteFraction, predict,
  tangentCoolingRate,
} from './model';
import { EUTECTOID_T, EUTECTOID_X, a3Temperature } from '../phase/systems';

const AUST = 850;
const martensite = (id: string, rate: number) => {
  const s = getSteel(id);
  const o = predict(s, buildTtt(s), AUST, rate);
  return o.fractions.find((f) => f.product === 'martensite')?.fraction ?? 0;
};

describe('critical cooling rate', () => {
  it.each(STEELS.map((s) => s.id))('%s: is the boundary predict itself reports', (id) => {
    const s = getSteel(id);
    const ttt = buildTtt(s);
    const crit = criticalCoolingRate(s, ttt, AUST)!;
    expect(crit).not.toBeNull();
    // At the rate, the nose is missed entirely; just below it, it is not.
    expect(predict(s, ttt, AUST, crit).startTemp).toBeNull();
    expect(predict(s, ttt, AUST, crit * 0.98).startTemp).not.toBeNull();
  });

  it.each(STEELS.map((s) => s.id))('%s: transformed fraction is continuous there', (id) => {
    const s = getSteel(id);
    const ttt = buildTtt(s);
    const crit = criticalCoolingRate(s, ttt, AUST)!;
    // Regression guard: this jumped 6.7-10 percentage points before the fix.
    expect(1 - martensite(id, crit * 0.999)).toBeLessThan(0.01);
  });

  it('the by-hand tangent construction always gives the higher figure', () => {
    for (const s of STEELS) {
      const crit = criticalCoolingRate(s, buildTtt(s), AUST)!;
      expect(tangentCoolingRate(s, AUST)).toBeGreaterThan(crit);
    }
  });

  it('reproduces the figures quoted in the UI for 1080', () => {
    const s = getSteel('1080');
    expect(Math.round(tangentCoolingRate(s, AUST))).toBe(310);
    expect(Math.round(criticalCoolingRate(s, buildTtt(s), AUST)!)).toBe(233);
  });

  it('ranks hardenability 4340 < 5140 < 1080, about 100x across the range', () => {
    const c = (id: string) => criticalCoolingRate(getSteel(id), buildTtt(getSteel(id)), AUST)!;
    expect(c('4340')).toBeLessThan(c('5140'));
    expect(c('5140')).toBeLessThan(c('1080'));
    const ratio = c('1080') / c('4340');
    expect(ratio).toBeGreaterThan(70);
    expect(ratio).toBeLessThan(150);
  });

  it('stays inside the slider’s range for every steel', () => {
    for (const s of STEELS) {
      const crit = criticalCoolingRate(s, buildTtt(s), AUST)!;
      expect(crit).toBeGreaterThanOrEqual(0.01);
      expect(crit).toBeLessThanOrEqual(5000);
    }
  });
});

describe('predict', () => {
  it.each(STEELS.map((s) => s.id))('%s: martensite fraction is monotone in cooling rate', (id) => {
    let prev = -1;
    for (let lg = -2; lg <= 4; lg += 0.02) {
      const f = martensite(id, 10 ** lg);
      expect(f).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = f;
    }
  });

  it.each(STEELS.map((s) => s.id))('%s: fractions sum to 1 and stay in range', (id) => {
    const s = getSteel(id);
    const ttt = buildTtt(s);
    for (let lg = -2; lg <= 4; lg += 0.05) {
      const o = predict(s, ttt, AUST, 10 ** lg);
      const sum = o.fractions.reduce((a, f) => a + f.fraction, 0);
      expect(sum).toBeCloseTo(1, 9);
      for (const f of o.fractions) {
        expect(f.fraction).toBeGreaterThanOrEqual(0);
        expect(f.fraction).toBeLessThanOrEqual(1);
      }
      expect(o.hardness).toBeGreaterThan(10);
      expect(o.hardness).toBeLessThan(70);
    }
  });

  it('never reports "roughly 0%" of a product it says formed', () => {
    for (const s of STEELS) {
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.01) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        const m = o.summary.match(/roughly (\d+)%/);
        if (m) expect(Number(m[1])).toBeGreaterThanOrEqual(1);
        // Anything displayed (>= TRACE_FRACTION) must round to at least 1%.
        for (const f of o.fractions) {
          if (f.fraction >= TRACE_FRACTION) expect(Math.round(f.fraction * 100)).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('gives fully pearlitic structure under a slow cool', () => {
    for (const s of STEELS) expect(martensite(s.id, 0.01)).toBe(0);
  });
});

describe('martensite temperatures', () => {
  it('follows Andrews’ equation', () => {
    // 539 - 423C - 30.4Mn - 17.7Ni - 12.1Cr - 7.5Mo
    const c = { C: 0.4, Mn: 0.8, Ni: 0, Cr: 0.85, Mo: 0 };
    expect(martensiteStart(c)).toBeCloseTo(539 - 423 * 0.4 - 30.4 * 0.8 - 12.1 * 0.85, 9);
  });

  it('puts 1080’s M90 below room temperature — the retained-austenite case', () => {
    const ms = martensiteStart(getSteel('1080').composition);
    expect(martensiteFractionTemp(ms, 0.9)).toBeLessThan(20);
  });

  it('is monotone: more martensite needs a lower temperature', () => {
    const ms = 300;
    expect(martensiteFractionTemp(ms, 0.9)).toBeLessThan(martensiteFractionTemp(ms, 0.5));
    expect(martensiteFractionTemp(ms, 0.5)).toBeLessThan(ms);
  });
});

/**
 * 5140 and 4340 are 0.40 wt% C — hypoeutectoid. Cooled slowly they must reject
 * proeutectoid ferrite before the remaining austenite, now at the eutectoid
 * composition, becomes pearlite. The amount is not a kinetic quantity: it is
 * the lever rule against the Fe–Fe₃C boundaries,
 *
 *     (0.76 − 0.40) / (0.76 − 0.022) = 0.36 / 0.738 ≈ 0.488,
 *
 * and it comes from `phase/systems.ts` so the two modules cannot drift. 1080
 * is eutectoid at 0.79 wt% C and its own note says it forms no proeutectoid
 * phase — that must stay true.
 */
describe('proeutectoid ferrite', () => {
  const SLOW = 0.01;
  const ferriteOf = (o: ReturnType<typeof predict>) =>
    o.fractions.find((f) => f.product === 'proeutectoid ferrite')?.fraction ?? 0;

  it('takes the A₃ boundary from the phase module, not a retyped constant', () => {
    expect(a3Temperature(0)).toBeCloseTo(912, 9); // pure iron
    expect(a3Temperature(EUTECTOID_X)).toBeCloseTo(EUTECTOID_T, 9); // meets A₁
    // 0.40 wt% C sits 0.40/0.76 of the way down from 912 °C to 727 °C.
    expect(a3Temperature(0.4)).toBeCloseTo(912 - (0.4 / 0.76) * (912 - 727), 9);
  });

  it('every shipped steel’s A₁ is the phase module’s eutectoid temperature', () => {
    for (const s of STEELS) expect(s.a1).toBe(EUTECTOID_T);
  });

  it('gives ≈0.488 equilibrium ferrite for the two 0.40 wt% C steels', () => {
    const lever = (0.76 - 0.4) / (0.76 - 0.022);
    expect(lever).toBeCloseTo(0.4878, 4);
    for (const id of ['5140', '4340']) {
      expect(equilibriumFerriteFraction(getSteel(id))).toBeCloseTo(lever, 12);
    }
  });

  it('gives exactly 0 for eutectoid 1080 — its note says no proeutectoid phase', () => {
    expect(equilibriumFerriteFraction(getSteel('1080'))).toBe(0);
    const s = getSteel('1080');
    const ttt = buildTtt(s);
    for (let lg = -2; lg <= 4; lg += 0.02) {
      expect(ferriteOf(predict(s, ttt, AUST, 10 ** lg))).toBe(0);
    }
    expect(ttt.a3).toBeNull();
    expect(ttt.equilibriumFerrite).toBe(0);
  });

  it('a slow cool gives ferrite + pearlite in the lever-rule proportions', () => {
    const lever = (0.76 - 0.4) / (0.76 - 0.022);
    for (const id of ['5140', '4340']) {
      const s = getSteel(id);
      const o = predict(s, buildTtt(s), AUST, SLOW);
      expect(ferriteOf(o)).toBeCloseTo(lever, 6);
      const pearlite = o.fractions.find((f) => f.product === 'coarse pearlite')!.fraction;
      expect(pearlite).toBeCloseTo(1 - lever, 6);
      expect(o.fractions.reduce((a, f) => a + f.fraction, 0)).toBeCloseTo(1, 12);
    }
  });

  it('1080 slow-cools to 100% coarse pearlite, exactly as before', () => {
    const s = getSteel('1080');
    const o = predict(s, buildTtt(s), AUST, SLOW);
    expect(o.fractions).toEqual([{ product: 'coarse pearlite', fraction: 1 }]);
    expect(o.hardness).toBe(s.hardness.coarsePearlite);
  });

  it('never exceeds the equilibrium fraction, at any rate', () => {
    for (const s of STEELS) {
      const eq = equilibriumFerriteFraction(s);
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.02) {
        expect(ferriteOf(predict(s, ttt, AUST, 10 ** lg))).toBeLessThanOrEqual(eq + 1e-12);
      }
    }
  });

  it('is monotone: faster cooling never gives more ferrite', () => {
    for (const s of STEELS) {
      const ttt = buildTtt(s);
      let prev = 1;
      for (let lg = -2; lg <= 4; lg += 0.02) {
        const f = ferriteOf(predict(s, ttt, AUST, 10 ** lg));
        expect(f).toBeLessThanOrEqual(prev + 1e-9);
        prev = f;
      }
    }
  });

  it('a fully quenched path is unchanged: 100% martensite, no ferrite', () => {
    for (const s of STEELS) {
      const o = predict(s, buildTtt(s), AUST, 5000);
      expect(o.fractions).toEqual([{ product: 'martensite', fraction: 1 }]);
      expect(o.hardness).toBe(s.hardness.martensite);
      expect(o.startTemp).toBeNull();
    }
  });

  /**
   * Regression guard. The ferrite curve is confined to the A₃–A₁ band, which a
   * quench crosses far too fast to accumulate any incubation, so the critical
   * cooling rate — the boundary `predict` reports between a mixed structure and
   * full martensite — must be untouched. Values measured before the change.
   */
  it.each([
    ['1080', 233.410447],
    ['5140', 36.461357],
    ['4340', 2.133697],
  ])('%s: critical cooling rate is unchanged at %f °C/s', (id, expected) => {
    const s = getSteel(id);
    expect(criticalCoolingRate(s, buildTtt(s), AUST)!).toBeCloseTo(expected, 5);
  });

  it('forms no ferrite at or above the critical cooling rate', () => {
    for (const s of STEELS) {
      const ttt = buildTtt(s);
      const crit = criticalCoolingRate(s, ttt, AUST)!;
      for (const r of [crit, crit * 1.5, crit * 10, 5000]) {
        expect(ferriteOf(predict(s, ttt, AUST, r))).toBe(0);
      }
    }
  });

  it('reports A₃ for the hypoeutectoid steels and null otherwise', () => {
    for (const id of ['5140', '4340']) {
      const s = getSteel(id);
      expect(buildTtt(s).a3).toBeCloseTo(a3Temperature(s.composition.C), 9);
      expect(buildTtt(s).a3).toBeCloseTo(814.63, 2);
    }
    expect(buildTtt(getSteel('1080')).a3).toBeNull();
  });

  /**
   * Mass balance, not kinetics: pearlite is eutectoid at 0.76 wt% C, so
   * whatever pearlite a 0.40 wt% C steel forms must be accompanied by
   * proeutectoid ferrite in the lever-rule ratio.
   */
  it('keeps ferrite and pearlite in the lever-rule ratio wherever it splits', () => {
    for (const id of ['5140', '4340']) {
      const s = getSteel(id);
      const ttt = buildTtt(s);
      const eq = ttt.equilibriumFerrite;
      for (let lg = -2; lg <= 4; lg += 0.02) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        const f = ferriteOf(o);
        const p = o.fractions
          .filter((x) => x.product === 'coarse pearlite' || x.product === 'fine pearlite')
          .reduce((a, x) => a + x.fraction, 0);
        // The split is claimed only for a completed transformation; a path cut
        // short at Mˢ reports the undivided product, so `f` is 0 there.
        if (f > 0) expect(f / (f + p)).toBeCloseTo(eq, 12);
        else if (o.complete && p > 0) expect(eq).toBe(0);
      }
    }
  });

  it('a bainitic path carries no proeutectoid ferrite', () => {
    for (const id of ['5140', '4340']) {
      const s = getSteel(id);
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.02) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        if (o.fractions.some((f) => f.product === 'bainite')) {
          expect(ferriteOf(o)).toBe(0);
        }
      }
    }
  });

  it('leaves the hardness readout untouched at every rate', () => {
    // The scope note on `hardnessOf` explains why: the shipped per-steel
    // product hardnesses already describe the ferrite + pearlite structure, so
    // diluting them again by the ferrite fraction would double-count.
    for (const id of ['5140', '4340', '1080']) {
      const s = getSteel(id);
      const ttt = buildTtt(s);
      const o = predict(s, ttt, AUST, 0.01);
      expect(o.hardness).toBe(s.hardness.coarsePearlite);
    }
  });

  it('ferrite appears before pearlite on the same path, never after', () => {
    for (const id of ['5140', '4340']) {
      const s = getSteel(id);
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.05) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        const order = o.fractions.map((f) => f.product);
        const fi = order.indexOf('proeutectoid ferrite');
        if (fi >= 0) expect(fi).toBe(0);
      }
    }
  });
});

/**
 * Where the ferrite split may and may not be claimed.
 *
 * The lever rule fixes the *equilibrium* ferrite fraction. It says nothing
 * about how a half-finished transformation divides, and this model has no
 * ferrite kinetics to say it with — so the split is claimed only where the
 * diffusional transformation ran to completion.
 *
 * The regression these guard against: the split was applied in the
 * partially-transformed branch too, where `TRACE_FRACTION` gates the prose on
 * the *unsplit* fraction and the bar on the *split* fractions. In the window
 * 0.005 ≤ f < 0.005/(1 − 0.4878) the prose quantified a product the bar had
 * already filtered out — the exact contradiction the constant exists to
 * prevent.
 */
describe('the ferrite split is only claimed where the model determines it', () => {
  const ferriteOf = (o: ReturnType<typeof predict>) =>
    o.fractions.find((f) => f.product === 'proeutectoid ferrite')?.fraction ?? 0;

  it('reports ferrite only when the transformation ran to completion', () => {
    for (const s of STEELS) {
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.005) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        if (ferriteOf(o) > 0) expect(o.complete).toBe(true);
      }
    }
  });

  it('never splits a product that is cut short at Mˢ', () => {
    for (const s of STEELS) {
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.005) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        if (!o.complete) {
          expect(o.fractions.map((f) => f.product)).not.toContain('proeutectoid ferrite');
        }
      }
    }
  });

  /**
   * The invariant the trace guard exists to hold: a product the prose puts a
   * number on must be a product the bar actually draws.
   */
  it('never quantifies a product the bar filters out', () => {
    for (const s of STEELS) {
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.002) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        const quantified = o.summary.match(/roughly (\d+)% ([^,.]+?) embedded/);
        if (!quantified) continue;
        const named = quantified[2].split(' + ').map((x) => x.trim());
        let sum = 0;
        for (const name of named) {
          const part = o.fractions.find((f) => f.product === name);
          expect(part, `${s.id} @ ${10 ** lg}: prose names "${name}", fractions do not`).toBeDefined();
          expect(part!.fraction).toBeGreaterThanOrEqual(TRACE_FRACTION);
          sum += part!.fraction;
        }
        expect(Math.round(sum * 100)).toBe(Number(quantified[1]));
      }
    }
  });

  /**
   * The three reachable slider detents a reviewer found. On the parent each
   * drew a single ~0.91% segment; the split pushed both halves under
   * TRACE_FRACTION so the bar showed martensite alone while the prose still
   * claimed 1%.
   */
  it.each([
    ['5140', 33.1131],
    ['4340', 1.9055],
    ['4340', 1.9498],
  ])('%s at %f °C/s draws every product its prose quantifies', (id, rate) => {
    const s = getSteel(id);
    const o = predict(s, buildTtt(s), AUST, rate);
    const displayed = o.fractions.filter((f) => f.fraction >= TRACE_FRACTION);
    // The diffusional product is ~0.91% here — above the trace floor, so it
    // must survive to the bar rather than being split into two invisible parts.
    expect(displayed.map((f) => f.product)).toContain(
      o.fractions.find((f) => f.product !== 'martensite')!.product,
    );
    expect(ferriteOf(o)).toBe(0);
  });
});
