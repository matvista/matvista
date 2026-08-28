import { describe, expect, it } from 'vitest';
import {
  FREEZE_OUT_K, K_B, Q, T_REF, builtInPotential, carriers,
  conductivity, depletionSplit, depletionWidth, fermiOffset, intrinsicCarriers,
  intrinsicOnsetTemp, isDegenerate, isFreezeOut, thermalVoltage,
} from './model';
import { DOPABLE, SEMICONDUCTORS, getSemiconductor } from './materials';

const si = getSemiconductor('si');
const CM3 = 1e6; // m^-3 per cm^-3

describe('thermal energy', () => {
  it('is 0.0259 eV at 300 K — the number every band diagram is scaled by', () => {
    expect(thermalVoltage(300)).toBeCloseTo(0.02585, 5);
  });
  it('is linear in temperature', () => {
    expect(thermalVoltage(600) / thermalVoltage(300)).toBeCloseTo(2, 12);
  });
});

describe('intrinsic carriers', () => {
  it.each(DOPABLE.map((s) => s.id))('%s: reproduces its tabulated 300 K value', (id) => {
    const s = getSemiconductor(id);
    expect(intrinsicCarriers(s.carriers!.ni300, s.Eg, T_REF)).toBeCloseTo(s.carriers!.ni300, 0);
  });

  it('puts silicon at 1.0e10 per cm3 and germanium at 2.4e13', () => {
    expect(getSemiconductor('si').carriers!.ni300 / CM3).toBeCloseTo(1.0e10, -8);
    expect(getSemiconductor('ge').carriers!.ni300 / CM3).toBeCloseTo(2.4e13, -11);
  });

  it('rises steeply with temperature', () => {
    const ni300 = si.carriers!.ni300;
    expect(intrinsicCarriers(ni300, si.Eg, 400)).toBeGreaterThan(
      intrinsicCarriers(ni300, si.Eg, 300) * 100,
    );
  });

  it('is monotone in temperature for every material', () => {
    for (const s of DOPABLE) {
      let prev = -1;
      for (let T = 100; T <= 800; T += 10) {
        const ni = intrinsicCarriers(s.carriers.ni300, s.Eg, T);
        expect(ni).toBeGreaterThan(prev);
        prev = ni;
      }
    }
  });

  /** The whole reason silicon beat germanium. */
  it('gives a narrower gap more intrinsic carriers at the same temperature', () => {
    const ge = getSemiconductor('ge');
    expect(ge.carriers!.ni300).toBeGreaterThan(si.carriers!.ni300);
    expect(ge.Eg).toBeLessThan(si.Eg);
  });

  /**
   * An Arrhenius plot of n_i is *nearly* a straight line of slope −Eg/2k, but
   * not exactly: the T^{3/2} density-of-states prefactor contributes a further
   * −1.5·T, which is 13% of the total for silicon around 550 K. Asserting the
   * clean −Eg/2k would have been asserting the approximation rather than the
   * model — this checks both terms.
   */
  it('has an Arrhenius slope of −Eg/2k, plus the T^{3/2} prefactor term', () => {
    const ni300 = si.carriers!.ni300;
    const T1 = 500, T2 = 600;
    const slope =
      (Math.log(intrinsicCarriers(ni300, si.Eg, T2)) - Math.log(intrinsicCarriers(ni300, si.Eg, T1))) /
      (1 / T2 - 1 / T1);
    const Tmean = (T1 + T2) / 2;
    expect(slope).toBeCloseTo(-si.Eg / (2 * K_B) - 1.5 * Tmean, -2);
    // and the gap term dominates, which is why the plot reads as a straight line
    expect(Math.abs(-si.Eg / (2 * K_B))).toBeGreaterThan(Math.abs(1.5 * Tmean) * 5);
  });
});

