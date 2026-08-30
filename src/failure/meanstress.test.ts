import { describe, expect, it } from 'vitest';
import {
  MEAN_STRESS_CRITERIA,
  allowableAmplitude,
  factorOfSafety,
  fromStressRatio,
  type MeanStressCriterion,
} from './model';

const Se = 250;
const Su = 800;
const Sy = 600;
const lines = MEAN_STRESS_CRITERIA.filter((c) => c !== 'yield');

describe('the endpoints are exact', () => {
  /** At zero mean stress every fatigue criterion must return the endurance limit. */
  it.each(lines)('%s: returns S_e at σ_m = 0', (c) => {
    expect(allowableAmplitude(c, 0, Se, Su, Sy)).toBeCloseTo(Se, 12);
  });

  it('goodman and gerber reach zero at the tensile strength', () => {
    expect(allowableAmplitude('goodman', Su, Se, Su, Sy)).toBeCloseTo(0, 12);
    expect(allowableAmplitude('gerber', Su, Se, Su, Sy)).toBeCloseTo(0, 12);
  });

  it('soderberg reaches zero at the yield strength, not the tensile', () => {
    expect(allowableAmplitude('soderberg', Sy, Se, Su, Sy)).toBeCloseTo(0, 12);
    expect(allowableAmplitude('goodman', Sy, Se, Su, Sy)).toBeGreaterThan(0);
  });

  it('the yield line runs from S_y to zero', () => {
    expect(allowableAmplitude('yield', 0, Se, Su, Sy)).toBeCloseTo(Math.min(Se, Sy), 12);
    expect(allowableAmplitude('yield', Sy, Se, Su, Sy)).toBeCloseTo(0, 12);
  });
});

describe('the criteria order the way the design texts say', () => {
  /**
   * Soderberg is the conservative one because it runs to S_y, Goodman to S_u,
   * and Gerber bulges above Goodman as a parabola through the same endpoints.
   * That ordering is the reason two criteria can disagree about one part.
   */
  it.each([50, 150, 300, 450])('at σ_m = %s: soderberg ≤ goodman ≤ gerber', (sm) => {
    const sod = allowableAmplitude('soderberg', sm, Se, Su, Sy);
    const good = allowableAmplitude('goodman', sm, Se, Su, Sy);
    const ger = allowableAmplitude('gerber', sm, Se, Su, Sy);
    expect(sod).toBeLessThanOrEqual(good + 1e-12);
    expect(good).toBeLessThanOrEqual(ger + 1e-12);
  });

  it('has them strictly apart somewhere, so the ordering is not a tie', () => {
    const sm = 300;
    expect(allowableAmplitude('gerber', sm, Se, Su, Sy)).toBeGreaterThan(
      allowableAmplitude('goodman', sm, Se, Su, Sy) + 1,
    );
    expect(allowableAmplitude('goodman', sm, Se, Su, Sy)).toBeGreaterThan(
      allowableAmplitude('soderberg', sm, Se, Su, Sy) + 1,
    );
  });

  /**
   * The point of Soderberg: it guards against yield and Goodman does not, so
   * they can disagree about whether a part is safe. Here is a mean stress
   * where Goodman passes and the yield line does not.
   */
  it('finds a load Goodman calls safe and yielding does not', () => {
    const sm = 560;
    const sa = allowableAmplitude('goodman', sm, Se, Su, Sy) * 0.95;
    expect(factorOfSafety('goodman', sm, sa, Se, Su, Sy)!).toBeGreaterThan(1);
    expect(factorOfSafety('yield', sm, sa, Se, Su, Sy)!).toBeLessThan(1);
  });

  it('a tensile mean stress always costs capacity', () => {
    for (const c of lines) {
      let prev = allowableAmplitude(c, 0, Se, Su, Sy);
      for (const sm of [50, 100, 200, 400, 600]) {
        const v = allowableAmplitude(c, sm, Se, Su, Sy);
        expect(v).toBeLessThanOrEqual(prev + 1e-12);
        prev = v;
      }
    }
  });

  it('treats compression as costing none', () => {
    for (const c of lines) {
      expect(allowableAmplitude(c, -200, Se, Su, Sy)).toBeCloseTo(Se, 12);
    }
  });
});

describe('the factor of safety agrees with the line it is measured against', () => {
  /**
   * A point sitting exactly on a criterion's line must return n = 1 for that
   * criterion. This is the check that ties the two functions together — they
   * are separate derivations of the same curve, and Gerber's is a quadratic
   * solve rather than a rearrangement.
   */
  it.each([
    ['goodman', 100],
    ['goodman', 400],
    ['gerber', 100],
    ['gerber', 400],
    ['gerber', 700],
    ['soderberg', 100],
    ['soderberg', 400],
    ['yield', 300],
  ])('%s at σ_m = %s: on the line means n = 1', (c, sm) => {
    const crit = c as MeanStressCriterion;
    const sa = allowableAmplitude(crit, sm as number, Se, Su, Sy);
    expect(factorOfSafety(crit, sm as number, sa, Se, Su, Sy)!).toBeCloseTo(1, 9);
  });

  it('is above one inside the line and below it outside', () => {
    for (const c of MEAN_STRESS_CRITERIA) {
      const sm = 200;
      const sa = allowableAmplitude(c, sm, Se, Su, Sy);
      expect(factorOfSafety(c, sm, sa * 0.5, Se, Su, Sy)!).toBeGreaterThan(1);
      expect(factorOfSafety(c, sm, sa * 2, Se, Su, Sy)!).toBeLessThan(1);
    }
  });

  it('returns nothing at the origin, where any factor satisfies every line', () => {
    for (const c of MEAN_STRESS_CRITERIA) {
      expect(factorOfSafety(c, 0, 0, Se, Su, Sy)).toBeNull();
    }
  });
});

describe('the stress ratio', () => {
  it('makes R = −1 fully reversed and R = 0 zero-to-tension', () => {
    expect(fromStressRatio(-1, 400)).toEqual({ m: 0, a: 400 });
    expect(fromStressRatio(0, 400)).toEqual({ m: 200, a: 200 });
  });

  it('reproduces the ratio it was given', () => {
    for (const R of [-1, -0.5, 0, 0.3, 0.8]) {
      const { m, a } = fromStressRatio(R, 500);
      const max = m + a;
      const min = m - a;
      expect(min / max).toBeCloseTo(R, 12);
      expect(max).toBeCloseTo(500, 12);
    }
  });

  /** R → 1 is a static load: the ripple vanishes and the mean carries it all. */
  it('collapses the amplitude as R approaches one', () => {
    expect(fromStressRatio(0.99, 500).a).toBeLessThan(5);
    expect(fromStressRatio(0.99, 500).m).toBeCloseTo(497.5, 6);
  });
});
