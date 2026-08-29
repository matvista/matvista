import { describe, expect, it } from 'vitest';
import {
  CRACK_GEOMETRIES, SECANT_MAX_RATIO, criticalCrackSize, criticalStress, cyclesToFailure,
  fatigueStrength, fitSn, geometryFactor, getCrackGeometry, griffithCrackLength,
  griffithStress, growthRate, hoopStress, lameHoopStress, larsonMiller, leakBeforeBreakThickness,
  parisLife, THIN_WALL_MIN_RATIO,
  plasticZoneRadius, ruptureHours, stressIntensity,
} from './model';
import {
  BRITTLE_SOLIDS, FATIGUE_BEHAVIOUR, FRACTURE_ALLOYS, GROWTH_CLASSES,
  s590Parameter, s590Stress, S590_CURVE,
} from './materials';
import { MECH_MATERIALS } from '../mechanical/materials';

describe('fracture — against published worked examples', () => {
  it('reproduces Callister’s 8.2 µm flaw in soda-lime glass at 40 MPa', () => {
    expect(griffithCrackLength(69, 0.3, 40) * 1e6).toBeCloseTo(8.2, 1);
  });

  it('round-trips Griffith stress and crack length', () => {
    const a = griffithCrackLength(69, 0.3, 40);
    expect(griffithStress(69, 0.3, a)).toBeCloseTo(40, 6);
  });

  it.each(FRACTURE_ALLOYS.map((a) => a.id))('%s: K at the critical crack equals K_IC', (id) => {
    const alloy = FRACTURE_ALLOYS.find((a) => a.id === id)!;
    for (const sigma of [200, 400, 700]) {
      const ac = criticalCrackSize(alloy.kic, sigma, 1);
      expect(stressIntensity(sigma, ac, 1)).toBeCloseTo(alloy.kic, 6);
      expect(criticalStress(alloy.kic, ac, 1)).toBeCloseTo(sigma, 6);
    }
  });

  it('gives 4340 tempered at 425 °C a 4.82 mm critical crack at 710 MPa', () => {
    expect(criticalCrackSize(87.4, 710, 1) * 1000).toBeCloseTo(4.82, 2);
  });

  it('makes critical crack size scale as the square of toughness', () => {
    const tough = criticalCrackSize(87.4, 700, 1);
    const brittle = criticalCrackSize(50, 700, 1);
    expect(tough / brittle).toBeCloseTo((87.4 / 50) ** 2, 9);
  });

  it('grows the plastic zone with K and shrinks it with yield strength', () => {
    expect(plasticZoneRadius(80, 1000)).toBeGreaterThan(plasticZoneRadius(40, 1000));
    expect(plasticZoneRadius(80, 1600)).toBeLessThan(plasticZoneRadius(80, 800));
  });

  it('keeps every brittle solid’s inputs positive', () => {
    for (const b of BRITTLE_SOLIDS) {
      expect(b.E).toBeGreaterThan(0);
      expect(b.gamma).toBeGreaterThan(0);
    }
  });
});

