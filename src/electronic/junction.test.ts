import { describe, expect, it } from 'vitest';
import {
  HALL_SINGLE_CARRIER_MARGIN,
  Q,
  T_REF,
  biasedDepletionWidth,
  builtInPotential,
  carriers,
  carriersFromHall,
  conductivity,
  diodeCurrentRatio,
  hallCarrierType,
  hallCoefficient,
  hallSingleCarrierValid,
  hallVoltage,
  intrinsicCarriers,
  millivoltsPerDecade,
  minorityShare,
  rectificationRatio,
  saturationCurrentRatio,
  thermalVoltage,
} from './model';
import { SEMICONDUCTORS } from './materials';
import type { Carriers } from './model';

const si = SEMICONDUCTORS.find((s) => s.id === 'si')!;
const ge = SEMICONDUCTORS.find((s) => s.id === 'ge')!;

describe('the diode, normalised', () => {
  it('is zero at zero bias, and −1 deep in reverse', () => {
    expect(diodeCurrentRatio(0, T_REF)).toBe(0);
    expect(diodeCurrentRatio(-1, T_REF)).toBeCloseTo(-1, 12);
  });

  /**
   * The slope carries no material property whatsoever — it is 2.303·kT/q, the
   * same for every diode ever made at the same temperature. Roughly 60 mV per
   * decade at room temperature is the number to recognise.
   */
  it('slopes at 2.303 kT/q — about 60 mV per decade at 300 K', () => {
    expect(millivoltsPerDecade(T_REF)).toBeCloseTo(59.5, 1);
    // And it is a temperature measurement, not a device constant.
    expect(millivoltsPerDecade(600) / millivoltsPerDecade(300)).toBeCloseTo(2, 12);
  });

  it('has a slope that really is the decade slope of the current', () => {
    const V = 0.4;
    const dV = millivoltsPerDecade(T_REF) / 1000;
    expect(
      Math.log10(diodeCurrentRatio(V + dV, T_REF) / diodeCurrentRatio(V, T_REF)),
    ).toBeCloseTo(1, 6);
  });

  /**
   * (eˣ − 1)/(1 − e⁻ˣ) = eˣ exactly, so the rectification ratio is a pure
   * exponential with no approximation anywhere in it.
   */
  it.each([0.1, 0.3, 0.5, 0.7])('rectifies exactly exp(V/V_T) at ±%s V', (V) => {
    const fwd = diodeCurrentRatio(V, T_REF);
    const rev = diodeCurrentRatio(-V, T_REF);
    expect(fwd / -rev).toBeCloseTo(rectificationRatio(V, T_REF), 6);
  });

  /**
   * "0.7 V for silicon, 0.3 V for germanium" is not a fact about silicon. It
   * follows from I_S ∝ n_i², and germanium's n_i is about a thousand times
   * larger, so it conducts measurably at a far lower bias.
   */
  it('explains the silicon/germanium turn-on gap from n_i alone', () => {
    const ratio = saturationCurrentRatio(ge.carriers!.ni300, si.carriers!.ni300);
    expect(ratio).toBeGreaterThan(1e5);
    // The bias difference that ratio is worth, at room temperature.
    const shift = thermalVoltage(T_REF) * Math.log(ratio);
    expect(shift).toBeGreaterThan(0.25);
    expect(shift).toBeLessThan(0.55);
  });

  it('narrows the depletion region in forward bias and widens it in reverse', () => {
    const ni = intrinsicCarriers(si.carriers!.ni300, si.Eg, T_REF);
    const Vbi = builtInPotential(1e23, 1e23, ni, T_REF);
    const W0 = biasedDepletionWidth(Vbi, 0, 1e23, 1e23, si.carriers!.epsR);
    expect(biasedDepletionWidth(Vbi, 0.3, 1e23, 1e23, si.carriers!.epsR)).toBeLessThan(W0);
    expect(biasedDepletionWidth(Vbi, -5, 1e23, 1e23, si.carriers!.epsR)).toBeGreaterThan(W0);
  });

  it('refuses to describe a junction whose barrier the bias has removed', () => {
    const ni = intrinsicCarriers(si.carriers!.ni300, si.Eg, T_REF);
    const Vbi = builtInPotential(1e23, 1e23, ni, T_REF);
    expect(biasedDepletionWidth(Vbi, Vbi + 0.1, 1e23, 1e23, si.carriers!.epsR)).toBe(0);
  });
});

