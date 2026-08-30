import { describe, expect, it } from 'vitest';
import {
  DIFFUSION_SYSTEMS, concentrationAt, depthForConcentration, diffusionCoefficient,
  dtForTarget, equalDtCurve, equalDtOptions, erf, erfInverse, siteDensity, timeForTarget,
  vacancyFraction,
  activationFromPair,
} from './model';

describe('carburising (Callister ex. 5.4)', () => {
  // 0.25 wt% C steel, surface held at 1.20 wt%, D = 1.6e-11 m²/s.
  // 0.80 wt% C at 0.5 mm takes about 7 hours.
  const D = 1.6e-11;
  const t = 7 * 3600;

  it('reaches 0.80 wt% C at 0.5 mm after 7 h', () => {
    expect(concentrationAt(5e-4, t, D, 0.25, 1.2)).toBeCloseTo(0.8, 2);
  });

  it('inverts to the same depth', () => {
    expect(depthForConcentration(0.8, t, D, 0.25, 1.2)! * 1000).toBeCloseTo(0.5, 2);
  });

  it('holds the surface at Cs and the interior at C0', () => {
    // Tolerance follows the erf approximation's own documented bound (max
    // absolute error 1.5e-7, Abramowitz & Stegun 7.1.26) — the surface value
    // comes back as 1.19999999905, which is the approximation, not a defect.
    expect(concentrationAt(0, t, D, 0.25, 1.2)).toBeCloseTo(1.2, 6);
    expect(concentrationAt(0.05, t, D, 0.25, 1.2)).toBeCloseTo(0.25, 6);
  });

  it('falls monotonically with depth', () => {
    let prev = Infinity;
    for (let x = 0; x < 2e-3; x += 2e-5) {
      const c = concentrationAt(x, t, D, 0.25, 1.2);
      expect(c).toBeLessThanOrEqual(prev + 1e-12);
      prev = c;
    }
  });

  it('returns null for a target outside (C0, Cs)', () => {
    expect(depthForConcentration(0.2, t, D, 0.25, 1.2)).toBeNull();
    expect(depthForConcentration(1.5, t, D, 0.25, 1.2)).toBeNull();
  });
});

describe('the error function', () => {
  it.each([
    [0, 0],
    [0.25, 0.2763],
    [0.5, 0.5205],
    [1, 0.8427],
    [2, 0.9953],
  ])('erf(%s) = %s', (x, expected) => {
    expect(erf(x)).toBeCloseTo(expected, 3);
  });
  it('is odd', () => expect(erf(-0.7)).toBeCloseTo(-erf(0.7), 12));
});

describe('Arrhenius diffusivity', () => {
  it.each(DIFFUSION_SYSTEMS.map((s) => s.id))('%s rises with temperature', (id) => {
    const sys = DIFFUSION_SYSTEMS.find((s) => s.id === id)!;
    expect(diffusionCoefficient(sys, 1200)).toBeGreaterThan(diffusionCoefficient(sys, 800));
  });

  it('makes interstitial carbon ~9 orders faster than iron self-diffusion at 500 °C', () => {
    const c = DIFFUSION_SYSTEMS.find((s) => s.id === 'c-fe-bcc')!;
    const fe = DIFFUSION_SYSTEMS.find((s) => s.id === 'fe-fe-bcc')!;
    const ratio = diffusionCoefficient(c, 773) / diffusionCoefficient(fe, 773);
    expect(Math.log10(ratio)).toBeGreaterThan(8);
    expect(Math.log10(ratio)).toBeLessThan(10);
  });

  it('costs more activation energy in FCC than BCC for the same interstitial', () => {
    const bcc = DIFFUSION_SYSTEMS.find((s) => s.id === 'c-fe-bcc')!;
    const fcc = DIFFUSION_SYSTEMS.find((s) => s.id === 'c-fe-fcc')!;
    expect(fcc.Qd).toBeGreaterThan(bcc.Qd);
  });
});

describe('vacancies', () => {
  it('rises with temperature and is negligible cold', () => {
    expect(vacancyFraction(0.9, 1300)).toBeGreaterThan(vacancyFraction(0.9, 300));
    expect(vacancyFraction(0.9, 300)).toBeLessThan(1e-14);
  });
  it('is about 1 site in 10 000 just below melting for a 0.9 eV metal', () => {
    const f = vacancyFraction(0.9, 1350);
    expect(f).toBeGreaterThan(1e-5);
    expect(f).toBeLessThan(1e-3);
  });
  it('counts sites by Callister eq. 4.2', () => {
    // N = N_A·rho/A; copper: 6.022e23 * 8.94 g/cm3 * 1e6 cm3/m3 / 63.55 g/mol
    expect(siteDensity(8.94, 63.55)).toBeCloseTo(8.47e28, -27);
  });
});