describe('fatigue', () => {
  const fitFor = (id: string) => {
    const beh = FATIGUE_BEHAVIOUR.find((f) => f.id === id)!;
    const mat = MECH_MATERIALS.find((m) => m.id === id)!;
    return { beh, mat, fit: fitSn(mat.uts, beh.ratio, beh.kneeCycles, beh.hasEnduranceLimit) };
  };

  it.each(FATIGUE_BEHAVIOUR.map((f) => f.id))('%s: hits both Basquin anchors', (id) => {
    const { beh, mat, fit } = fitFor(id);
    expect(fatigueStrength(fit, 1e3)).toBeCloseTo(0.9 * mat.uts, 6);
    expect(fatigueStrength(fit, beh.kneeCycles)).toBeCloseTo(beh.ratio * mat.uts, 6);
  });

  it.each(FATIGUE_BEHAVIOUR.map((f) => f.id))('%s: S–N is monotone decreasing', (id) => {
    const { fit } = fitFor(id);
    let prev = Infinity;
    for (let lg = 3; lg <= 9; lg += 0.05) {
      const s = fatigueStrength(fit, 10 ** lg);
      expect(s).toBeLessThanOrEqual(prev + 1e-9);
      prev = s;
    }
  });

  /** The domain trap this module exists to teach. */
  it('flattens only for the alloys that actually have a fatigue limit', () => {
    for (const beh of FATIGUE_BEHAVIOUR) {
      const { mat, fit } = fitFor(beh.id);
      const past = fatigueStrength(fit, beh.kneeCycles * 100);
      if (beh.hasEnduranceLimit) {
        expect(past).toBeCloseTo(beh.ratio * mat.uts, 6);
        expect(cyclesToFailure(fit, fit.kneeStress * 0.99)).toBeNull();
      } else {
        expect(past).toBeLessThan(beh.ratio * mat.uts);
        expect(cyclesToFailure(fit, fit.kneeStress * 0.99)).not.toBeNull();
      }
    }
  });

  it('gives an endurance limit to exactly the ferrous alloys and titanium', () => {
    expect(FATIGUE_BEHAVIOUR.filter((f) => f.hasEnduranceLimit).map((f) => f.id).sort())
      .toEqual(['fe', 'steel1020', 'ti']);
  });

  it.each(FATIGUE_BEHAVIOUR.map((f) => f.id))('%s: S → N → S round trips', (id) => {
    const { fit } = fitFor(id);
    for (const N of [1e4, 1e5, 5e5]) {
      expect(cyclesToFailure(fit, fatigueStrength(fit, N))!).toBeCloseTo(N, 0);
    }
  });
});

describe('Paris crack growth', () => {
  it.each(GROWTH_CLASSES.map((g) => g.id))('%s: closed form matches numerical integration', (id) => {
    const g = GROWTH_CLASSES.find((c) => c.id === id)!;
    const a0 = 1e-3, af = 0.02, dS = 150, Y = 1;
    const analytic = parisLife(g.C, g.m, a0, af, dS, Y)!;
    let N = 0;
    const steps = 200000;
    const h = (af - a0) / steps;
    for (let i = 0; i < steps; i++) N += h / growthRate(g.C, g.m, a0 + h * (i + 0.5), dS, Y);
    expect(analytic / N).toBeCloseTo(1, 2);
  });

  it('multiplies life by 8 when m = 3 and the stress range halves', () => {
    const g = GROWTH_CLASSES.find((c) => c.id === 'ferritic')!;
    expect(g.m).toBe(3);
    const slow = parisLife(g.C, g.m, 1e-3, 0.02, 75, 1)!;
    const fast = parisLife(g.C, g.m, 1e-3, 0.02, 150, 1)!;
    expect(slow / fast).toBeCloseTo(8, 6);
  });

  it('returns null for a crack that is already critical', () => {
    const g = GROWTH_CLASSES[0];
    expect(parisLife(g.C, g.m, 0.02, 0.02, 150, 1)).toBeNull();
  });

  it('offers steel classes only — Barsom constants are not transferable', () => {
    for (const g of GROWTH_CLASSES) expect(g.name).toMatch(/steel|stainless/i);
  });
});

describe('creep — Larson–Miller', () => {
  it('reproduces Callister’s S-590 example: 800 °C, 140 MPa ≈ 233 h', () => {
    const T = 800 + 273.15;
    const P = s590Parameter(140) * 1000;
    expect(P / 1000).toBeCloseTo(24.0, 1);
    expect(ruptureHours(P, T)).toBeGreaterThan(215);
    expect(ruptureHours(P, T)).toBeLessThan(250);
  });

  it('round-trips the parameter', () => {
    expect(ruptureHours(larsonMiller(1073, 233), 1073)).toBeCloseTo(233, 6);
  });

  it.each(S590_CURVE.map((c) => c.stress))('round-trips %i MPa through the master curve', (s) => {
    expect(s590Stress(s590Parameter(s))).toBeCloseTo(s, 6);
  });

  it('keeps the master curve monotone', () => {
    for (let i = 1; i < S590_CURVE.length; i++) {
      expect(S590_CURVE[i].stress).toBeLessThan(S590_CURVE[i - 1].stress);
      expect(S590_CURVE[i].P).toBeGreaterThan(S590_CURVE[i - 1].P);
    }
  });

  it('raises P with both temperature and time, and lowers the allowable stress', () => {
    expect(larsonMiller(1200, 100)).toBeGreaterThan(larsonMiller(1000, 100));
    expect(larsonMiller(1073, 1000)).toBeGreaterThan(larsonMiller(1073, 10));
    expect(s590Stress(25)).toBeLessThan(s590Stress(22));
  });
});

