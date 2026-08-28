/**
 * Semiconductor carrier statistics and the p–n junction.
 * Equations follow Callister & Rethwisch ch. 18 ("Electrical properties").
 *
 * Everything here assumes **non-degenerate, fully ionised** conditions, and
 * both halves of that matter:
 *
 * - *Non-degenerate* means Boltzmann statistics stand in for Fermi–Dirac, which
 *   holds while the Fermi level stays a few kT inside the gap. Above roughly
 *   10¹⁹ cm⁻³ of dopant it does not: the Fermi level enters the band, the
 *   material turns degenerate, and n = N_d stops being true. `isDegenerate`
 *   exists to say so rather than to quietly keep computing.
 * - *Fully ionised* means every dopant atom has given up its carrier. That is a
 *   good approximation around room temperature and a bad one in the cold, where
 *   carriers freeze back onto their donors. `isFreezeOut` marks that end.
 *
 * The band gap is also treated as constant. Real gaps narrow as temperature
 * rises — silicon's by about 0.3 meV/K — so the hot end of any curve here
 * understates n_i. The UI says so; it is not hidden in a comment.
 */

/** Boltzmann constant, eV/K. */
export const K_B = 8.617333e-5;
/** Elementary charge, C. */
export const Q = 1.602177e-19;
/** Permittivity of free space, F/m. */
export const EPS_0 = 8.854188e-12;
/** The temperature the tabulated data is quoted at, K. */
export const T_REF = 300;

/** Thermal energy kT in eV — numerically also kT/q in volts. */
export function thermalVoltage(T: number): number {
  return K_B * T;
}

/**
 * Intrinsic carrier concentration at temperature T, scaled from its tabulated
 * 300 K value:
 *
 *   n_i(T) = n_i(300)·(T/300)^{3/2}·exp[ −(E_g/2k)·(1/T − 1/300) ]
 *
 * The 3/2 power is the density-of-states temperature dependence; the
 * exponential is the Boltzmann factor over half the gap. Anchoring on the
 * published 300 K value avoids depending on effective masses, which are quoted
 * inconsistently across sources.
 *
 * @param ni300 intrinsic concentration at 300 K, m⁻³
 * @param Eg    band gap, eV
 * @param T     temperature, K
 */
export function intrinsicCarriers(ni300: number, Eg: number, T: number): number {
  if (T <= 0) return 0;
  return (
    ni300 *
    (T / T_REF) ** 1.5 *
    Math.exp(-(Eg / (2 * K_B)) * (1 / T - 1 / T_REF))
  );
}

export interface Carriers {
  /** Electron concentration, m⁻³. */
  n: number;
  /** Hole concentration, m⁻³. */
  p: number;
}

/**
 * Electron and hole concentrations from charge neutrality and the mass-action
 * law together (Callister eq. 18.35 and the neutrality condition):
 *
 *   n − p = N_d − N_a       and       n·p = n_i²
 *
 * Solving the pair rather than assuming n = N_d is what makes the answer stay
 * right where doping and n_i are comparable — near intrinsic, or hot enough
 * that n_i has caught up with the doping.
 */
export function carriers(ni: number, Nd: number, Na: number): Carriers {
  const net = Nd - Na;
  const root = Math.sqrt(net * net + 4 * ni * ni);
  // Only one branch of the quadratic is numerically safe. When |net| >> n_i the
  // root is nearly equal to |net|, so whichever of (root + net) and (root − net)
  // subtracts loses almost every significant digit — heavy n-type doping made
  // the hole concentration wrong in the fourth digit and worse beyond it. Take
  // the majority carrier from the addition, which never cancels, and recover the
  // minority from the mass-action law instead.
  if (net > 0) {
    const n = (net + root) / 2;
    return { n, p: (ni * ni) / n };
  }
  if (net < 0) {
    const p = (-net + root) / 2;
    return { n: (ni * ni) / p, p };
  }
  return { n: ni, p: ni };
}

/**
 * Conductivity from both carrier types, Callister eq. 18.13:
 *   σ = n·|e|·μ_e + p·|e|·μ_h
 *
 * @param mu_e electron mobility, m²/V·s
 */
