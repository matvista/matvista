import { describe, expect, it } from 'vitest';
import { GROWTH_CLASSES } from './materials';
import {
  DKTH_RANGE,
  crackLife,
  criticalCrackSize,
  deltaK,
  growthRate,
  parisLife,
  thresholdCrackSize,
} from './model';

const g = GROWTH_CLASSES[0];
const Y = 1.1;

describe('ΔK and the threshold crack size', () => {
  it('inverts itself: the threshold size is where ΔK equals the threshold', () => {
    for (const dKth of [2, 5, 9]) {
      for (const dSigma of [50, 120, 300]) {
        const a = thresholdCrackSize(dKth, dSigma, Y)!;
        expect(deltaK(dSigma, a, Y)).toBeCloseTo(dKth, 9);
      }
    }
  });

  it('rises with crack length, which is why the start governs', () => {
    expect(deltaK(100, 0.002, Y)).toBeLessThan(deltaK(100, 0.02, Y));
  });

  it('refuses a threshold size for a load that cannot produce one', () => {
    expect(thresholdCrackSize(5, 0, Y)).toBeNull();
    expect(thresholdCrackSize(0, 100, Y)).toBeNull();
  });
});

describe('the life integration now refuses below threshold', () => {
  /**
   * The defect this closes: `parisLife` returns a confident finite life for a
   * crack that never advances. ΔK rises with a, so a starting crack below
   * threshold means the entire history is below it.
   */
  it('returns no life for a crack that would never propagate', () => {
    const dKth = 6;
    const a0 = thresholdCrackSize(dKth, 100, Y)! * 0.5;
    const af = criticalCrackSize(g.kic, 100, Y);
    const guarded = crackLife(g.C, g.m, a0, af, 100, Y, dKth);
    expect(guarded.refusal).toBe('below threshold');
    expect(guarded.cycles).toBeNull();
    // And the unguarded function is happy to answer, which is the point.
    expect(parisLife(g.C, g.m, a0, af, 100, Y)).toBeGreaterThan(0);
  });

  it('allows it once the starting crack is above threshold', () => {
    const dKth = 6;
    const a0 = thresholdCrackSize(dKth, 100, Y)! * 1.5;
    const af = criticalCrackSize(g.kic, 100, Y);
    const r = crackLife(g.C, g.m, a0, af, 100, Y, dKth);
    expect(r.refusal).toBeNull();
    expect(r.cycles).toBeCloseTo(parisLife(g.C, g.m, a0, af, 100, Y)!, 6);
  });

  it('is exactly at the boundary, not near it', () => {
    const dKth = 6;
    const a = thresholdCrackSize(dKth, 100, Y)!;
    const af = criticalCrackSize(g.kic, 100, Y);
    expect(crackLife(g.C, g.m, a * (1 + 1e-9), af, 100, Y, dKth).refusal).toBeNull();
    expect(crackLife(g.C, g.m, a * (1 - 1e-9), af, 100, Y, dKth).refusal).toBe('below threshold');
  });

  it('refuses an empty interval separately from a dormant crack', () => {
    expect(crackLife(g.C, g.m, 0.01, 0.001, 100, Y, 1).refusal).toBe('no interval');
    expect(crackLife(g.C, g.m, 0.001, 0.01, 0, Y, 1).refusal).toBe('no interval');
  });
});

describe('m is a slope on a log–log plot', () => {
  /**
   * The physical point the a-vs-N curve alone cannot make: life goes as
   * Δσ^(−m), so halving the stress range multiplies life by 2^m. For m = 3
   * that is eight times, which students otherwise take on faith.
   */
  it.each(GROWTH_CLASSES.map((c) => c.id))('%s: halving Δσ multiplies life by 2^m', (id) => {
    const c = GROWTH_CLASSES.find((x) => x.id === id)!;
    const a0 = 0.001;
    const af = 0.01;
    const full = parisLife(c.C, c.m, a0, af, 200, Y)!;
    const half = parisLife(c.C, c.m, a0, af, 100, Y)!;
    expect(half / full).toBeCloseTo(2 ** c.m, 6);
  });

  /** And the rate itself is a straight line of slope m in log–log. */
  it.each(GROWTH_CLASSES.map((c) => c.id))('%s: da/dN has log–log slope m', (id) => {
    const c = GROWTH_CLASSES.find((x) => x.id === id)!;
    const r1 = growthRate(c.C, c.m, 0.001, 100, Y);
    const r2 = growthRate(c.C, c.m, 0.004, 100, Y);
    // a ×4 ⇒ ΔK ×2, so the rate should rise by 2^m.
    expect(r2 / r1).toBeCloseTo(2 ** c.m, 6);
  });
});

describe('the threshold is offered as a range, not a table', () => {
  it('brackets the values steels are quoted at', () => {
    expect(DKTH_RANGE.min).toBeLessThan(DKTH_RANGE.typical);
    expect(DKTH_RANGE.typical).toBeLessThan(DKTH_RANGE.max);
    expect(DKTH_RANGE.min).toBeGreaterThan(0);
  });

  /** Region II has to exist somewhere in that range, or the panel is empty. */
  it.each(GROWTH_CLASSES.map((c) => c.id))('%s: leaves a Paris window below K_IC', (id) => {
    const c = GROWTH_CLASSES.find((x) => x.id === id)!;
    expect(DKTH_RANGE.typical).toBeLessThan(c.kic);
    expect(DKTH_RANGE.max).toBeLessThan(c.kic);
  });
});