describe('carrier concentrations obey both governing equations', () => {
  const ni = si.carriers!.ni300;

  it('gives n = p = n_i with no doping', () => {
    const c = carriers(ni, 0, 0);
    expect(c.n).toBeCloseTo(ni, 0);
    expect(c.p).toBeCloseTo(ni, 0);
  });

  it('always satisfies the mass-action law n·p = n_i²', () => {
    for (const Nd of [0, 1e18, 1e20, 1e22, 1e24]) {
      for (const Na of [0, 1e18, 1e21, 1e23]) {
        const c = carriers(ni, Nd, Na);
        expect(Math.log10(c.n * c.p)).toBeCloseTo(Math.log10(ni * ni), 6);
      }
    }
  });

  it('always satisfies charge neutrality n − p = N_d − N_a', () => {
    for (const [Nd, Na] of [[1e21, 0], [0, 1e21], [1e21, 3e20], [5e20, 5e20]]) {
      const c = carriers(ni, Nd, Na);
      // Relative, not absolute: at 10²¹ carriers an absolute tolerance of 0.5
      // is asking for exactness a double cannot carry.
      const net = Nd - Na;
      if (net === 0) expect(c.n - c.p).toBeCloseTo(0, 0);
      else expect((c.n - c.p) / net).toBeCloseTo(1, 9);
    }
  });

  it('makes n ≈ N_d once doping dwarfs n_i', () => {
    const c = carriers(ni, 1e21, 0);
    expect(c.n / 1e21).toBeCloseTo(1, 6);
  });

  it('compensates: equal donors and acceptors leave it intrinsic', () => {
    const c = carriers(ni, 1e21, 1e21);
    expect(c.n).toBeCloseTo(ni, 0);
    expect(c.p).toBeCloseTo(ni, 0);
  });

  it('never returns a negative concentration', () => {
    for (const Nd of [0, 1e15, 1e24]) {
      for (const Na of [0, 1e15, 1e24]) {
        const c = carriers(ni, Nd, Na);
        expect(c.n).toBeGreaterThan(0);
        expect(c.p).toBeGreaterThan(0);
      }
    }
  });
});

describe('conductivity', () => {
  /**
   * Callister tabulates intrinsic sigma to one significant figure. Recomputing
   * from n_i and the mobilities should land in the same neighbourhood — that
   * agreement is the check, not an exact match.
   */
  it.each([
    ['si', 4e-4],
    ['ge', 2.2],
    ['insb', 2e4],
  ])('%s: computed intrinsic σ is within 3× of the tabulated %s', (id, tabulated) => {
    const s = getSemiconductor(id);
    const ni = s.carriers!.ni300;
    const computed = conductivity({ n: ni, p: ni }, s.mu_e, s.mu_h!);
    const ratio = computed / (tabulated as number);
    expect(ratio).toBeGreaterThan(1 / 3);
    expect(ratio).toBeLessThan(3);
  });

  it('rises with doping', () => {
    const ni = si.carriers!.ni300;
    const intrinsic = conductivity(carriers(ni, 0, 0), si.mu_e, si.mu_h!);
    const doped = conductivity(carriers(ni, 1e21, 0), si.mu_e, si.mu_h!);
    expect(doped).toBeGreaterThan(intrinsic * 1e4);
  });

  it('is higher for n-type than p-type at equal doping, where μ_e > μ_h', () => {
    const ni = si.carriers!.ni300;
    const n = conductivity(carriers(ni, 1e21, 0), si.mu_e, si.mu_h!);
    const p = conductivity(carriers(ni, 0, 1e21), si.mu_e, si.mu_h!);
    expect(n).toBeGreaterThan(p);
    expect(n / p).toBeCloseTo(si.mu_e / si.mu_h!, 1);
  });
});

