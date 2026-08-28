import { describe, expect, it } from 'vitest';
import {
  DIFFUSION_SYSTEMS, concentrationAt, depthForConcentration, diffusionCoefficient,
  erf, siteDensity, vacancyFraction,
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