/**
 * M2 — the equal-Dt locus.
 *
 * For a fixed concentration at a fixed depth, x/2√(Dt) is a constant, so Dt is
 * a constant: the profile does not care about temperature and time separately,
 * only about their product through D. That invariance is what students almost
 * never extract from the erf solution, and it is what makes
 * "1000 °C for 7 h ≡ 1100 °C for 2.53 h" a calculation rather than a slogan.
 *
 * An earlier version of this line said 1.4 h, which is not this model's
 * answer and is not consistent with the rest of the file: with the shipped
 * Qd = 148 000 J/mol, D(1373.15)/D(1273.15) is 2.7697, so 7 h becomes 2.527 h.
 * A ratio of 5 would need about 1165 °C, and 1.4 h also contradicts the
 * 3.295x-per-100-°C figure asserted thirty lines below. The equivalences are
 * computed below now rather than quoted.
 */
describe('inverse error function', () => {
  it.each([0, 0.2763, 0.5205, 0.8427, 0.9953])('round-trips erf at %s', (y) => {
    expect(erf(erfInverse(y)!)).toBeCloseTo(y, 6);
  });

  it('inverts erf over its whole open range', () => {
    for (let z = 0.01; z < 3; z += 0.01) {
      expect(erfInverse(erf(z))!).toBeCloseTo(z, 5);
    }
  });

  it('refuses arguments outside (−1, 1)', () => {
    expect(erfInverse(1)).toBeNull();
    expect(erfInverse(-1)).toBeNull();
    expect(erfInverse(1.5)).toBeNull();
  });
});