describe('Fermi level', () => {
  const ni = si.carriers!.ni300;
  it('sits at the intrinsic level when undoped', () => {
    expect(fermiOffset(ni, ni, 300)).toBeCloseTo(0, 12);
  });
  it('moves up for n-type and down for p-type', () => {
    expect(fermiOffset(carriers(ni, 1e21, 0).n, ni, 300)).toBeGreaterThan(0);
    expect(fermiOffset(carriers(ni, 0, 1e21).n, ni, 300)).toBeLessThan(0);
  });
  it('shifts by kT per factor of e in carriers', () => {
    expect(fermiOffset(ni * Math.E, ni, 300)).toBeCloseTo(K_B * 300, 12);
  });
  it('stays inside the gap for non-degenerate doping', () => {
    const off = fermiOffset(carriers(ni, 1e23, 0).n, ni, 300);
    expect(Math.abs(off)).toBeLessThan(si.Eg / 2);
  });
});

describe('the p–n junction', () => {
  const ni = si.carriers!.ni300;

  /** The standard worked value for symmetric 1e17 cm^-3 silicon. */
  it('gives 0.83 V built-in potential for Si doped 1e17/1e17', () => {
    const V = builtInPotential(1e17 * CM3, 1e17 * CM3, ni, 300);
    expect(V).toBeCloseTo(0.83, 2);
  });

  it('gives about 0.15 µm depletion width for that junction', () => {
    const V = builtInPotential(1e17 * CM3, 1e17 * CM3, ni, 300);
    const W = depletionWidth(V, 1e17 * CM3, 1e17 * CM3, si.carriers!.epsR);
    expect(W * 1e6).toBeCloseTo(0.15, 1);
  });

  it('raises the built-in potential with doping, by kT per decade of product', () => {
    const a = builtInPotential(1e16 * CM3, 1e16 * CM3, ni, 300);
    const b = builtInPotential(1e17 * CM3, 1e17 * CM3, ni, 300);
    expect(b - a).toBeCloseTo(2 * K_B * 300 * Math.LN10, 6);
  });

  /**
   * V_bi cannot exceed the gap — the Fermi levels cannot be separated by more
   * than that. Wherever the formula says otherwise, the doping has gone
   * degenerate and the Boltzmann form no longer applies.
   */
  it('stays below the band gap wherever the model is non-degenerate', () => {
    for (const s of DOPABLE) {
      for (const dopeCm3 of [1e15, 1e16, 1e17, 1e18, 1e19]) {
        const dope = dopeCm3 * CM3;
        const c = carriers(s.carriers.ni300, dope, 0);
        const offset = fermiOffset(c.n, s.carriers.ni300, 300);
        if (isDegenerate(offset, s.Eg, 300)) continue;
        const V = builtInPotential(dope, dope, s.carriers.ni300, 300);
        expect(V).toBeLessThan(s.Eg);
      }
    }
  });

  /**
   * And the converse: where the formula does exceed the gap, the degeneracy
   * flag must already have fired. GaAs at 10¹⁹/10¹⁹ returns 1.51 V against a
   * 1.42 eV gap; InSb, with a 0.17 eV gap, breaks a whole decade earlier — the
   * case a flat "10¹⁹ cm⁻³" threshold would have missed.
   */
  it.each([['gaas', 1e19], ['insb', 1e18]])(
    '%s at %s per cm3: the impossible answer is flagged degenerate',
    (id, dopeCm3) => {
      const s = getSemiconductor(id as string);
      const dope = (dopeCm3 as number) * CM3;
      const V = builtInPotential(dope, dope, s.carriers!.ni300, 300);
      expect(V).toBeGreaterThan(s.Eg);
      const c = carriers(s.carriers!.ni300, dope, 0);
      expect(isDegenerate(fermiOffset(c.n, s.carriers!.ni300, 300), s.Eg, 300)).toBe(true);
    },
  );

  /** The depletion region spreads into the lightly doped side. */
  it('puts most of the depletion width on the lighter side', () => {
    const Na = 1e16 * CM3, Nd = 1e18 * CM3;
    const V = builtInPotential(Na, Nd, ni, 300);
    const W = depletionWidth(V, Na, Nd, si.carriers!.epsR);
    const { xp, xn } = depletionSplit(W, Na, Nd);
    expect(xp).toBeGreaterThan(xn);
    expect(xp / xn).toBeCloseTo(Nd / Na, 0);
    expect(xp + xn).toBeCloseTo(W, 12);
  });

  it('narrows as doping rises', () => {
    const light = depletionWidth(builtInPotential(1e15 * CM3, 1e15 * CM3, ni, 300), 1e15 * CM3, 1e15 * CM3, 11.7);
    const heavy = depletionWidth(builtInPotential(1e18 * CM3, 1e18 * CM3, ni, 300), 1e18 * CM3, 1e18 * CM3, 11.7);
    expect(heavy).toBeLessThan(light);
  });
});