describe('the Hall effect', () => {
  const mu_e = si.mu_e;
  const mu_h = si.mu_h!;
  const ni = intrinsicCarriers(si.carriers!.ni300, si.Eg, T_REF);

  /**
   * The measurement the panel is for: dope it, measure it, get the doping
   * back. Closing that loop is the strongest form of the argument.
   */
  it.each([1e21, 1e22, 1e23])('recovers a donor doping of %s from the voltage', (Nd) => {
    const c = carriers(ni, Nd, 0);
    const R = hallCoefficient(c, mu_e, mu_h);
    const V = hallVoltage(R, 0.01, 0.5, 5e-4);
    expect(carriersFromHall(V, 0.01, 0.5, 5e-4)!).toBeCloseTo(Nd, -Math.log10(Nd) + 3);
  });

  /**
   * Conductivity alone cannot tell n-type from p-type: two samples matched for
   * σ are indistinguishable until you put them in a field. This asserts both
   * halves — that σ matches, and that the Hall sign still separates them.
   */
  it('tells n-type from p-type where conductivity cannot', () => {
    const n = carriers(ni, 1e22, 0);
    // Doping chosen so the two conductivities match.
    const p = carriers(ni, 0, (1e22 * mu_e) / mu_h);
    expect(conductivity(n, mu_e, mu_h)).toBeCloseTo(conductivity(p, mu_e, mu_h), 6);

    const Rn = hallCoefficient(n, mu_e, mu_h);
    const Rp = hallCoefficient(p, mu_e, mu_h);
    expect(hallCarrierType(Rn)).toBe('n');
    expect(hallCarrierType(Rp)).toBe('p');
    expect(Math.sign(hallVoltage(Rn, 0.01, 0.5, 5e-4))).toBe(
      -Math.sign(hallVoltage(Rp, 0.01, 0.5, 5e-4)),
    );
  });

  /**
   * Intrinsic silicon has n = p and a *negative* Hall coefficient, because the
   * sign follows mobility rather than count and electrons are the more mobile
   * carrier. A 1/(pq) model cannot produce this.
   */
  it('gives intrinsic material a negative coefficient despite n = p', () => {
    const c = carriers(ni, 0, 0);
    expect(c.n).toBeCloseTo(c.p, 0);
    expect(mu_e).toBeGreaterThan(mu_h);
    expect(hallCoefficient(c, mu_e, mu_h)).toBeLessThan(0);
  });

  /**
   * The magnitude near intrinsic, not only the sign. Every other magnitude
   * assertion here is in the extrinsic limit, where the two-carrier form and
   * 1/(nq) coincide — so replacing the denominator's σ² with (σ_p − σ_n)²
   * left them all green while making R_H 4.5× too small at intrinsic and
   * infinite wherever σ_p = σ_n, which is a reachable p-type state.
   *
   * At n = p the two-carrier form collapses to a closed form that shares no
   * algebra with the implementation:
   *
   *     R_H = (μ_h − μ_e) / (q·n_i·(μ_h + μ_e))
   */
  it('has the right magnitude at intrinsic, where 1/(nq) does not apply', () => {
    const c = carriers(ni, 0, 0);
    const closed = (mu_h - mu_e) / (Q * ni * (mu_h + mu_e));
    // Relative: R_H is order 10², so an absolute tolerance would be either
    // vacuous or unmeetable.
    expect(hallCoefficient(c, mu_e, mu_h) / closed).toBeCloseTo(1, 12);
    // And it is nowhere near the single-carrier value, so this is a real check.
    expect(Math.abs(hallCoefficient(c, mu_e, mu_h) / (1 / (Q * ni)))).toBeLessThan(0.5);
  });

  /** Finite everywhere the sliders reach, including where σ_p = σ_n. */
  it('stays finite where the two conductivities are equal', () => {
    // p·μ_h = n·μ_e with n·p = n_i²  ⇒  p = n_i·√(μ_e/μ_h).
    const p = ni * Math.sqrt(mu_e / mu_h);
    const balanced = { n: (ni * ni) / p, p };
    expect(Number.isFinite(hallCoefficient(balanced, mu_e, mu_h))).toBe(true);
    expect(Math.abs(hallCoefficient(balanced, mu_e, mu_h))).toBeGreaterThan(0);
  });

  /**
   * The margin is a constant the panel's refusal turns on, so it is pinned and
   * so is the behaviour either side of it. Tightening it 100× left every test
   * green before.
   */
  it('refuses exactly at the margin it declares', () => {
    expect(HALL_SINGLE_CARRIER_MARGIN).toBe(0.05);
    // Walk doping until the share crosses the margin, then check both sides.
    let below: Carriers | null = null;
    let above: Carriers | null = null;
    for (let e = 15; e <= 26; e += 0.01) {
      const c = carriers(ni, 10 ** e, 0);
      const share = minorityShare(c, mu_e, mu_h);
      if (share > HALL_SINGLE_CARRIER_MARGIN) above = c;
      else if (below == null) below = c;
    }
    expect(above).not.toBeNull();
    expect(below).not.toBeNull();
    expect(hallSingleCarrierValid(above!, mu_e, mu_h)).toBe(false);
    expect(hallSingleCarrierValid(below!, mu_e, mu_h)).toBe(true);
    expect(minorityShare(below!, mu_e, mu_h)).toBeLessThanOrEqual(HALL_SINGLE_CARRIER_MARGIN);
    expect(minorityShare(above!, mu_e, mu_h)).toBeGreaterThan(HALL_SINGLE_CARRIER_MARGIN);
  });

  it('refuses the single-carrier reading near intrinsic, and allows it when doped', () => {
    expect(hallSingleCarrierValid(carriers(ni, 0, 0), mu_e, mu_h)).toBe(false);
    expect(hallSingleCarrierValid(carriers(ni, 1e23, 0), mu_e, mu_h)).toBe(true);
  });

  it('has a minority share that runs from a half to nothing as doping rises', () => {
    const intrinsic = minorityShare(carriers(ni, 0, 0), mu_e, mu_h);
    expect(intrinsic).toBeGreaterThan(0.2);
    let prev = intrinsic;
    for (const Nd of [1e18, 1e20, 1e22, 1e24]) {
      const s = minorityShare(carriers(ni, Nd, 0), mu_e, mu_h);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
    expect(prev).toBeLessThan(HALL_SINGLE_CARRIER_MARGIN);
  });

  /** V_H scales with I and B and inversely with thickness — the design levers. */
  it('scales the way the geometry says it should', () => {
    const R = hallCoefficient(carriers(ni, 1e22, 0), mu_e, mu_h);
    expect(hallVoltage(R, 0.02, 0.5, 5e-4)).toBeCloseTo(2 * hallVoltage(R, 0.01, 0.5, 5e-4), 12);
    expect(hallVoltage(R, 0.01, 1.0, 5e-4)).toBeCloseTo(2 * hallVoltage(R, 0.01, 0.5, 5e-4), 12);
    expect(hallVoltage(R, 0.01, 0.5, 1e-3)).toBeCloseTo(0.5 * hallVoltage(R, 0.01, 0.5, 5e-4), 12);
  });

  it('returns nothing rather than a number for a degenerate measurement', () => {
    expect(carriersFromHall(0, 0.01, 0.5, 5e-4)).toBeNull();
    expect(carriersFromHall(1e-3, 0, 0.5, 5e-4)).toBeNull();
    expect(carriersFromHall(1e-3, 0.01, 0.5, 0)).toBeNull();
    expect(hallVoltage(1, 1, 1, 0)).toBe(0);
  });

  /** In the strongly extrinsic limit the two-carrier form reduces to 1/(nq). */
  it('reduces to the textbook single-carrier form when doping dominates', () => {
    const Nd = 1e24;
    const R = hallCoefficient(carriers(ni, Nd, 0), mu_e, mu_h);
    expect(Math.abs(R)).toBeCloseTo(1 / (Nd * Q), 12);
  });
});