describe('the equal-Dt process curve', () => {
  // Callister ex. 5.4 again: 0.25 wt% C steel, surface 1.20 wt%, and the
  // question "how long to reach 0.80 wt% at 0.5 mm" — answered there at
  // D = 1.6e-11 m²/s in about 7 hours.
  const C0 = 0.25;
  const Cs = 1.2;
  const target = 0.8;
  const x = 5e-4;
  const D = 1.6e-11;

  it('reproduces Callister’s 7 hours from the inversion', () => {
    const t = timeForTarget(target, x, D, C0, Cs)!;
    expect(t).not.toBeNull();
    expect(t / 3600).toBeCloseTo(7, 1);
  });

  it('agrees with the forward solution it inverts', () => {
    const t = timeForTarget(target, x, D, C0, Cs)!;
    expect(concentrationAt(x, t, D, C0, Cs)).toBeCloseTo(target, 6);
  });

  it('depends on D and t only through their product', () => {
    const Dt = dtForTarget(target, x, C0, Cs)!;
    for (const factor of [0.1, 0.5, 2, 10, 100]) {
      expect(timeForTarget(target, x, D * factor, C0, Cs)!).toBeCloseTo(Dt / (D * factor), 12);
      // …and the profile really is unchanged
      expect(
        concentrationAt(x, Dt / (D * factor), D * factor, C0, Cs),
      ).toBeCloseTo(target, 6);
    }
  });

  it('holds Dt constant along the whole returned curve', () => {
    const sys = DIFFUSION_SYSTEMS.find((s) => s.id === 'c-fe-fcc')!;
    const curve = equalDtCurve(sys, target, x, C0, Cs, 400, 1200, 80);
    expect(curve).not.toBeNull();
    expect(curve!.points.length).toBe(81);
    for (const p of curve!.points) {
      const D_T = diffusionCoefficient(sys, p.tempC + 273.15);
      expect(D_T * p.seconds).toBeCloseTo(curve!.dt, 9);
      // and every point on it genuinely hits the target
      expect(concentrationAt(x, p.seconds, D_T, C0, Cs)).toBeCloseTo(target, 6);
    }
  });

  it('falls monotonically with temperature — hotter is always quicker', () => {
    const sys = DIFFUSION_SYSTEMS.find((s) => s.id === 'c-fe-fcc')!;
    const curve = equalDtCurve(sys, target, x, C0, Cs, 400, 1200, 80)!;
    for (let i = 1; i < curve.points.length; i++) {
      expect(curve.points[i].seconds).toBeLessThan(curve.points[i - 1].seconds);
    }
  });

  /**
   * The prose the module already asserts — "heating is a far more powerful
   * lever than waiting" — as a number. 100 °C buys back most of an order of
   * magnitude for carbon in γ-iron.
   */
  it('makes 100 °C worth 3.3× the time for carbon in γ-iron', () => {
    const sys = DIFFUSION_SYSTEMS.find((s) => s.id === 'c-fe-fcc')!;
    const at = (T: number) =>
      timeForTarget(target, x, diffusionCoefficient(sys, T + 273.15), C0, Cs)!;
    const ratio = at(900) / at(1000);
    // Independently, straight from Arrhenius: the time ratio is D(1273)/D(1173)
    // = exp[(Qd/R)(1/1173 − 1/1273)], which the inversion must not disturb.
    const closedForm = Math.exp((sys.Qd / 8.31) * (1 / 1173.15 - 1 / 1273.15));
    expect(ratio).toBeCloseTo(closedForm, 9);
    expect(ratio).toBeCloseTo(3.3, 1);
  });

  /**
   * The two equivalences this module states in prose — one in the describe
   * above, one in the panel's own docstring — computed rather than quoted.
   * Both were wrong when written, so both are pinned now.
   *
   * The ratio is not one number: it is D(T₂)/D(T₁), which falls as the pair
   * moves up the scale. 100 °C is worth 3.295x at 900 -> 1000, 3.006x at
   * 950 -> 1050 and 2.770x at 1000 -> 1100, and that is why a single
   * "100 °C buys you 3x" figure cannot be reused at another temperature.
   */
  it.each([
    [1000, 7, 1100, 2.5273],
    [950, 5, 1050, 1.6636],
  ])('%i °C for %s h is %i °C for %s h', (T1, h1, T2, h2) => {
    const sys = DIFFUSION_SYSTEMS.find((s) => s.id === 'c-fe-fcc')!;
    const D = (T: number) => diffusionCoefficient(sys, T + 273.15);
    // Equal Dt, so the times go inversely as the diffusion coefficients.
    expect((h1 * D(T1)) / D(T2)).toBeCloseTo(h2, 4);
    // …and the profile really is the same one, through the erf solution.
    // Compared as a ratio: h2 above is quoted to four places, which is the
    // precision the prose states, not the precision the model holds to.
    const dt = D(T1) * h1 * 3600;
    expect((D(T2) * h2 * 3600) / dt).toBeCloseTo(1, 4);
    expect(concentrationAt(x, h2 * 3600, D(T2), C0, Cs)).toBeCloseTo(
      concentrationAt(x, h1 * 3600, D(T1), C0, Cs),
      4,
    );
  });

  /**
   * What the 0.5 h snap on the time slider costs, since the panel discloses it
   * in words ("the setting is snapped, the curve is not") without a figure.
   * The 1050 °C chip for a 950 °C / 5 h treatment wants 1.6636 h and sets
   * 1.5 h.
   */
  it('quantifies the snap the equal-Dt chips disclose', () => {
    const sys = DIFFUSION_SYSTEMS.find((s) => s.id === 'c-fe-fcc')!;
    const D = (T: number) => diffusionCoefficient(sys, T + 273.15);
    const want = D(950) * 5 * 3600;
    const got = D(1050) * 1.5 * 3600;
    expect(Math.round(1.6636 / 0.5) * 0.5).toBe(1.5);
    expect(1 - got / want).toBeCloseTo(0.0983, 4);
    // Depth goes as √(Dt), so a 9.8% shortfall in Dt is a 5.0% shallower case.
    expect(1 - Math.sqrt(got / want)).toBeCloseTo(0.0504, 4);
  });

  /**
   * The chips the panel offers, swept over every state the sliders can reach.
   *
   * They used to be built over 500–1200 °C while the temperature slider starts
   * at **400**, and anything wanting a time outside 0.5–40 h was dropped with
   * no fallback — so a reader at the cold end of the curve got an empty list,
   * under prose reading "Every point on that line is the same treatment:"
   * followed by nothing. `?sys=c-fe-fcc&difT=400&h=0.5` is one such state.
   *
   * Sweeping the whole grid rather than the found case: the count is the
   * claim, and it is the count that a later change to the bounds would move.
   */
  describe('the equal-Dt chips a reader can reach', () => {
    const TEMP_MIN = 400;
    const TEMP_MAX = 1200;
    const HOURS_MIN = 0.5;
    const HOURS_MAX = 40;
    /** Chip spacing — round numbers, not the slider's resolution. */
    const STEP = 50;

    /**
     * Every (system, temperature, time) the three controls can be set to: the
     * temperature slider steps 10 °C and the time slider 0.5 h, so this is
     * 7 x 81 x 80 states, not a sample of them. The chip *spacing* stays 50,
     * which is the point — a reader between two chips must still be offered
     * something.
     */
    const sweep = (fromC: number) => {
      let states = 0;
      let empty = 0;
      const emptyKeys: string[] = [];
      for (const sys of DIFFUSION_SYSTEMS) {
        for (let T = TEMP_MIN; T <= TEMP_MAX; T += 10) {
          for (let h = HOURS_MIN; h <= HOURS_MAX + 1e-9; h += 0.5) {
            const D = diffusionCoefficient(sys, T + 273.15);
            const depth = depthForConcentration(target, h * 3600, D, C0, Cs);
            if (depth == null) continue;
            const curve = equalDtCurve(sys, target, depth, C0, Cs, TEMP_MIN, TEMP_MAX);
            if (curve == null) continue;
            states++;
            const opts = equalDtOptions(sys, curve.dt, fromC, TEMP_MAX, STEP, HOURS_MIN, HOURS_MAX);
            if (opts.length === 0) {
              empty++;
              emptyKeys.push(`${sys.id} ${T}°C ${h}h`);
            }
          }
        }
      }
      return { states, empty, emptyKeys };
    };

    it('starting the chips at 500 °C leaves states with nothing to offer', () => {
      const r = sweep(500);
      expect(r.states).toBeGreaterThan(40000);
      expect(r.empty).toBeGreaterThan(0);
      // The state the review named is among them, and it is not alone.
      expect(r.emptyKeys).toContain('c-fe-fcc 400°C 0.5h');
      expect(r.empty).toBeGreaterThan(50);
    });

    it('starting them at the temperature slider’s own floor does not', () => {
      const r = sweep(TEMP_MIN);
      expect(r.states).toBeGreaterThan(40000);
      expect(r.empty, `still empty at: ${r.emptyKeys.slice(0, 5).join(', ')}`).toBe(0);
    });

    /**
     * And the chips are on the curve, not merely inside the sliders: each one
     * must reproduce the same Dt, which is the whole claim the panel makes
     * about them.
     */
    it('offers only settings that really are the same treatment', () => {
      const sys = DIFFUSION_SYSTEMS.find((s) => s.id === 'c-fe-fcc')!;
      const depth = depthForConcentration(
        target,
        5 * 3600,
        diffusionCoefficient(sys, 950 + 273.15),
        C0,
        Cs,
      )!;
      const curve = equalDtCurve(sys, target, depth, C0, Cs, TEMP_MIN, TEMP_MAX)!;
      const opts = equalDtOptions(sys, curve.dt, TEMP_MIN, TEMP_MAX, STEP, HOURS_MIN, HOURS_MAX);
      expect(opts.length).toBeGreaterThan(4);
      for (const o of opts) {
        const D = diffusionCoefficient(sys, o.tempC + 273.15);
        expect(D * o.hours * 3600).toBeCloseTo(curve.dt, 9);
        expect(concentrationAt(depth, o.hours * 3600, D, C0, Cs)).toBeCloseTo(target, 6);
        expect(o.hours).toBeGreaterThanOrEqual(HOURS_MIN);
        expect(o.hours).toBeLessThanOrEqual(HOURS_MAX);
      }
    });
  });

  /**
   * The domain guard that matters. Outside (C0, Cs) there is no solution at
   * any temperature or time, and the curve has to be **absent** rather than
   * clamped — clamping is what hid the out-of-domain computation in
   * iteration 9. Both bounds are reachable from the shipped sliders: the
   * surface-concentration control goes down to 0.40 wt%, below the 0.50 wt%
   * case-hardening target.
   */
  it('has no solution for a target at or outside the two ends', () => {
    expect(dtForTarget(0.25, x, C0, Cs)).toBeNull(); // target = C0
    expect(dtForTarget(0.2, x, C0, Cs)).toBeNull(); // below C0
    expect(dtForTarget(1.2, x, C0, Cs)).toBeNull(); // target = Cs
    expect(dtForTarget(1.5, x, C0, Cs)).toBeNull(); // above Cs
    expect(timeForTarget(0.2, x, D, C0, Cs)).toBeNull();
    const sys = DIFFUSION_SYSTEMS.find((s) => s.id === 'c-fe-fcc')!;
    expect(equalDtCurve(sys, 0.4, x, C0, 0.4, 400, 1200, 10)).toBeNull();
  });

  /**
   * The panel takes its target depth from `depthForConcentration` and then
   * asks `dtForTarget` what Dt that implies. The two are separate numerical
   * inversions of the same equation, so the round trip has to return the Dt it
   * started from — otherwise the curve would not pass through the setting the
   * reader is looking at.
   */
  it('round-trips depthForConcentration back to the same Dt', () => {
    for (const D of [1e-12, 1.6e-11, 5e-11]) {
      for (const hours of [1, 5, 20]) {
        const t = hours * 3600;
        const depth = depthForConcentration(0.5, t, D, C0, Cs)!;
        expect(depth).not.toBeNull();
        expect(dtForTarget(0.5, depth, C0, Cs)!).toBeCloseTo(D * t, 15);
      }
    }
  });

  it('has no solution at zero depth or zero diffusivity', () => {
    expect(dtForTarget(target, 0, C0, Cs)).toBeNull();
    expect(timeForTarget(target, x, 0, C0, Cs)).toBeNull();
  });
});