/**
 * P8 — Y is not a fudge factor. It encodes the crack's geometry, and it is
 * where a hand calculation goes wrong. Every value below is a standard
 * handbook closed form (Tada/Paris/Irwin; Feddersen for the finite-width
 * secant), not a number dialled in on a slider.
 */
describe('named crack geometries', () => {
  const Y = (id: string, ratio = 0) => geometryFactor(getCrackGeometry(id), ratio);

  it('gives the centre crack in a wide plate Y = 1 exactly', () => {
    expect(Y('centre')).toBe(1);
  });

  /**
   * The free-surface correction. A crack that breaks the surface opens more
   * than a buried one of the same size, and 1.12 is that 12%.
   */
  it('gives the single-edge notch the 1.12 free-surface correction', () => {
    expect(Y('edge')).toBeCloseTo(1.12, 12);
  });

  /**
   * A semicircular surface flaw: Y = 1.12/Φ, with Φ the complete elliptic
   * integral of the second kind, which is exactly π/2 when a/c = 1. The 1.12
   * free-surface term is the same one the edge notch carries; the ellipse's
   * front divides it down.
   */
  it('gives the semicircular surface flaw 1.12/(π/2) = 0.713', () => {
    expect(Y('surface')).toBeCloseTo(1.12 / (Math.PI / 2), 12);
    expect(Y('surface')).toBeCloseTo(0.713, 3);
    // Smaller than the edge notch, which is why a buried-ish flaw of the same
    // depth is less severe than a notch of that depth.
    expect(Y('surface')).toBeLessThan(Y('edge')!);
  });

  describe('the finite-width secant correction', () => {
    it('reduces to the wide plate as the crack vanishes', () => {
      expect(Y('finite', 0)).toBeCloseTo(1, 12);
      expect(Y('finite', 0.01)).toBeCloseTo(1, 3);
    });

    it('follows √sec(π·2a/2W)', () => {
      for (const r of [0.1, 0.3, 0.5, 0.7]) {
        expect(Y('finite', r)!).toBeCloseTo(Math.sqrt(1 / Math.cos((Math.PI * r) / 2)), 12);
      }
      expect(Y('finite', 0.5)!).toBeCloseTo(1.1892, 4);
      expect(Y('finite', 0.7)!).toBeCloseTo(1.4841, 4);
    });

    it('rises monotonically as the crack eats the section', () => {
      let prev = 0;
      for (let r = 0; r <= SECANT_MAX_RATIO; r += 0.01) {
        const y = Y('finite', r)!;
        expect(y).toBeGreaterThan(prev);
        prev = y;
      }
    });

    /**
     * The validity limit, and the reason this is a `null` and not a number.
     * Past 2a/W ≈ 0.7 the expression is outside its fit and heading for a
     * singularity at 1; extrapolating there would return a confident value for
     * a case the formula does not describe.
     */
    it('refuses past its validity limit rather than extrapolating', () => {
      expect(SECANT_MAX_RATIO).toBe(0.7);
      expect(Y('finite', 0.7)).not.toBeNull();
      expect(Y('finite', 0.71)).toBeNull();
      expect(Y('finite', 0.99)).toBeNull();
      expect(Y('finite', -0.1)).toBeNull();
    });
  });

  it('marks only the finite-width case as width-dependent', () => {
    for (const g of CRACK_GEOMETRIES) {
      expect(g.finiteWidth).toBe(g.id === 'finite');
      if (!g.finiteWidth) {
        // A width-independent Y must ignore the ratio entirely.
        expect(geometryFactor(g, 0)).toBe(geometryFactor(g, 0.5));
      }
    }
  });

  it('falls back to a known geometry for an unknown id', () => {
    expect(getCrackGeometry('nonsense').id).toBe(CRACK_GEOMETRIES[0].id);
  });

  /**
   * The point of naming them: the same crack and the same stress span a factor
   * of two in K depending only on where the crack sits.
   */
  it('spans a factor of two in K across the named cases', () => {
    const a = 0.002;
    const sigma = 400;
    const ks = ['centre', 'edge', 'surface'].map((id) => stressIntensity(sigma, a, Y(id)!));
    expect(Math.max(...ks) / Math.min(...ks)).toBeCloseTo(1.12 / 0.713, 2);
  });
});

