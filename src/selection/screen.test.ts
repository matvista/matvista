import { describe, expect, it } from 'vitest';
import {
  INDICES,
  SELECTION_MATERIALS,
  indexValue,
  paretoFront,
  passesLimits,
  screen,
  screenStages,
  type AttributeLimits,
  type PerformanceIndex,
  type SelectionMaterial,
} from './materials';

const all = SELECTION_MATERIALS;

describe('screening against hard limits', () => {
  /**
   * The survivor set has to equal a brute-force filter written independently
   * of the implementation, over a sweep of limits rather than a chosen few.
   */
  it('matches a brute-force filter across a sweep', () => {
    for (const d of [0.5, 1.5, 3, 8, 25]) {
      for (const e of [0, 10, 70, 200, 500]) {
        for (const s of [0, 100, 400, 1500, 5000]) {
          const limits: AttributeLimits = { densityMax: d, modulusMin: e, strengthMin: s };
          const brute = all.filter((m) => m.density <= d && m.modulus >= e && m.strength >= s);
          expect(screen(all, limits).map((m) => m.name)).toEqual(brute.map((m) => m.name));
        }
      }
    }
  });

  it('keeps everything when no limit is set', () => {
    expect(screen(all, {})).toHaveLength(all.length);
  });

  /**
   * A limit outside the data's range must be all-or-nothing. A partial result
   * there would mean a comparison is running the wrong way round.
   */
  it('is total or empty for a limit outside the data', () => {
    const maxDensity = Math.max(...all.map((m) => m.density));
    const minDensity = Math.min(...all.map((m) => m.density));
    expect(screen(all, { densityMax: maxDensity })).toHaveLength(all.length);
    expect(screen(all, { densityMax: minDensity / 2 })).toHaveLength(0);

    const maxE = Math.max(...all.map((m) => m.modulus));
    expect(screen(all, { modulusMin: 0 })).toHaveLength(all.length);
    expect(screen(all, { modulusMin: maxE * 2 })).toHaveLength(0);
  });

  /** The boundary is inclusive: a material exactly on the limit passes. */
  it('admits a material sitting exactly on the limit', () => {
    const m = all[0];
    expect(passesLimits(m, { densityMax: m.density })).toBe(true);
    expect(passesLimits(m, { modulusMin: m.modulus })).toBe(true);
    expect(passesLimits(m, { strengthMin: m.strength })).toBe(true);
    expect(passesLimits(m, { densityMax: m.density - 1e-9 })).toBe(false);
  });
});

describe('the funnel', () => {
  it('never grows, and ends where a single screen would', () => {
    const limits: AttributeLimits = { densityMax: 3, modulusMin: 50, strengthMin: 200 };
    const stages = screenStages(all, limits);
    expect(stages[0].survivors).toHaveLength(all.length);
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].survivors.length).toBeLessThanOrEqual(stages[i - 1].survivors.length);
    }
    expect(stages[stages.length - 1].survivors.map((m) => m.name)).toEqual(
      screen(all, limits).map((m) => m.name),
    );
  });

  it('lists one stage per limit set, plus the starting set', () => {
    expect(screenStages(all, {})).toHaveLength(1);
    expect(screenStages(all, { densityMax: 3 })).toHaveLength(2);
    expect(screenStages(all, { densityMax: 3, strengthMin: 100 })).toHaveLength(3);
  });

  /**
   * The worked funnel the plan names: 54 materials, then those under
   * 3 Mg/m³. Asserted as a real count so the panel cannot quote a number the
   * data does not support.
   */
  it('reproduces the light-materials screen on the shipped data', () => {
    expect(all).toHaveLength(54);
    const light = screen(all, { densityMax: 3 });
    expect(light.length).toBeGreaterThan(0);
    expect(light.length).toBeLessThan(all.length);
    expect(light.every((m) => m.density <= 3)).toBe(true);
  });
});

