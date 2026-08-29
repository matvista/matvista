import { describe, expect, it } from 'vitest';
import { STEELS, getSteel, martensiteStart, martensiteFractionTemp } from './steels';
import {
  TRACE_FRACTION, buildTtt, criticalCoolingRate, equilibriumFerriteFraction, predict,
  tangentCoolingRate, untransformedAusteniteCarbon,
} from './model';
import { EUTECTOID_T, EUTECTOID_X, FERRITE_MAX, steelMicrostructure } from '../phase/systems';

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

  /**
   * One provenance for every transformation temperature the module reports.
   *
   * This replaces five assertions on an `ae3()` helper that has been removed
   * along with the row it fed. The history is worth keeping, because the
   * removal is the second correction to the same number:
   *
   *  - It began as the binary Fe–Fe₃C A₃, which is a function of carbon alone
   *    and so handed 5140 and 4340 the identical 814.63 °C.
   *  - It became Andrews' regression, which is composition-corrected — but the
   *    formula is Andrews' **Ac₃**, an on-heating temperature, and it was
   *    labelled Ae₃; it also under-predicts published Ac₃ for these chromium
   *    steels by 20–30 °C.
   *  - And its partner never moved: `a1` is a hard-coded 727 for all three
   *    grades, so 4340's displayed intercritical window was 5.3 °C against a
   *    published ~38. Correcting `a1` too means feeding an on-heating Ac₁ into
   *    a cooling construction and moving every critical cooling rate, which is
   *    a larger decision than this one.
   *
   * So the module now reports exactly one equilibrium temperature, `a1`, and
   * it is the binary eutectoid the C-curve is anchored on, consistent with the
   * phase-diagram module. This guards that: nothing composition-corrected may
   * be exposed beside it without revisiting the whole set.
   */
  it('exposes no composition-corrected boundary beside the constant A₁', () => {
    for (const s of STEELS) {
      const ttt = buildTtt(s);
      expect(Object.keys(ttt)).not.toContain('a3');
      expect(ttt.a1).toBe(EUTECTOID_T);
    }
    // All three share it, which is what makes it a construction anchor rather
    // than a property of the individual steel.
    expect(new Set(STEELS.map((s) => s.a1)).size).toBe(1);
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

  /**
   * 1080 is the eutectoid *grade*, and its note says it forms no proeutectoid
   * phase — but its nominal 0.79 wt% C sits 0.03 above the eutectoid, so the
   * phase module classifies it as hyper-eutectoid and a real 1080 rejects a
   * trace of proeutectoid **cementite**. This asserts what is true rather than
   * the tidier thing: the *ferrite* fraction is 0 because there is none to
   * form, and the cementite the diagram implies is a known, recorded
   * limitation that this model does not report.
   */
  it('forms no proeutectoid ferrite in 1080, which is hyper-eutectoid at 0.79 wt% C', () => {
    const micro = steelMicrostructure(getSteel('1080').composition.C)!;
    expect(micro.kind).toBe('hypereutectoid');
    expect(micro.proeutectoid).toBe('Fe₃C (cementite)');
    // Small enough that the module's "no proeutectoid phase" note is a fair
    // simplification, and it is recorded as one rather than asserted away.
    expect(micro.proeutectoidFraction).toBeLessThan(0.01);
    expect(equilibriumFerriteFraction(getSteel('1080'))).toBe(0);
    const s = getSteel('1080');
    const ttt = buildTtt(s);
    for (let lg = -2; lg <= 4; lg += 0.02) {
      expect(ferriteOf(predict(s, ttt, AUST, 10 ** lg))).toBe(0);
    }
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

  /**
   * Mass balance, not kinetics: pearlite is eutectoid at 0.76 wt% C, so
   * whatever pearlite a 0.40 wt% C steel forms must be accompanied by
   * proeutectoid ferrite in the lever-rule ratio.
   */
  it('reduces to the lever-rule ratio on a completed transformation', () => {
    for (const id of ['5140', '4340']) {
      const s = getSteel(id);
      const ttt = buildTtt(s);
      const eq = ttt.equilibriumFerrite;
      for (let lg = -2; lg <= 4; lg += 0.02) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        if (!o.complete || o.startTemp === null) continue;
        const f = ferriteOf(o);
        const p = o.fractions
          .filter((x) => x.product === 'coarse pearlite' || x.product === 'fine pearlite')
          .reduce((a, x) => a + x.fraction, 0);
        expect(f).toBeCloseTo(eq, 12);
        expect(p).toBeCloseTo(1 - eq, 12);
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
 * Prose and bar must describe the same structure.
 *
 * `TRACE_FRACTION` filters what the bar draws. When the prose was built from a
 * different number than the bar, a product just above the floor could be split
 * into parts just below it and the prose would quantify something no segment
 * showed. Both are now gated on the same fractions, by `describeParts`.
 *
 * (This block previously asserted that the split applied only to a completed
 * transformation. That rule is withdrawn — it put a 48.78-point step across an
 * infinitesimal rate change and broke carbon conservation; see the
 * ferrite-leads block below. What survives is the prose/bar invariant, which
 * was the part worth keeping.)
 */
describe('prose and bar never disagree', () => {
  const ferriteOf = (o: ReturnType<typeof predict>) =>
    o.fractions.find((f) => f.product === 'proeutectoid ferrite')?.fraction ?? 0;

  it('a partially transformed hypoeutectoid path forms ferrite first', () => {
    for (const id of ['5140', '4340']) {
      const s = getSteel(id);
      const ttt = buildTtt(s);
      let sawPartialFerrite = false;
      for (let lg = -2; lg <= 4; lg += 0.005) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        if (!o.complete && ferriteOf(o) > 0) sawPartialFerrite = true;
      }
      // The withdrawn rule made this impossible; ferrite-leads requires it.
      expect(sawPartialFerrite).toBe(true);
    }
  });

  /**
   * The defining relation of ferrite-leads, asserted directly: pearlite exists
   * only once ferrite has reached its equilibrium fraction, and while ferrite
   * is still short of that there is no pearlite at all.
   */
  it('pearlite appears only after ferrite has saturated', () => {
    for (const id of ['5140', '4340']) {
      const s = getSteel(id);
      const ttt = buildTtt(s);
      const alpha = ttt.equilibriumFerrite;
      for (let lg = -2; lg <= 4; lg += 0.002) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        const pearlite = o.fractions
          .filter((f) => f.product === 'coarse pearlite' || f.product === 'fine pearlite')
          .reduce((a, f) => a + f.fraction, 0);
        if (pearlite > 0) expect(ferriteOf(o)).toBeCloseTo(alpha, 12);
        if (ferriteOf(o) < alpha - 1e-12) expect(pearlite).toBe(0);
      }
    }
  });

  /**
   * Superseded by "every quantified pair in the prose matches a drawn
   * segment" below, which asserts the same invariant per product rather than
   * per phrase and survives the prose being rewritten. Kept as the named
   * regression for the three reviewer detents only.
   */

  /**
   * The three reachable slider detents a reviewer found, where the prose
   * claimed 1% of a product the bar had filtered out entirely.
   */
  it.each([
    ['5140', 33.1131],
    ['4340', 1.9055],
    ['4340', 1.9498],
  ])('%s at %f °C/s draws every product its prose quantifies', (id, rate) => {
    const s = getSteel(id);
    const o = predict(s, buildTtt(s), AUST, rate);
    const quantified = o.summary.match(/roughly (\d+)% ([^,.]+?) embedded/)!;
    expect(quantified).not.toBeNull();
    for (const name of quantified[2].split(' + ').map((x) => x.trim())) {
      const part = o.fractions.find((f) => f.product === name)!;
      expect(part.fraction).toBeGreaterThanOrEqual(TRACE_FRACTION);
    }
  });
});

/**
 * The three invariants the ferrite split has to satisfy.
 *
 * Two earlier attempts each failed one of them and had to be replaced:
 * a proportional split applied at every rate credited ferrite where the
 * model's kinetics forbid it, and restricting the split to the completed
 * branch installed a 48.78-point discontinuity across a 2×10⁻¹⁴ % change in
 * cooling rate, broke carbon conservation (up to 98.3% pearlite in a 0.40 wt%
 * C steel, which needs the remaining austenite to hold −19 wt% C), and made
 * the pearlite fraction non-monotone in rate by 48.7 points.
 *
 * The model asserted here is ferrite-leads: ferrite is the faster reaction and
 * runs ahead of pearlite, so the first `alphaEq` of any diffusional
 * transformation is proeutectoid ferrite and only the remainder is pearlite.
 *
 *     ferrite  = min(f, alphaEq)
 *     pearlite = max(0, f − alphaEq)
 *
 * At f = 1 that reduces to exactly the lever rule already shipped.
 */
describe('ferrite-leads: continuity, monotonicity, carbon balance', () => {
  const HYPO = ['5140', '4340'];
  const fracOf = (o: ReturnType<typeof predict>, p: string) =>
    o.fractions.find((f) => f.product === p)?.fraction ?? 0;
  const ferriteOf = (o: ReturnType<typeof predict>) => fracOf(o, 'proeutectoid ferrite');
  const pearliteOf = (o: ReturnType<typeof predict>) =>
    fracOf(o, 'coarse pearlite') + fracOf(o, 'fine pearlite');

  /** The slowest rate whose transformation does not run to completion. */
  function completionBoundary(id: string): number {
    const s = getSteel(id);
    const ttt = buildTtt(s);
    // `complete` is also true on the fully-martensitic branch, so the search
    // is confined below the critical rate and asks for a *diffusional*
    // transformation that finished.
    const done = (r: number) => {
      const o = predict(s, ttt, AUST, r);
      return o.complete && o.startTemp !== null;
    };
    let lo = 0.001; // finishes
    let hi = criticalCoolingRate(s, ttt, AUST)! * 0.9; // does not
    expect(done(lo)).toBe(true);
    expect(done(hi)).toBe(false);
    for (let i = 0; i < 200; i++) {
      const mid = Math.sqrt(lo * hi);
      if (done(mid)) lo = mid;
      else hi = mid;
    }
    return hi;
  }

  it.each(HYPO)('%s: every product is continuous across the completion boundary', (id) => {
    const s = getSteel(id);
    const ttt = buildTtt(s);
    const edge = completionBoundary(id);
    const below = predict(s, ttt, AUST, edge * (1 - 1e-9));
    const above = predict(s, ttt, AUST, edge * (1 + 1e-9));
    expect(below.complete && below.startTemp !== null).toBe(true);
    expect(above.complete).toBe(false);
    // The regression this replaces jumped 48.78 points here.
    expect(Math.abs(ferriteOf(above) - ferriteOf(below))).toBeLessThan(0.001);
    expect(Math.abs(pearliteOf(above) - pearliteOf(below))).toBeLessThan(0.001);
  });

  /**
   * The two rates a reviewer found, where the completed/partial branch flip
   * used to swap a ferrite + pearlite structure for 100% pearlite at the same
   * start temperature and the same hardness.
   */
  it.each([
    ['5140', 3.038446399],
    ['4340', 0.142246453],
  ])('%s at %f °C/s reads the same either side of the branch flip', (id, rate) => {
    const s = getSteel(id);
    const ttt = buildTtt(s);
    const lo = predict(s, ttt, AUST, rate * (1 - 1e-12));
    const hi = predict(s, ttt, AUST, rate * (1 + 1e-12));
    expect(Math.abs(ferriteOf(hi) - ferriteOf(lo))).toBeLessThan(0.001);
    expect(Math.abs(pearliteOf(hi) - pearliteOf(lo))).toBeLessThan(0.001);
  });

  it.each(HYPO)('%s: ferrite and pearlite are both monotone in cooling rate', (id) => {
    const s = getSteel(id);
    const ttt = buildTtt(s);
    let prevFerrite = 1;
    let prevPearlite = 1;
    for (let lg = -2; lg <= 4; lg += 0.002) {
      const o = predict(s, ttt, AUST, 10 ** lg);
      expect(ferriteOf(o)).toBeLessThanOrEqual(prevFerrite + 1e-9);
      expect(pearliteOf(o)).toBeLessThanOrEqual(prevPearlite + 1e-9);
      prevFerrite = ferriteOf(o);
      prevPearlite = pearliteOf(o);
    }
  });

  /**
   * Carbon conservation. Ferrite holds 0.022 wt% C and pearlite 0.76, both
   * from the phase module. Their combined carbon can never exceed the steel's,
   * and what is left in the austenite can only be richer than the bulk — that
   * is the direction ferrite rejection moves it.
   */
  it.each(HYPO)('%s: carbon balances, and the austenite is enriched not depleted', (id) => {
    const s = getSteel(id);
    const ttt = buildTtt(s);
    const C0 = s.composition.C;
    for (let lg = -2; lg <= 4; lg += 0.002) {
      const o = predict(s, ttt, AUST, 10 ** lg);
      const inFerrite = ferriteOf(o) * FERRITE_MAX;
      const inPearlite = pearliteOf(o) * EUTECTOID_X;
      const consumed = inFerrite + inPearlite;
      const solid = ferriteOf(o) + pearliteOf(o);
      expect(consumed).toBeLessThanOrEqual(C0 + 1e-12);
      if (solid < 1 - 1e-9) {
        const remaining = (C0 - consumed) / (1 - solid);
        expect(remaining).toBeGreaterThanOrEqual(C0 - 1e-9);
        // and never past the eutectoid, which is where ferrite rejection stops
        expect(remaining).toBeLessThanOrEqual(EUTECTOID_X + 1e-9);
      }
    }
  });

  it.each(HYPO)('%s: pearlite never exceeds what the carbon allows', (id) => {
    // A steel at C0 can produce at most C0/0.76 of pearlite by mass.
    const s = getSteel(id);
    const ttt = buildTtt(s);
    const ceiling = s.composition.C / EUTECTOID_X;
    expect(ceiling).toBeCloseTo(0.5263, 4);
    for (let lg = -2; lg <= 4; lg += 0.002) {
      expect(pearliteOf(predict(s, ttt, AUST, 10 ** lg))).toBeLessThanOrEqual(ceiling + 1e-9);
    }
  });

  it('still reduces to the lever rule on a slow cool', () => {
    for (const id of HYPO) {
      const s = getSteel(id);
      const o = predict(s, buildTtt(s), AUST, 0.01);
      expect(ferriteOf(o)).toBeCloseTo(equilibriumFerriteFraction(s), 12);
      expect(pearliteOf(o)).toBeCloseTo(1 - equilibriumFerriteFraction(s), 12);
    }
  });

  it('leaves 1080 with no ferrite at any rate', () => {
    const s = getSteel('1080');
    const ttt = buildTtt(s);
    for (let lg = -2; lg <= 4; lg += 0.002) {
      expect(ferriteOf(predict(s, ttt, AUST, 10 ** lg))).toBe(0);
    }
  });
});

/**
 * The enrichment the UI puts on screen beside Mˢ.
 *
 * Ferrite takes only 0.022 wt% C out of a 0.40 wt% steel, so what it leaves
 * behind is richer — and that is the austenite whose Mˢ actually matters. The
 * first version of this calculation summed martensite's carbon into the
 * consumed total, which made the remaining austenite look *depleted* (0.12
 * against 0.40) and suppressed the caveat entirely.
 */
describe('untransformed austenite carbon', () => {
  it('is the bulk composition when nothing is left', () => {
    for (const id of ['5140', '4340', '1080']) {
      const s = getSteel(id);
      const o = predict(s, buildTtt(s), AUST, 0.01);
      expect(o.complete).toBe(true);
      expect(untransformedAusteniteCarbon(o, s.composition.C)).toBeCloseTo(s.composition.C, 12);
    }
  });

  it('is the bulk composition on a full quench — martensite is the austenite', () => {
    for (const s of STEELS) {
      const o = predict(s, buildTtt(s), AUST, 5000);
      expect(untransformedAusteniteCarbon(o, s.composition.C)).toBeCloseTo(s.composition.C, 12);
    }
  });

  it('reads 0.519 wt% C for 5140 at 10 °C/s — 24% ferrite, 76% austenite', () => {
    const s = getSteel('5140');
    const o = predict(s, buildTtt(s), AUST, 10);
    const ferrite = o.fractions.find((f) => f.product === 'proeutectoid ferrite')!.fraction;
    expect(ferrite).toBeCloseTo(0.2394, 4);
    // (0.40 − 0.2394 × 0.022) / (1 − 0.2394)
    expect(untransformedAusteniteCarbon(o, 0.4)).toBeCloseTo(
      (0.4 - 0.2394 * FERRITE_MAX) / (1 - 0.2394),
      3,
    );
    expect(untransformedAusteniteCarbon(o, 0.4)).toBeCloseTo(0.519, 3);
  });

  /**
   * 1080 is the case that forced the domain guard: hyper-eutectoid, so its
   * pearlite at 0.76 wt% leaves a surplus belonging to cementite the model
   * does not track, and the quotient ran to 6.97 wt% C as the untransformed
   * fraction approached zero.
   */
  it('returns the bulk composition for a steel that rejects no ferrite', () => {
    const s = getSteel('1080');
    const ttt = buildTtt(s);
    for (let lg = -2; lg <= 4; lg += 0.005) {
      expect(untransformedAusteniteCarbon(predict(s, ttt, AUST, 10 ** lg), s.composition.C)).toBe(
        s.composition.C,
      );
    }
  });

  it('is never below the bulk, and never above the eutectoid', () => {
    for (const s of STEELS) {
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.002) {
        const c = untransformedAusteniteCarbon(predict(s, ttt, AUST, 10 ** lg), s.composition.C);
        expect(c).toBeGreaterThanOrEqual(s.composition.C - 1e-9);
        expect(c).toBeLessThanOrEqual(Math.max(EUTECTOID_X, s.composition.C) + 1e-9);
      }
    }
  });
});

/**
 * The matrix has to be drawn too, not just the product.
 *
 * The prose says a product is "embedded in martensite". Where the path very
 * nearly completes, that martensite falls below `TRACE_FRACTION` and the bar
 * does not draw it — so the sentence names a phase that is not on screen. The
 * mirror image of the defect fixed for the product itself, and it was there
 * before the ferrite work started: 1080 at 23.44 °C/s reads "roughly 100%
 * coarse pearlite embedded in martensite" with 0.098% martensite.
 */
describe('the prose names only phases the bar draws', () => {
  it('never says "embedded in martensite" when no martensite is drawn', () => {
    for (const s of STEELS) {
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.002) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        if (!/embedded in martensite/.test(o.summary)) continue;
        const m = o.fractions.find((f) => f.product === 'martensite')?.fraction ?? 0;
        expect(
          m,
          `${s.id} @ ${10 ** lg}: prose says "embedded in martensite", bar draws ${m}`,
        ).toBeGreaterThanOrEqual(TRACE_FRACTION);
      }
    }
  });

  it('1080 at 23.44 °C/s — the witness — no longer claims an undrawn matrix', () => {
    const s = getSteel('1080');
    const o = predict(s, buildTtt(s), AUST, 23.44);
    const m = o.fractions.find((f) => f.product === 'martensite')!.fraction;
    expect(m).toBeLessThan(TRACE_FRACTION);
    expect(o.summary).not.toMatch(/embedded in martensite/);
    // and it still says what did happen
    expect(o.summary).toMatch(/coarse pearlite/);
  });

  it('still says it when there really is martensite to see', () => {
    const s = getSteel('5140');
    const o = predict(s, buildTtt(s), AUST, 10);
    expect(o.fractions.find((f) => f.product === 'martensite')!.fraction).toBeGreaterThan(0.5);
    expect(o.summary).toMatch(/embedded in martensite/);
  });
});

/**
 * Where each diffusional product is allowed to form.
 *
 * `productAt` has been byte-identical to the base commit through this whole
 * series, and it is the actual defect the ferrite work kept circling. Its
 * pearlite/bainite divide is the arithmetic midpoint of the sub-nose range —
 * 395 °C for 5140 and 4340 — so the bainite field measured at 476–480 °C for
 * 4340 (dilatometric CCT, Materials 2020, 13, 5585) was labelled "fine
 * pearlite", and `splitProeutectoid` fires on pearlitic labels, so
 * ferrite-leads then reported the whole of it as proeutectoid ferrite. That is
 * how the model came to claim proeutectoid ferrite forming at 396.5 °C against
 * a measured ferrite start near 700 °C.
 *
 * The fix is a floor on the pearlitic field, not a new invented temperature:
 * in a hypoeutectoid steel the product below the pearlite nose is bainite. The
 * nose is shipped digitised data, it is the lowest temperature at which this
 * model has any evidence of a pearlitic reaction at all, and it errs toward
 * under-reporting ferrite rather than over-reporting it.
 */
describe('the pearlitic field has a floor', () => {
  const ferriteOf = (o: ReturnType<typeof predict>) =>
    o.fractions.find((f) => f.product === 'proeutectoid ferrite')?.fraction ?? 0;

  it.each(['5140', '4340'])('%s reports no ferrite below its pearlite nose', (id) => {
    const s = getSteel(id);
    const ttt = buildTtt(s);
    let lowest = Infinity;
    for (let lg = -2; lg <= 4; lg += 0.001) {
      const o = predict(s, ttt, AUST, 10 ** lg);
      if (ferriteOf(o) > 0 && o.startTemp !== null) lowest = Math.min(lowest, o.startTemp);
    }
    expect(lowest).toBeGreaterThanOrEqual(s.nose.temp);
    // Measured before this change: 403.0 °C for 5140, 396.5 °C for 4340.
    expect(lowest).toBeGreaterThan(400);
  });

  it('gives a hypoeutectoid steel no fine-pearlite field', () => {
    for (const id of ['5140', '4340']) {
      const s = getSteel(id);
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.0005) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        expect(o.fractions.map((f) => f.product)).not.toContain('fine pearlite');
      }
    }
  });

  it('closes the narrow fine-pearlite window a reviewer found in 4340', () => {
    // 1.9877–2.0082 °C/s reported "fine pearlite" starting near 396 °C, which
    // ferrite-leads then rendered as proeutectoid ferrite.
    const s = getSteel('4340');
    const ttt = buildTtt(s);
    for (const rate of [1.9877, 1.99, 2.0, 2.0082]) {
      const o = predict(s, ttt, AUST, rate);
      expect(o.fractions.map((f) => f.product)).not.toContain('fine pearlite');
      expect(ferriteOf(o)).toBe(0);
      expect(o.fractions.map((f) => f.product)).toContain('bainite');
    }
  });

  it('leaves 1080 — the eutectoid grade — classified exactly as before', () => {
    const s = getSteel('1080');
    const ttt = buildTtt(s);
    // coarse ≥ 540, fine ≥ (540+250)/2 = 395, bainite below: the shipped divide.
    const seen = new Set<string>();
    for (let lg = -2; lg <= 4; lg += 0.001) {
      const o = predict(s, ttt, AUST, 10 ** lg);
      for (const f of o.fractions) {
        if (f.fraction > 0) seen.add(f.product);
      }
      if (o.startTemp === null) continue;
      const expected =
        o.startTemp >= 540 ? 'coarse pearlite' : o.startTemp >= 395 ? 'fine pearlite' : 'bainite';
      expect(o.fractions.map((f) => f.product)).toContain(expected);
    }
    // 1080 still reaches all three diffusional products.
    expect(seen).toContain('coarse pearlite');
    expect(seen).toContain('fine pearlite');
    expect(seen).toContain('bainite');
    expect(seen).not.toContain('proeutectoid ferrite');
  });

  /**
   * `productAt` only labels; it never touches the Scheil run that decides
   * whether the nose was missed. The critical rates must therefore be bit-,
   * not merely close-to-, identical.
   */
  it.each([
    ['1080', 233.41044666842697],
    ['5140', 36.46135678530757],
    ['4340', 2.133696798237151],
  ])('%s: critical cooling rate is bit-identical', (id, expected) => {
    const s = getSteel(id);
    expect(criticalCoolingRate(s, buildTtt(s), AUST)).toBe(expected);
  });
});