describe('recovering Q_d and D₀ from two measurements', () => {
  /**
   * The round trip that matters: take two points off a system's own Arrhenius
   * line and the fit must return the tabulated constants exactly. It is a
   * closed-form inversion, not a regression, so "exactly" means floating
   * point rather than a tolerance.
   */
  it.each(DIFFUSION_SYSTEMS.map((s) => s.id))('%s: recovers its tabulated constants', (id) => {
    const sys = DIFFUSION_SYSTEMS.find((s) => s.id === id)!;
    const T1 = 900;
    const T2 = 1300;
    const fit = activationFromPair(
      T1,
      diffusionCoefficient(sys, T1),
      T2,
      diffusionCoefficient(sys, T2),
    )!;
    expect(fit.Qd).toBeCloseTo(sys.Qd, 6);
    expect(fit.D0 / sys.D0).toBeCloseTo(1, 9);
  });

  /** The answer cannot depend on which of the two points is given first. */
  it('is symmetric in its two points', () => {
    const sys = DIFFUSION_SYSTEMS[0];
    const a = activationFromPair(800, diffusionCoefficient(sys, 800), 1200, diffusionCoefficient(sys, 1200))!;
    const b = activationFromPair(1200, diffusionCoefficient(sys, 1200), 800, diffusionCoefficient(sys, 800))!;
    expect(a.Qd).toBeCloseTo(b.Qd, 6);
    expect(a.D0 / b.D0).toBeCloseTo(1, 9);
  });

  /** Widely separated points and close ones describe the same line. */
  it('does not depend on how far apart the two temperatures are', () => {
    const sys = DIFFUSION_SYSTEMS[3];
    const wide = activationFromPair(700, diffusionCoefficient(sys, 700), 1600, diffusionCoefficient(sys, 1600))!;
    const near = activationFromPair(1000, diffusionCoefficient(sys, 1000), 1010, diffusionCoefficient(sys, 1010))!;
    expect(wide.Qd).toBeCloseTo(sys.Qd, 5);
    expect(near.Qd).toBeCloseTo(sys.Qd, 3);
  });

  it('refuses the inputs the line is not defined on', () => {
    // Equal temperatures: the slope is vertical, so ±Infinity...
    expect(activationFromPair(1000, 1e-12, 1000, 1e-13)).toBeNull();
    // ...and NaN when the two measurements are identical as well.
    expect(activationFromPair(1000, 1e-12, 1000, 1e-12)).toBeNull();
    expect(activationFromPair(1000, 0, 1200, 1e-13)).toBeNull();
    expect(activationFromPair(0, 1e-12, 1200, 1e-13)).toBeNull();
    expect(activationFromPair(-100, 1e-12, 1200, 1e-13)).toBeNull();
  });

  /**
   * D₀ is the intercept at 1/T = 0, not a diffusion coefficient anyone
   * measures: every system's D₀ is orders of magnitude above its D at any
   * temperature it is tabulated for.
   */
  it('puts D₀ far above any D the system actually reaches', () => {
    for (const sys of DIFFUSION_SYSTEMS) {
      expect(diffusionCoefficient(sys, 1600)).toBeLessThan(sys.D0);
    }
  });

  /**
   * The two mechanisms separate by slope. Interstitial diffusion needs no
   * vacancy, so its activation energies are the lower family — which is the
   * plot's teaching point, and it is a property of the data rather than of
   * the drawing.
   */
  it('separates the interstitial and vacancy families by activation energy', () => {
    const inter = DIFFUSION_SYSTEMS.filter((s) => s.mechanism === 'interstitial').map((s) => s.Qd);
    const vac = DIFFUSION_SYSTEMS.filter((s) => s.mechanism === 'vacancy').map((s) => s.Qd);
    expect(inter.length).toBeGreaterThan(1);
    expect(vac.length).toBeGreaterThan(1);
    expect(Math.max(...inter)).toBeLessThan(Math.min(...vac));
  });
});