/**
 * Leak-before-break. A through-wall crack that reaches the far side leaks —
 * loudly, detectably, at low consequence — whereas a buried crack that reaches
 * critical length bursts the vessel. The design criterion is that the critical
 * **through-wall** crack length be at least the wall thickness.
 *
 * With hoop stress σ = pr/t and 2a_c = (2/π)(K_IC/Yσ)², the condition
 * 2a_c ≥ t solves to t ≥ (π/2)(Y·p·r/K_IC)².
 */
describe('leak-before-break', () => {
  it('computes the hoop stress of a thin-walled cylinder', () => {
    expect(hoopStress(10, 0.5, 0.005)).toBeCloseTo(1000, 9);
    expect(hoopStress(10, 0.5, 0)).toBe(Infinity);
  });

  /**
   * The criterion, checked against the independent LEFM route rather than
   * restated: at the returned thickness, twice the critical crack size must
   * equal the wall exactly.
   */
  it.each(FRACTURE_ALLOYS.map((a) => a.id))('%s: 2·a_c equals the wall at t_min', (id) => {
    const alloy = FRACTURE_ALLOYS.find((a) => a.id === id)!;
    for (const p of [2, 10, 30]) {
      for (const r of [0.2, 0.5, 1.5]) {
        const t = leakBeforeBreakThickness(alloy.kic, p, r, 1)!;
        expect(t).toBeGreaterThan(0);
        const sigma = hoopStress(p, r, t);
        expect(2 * criticalCrackSize(alloy.kic, sigma, 1)).toBeCloseTo(t, 12);
      }
    }
  });

  it('is satisfied above the returned thickness and violated below it', () => {
    const kic = 87.4;
    const t = leakBeforeBreakThickness(kic, 10, 0.5, 1)!;
    const holds = (wall: number) =>
      2 * criticalCrackSize(kic, hoopStress(10, 0.5, wall), 1) >= wall;
    expect(holds(t * 1.2)).toBe(true);
    expect(holds(t * 0.8)).toBe(false);
  });

  /**
   * The engineering conclusion, and the one that contradicts "stronger is
   * safer": the same steel tempered warmer is 220 MPa weaker and 37 MPa√m
   * tougher, and it satisfies leak-before-break in a wall a third as thick.
   */
  it('lets the tougher 4340 temper use a thinner wall than the stronger one', () => {
    const soft = FRACTURE_ALLOYS.find((a) => a.id === '4340-425')!;
    const hard = FRACTURE_ALLOYS.find((a) => a.id === '4340-260')!;
    expect(soft.yieldStrength).toBeLessThan(hard.yieldStrength);
    expect(soft.kic).toBeGreaterThan(hard.kic);
    const tSoft = leakBeforeBreakThickness(soft.kic, 10, 0.5, 1)!;
    const tHard = leakBeforeBreakThickness(hard.kic, 10, 0.5, 1)!;
    expect(tSoft).toBeCloseTo(0.0051409, 7);
    expect(tHard).toBeCloseTo(0.0157080, 7);
    expect(tHard / tSoft).toBeCloseTo((soft.kic / hard.kic) ** 2, 9);
  });

  it('scales as (Y·p·r/K_IC)², so toughness pays twice over', () => {
    const base = leakBeforeBreakThickness(50, 10, 0.5, 1)!;
    expect(leakBeforeBreakThickness(50, 20, 0.5, 1)!).toBeCloseTo(4 * base, 12);
    expect(leakBeforeBreakThickness(50, 10, 1.0, 1)!).toBeCloseTo(4 * base, 12);
    expect(leakBeforeBreakThickness(100, 10, 0.5, 1)!).toBeCloseTo(base / 4, 12);
    expect(leakBeforeBreakThickness(50, 10, 0.5, 2)!).toBeCloseTo(4 * base, 12);
  });

  it('refuses degenerate input rather than returning zero or infinity', () => {
    expect(leakBeforeBreakThickness(0, 10, 0.5, 1)).toBeNull();
    expect(leakBeforeBreakThickness(50, 0, 0.5, 1)).toBeNull();
    expect(leakBeforeBreakThickness(50, 10, 0, 1)).toBeNull();
    expect(leakBeforeBreakThickness(50, 10, 0.5, 0)).toBeNull();
  });

  /**
   * σ = pr/t assumes the hoop stress is uniform through the wall, and this
   * panel's own sliders reach walls where it is not. The secant correction
   * refuses outside its range; this expression had no equivalent, and printed
   * confident numbers past the point where it describes the vessel.
   *
   * Lamé is the oracle: the exact elasticity solution for a thick cylinder,
   * whose bore value the thin-wall form approximates from below.
   */
  describe('the thin-wall assumption behind σ = pr/t', () => {
    it('is Lamé in the limit — the two converge as the wall thins', () => {
      const p = 10;
      const r = 0.5;
      let previous = Infinity;
      for (const ratio of [5, 10, 20, 50, 100, 1000]) {
        const t = r / ratio;
        const thin = hoopStress(p, r, t);
        const thick = lameHoopStress(p, r, t);
        // Thin-wall always under-reads the peak, which is the unsafe direction.
        expect(thin).toBeLessThan(thick);
        const error = (thick - thin) / thin;
        expect(error).toBeLessThan(previous);
        previous = error;
      }
      // …and it really does go to zero, rather than to some floor.
      expect((lameHoopStress(p, r, r / 1e6) - hoopStress(p, r, r / 1e6)) / hoopStress(p, r, r / 1e6))
        .toBeCloseTo(0, 5);
    });

    it('is worth a few per cent at the r/t the module calls the limit', () => {
      expect(THIN_WALL_MIN_RATIO).toBe(10);
      const t = 0.5 / THIN_WALL_MIN_RATIO;
      const thin = hoopStress(10, 0.5, t);
      const thick = lameHoopStress(10, 0.5, t);
      expect(thin).toBeCloseTo(100, 9);
      expect(thick).toBeCloseTo(105.238, 3);
      expect((thick - thin) / thin).toBeCloseTo(0.0524, 4);
    });

    /**
     * The shipped default, which is the case the review found: the panel opens
     * at p = 10 MPa and r = 500 mm, and the 7075-T651 row is a 68 mm wall.
     */
    it('is breached at the shipped defaults, on the 7075 row', () => {
      const p = 10;
      const r = 0.5;
      const Y = 1;
      const ratios = Object.fromEntries(
        FRACTURE_ALLOYS.map((a) => {
          const t = leakBeforeBreakThickness(a.kic, p, r, Y)!;
          return [a.id, r / t];
        }),
      );
      const t7075 = leakBeforeBreakThickness(
        FRACTURE_ALLOYS.find((a) => a.id.startsWith('7075'))!.kic,
        p,
        r,
        Y,
      )!;
      expect(t7075 * 1000).toBeCloseTo(68.2, 1);
      expect(ratios['7075']).toBeCloseTo(7.33, 2);
      // Thin-wall reads 73 MPa where Lamé's bore value is 79.
      expect(hoopStress(p, r, t7075)).toBeCloseTo(73.3, 1);
      expect(lameHoopStress(p, r, t7075)).toBeCloseTo(78.66, 2);
      // Which rows are marked, and which are not — a guard that flagged
      // everything or nothing would pass a weaker assertion than this.
      const breached = Object.entries(ratios)
        .filter(([, v]) => v < THIN_WALL_MIN_RATIO)
        .map(([id]) => id)
        .sort();
      expect(breached).toEqual(['7075']);
      // 2024 is the next nearest and still clear, at r/t 16.5.
      expect(ratios['2024']).toBeCloseTo(16.5, 1);
    });

    /**
     * The far corner of the two sliders, where the figure stops meaning
     * anything at all: p = 40 MPa, r = 2000 mm.
     */
    it('is breached grossly at the far end of the sliders', () => {
      const t = leakBeforeBreakThickness(
        FRACTURE_ALLOYS.find((a) => a.id.startsWith('7075'))!.kic,
        40,
        2,
        1,
      )!;
      expect(t * 1000).toBeCloseTo(17453, 0);
      // A 17 m wall on a 2 m bore: r/t is 0.11, and the thin-wall stress it is
      // derived from is 4.6 MPa against Lamé's 40.9 — nine times out.
      expect(2 / t).toBeCloseTo(0.115, 3);
      expect(hoopStress(40, 2, t)).toBeCloseTo(4.6, 1);
      expect(lameHoopStress(40, 2, t)).toBeCloseTo(40.85, 2);
    });
  });
});

