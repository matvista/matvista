import { describe, expect, it } from 'vitest';
import {
  CEMENTITE_X, CU_NI, EUTECTOID_X, FERRITE_MAX, PHASE_SYSTEMS, gibbsPhaseRule, lever,
  microconstituents, steelMicrostructure,
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

/**
 * M8 — the microconstituent split, generalised off Fe–C.
 *
 * Callister §9.16, the standard eutectic worked example: a 40 wt% Sn alloy
 * cooled to just below 183 °C is 50% primary α and 50% eutectic constituent,
 * yet **73%** of it is α by phase — because the eutectic constituent contains
 * α too. That gap between microconstituent and phase is the single most
 * reliable exam trap in eutectic systems, and it is the same distinction the
 * module already teaches well for steel.
 */
describe('Pb–Sn microconstituents (Callister §9.16: 40 wt% Sn)', () => {
  const pbsn = PHASE_SYSTEMS.find((s) => s.id === 'pb-sn')!;
  const m = microconstituents(pbsn, 40)!;

  it('forms at the eutectic, and names it', () => {
    expect(m.invariant.type).toBe('eutectic');
    expect(m.invariant.T).toBe(183);
    expect(m.invariant.x).toBe(61.9);
  });

  it('is hypoeutectic with primary α', () => {
    expect(m.kind).toBe('hypoeutectic');
    expect(m.primary).toBe('α');
    expect(m.primaryComposition).toBeCloseTo(18.3, 9);
  });

  it('gives 50% primary α and 50% eutectic constituent', () => {
    expect(m.primaryFraction).toBeCloseTo(0.5, 2);
    expect(m.eutecticFraction).toBeCloseTo(0.5, 2);
    expect(m.primaryFraction + m.eutecticFraction).toBeCloseTo(1, 12);
  });

  it('gives 73% total α and 27% total β — not 50/50', () => {
    expect(m.left.name).toBe('α');
    expect(m.right.name).toBe('β');
    expect(m.left.fraction).toBeCloseTo(0.73, 2);
    expect(m.right.fraction).toBeCloseTo(0.27, 2);
    expect(m.left.fraction + m.right.fraction).toBeCloseTo(1, 12);
    // The trap, stated as an assertion: the two splits genuinely differ.
    expect(Math.abs(m.left.fraction - m.primaryFraction)).toBeGreaterThan(0.2);
  });

  it('computes total α the same way twice', () => {
    // Directly by the lever rule over the whole α–β tie line …
    const direct = lever(40, 18.3, 97.8);
    expect(m.left.fraction).toBeCloseTo(direct, 12);
    // … and by adding the α inside the eutectic constituent to the primary α.
    const alphaInEutectic = m.eutecticFraction * lever(61.9, 18.3, 97.8);
    expect(m.primaryFraction + alphaInEutectic).toBeCloseTo(m.left.fraction, 12);
  });

  it('handles the hypereutectic side, where the primary is β', () => {
    const h = microconstituents(pbsn, 80)!;
    expect(h.kind).toBe('hypereutectic');
    expect(h.primary).toBe('β');
    expect(h.primaryComposition).toBeCloseTo(97.8, 9);
    // Primary β grows toward pure β and vanishes at the eutectic, so it is
    // the lever taken from the eutectic side — the mirror of the α case, and
    // the same form `steelMicrostructure` has always used above 0.76 wt% C.
    expect(h.primaryFraction).toBeCloseTo((80 - 61.9) / (97.8 - 61.9), 12);
    expect(h.eutecticFraction).toBeCloseTo((97.8 - 80) / (97.8 - 61.9), 12);
    expect(h.left.fraction).toBeCloseTo(lever(80, 18.3, 97.8), 12);
    // total β two ways, as on the hypoeutectic side
    expect(h.primaryFraction + h.eutecticFraction * (1 - lever(61.9, 18.3, 97.8))).toBeCloseTo(
      h.right.fraction,
      12,
    );
  });

  it('is wholly eutectic at the eutectic composition', () => {
    const e = microconstituents(pbsn, 61.9)!;
    expect(e.kind).toBe('eutectic');
    expect(e.primary).toBeNull();
    expect(e.eutecticFraction).toBeCloseTo(1, 12);
    expect(e.primaryFraction).toBeCloseTo(0, 12);
  });

  /**
   * Inside the terminal solid solutions there is no eutectic constituent at
   * all, so the panel must be **absent** rather than showing zeros. Clamping
   * a fraction to hide an out-of-domain computation is the iteration-9 defect.
   */
  it('refuses compositions outside the α + β field', () => {
    expect(microconstituents(pbsn, 10)).toBeNull();
    expect(microconstituents(pbsn, 99)).toBeNull();
    expect(microconstituents(pbsn, 0)).toBeNull();
    expect(microconstituents(pbsn, 100)).toBeNull();
  });

  it('refuses a system with no invariant at all', () => {
    expect(microconstituents(CU_NI, 35)).toBeNull();
  });

  it('keeps every fraction in range and summing to one across the field', () => {
    for (let x = 18.4; x < 97.8; x += 0.1) {
      const r = microconstituents(pbsn, x)!;
      expect(r).not.toBeNull();
      expect(r.primaryFraction + r.eutecticFraction).toBeCloseTo(1, 12);
      expect(r.left.fraction + r.right.fraction).toBeCloseTo(1, 12);
      for (const v of [r.primaryFraction, r.eutecticFraction, r.left.fraction, r.right.fraction]) {
        expect(v).toBeGreaterThanOrEqual(-1e-12);
        expect(v).toBeLessThanOrEqual(1 + 1e-12);
      }
    }
  });
});

/**
 * The declared invariant products are a second copy of numbers the boundary
 * polylines already carry, so they are cross-checked against the diagram's own
 * evaluator rather than trusted. Probe at the tie line's midpoint, which is
 * inside the two-phase field for both systems — the invariant composition
 * itself sits on the Pb–Sn liquidus and evaluates as L.
 */
describe('invariant products agree with the diagram that declares them', () => {
  it.each(PHASE_SYSTEMS.flatMap((s) => s.invariants.filter((i) => i.products).map((i) => [s.id, i.label] as const)))(
    '%s %s',
    (sid, label) => {
      const sys = PHASE_SYSTEMS.find((s) => s.id === sid)!;
      const inv = sys.invariants.find((i) => i.label === label)!;
      const [a, b] = inv.products!;
      const mid = (a.composition + b.composition) / 2;
      const at = sys.evaluate(mid, inv.T);
      expect(at.phases.map((p) => p.name)).toEqual([a.name, b.name]);
      expect(Math.min(at.tieLine!.x1, at.tieLine!.x2)).toBeCloseTo(a.composition, 9);
      expect(Math.max(at.tieLine!.x1, at.tieLine!.x2)).toBeCloseTo(b.composition, 9);
      expect(a.composition).toBeLessThan(inv.x);
      expect(b.composition).toBeGreaterThan(inv.x);
    },
  );

  it('leaves the Fe–C eutectic without products — γ is gone by 727 °C', () => {
    const feC = PHASE_SYSTEMS.find((s) => s.id === 'fe-c')!;
    expect(feC.invariants.find((i) => i.label === 'Eutectic')!.products).toBeUndefined();
    // and so the microconstituent split is taken at the eutectoid
    expect(microconstituents(feC, 0.4)!.invariant.label).toBe('Eutectoid');
  });
});

/**
 * `steelMicrostructure` is now a wrapper. Its published behaviour — the values
 * `heattreat/model.ts` and the Fe–C panel read — has to be bit-for-bit what the
 * closed forms give, so the closed forms are restated here rather than the
 * wrapper being trusted to agree with itself.
 */
describe('steelMicrostructure still computes exactly what it did', () => {
  it('matches the closed forms across the whole steel range', () => {
    for (let c = FERRITE_MAX; c <= 2.14; c += 0.001) {
      const r = steelMicrostructure(c)!;
      expect(r).not.toBeNull();
      expect(r.totalFerrite).toBeCloseTo((CEMENTITE_X - c) / (CEMENTITE_X - FERRITE_MAX), 12);
      expect(r.totalCementite).toBeCloseTo(1 - r.totalFerrite, 12);
      const pearlite =
        c < EUTECTOID_X
          ? (c - FERRITE_MAX) / (EUTECTOID_X - FERRITE_MAX)
          : (CEMENTITE_X - c) / (CEMENTITE_X - EUTECTOID_X);
      expect(r.pearlite).toBeCloseTo(Math.min(1, pearlite), 12);
      expect(r.proeutectoidFraction).toBeCloseTo(1 - r.pearlite, 12);
      expect(r.kind).toBe(
        Math.abs(c - EUTECTOID_X) < 1e-9
          ? 'eutectoid'
          : c < EUTECTOID_X
            ? 'hypoeutectoid'
            : 'hypereutectoid',
      );
    }
  });

  it('keeps its own domain — cast iron is not steel', () => {
    expect(steelMicrostructure(0.021)).toBeNull();
    expect(steelMicrostructure(2.15)).toBeNull();
    expect(steelMicrostructure(FERRITE_MAX)).not.toBeNull();
    expect(steelMicrostructure(2.14)).not.toBeNull();
  });

  it('reports zero pearlite, not null, at ferrite’s solubility limit', () => {
    const r = steelMicrostructure(FERRITE_MAX)!;
    expect(r.pearlite).toBeCloseTo(0, 12);
    expect(r.proeutectoidFraction).toBeCloseTo(1, 12);
    expect(r.totalFerrite).toBeCloseTo(1, 12);
  });
});

