import { describe, expect, it } from 'vitest';
import {
  CU_NI, PHASE_SYSTEMS, gibbsPhaseRule, lever, steelMicrostructure,
} from './systems';

describe('Fe–C microstructure (Callister ex. 9.4: 0.35 wt% C)', () => {
  const s = steelMicrostructure(0.35)!;
  it('is hypoeutectoid', () => expect(s.kind).toBe('hypoeutectoid'));
  it('gives 44% pearlite', () => expect(s.pearlite).toBeCloseTo(0.44, 2));
  it('gives 56% proeutectoid ferrite', () => expect(s.proeutectoidFraction).toBeCloseTo(0.56, 2));
  it('gives 95.1% total ferrite', () => expect(s.totalFerrite).toBeCloseTo(0.951, 3));
  it('gives 4.9% total cementite', () => expect(s.totalCementite).toBeCloseTo(0.049, 3));
});

describe('Fe–C classification', () => {
  it('calls 0.76 wt% eutectoid and fully pearlitic', () => {
    const s = steelMicrostructure(0.76)!;
    expect(s.kind).toBe('eutectoid');
    expect(s.pearlite).toBeCloseTo(1, 9);
  });
  it('calls 1.2 wt% hypereutectoid with proeutectoid cementite', () => {
    const s = steelMicrostructure(1.2)!;
    expect(s.kind).toBe('hypereutectoid');
    expect(s.proeutectoid).toContain('Fe₃C');
  });
  it('keeps every fraction in range and summing to one', () => {
    for (let c = 0.03; c < 2.1; c += 0.01) {
      const r = steelMicrostructure(c);
      if (!r) continue;
      expect(r.pearlite + r.proeutectoidFraction).toBeCloseTo(1, 9);
      expect(r.totalFerrite + r.totalCementite).toBeCloseTo(1, 9);
      for (const v of [r.pearlite, r.proeutectoidFraction, r.totalFerrite, r.totalCementite]) {
        expect(v).toBeGreaterThanOrEqual(-1e-9);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe('Cu–Ni lever rule (Callister: 35 wt% Ni at 1250 °C)', () => {
  const p = CU_NI.evaluate(35, 1250);
  it('is two-phase', () => expect(p.phases).toHaveLength(2));
  it('puts α at 42.5 and L at 31.5 wt% Ni', () => {
    expect(p.phases.find((x) => x.name === 'α')!.composition).toBeCloseTo(42.5, 0);
    expect(p.phases.find((x) => x.name === 'L')!.composition).toBeCloseTo(31.5, 0);
  });
  it('gives 32% α and 68% liquid', () => {
    expect(p.phases.find((x) => x.name === 'α')!.fraction).toBeCloseTo(0.32, 1);
    expect(p.phases.find((x) => x.name === 'L')!.fraction).toBeCloseTo(0.68, 1);
  });
  it('matches the lever rule directly', () => {
    expect(lever(35, 31.5, 42.5)).toBeCloseTo(0.6818, 3);
  });
});

/**
 * The invariant that caught the missing single-phase α field: a two-phase point
 * must have its overall composition between the ends of its own tie line. The
 * lever-rule fractions are clamped to [0,1], so an out-of-domain reading looks
 * entirely plausible without this check.
 */
describe('every phase point is internally consistent', () => {
  it.each(PHASE_SYSTEMS.map((s) => s.id))('%s', (id) => {
    const sys = PHASE_SYSTEMS.find((s) => s.id === id)!;
    for (let i = 0; i <= 40; i++) {
      for (let j = 0; j <= 40; j++) {
        const x = sys.xMin + ((sys.xMax - sys.xMin) * i) / 40;
        const T = sys.tMin + ((sys.tMax - sys.tMin) * j) / 40;
        const r = sys.evaluate(x, T);
        expect(r.phases.reduce((a, p) => a + p.fraction, 0)).toBeCloseTo(1, 6);
        for (const p of r.phases) {
          expect(p.fraction).toBeGreaterThanOrEqual(-1e-9);
          expect(p.fraction).toBeLessThanOrEqual(1 + 1e-9);
        }
        if (r.tieLine && r.phases.length === 2) {
          const lo = Math.min(r.tieLine.x1, r.tieLine.x2);
          const hi = Math.max(r.tieLine.x1, r.tieLine.x2);
          expect(x).toBeGreaterThanOrEqual(lo - 1e-6);
          expect(x).toBeLessThanOrEqual(hi + 1e-6);
        }
      }
    }
  });
});

describe('the single-phase α field between the eutectoid and A₃', () => {
  const feC = PHASE_SYSTEMS.find((s) => s.id === 'fe-c')!;
  it('makes pure iron single-phase α at 800 °C, not a mixture', () => {
    const r = feC.evaluate(0, 800);
    expect(r.region).toBe('α');
    expect(r.phases).toHaveLength(1);
  });
  it('makes pure iron austenite above 912 °C', () => {
    expect(feC.evaluate(0, 1000).region).toBe('γ');
  });
  it('still gives α + γ at a composition inside that field', () => {
    expect(feC.evaluate(0.3, 800).region).toBe('α + γ');
  });
  it('moves the α tie-line end with temperature rather than pinning it at 0.022', () => {
    // Both temperatures must sit inside the α + γ field at this composition:
    // A₃ reaches 0.3 wt% C at about 839 °C, above which 0.3 is single-phase γ.
    const hot = feC.evaluate(0.3, 830);
    const cool = feC.evaluate(0.3, 750);
    expect(hot.region).toBe('α + γ');
    expect(cool.region).toBe('α + γ');
    const alphaOf = (r: typeof hot) => r.phases.find((p) => p.name === 'α')!.composition;
    // Ferrite dissolves less carbon as it gets hotter toward A₃, reaching zero
    // at 912 °C — so the hot tie line's α end is the leaner one.
    expect(alphaOf(hot)).toBeLessThan(alphaOf(cool));
    expect(alphaOf(cool)).toBeLessThan(0.022);
  });
});

/**
 * M7 — the Gibbs phase rule, attached live to the point the reader is already
 * dragging. For a condensed binary at fixed pressure P + F = C + N with C = 2
 * and N = 1, so F = 3 − P: two degrees of freedom in a single-phase field, one
 * inside a two-phase field — the tie line *is* the lost degree of freedom —
 * and zero on an invariant, which is why a eutectic is a point and not a line.
 */
describe('the Gibbs phase rule', () => {
  it('always states the condensed binary form it is using', () => {
    const r = gibbsPhaseRule(CU_NI, 50, 1200);
    expect(r.C).toBe(2);
    expect(r.N).toBe(1);
    expect(r.P + r.F).toBe(r.C + r.N);
  });

  /**
   * The sweep the iteration-9 audit established, now checking F rather than
   * the fractions: 41 × 41 points per system, and every one must satisfy
   * F = 3 − P with P the number of phases `evaluate` actually reports.
   */
  it.each(PHASE_SYSTEMS.map((s) => s.id))('%s: F = 3 − P at every point on the grid', (id) => {
    const sys = PHASE_SYSTEMS.find((s) => s.id === id)!;
    let singles = 0;
    let doubles = 0;
    for (let i = 0; i <= 40; i++) {
      for (let j = 0; j <= 40; j++) {
        const x = sys.xMin + ((sys.xMax - sys.xMin) * i) / 40;
        const T = sys.tMin + ((sys.tMax - sys.tMin) * j) / 40;
        const r = gibbsPhaseRule(sys, x, T);
        if (r.invariant) continue;
        const P = sys.evaluate(x, T).phases.length;
        expect(r.P).toBe(P);
        expect(r.F).toBe(3 - P);
        if (P === 1) singles++;
        else doubles++;
      }
    }
    // Both cases have to actually occur, or the assertion above is vacuous.
    expect(singles).toBeGreaterThan(0);
    expect(doubles).toBeGreaterThan(0);
  });

  it('gives F = 0 exactly on the Pb–Sn eutectic', () => {
    const pbsn = PHASE_SYSTEMS.find((s) => s.id === 'pb-sn')!;
    const r = gibbsPhaseRule(pbsn, 61.9, 183);
    expect(r.invariant?.label).toBe('Eutectic');
    expect(r.P).toBe(3);
    expect(r.F).toBe(0);
  });

  it('gives F = 0 on both Fe–C invariants', () => {
    const feC = PHASE_SYSTEMS.find((s) => s.id === 'fe-c')!;
    const eutectoid = gibbsPhaseRule(feC, 0.76, 727);
    expect(eutectoid.invariant?.label).toBe('Eutectoid');
    expect(eutectoid.F).toBe(0);
    const eutectic = gibbsPhaseRule(feC, 4.3, 1147);
    expect(eutectic.invariant?.label).toBe('Eutectic');
    expect(eutectic.F).toBe(0);
  });

  it('finds no invariant in an isomorphous system, which has none', () => {
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j <= 20; j++) {
        const x = (100 * i) / 20;
        const T = 1000 + (550 * j) / 20;
        expect(gibbsPhaseRule(CU_NI, x, T).invariant).toBeNull();
      }
    }
  });

  /**
   * The tolerance is the arrow-key step — 1% of each axis — so a keyboard user
   * can actually land on the invariant. Wider and the eutectic would swallow
   * its neighbourhood; narrower and it would be unreachable without a mouse.
   */
  it('matches the invariant over exactly one arrow-key step, and no further', () => {
    const pbsn = PHASE_SYSTEMS.find((s) => s.id === 'pb-sn')!;
    const dx = (pbsn.xMax - pbsn.xMin) * 0.01; // 1.0 wt% Sn
    const dT = (pbsn.tMax - pbsn.tMin) * 0.01; // 3.3 °C
    expect(gibbsPhaseRule(pbsn, 61.9 + dx * 0.99, 183).invariant).not.toBeNull();
    expect(gibbsPhaseRule(pbsn, 61.9, 183 + dT * 0.99).invariant).not.toBeNull();
    expect(gibbsPhaseRule(pbsn, 61.9 + dx * 1.01, 183).invariant).toBeNull();
    expect(gibbsPhaseRule(pbsn, 61.9, 183 + dT * 1.01).invariant).toBeNull();
    // and the far side of the diagram is nowhere near it
    expect(gibbsPhaseRule(pbsn, 10, 100).invariant).toBeNull();
  });

  /**
   * The eutectic composition at the eutectic temperature is single-phase L by
   * the evaluator — it sits exactly on the liquidus. The phase rule has to
   * override that with the three phases of the reaction, or the readout would
   * say F = 2 at the one point in the diagram where nothing can move.
   */
  it('overrides the evaluator’s phase count on an invariant', () => {
    const pbsn = PHASE_SYSTEMS.find((s) => s.id === 'pb-sn')!;
    expect(pbsn.evaluate(61.9, 183).phases).toHaveLength(1);
    expect(gibbsPhaseRule(pbsn, 61.9, 183).P).toBe(3);
  });
});

