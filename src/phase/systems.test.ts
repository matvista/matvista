import { describe, expect, it } from 'vitest';
import { CU_NI, PHASE_SYSTEMS, lever, steelMicrostructure } from './systems';

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