export function conductivity(c: Carriers, mu_e: number, mu_h: number): number {
  return Q * (c.n * mu_e + c.p * mu_h);
}

/**
 * Where the Fermi level sits relative to the intrinsic level, eV:
 *   E_F − E_i = kT·ln(n / n_i)
 * Positive for n-type, negative for p-type.
 */
export function fermiOffset(n: number, ni: number, T: number): number {
  if (n <= 0 || ni <= 0) return 0;
  return K_B * T * Math.log(n / ni);
}

/**
 * Built-in potential of an abrupt p–n junction, V:
 *   V_bi = (kT/q)·ln(N_a·N_d / n_i²)
 */
export function builtInPotential(Na: number, Nd: number, ni: number, T: number): number {
  if (Na <= 0 || Nd <= 0 || ni <= 0) return 0;
  return K_B * T * Math.log((Na * Nd) / (ni * ni));
}

/**
 * Depletion width of an abrupt junction at zero bias, m:
 *   W = √[ (2·ε·V_bi / q)·(1/N_a + 1/N_d) ]
 *
 * The asymmetry is the useful part: the depletion region spreads into the
 * *lightly* doped side, because the same charge needs more volume to find it.
 */
export function depletionWidth(
  Vbi: number,
  Na: number,
  Nd: number,
  epsR: number,
): number {
  if (Na <= 0 || Nd <= 0 || Vbi <= 0) return 0;
  return Math.sqrt(((2 * epsR * EPS_0 * Vbi) / Q) * (1 / Na + 1 / Nd));
}

/** How the depletion width divides between the two sides, m. */
export function depletionSplit(W: number, Na: number, Nd: number): { xp: number; xn: number } {
  const total = Na + Nd;
  if (total <= 0) return { xp: 0, xn: 0 };
  // Charge balance: N_a·x_p = N_d·x_n.
  return { xp: (W * Nd) / total, xn: (W * Na) / total };
}

/* ------------------------------------------------------ domain boundaries */

/**
 * Degeneracy, tested against the physics rather than a fixed concentration.
 *
 * Boltzmann statistics hold while the Fermi level stays a few kT inside the
 * gap; degeneracy begins when it reaches within about 3kT of a band edge. A
 * flat "10¹⁹ cm⁻³" rule of thumb is silicon's number and travels badly: indium
 * antimonide has a 0.17 eV gap, so its whole non-degenerate window at 300 K is
 * only 7 meV wide and it is degenerate at 10¹⁸ — where the flat rule would have
 * called it fine and the built-in potential came out larger than the gap.
 *
 * @param offsetEv E_F − E_i, eV (signed; magnitude is what matters)
 * @param Eg       band gap, eV
 */
export const DEGENERACY_MARGIN_KT = 3;

export function isDegenerate(offsetEv: number, Eg: number, T: number): boolean {
  return Math.abs(offsetEv) >= Eg / 2 - DEGENERACY_MARGIN_KT * K_B * T;
}

/**
 * Freeze-out: below about 100 K the dopants keep their carriers and the
 * extrinsic plateau collapses. The model assumes complete ionisation, so it
 * over-predicts carriers here.
 */
export const FREEZE_OUT_K = 100;

export function isFreezeOut(T: number): boolean {
  return T < FREEZE_OUT_K;
}

/**
 * The temperature at which n_i catches the net doping — the top of the
 * extrinsic plateau, where a device stops behaving as designed. Found by
 * bisection because n_i(T) has no closed-form inverse.
 *
 * Returns null when the doping is never reached inside the searched range.
 */
export function intrinsicOnsetTemp(
  ni300: number,
  Eg: number,
  netDoping: number,
): number | null {
  if (netDoping <= 0) return null;
  let lo = 50;
  let hi = 2000;
  if (intrinsicCarriers(ni300, Eg, hi) < netDoping) return null;
  if (intrinsicCarriers(ni300, Eg, lo) > netDoping) return lo;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (intrinsicCarriers(ni300, Eg, mid) < netDoping) lo = mid;
    else hi = mid;
  }
  return hi;
}
