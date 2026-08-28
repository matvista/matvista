import { describe, expect, it } from 'vitest';
import { STEELS, getSteel, martensiteStart, martensiteFractionTemp } from './steels';
import {
  TRACE_FRACTION, buildTtt, criticalCoolingRate, predict, tangentCoolingRate,
} from './model';

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
