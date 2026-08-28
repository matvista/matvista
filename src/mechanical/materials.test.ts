import { describe, expect, it } from 'vitest';
import {
  MECH_MATERIALS, YIELD_OFFSET, buildCurve, hallPetch, percentColdWork,
  trueStrain, trueStress,
} from './materials';

describe('the constructed curve honours its published anchors', () => {
  it.each(MECH_MATERIALS.map((m) => m.id))('%s', (id) => {
    const m = MECH_MATERIALS.find((x) => x.id === id)!;
    // Fine sampling: the default 240 points are too coarse to read the offset
    // stress off a steep hardening branch without the test itself lying.
    const c = buildCurve(m, 200000);
    const E_MPa = m.E * 1000;

    // The 0.2% offset construction must land on the published yield strength —
    // that is the definition of the number in the table.
    const offsetStrain = YIELD_OFFSET + m.yield / E_MPa;
    const atOffset = c.points.reduce((best, p) =>
      Math.abs(p.strain - offsetStrain) < Math.abs(best.strain - offsetStrain) ? p : best);
    expect(atOffset.stress / m.yield).toBeCloseTo(1, 2);

    // Peak is UTS; the curve ends at the published elongation.
    const peak = c.points.reduce((a, b) => (b.stress > a.stress ? b : a));
    expect(peak.stress / m.uts).toBeCloseTo(1, 2);
    expect(c.fractureStrain).toBeCloseTo(m.elongation / 100, 9);

    // Slope inside the elastic region is E.
    const propStrain = (0.85 * m.yield) / E_MPa;
    const inElastic = c.points.find((p) => p.strain > 0 && p.strain < propStrain * 0.5)!;
    expect(inElastic.stress / inElastic.strain / E_MPa).toBeCloseTo(1, 2);

    // Resilience is σy²/2E (Callister eq. 6.14).
    expect(c.resilience).toBeCloseTo((m.yield ** 2) / (2 * E_MPa), 6);
    expect(c.toughness).toBeGreaterThan(0);
    expect(Number.isFinite(c.toughness)).toBe(true);
  });
});

describe('true stress and strain', () => {
  it('exceeds and undercuts the engineering values respectively', () => {
    expect(trueStress(300, 0.1)).toBeCloseTo(330, 9);
    expect(trueStrain(0.1)).toBeCloseTo(Math.log(1.1), 12);
    expect(trueStrain(0.1)).toBeLessThan(0.1);
  });
});

describe('Hall–Petch', () => {
  it('is linear in d^(−1/2)', () => {
    expect((hallPetch(0.01, 70, 23.4) - 70) / (hallPetch(0.04, 70, 23.4) - 70)).toBeCloseTo(2, 9);
  });
  it('makes finer grains stronger', () => {
    expect(hallPetch(0.005, 70, 23.4)).toBeGreaterThan(hallPetch(0.05, 70, 23.4));
  });
});

describe('cold work', () => {
  it('follows Callister eq. 7.8', () => {
    expect(percentColdWork(100, 75)).toBeCloseTo(25, 9);
  });
});