describe('domain boundaries are flagged, not ignored', () => {
  it('calls silicon degenerate near 1e19 per cm3 but not at 1e18', () => {
    const ni = si.carriers!.ni300;
    const off = (cm3: number) => fermiOffset(carriers(ni, cm3 * CM3, 0).n, ni, 300);
    expect(isDegenerate(off(1e19), si.Eg, 300)).toBe(true);
    expect(isDegenerate(off(1e18), si.Eg, 300)).toBe(false);
  });

  it('calls narrow-gap InSb degenerate a decade earlier than silicon', () => {
    const insb = getSemiconductor('insb');
    const ni = insb.carriers!.ni300;
    const off = fermiOffset(carriers(ni, 1e18 * CM3, 0).n, ni, 300);
    expect(isDegenerate(off, insb.Eg, 300)).toBe(true);
  });
  it('calls it freeze-out below 100 K', () => {
    expect(isFreezeOut(FREEZE_OUT_K - 1)).toBe(true);
    expect(isFreezeOut(300)).toBe(false);
  });

  /** Where the extrinsic plateau ends — the practical temperature ceiling. */
  it('finds the intrinsic onset, and puts germanium’s far below silicon’s', () => {
    const ge = getSemiconductor('ge');
    const tSi = intrinsicOnsetTemp(si.carriers!.ni300, si.Eg, 1e17 * CM3)!;
    const tGe = intrinsicOnsetTemp(ge.carriers!.ni300, ge.Eg, 1e17 * CM3)!;
    expect(tGe).toBeLessThan(tSi);
    expect(tSi).toBeGreaterThan(400);
  });

  it('returns the onset temperature where n_i really does equal the doping', () => {
    const target = 1e17 * CM3;
    const T = intrinsicOnsetTemp(si.carriers!.ni300, si.Eg, target)!;
    expect(intrinsicCarriers(si.carriers!.ni300, si.Eg, T) / target).toBeCloseTo(1, 2);
  });

  it('returns null when the doping is never reached', () => {
    expect(intrinsicOnsetTemp(si.carriers!.ni300, si.Eg, 1e30)).toBeNull();
  });
});

describe('the dataset fences its own domain', () => {
  it('offers carrier data only where both n_i and hole mobility are known', () => {
    for (const s of DOPABLE) {
      expect(s.carriers).not.toBeNull();
      expect(s.mu_h).not.toBeNull();
    }
    // The wide-gap compounds are band-gap comparison only.
    for (const id of ['gap', 'cds', 'znte']) {
      expect(DOPABLE.some((s) => s.id === id)).toBe(false);
    }
  });

  it('has a positive gap and electron mobility for every entry', () => {
    for (const s of SEMICONDUCTORS) {
      expect(s.Eg).toBeGreaterThan(0);
      expect(s.mu_e).toBeGreaterThan(0);
    }
  });

  it('keeps Q and the gap ordering sane', () => {
    expect(Q).toBeCloseTo(1.602e-19, 22);
    const byGap = [...SEMICONDUCTORS].sort((a, b) => a.Eg - b.Eg);
    expect(byGap[0].id).toBe('insb');
    expect(byGap[byGap.length - 1].id).toBe('cds');
  });
});
