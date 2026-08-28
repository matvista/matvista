import { describe, expect, it } from 'vitest';
import {
  criticalCrackSize, criticalStress, cyclesToFailure, fatigueStrength, fitSn,
  griffithCrackLength, griffithStress, growthRate, larsonMiller, parisLife,
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
