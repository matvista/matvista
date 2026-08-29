import { describe, expect, it } from 'vitest';
import {
  CEMENTITE_X, CU_NI, EUTECTOID_T, EUTECTOID_X, FERRITE_MAX, PHASE_SYSTEMS,
  boundaryTemperature, gibbsPhaseRule, lever, microconstituents, steelMicrostructure,
} from './systems';
import { STEELS } from '../heattreat/steels';

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
   * **F = 0 is a line, not a dot, and it is the line the diagram draws.**
   *
   * This block replaces one that asserted a ±1%-of-each-axis box around the
   * invariant *composition*. That box was wrong in both directions at once. On
   * Fe–C it spanned ±12.0 °C, so `x=0.76, T=739` — a point in the middle of
   * the γ field, which the region readout on the same screen names — was
   * reported as three phases with F = 0. And it missed the eutectic isotherm
   * away from the invariant composition, where three phases genuinely do
   * coexist: 40 wt% Sn at 183 °C read F = 1.
   *
   * The oracle here is not `gibbsPhaseRule`'s own arithmetic. It is
   * `evaluate` a half-degree either side of the line: a temperature where the
   * phases above and the phases below add up to three distinct names is one
   * where three phases meet, and that is the whole content of the claim.
   */
  const INVARIANTS: [string, string, number, [number, number]][] = [
    ['pb-sn', 'Eutectic', 183, [18.3, 97.8]],
    ['fe-c', 'Eutectoid', 727, [FERRITE_MAX, CEMENTITE_X]],
    ['fe-c', 'Eutectic', 1147, [2.14, CEMENTITE_X]],
  ];
  const sys = (id: string) => PHASE_SYSTEMS.find((s) => s.id === id)!;
  /**
   * Distinct phase names present immediately above and immediately below T.
   *
   * A micro-degree rather than a round number on purpose: the Fe–C eutectic
   * corner has the γ solidus, A_cm and the isotherm converging at
   * (2.14, 1147), so a half-degree probe straddles all three and reports three
   * names for a point that is really in one field.
   */
  const meeting = (id: string, x: number, T: number) =>
    new Set(
      [T - 1e-6, T + 1e-6].flatMap((t) => sys(id).evaluate(x, t).phases.map((p) => p.name)),
    );

  it.each(INVARIANTS)(
    '%s %s: every invariant is a drawn isotherm, not a declared point',
    (id, label, T, span) => {
      const inv = sys(id).invariants.find((i) => i.label === label)!;
      expect(inv.T).toBe(T);
      // The span is derived from the isotherm boundary, so an invariant with
      // no isotherm drawn for it would silently never be flagged.
      const line = sys(id).boundaries.find(
        (b) => b.kind === 'isotherm' && b.points.every(([, t]) => t === T),
      );
      expect(line, `${id} ${label} has no isotherm drawn`).toBeDefined();
      const xs = line!.points.map(([x]) => x);
      expect([Math.min(...xs), Math.max(...xs)]).toEqual(span);
    },
  );

  it.each(INVARIANTS)(
    '%s %s: F = 0 all along the isotherm, and three phases really do meet there',
    (id, label, T, [xa, xb]) => {
      for (let j = 0; j <= 20; j++) {
        // Indexed, not accumulated: a float step overshoots xb and falls off
        // the end of the very span under test.
        const x = j === 20 ? xb : xa + ((xb - xa) * j) / 20;
        const r = gibbsPhaseRule(sys(id), x, T);
        expect(r.invariant?.label, `${id} at x=${x}`).toBe(label);
        expect(r.P).toBe(3);
        expect(r.F).toBe(0);
        // Independent of the rule: the evaluator sees three names across the line.
        expect(meeting(id, x, T).size, `${id} at x=${x}`).toBe(3);
      }
    },
  );

  it.each(INVARIANTS)(
    '%s %s: one degree off the line is not on it',
    (id, label, T, [xa, xb]) => {
      const mid = (xa + xb) / 2;
      for (const t of [T - 1, T + 1, T - 12, T + 12]) {
        const r = gibbsPhaseRule(sys(id), mid, t);
        expect(r.invariant, `${id} ${label} at ${t} °C`).toBeNull();
        expect(r.P).toBe(sys(id).evaluate(mid, t).phases.length);
      }
    },
  );

  /**
   * Both Fe–C isotherms run hard up against a diagram edge — the eutectoid
   * ends at cementite, which is `xMax` — so the cases that exist are counted
   * rather than assumed, or a row could pass by testing nothing.
   */
  it('is not on the isotherm past either of its ends', () => {
    let checked = 0;
    for (const [id, , T, [xa, xb]] of INVARIANTS) {
      const off = (xb - xa) * 0.02;
      for (const x of [xa - off, xb + off]) {
        if (x < sys(id).xMin || x > sys(id).xMax) continue;
        checked++;
        expect(gibbsPhaseRule(sys(id), x, T).invariant, `${id} at ${x}, ${T} °C`).toBeNull();
        expect(meeting(id, x, T).size, `${id} at ${x}, ${T} °C`).toBeLessThan(3);
      }
    }
    expect(checked).toBe(3);
  });

  /**
   * The five points the review reproduced against the shipped code, kept as
   * named cases so the failure mode is recognisable rather than buried in a
   * sweep. The first three read F = 0 with three phases; the last two read
   * F = 1 with two.
   */
  it.each([
    ['fe-c', 0.76, 739, 2, 'γ'],
    ['fe-c', 4.3, 1159, 2, 'L'],
    ['pb-sn', 61.9, 186, 2, 'L'],
  ])('%s at %s, %s °C is in a field, not on a line', (id, x, T, F, region) => {
    const r = gibbsPhaseRule(sys(id as string), x as number, T as number);
    expect(r.invariant).toBeNull();
    expect(r.F).toBe(F);
    expect(sys(id as string).evaluate(x as number, T as number).region).toBe(region);
  });

  it.each([
    ['pb-sn', 40, 183],
    ['fe-c', 0.3, 727],
  ])('%s at %s, %s °C is on the isotherm away from the invariant composition', (id, x, T) => {
    const r = gibbsPhaseRule(sys(id as string), x as number, T as number);
    expect(r.P).toBe(3);
    expect(r.F).toBe(0);
    expect(meeting(id as string, x as number, T as number).size).toBe(3);
  });

  /**
   * The sweep the old tolerance would have failed: nothing anywhere may be
   * flagged F = 0 unless three phases actually meet at it. 121 × 121 per
   * system, deliberately offset so the grid does not sit only on round
   * numbers, plus every invariant temperature as an exact row.
   */
  it.each(PHASE_SYSTEMS.map((s) => s.id))('%s: nothing is flagged invariant that is not', (id) => {
    const s = sys(id);
    const rows = [...Array(121).keys()].map((j) => s.tMin + ((s.tMax - s.tMin) * j) / 120);
    rows.push(...s.invariants.map((i) => i.T));
    let flagged = 0;
    for (const T of rows) {
      for (let i = 0; i <= 120; i++) {
        const x = s.xMin + ((s.xMax - s.xMin) * i) / 120;
        const r = gibbsPhaseRule(s, x, T);
        if (!r.invariant) continue;
        flagged++;
        expect(meeting(id, x, T).size, `${id} flagged (${x}, ${T})`).toBe(3);
      }
    }
    // Cu–Ni has no invariant and must flag nothing; the other two must flag
    // something, or this sweep proves nothing about them.
    expect(flagged === 0).toBe(s.invariants.length === 0);
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

/**
 * M12 — the austenitising temperature is *chosen from the phase diagram*,
 * A₃ + 30–50 °C, not picked. The heat-treatment module reads these numbers off
 * the same Fe–Fe₃C model the phase module draws, so the two cannot disagree
 * about the steel they are both describing.
 */
describe('reading a boundary temperature off the diagram', () => {
  const feC = PHASE_SYSTEMS.find((s) => s.id === 'fe-c')!;

  it('puts A₃ at 912 °C for pure iron and at the eutectoid for 0.76 wt% C', () => {
    expect(boundaryTemperature(feC, 'A₃', 0)).toBeCloseTo(912, 9);
    expect(boundaryTemperature(feC, 'A₃', EUTECTOID_X)).toBeCloseTo(EUTECTOID_T, 9);
  });

  /** The number the austenitising panel quotes for both 0.40 wt% grades. */
  it('puts A₃ for 0.40 wt% C at 815 °C', () => {
    expect(boundaryTemperature(feC, 'A₃', 0.4)!).toBeCloseTo(814.6, 1);
  });

  it('puts A_cm at the eutectoid and at γ’s solubility ceiling', () => {
    expect(boundaryTemperature(feC, 'A_cm', EUTECTOID_X)).toBeCloseTo(EUTECTOID_T, 9);
    expect(boundaryTemperature(feC, 'A_cm', 2.14)).toBeCloseTo(1147, 9);
    // 1080 is barely hypereutectoid, so its A_cm window is a few degrees wide.
    expect(boundaryTemperature(feC, 'A_cm', 0.79)!).toBeCloseTo(736.1, 1);
  });

  it('returns null off the end of a boundary, and for an unknown one', () => {
    expect(boundaryTemperature(feC, 'A₃', 1.5)).toBeNull();
    expect(boundaryTemperature(feC, 'A_cm', 0.5)).toBeNull();
    expect(boundaryTemperature(feC, 'not a boundary', 0.4)).toBeNull();
  });

  it('interpolates monotonically along a straight boundary', () => {
    let prev = -Infinity;
    for (let x = 0.76; x <= 2.14; x += 0.02) {
      const T = boundaryTemperature(feC, 'A_cm', x)!;
      expect(T).toBeGreaterThan(prev);
      prev = T;
    }
  });
});

describe('undissolved ferrite at the austenitising temperature', () => {
  const feC = PHASE_SYSTEMS.find((s) => s.id === 'fe-c')!;
  const ferriteAt = (C: number, T: number) =>
    feC.evaluate(C, T).phases.find((p) => p.name === 'α')?.fraction ?? 0;

  /** Composition of a straight boundary at a temperature — the drawn line. */
  const compositionAt = (label: string, T: number) => {
    const pts = feC.boundaries.find((b) => b.label === label)!.points;
    const [[x1, t1], [x2, t2]] = [pts[0], pts[pts.length - 1]];
    return x1 + ((x2 - x1) * (T - t1)) / (t2 - t1);
  };

  it('is zero at and above A₃ for every shipped steel, and positive below', () => {
    for (const steel of STEELS) {
      const C = steel.composition.C;
      const a3 = boundaryTemperature(feC, 'A₃', C);
      if (a3 == null) continue; // hypereutectoid: A₃ does not reach it
      expect(ferriteAt(C, a3 + 1)).toBe(0);
      expect(ferriteAt(C, a3 - 1)).toBeGreaterThan(0);
    }
  });

  /**
   * The heat-treatment panel and the phase panel must report one number. The
   * oracle here is the **drawn boundary polylines**, interpolated directly —
   * `evaluate` computes its tie line from functions instead, so agreement is a
   * real cross-check between the diagram's data and its evaluator.
   */
  it('matches a lever rule taken over the two drawn boundaries', () => {
    for (const T of [740, 760, 780, 800, 810]) {
      const alphaEnd = compositionAt('α/(α+γ)', T);
      const gammaEnd = compositionAt('A₃', T);
      for (const C of [0.1, 0.2, 0.3, 0.4]) {
        if (C <= alphaEnd || C >= gammaEnd) continue;
        expect(ferriteAt(C, T)).toBeCloseTo(lever(C, alphaEnd, gammaEnd), 9);
      }
    }
  });

  it('leaves the default 850 °C above A₃ for both 0.40 wt% grades', () => {
    for (const steel of STEELS.filter((s) => s.composition.C < EUTECTOID_X)) {
      expect(boundaryTemperature(feC, 'A₃', steel.composition.C)!).toBeLessThan(850);
      expect(ferriteAt(steel.composition.C, 850)).toBe(0);
    }
  });

  /**
   * The hypereutectoid case, and why it is the other way round: 1080 at
   * 0.79 wt% C sits in γ + Fe₃C between A₁ and A_cm, and that undissolved
   * cementite is deliberately kept — dissolving it raises the carbon in
   * solution and drops Mˢ.
   */
  it('puts 1080 in γ + Fe₃C just above A₁ and in γ at 850 °C', () => {
    const c = STEELS.find((s) => s.id === '1080')!.composition.C;
    expect(c).toBeGreaterThan(EUTECTOID_X);
    expect(feC.evaluate(c, 730).region).toBe('γ + Fe₃C');
    expect(feC.evaluate(c, 850).region).toBe('γ');
    const acm = boundaryTemperature(feC, 'A_cm', c)!;
    expect(acm - EUTECTOID_T).toBeLessThan(10); // a nine-degree window
    expect(feC.evaluate(c, acm + 1).region).toBe('γ');
  });
});

