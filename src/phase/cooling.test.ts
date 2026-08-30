import { describe, expect, it } from 'vitest';
import {
  CU_NI,
  EUTECTOID_T,
  FE_C,
  PB_SN,
  PHASE_SYSTEMS,
  boundaryTemperature,
  coolingSequence,
} from './systems';

const regions = (stages: { region: string }[]) => stages.map((s) => s.region);

describe('the path an alloy takes down the diagram', () => {
  it('Cu–Ni 35%: liquid, then α + L, then all α', () => {
    const s = coolingSequence(CU_NI, 35, 1350, 1100);
    expect(regions(s)).toEqual(['L', 'α + L', 'α']);
  });

  it('Pb–Sn 40%: primary α forms before the eutectic', () => {
    const s = coolingSequence(PB_SN, 40, 300, 100);
    expect(regions(s)).toEqual(['L', 'α + L', 'α + β']);
    expect(s[2].T).toBeCloseTo(183, 1);
  });

  /**
   * The eutectic composition goes straight from liquid to α + β with no
   * primary α at all. Same two phases as the 40% alloy, different
   * microstructure, and only one of them is solder — which is the whole point
   * of separating fractions from structure.
   */
  it('Pb–Sn 61.9%: no primary α — straight to the eutectic', () => {
    const s = coolingSequence(PB_SN, 61.9, 300, 100);
    expect(regions(s)).toEqual(['L', 'α + β']);
    expect(s[1].T).toBeCloseTo(183, 1);
  });

  it('gives both Pb–Sn alloys the same phases and different amounts', () => {
    const a = coolingSequence(PB_SN, 40, 300, 100).at(-1)!.point;
    const b = coolingSequence(PB_SN, 61.9, 300, 100).at(-1)!.point;
    expect(a.phases.map((p) => p.name)).toEqual(b.phases.map((p) => p.name));
    const fa = a.phases.find((p) => p.name === 'α')!.fraction;
    const fb = b.phases.find((p) => p.name === 'α')!.fraction;
    expect(Math.abs(fa - fb)).toBeGreaterThan(0.1);
  });

  it('Fe–C 0.4%: austenite, proeutectoid ferrite, then pearlite at the eutectoid', () => {
    const s = coolingSequence(FE_C, 0.4, 1000, 600);
    expect(regions(s)).toEqual(['γ', 'α + γ', 'α + Fe₃C']);
    expect(s[2].T).toBeCloseTo(EUTECTOID_T, 1);
  });

  /**
   * The crossing temperatures are found by bisecting `evaluate`, while
   * `boundaryTemperature` reads the boundary polylines. Two independent routes
   * to the same number, so they must agree.
   */
  it.each([
    ['A₃', 0.4],
    ['A₃', 0.2],
  ])('Fe–C %s at %s wt%% agrees with the boundary polyline', (label, x) => {
    const s = coolingSequence(FE_C, x as number, 1100, 600);
    const crossing = s.find((st) => st.region === 'α + γ')!;
    expect(crossing.T).toBeCloseTo(boundaryTemperature(FE_C, label as string, x as number)!, 1);
  });

  it('lands the eutectic and eutectoid on their invariant temperatures', () => {
    expect(coolingSequence(PB_SN, 40, 300, 100).at(-1)!.T).toBeCloseTo(183, 2);
    expect(coolingSequence(FE_C, 0.4, 1000, 600).at(-1)!.T).toBeCloseTo(727, 2);
  });
});

describe('the sequence is well formed for every system', () => {
  it.each(PHASE_SYSTEMS.map((s) => s.id))('%s: temperatures fall and regions change', (id) => {
    const sys = PHASE_SYSTEMS.find((s) => s.id === id)!;
    for (const frac of [0.15, 0.3, 0.5, 0.7, 0.9]) {
      const x = sys.xMin + (sys.xMax - sys.xMin) * frac;
      const stages = coolingSequence(sys, x, sys.tMax, sys.tMin);
      expect(stages.length).toBeGreaterThan(0);
      for (let i = 1; i < stages.length; i++) {
        expect(stages[i].T, `${id} x=${x}`).toBeLessThan(stages[i - 1].T);
        expect(stages[i].region).not.toBe(stages[i - 1].region);
      }
      // Every stage's point really is in the region it claims.
      for (const st of stages) expect(st.point.region).toBe(st.region);
    }
  });

  it('starts at the temperature it was asked to start at', () => {
    expect(coolingSequence(PB_SN, 40, 250, 100)[0].T).toBe(250);
  });

  it('clamps to the modelled window rather than walking outside it', () => {
    const s = coolingSequence(PB_SN, 40, 10_000, -500);
    expect(s[0].T).toBeLessThanOrEqual(PB_SN.tMax);
    expect(s.at(-1)!.T).toBeGreaterThanOrEqual(PB_SN.tMin);
  });

  it('returns nothing when there is no interval to walk', () => {
    expect(coolingSequence(PB_SN, 40, 100, 300)).toEqual([]);
    expect(coolingSequence(PB_SN, 40, 200, 200)).toEqual([]);
  });
});