/**
 * Every number in the prose must be a number on the bar.
 *
 * Two failures of that rule survived into this series' own fix for it.
 * `describeParts` joined the product names with " + " and printed their
 * **sum**, so 5140 at 4 °C/s read "roughly 74% proeutectoid ferrite + coarse
 * pearlite" beside segments of 49% and 25% — a figure matching neither. And
 * the trace branch interpolated `productAt`'s label rather than the split, so
 * it could name a product the split had replaced.
 */
describe('the prose quantifies each segment separately', () => {
  /** The vocabulary the prose is allowed to name, so the match cannot run on. */
  const PRODUCT_NAMES =
    'proeutectoid ferrite|coarse pearlite|fine pearlite|bainite|martensite';

  const shownOf = (o: ReturnType<typeof predict>) =>
    o.fractions.filter((f) => f.fraction >= TRACE_FRACTION);

  it('5140 at 4 °C/s gives each product its own percentage', () => {
    const s = getSteel('5140');
    const o = predict(s, buildTtt(s), AUST, 4);
    const parts = shownOf(o).filter((f) => f.product !== 'martensite');
    expect(parts.length).toBeGreaterThan(1);
    // The old text printed one summed figure against a compound noun.
    expect(o.summary).not.toMatch(/% proeutectoid ferrite \+ /);
    for (const p of parts) {
      expect(o.summary).toContain(`${Math.round(p.fraction * 100)}% ${p.product}`);
    }
  });

  /**
   * The general rule, over every reachable detent: any "N% <product>" pair the
   * prose prints must match a segment the bar draws, to the percent.
   */
  it('every quantified pair in the prose matches a drawn segment', () => {
    for (const s of STEELS) {
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.001) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        const pairs = [...o.summary.matchAll(new RegExp(`(\\d+)% (${PRODUCT_NAMES})`, 'g'))];
        for (const [, pct, name] of pairs) {
          const seg = o.fractions.find((f) => f.product === name);
          expect(seg, `${s.id} @ ${10 ** lg}: prose names "${name}"`).toBeDefined();
          expect(seg!.fraction).toBeGreaterThanOrEqual(TRACE_FRACTION);
          expect(Math.round(seg!.fraction * 100)).toBe(Number(pct));
        }
      }
    }
  });

  it('the trace branch names the split, not the raw product label', () => {
    for (const s of STEELS) {
      const ttt = buildTtt(s);
      for (let lg = -2; lg <= 4; lg += 0.001) {
        const o = predict(s, ttt, AUST, 10 ** lg);
        const trace = o.summary.match(new RegExp(`a trace of (${PRODUCT_NAMES}) forms`));
        if (!trace) continue;
        // Whatever it names must be a product the model actually produced.
        expect(
          o.fractions.some((f) => f.product === trace[1]),
          `${s.id} @ ${10 ** lg}: prose traces "${trace[1]}", fractions are ${o.fractions
            .map((f) => f.product)
            .join('/')}`,
        ).toBe(true);
      }
    }
  });
});