describe('ranking on two objectives', () => {
  const a = INDICES[0];
  const b = INDICES[1];

  /** Nothing on the front is beaten on both counts by anything at all. */
  it('admits no dominated material', () => {
    const front = paretoFront(all, a, b);
    expect(front.length).toBeGreaterThan(0);
    for (const m of front) {
      const ma = indexValue(m, a);
      const mb = indexValue(m, b);
      const dominated = all.some(
        (o) =>
          o !== m &&
          indexValue(o, a) >= ma &&
          indexValue(o, b) >= mb &&
          (indexValue(o, a) > ma || indexValue(o, b) > mb),
      );
      expect(dominated, m.name).toBe(false);
    }
  });

  /** And everything left out is beaten by something on it. */
  it('leaves out only materials something on the front beats', () => {
    const front = paretoFront(all, a, b);
    for (const m of all.filter((x) => !front.includes(x))) {
      const ma = indexValue(m, a);
      const mb = indexValue(m, b);
      expect(
        front.some((f) => indexValue(f, a) >= ma && indexValue(f, b) >= mb),
        m.name,
      ).toBe(true);
    }
  });

  /** The best material on either index alone is always on the front. */
  it('contains the winner on each index', () => {
    const front = paretoFront(all, a, b);
    for (const idx of [a, b]) {
      const best = [...all].sort((x, y) => indexValue(y, idx) - indexValue(x, idx))[0];
      expect(front.map((m) => m.name)).toContain(best.name);
    }
  });

  it('is smaller than the full set — otherwise it is ranking nothing', () => {
    expect(paretoFront(all, a, b).length).toBeLessThan(all.length);
  });
});

describe('the Pareto front on a case built to expose it', () => {
  /**
   * The shipped set cannot tell a correct dominance test from two broken ones:
   * its two default indices are both modulus-based, so they are strongly
   * correlated and one material happens to win on both. With that shape, a
   * dominance rule of "strictly better on both" and one of "better on either"
   * each leave the assertions above green.
   *
   * These four materials are constructed so the front is known by hand, and so
   * that weak dominance — equal on one index, better on the other — actually
   * occurs. That is the case the correct rule and the "strictly better on
   * both" rule disagree about.
   */
  const E: PerformanceIndex = {
    id: 'e', label: 'E/ρ', property: 'modulus', exponent: 1, slope: 1,
    scenario: '', derivation: INDICES[0].derivation,
  };
  const S: PerformanceIndex = {
    id: 's', label: 'σ/ρ', property: 'strength', exponent: 1, slope: 1,
    scenario: '', derivation: INDICES[0].derivation,
  };

  // With ρ = 1 for all four, the indices are just modulus and strength.
  const stiff: SelectionMaterial = { name: 'stiff', cls: 'metal', density: 1, modulus: 100, strength: 10 };
  const strong: SelectionMaterial = { name: 'strong', cls: 'metal', density: 1, modulus: 10, strength: 100 };
  const middling: SelectionMaterial = { name: 'middling', cls: 'metal', density: 1, modulus: 50, strength: 50 };
  // Equal to `middling` on E and worse on σ: weakly dominated, so off the front.
  const tiedButWorse: SelectionMaterial = { name: 'tied', cls: 'metal', density: 1, modulus: 50, strength: 20 };
  const set = [stiff, strong, middling, tiedButWorse];

  it('keeps the three that trade off and drops the weakly dominated one', () => {
    expect(paretoFront(set, E, S).map((m) => m.name).sort()).toEqual([
      'middling',
      'stiff',
      'strong',
    ]);
  });

  it('drops a material beaten outright', () => {
    const worst: SelectionMaterial = { name: 'worst', cls: 'metal', density: 1, modulus: 1, strength: 1 };
    expect(paretoFront([...set, worst], E, S).map((m) => m.name)).not.toContain('worst');
  });

  /** Two identical materials dominate nothing, so both stay. */
  it('keeps exact duplicates, which cannot dominate each other', () => {
    const twin: SelectionMaterial = { ...middling, name: 'twin' };
    const front = paretoFront([stiff, strong, middling, twin], E, S).map((m) => m.name);
    expect(front).toContain('middling');
    expect(front).toContain('twin');
  });
});
