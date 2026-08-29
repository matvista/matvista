/**
 * Point-defect and diffusion models.
 * Equations and constants follow Callister & Rethwisch ch. 4–5.
 */

export const BOLTZMANN_EV = 8.62e-5; // eV/atom·K
export const GAS_CONSTANT = 8.31; // J/mol·K
export const AVOGADRO = 6.022e23;

/** Equilibrium vacancy fraction, Callister eq. 4.1: N_v/N = exp(−Q_v / kT). */
export function vacancyFraction(Qv_eV: number, T_K: number): number {
  return Math.exp(-Qv_eV / (BOLTZMANN_EV * T_K));
}

/** Atomic sites per m³, Callister eq. 4.2: N = N_A·ρ / A. */
export function siteDensity(density_g_cm3: number, atomicMass: number): number {
  return (AVOGADRO * density_g_cm3 * 1e6) / atomicMass;
}

export interface DiffusionSystem {
  id: string;
  label: string;
  /** Pre-exponential, m²/s. */
  D0: number;
  /** Activation energy, J/mol. */
  Qd: number;
  mechanism: 'interstitial' | 'vacancy';
  note: string;
}

/** Callister table 5.2. */
export const DIFFUSION_SYSTEMS: DiffusionSystem[] = [
  {
    id: 'c-fe-bcc',
    label: 'C in α-Fe (BCC)',
    D0: 1.1e-6,
    Qd: 87_400,
    mechanism: 'interstitial',
    note: 'Carbon is small enough to squeeze between iron atoms, so it never needs to wait for a vacancy. The low activation energy is why carburising works at all.',
  },
  {
    id: 'c-fe-fcc',
    label: 'C in γ-Fe (FCC)',
    D0: 2.3e-5,
    Qd: 148_000,
    mechanism: 'interstitial',
    note: 'Still interstitial, but FCC packs more densely than BCC, so the squeeze is tighter and the activation energy nearly doubles. Case hardening is nonetheless done here, above 912 °C.',
  },
  {
    id: 'n-fe-bcc',
    label: 'N in α-Fe (BCC)',
    D0: 5.0e-7,
    Qd: 77_000,
    mechanism: 'interstitial',
    note: 'Nitrogen diffuses even more readily than carbon in BCC iron — the basis of nitriding.',
  },
  {
    id: 'n-fe-fcc',
    label: 'N in γ-Fe (FCC)',
    D0: 9.1e-5,
    Qd: 168_000,
    mechanism: 'interstitial',
    note: 'The same density penalty carbon pays on moving from BCC to FCC.',
  },
  {
    id: 'fe-fe-bcc',
    label: 'Fe in α-Fe (self-diffusion)',
    D0: 2.8e-4,
    Qd: 251_000,
    mechanism: 'vacancy',
    note: 'Self-diffusion must proceed by vacancy exchange — an iron atom has to wait for a neighbouring site to fall empty. The activation energy is roughly triple that of interstitial carbon, and D at 500 °C is nine orders of magnitude smaller.',
  },
  {
    id: 'fe-fe-fcc',
    label: 'Fe in γ-Fe (self-diffusion)',
    D0: 5.0e-5,
    Qd: 284_000,
    mechanism: 'vacancy',
    note: 'The slowest system here: vacancy mechanism in the denser of the two iron structures.',
  },
  {
    id: 'cu-cu',
    label: 'Cu in Cu (self-diffusion)',
    D0: 2.5e-5,
    Qd: 200_000,
    mechanism: 'vacancy',
    note: 'Copper self-diffusion, also by vacancy exchange.',
  },
];

/** Arrhenius temperature dependence, Callister eq. 5.8: D = D₀·exp(−Q_d / RT). */
export function diffusionCoefficient(sys: DiffusionSystem, T_K: number): number {
  return sys.D0 * Math.exp(-sys.Qd / (GAS_CONSTANT * T_K));
}

/**
 * Gauss error function — Abramowitz & Stegun 7.1.26.
 * Max absolute error 1.5e-7, ample for plotting a concentration profile.
 */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/**
 * Fick's second law, semi-infinite solid with constant surface concentration
 * (Callister eq. 5.5):  (C_x − C₀)/(C_s − C₀) = 1 − erf( x / 2√(Dt) )
 *
 * @param x  depth, m
 * @param t  time, s
 */
export function concentrationAt(
  x: number,
  t: number,
  D: number,
  C0: number,
  Cs: number,
): number {
  if (t <= 0) return x <= 0 ? Cs : C0;
  return C0 + (Cs - C0) * (1 - erf(x / (2 * Math.sqrt(D * t))));
}

/** Depth at which the concentration reaches a target value — inverts eq. 5.5 numerically. */
export function depthForConcentration(
  target: number,
  t: number,
  D: number,
  C0: number,
  Cs: number,
): number | null {
  if (t <= 0 || target <= C0 || target >= Cs) return null;
  let lo = 0;
  let hi = 1e-2; // 10 mm is deeper than any practical case depth
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (concentrationAt(mid, t, D, C0, Cs) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Inverse error function, by bisection on erf — which is monotone, so this
 * converges unconditionally. Null outside (−1, 1), where no argument exists.
 *
 * 80 halvings of a 0…6 bracket, which is far past `erf`'s own 1.5 × 10⁻⁷
 * accuracy bound; the approximation, not the search, sets the answer.
 */
export function erfInverse(y: number): number | null {
  if (!(Math.abs(y) < 1)) return null;
  const sign = y < 0 ? -1 : 1;
  const ay = Math.abs(y);
  let lo = 0;
  let hi = 6; // erf(6) = 1 to 16 places
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (erf(mid) < ay) lo = mid;
    else hi = mid;
  }
  return sign * ((lo + hi) / 2);
}

/**
 * The Dt product that puts `target` at depth `x`, m².
 *
 * The whole of M2 in one line. Fick's second law fixes the profile through the
 * single group x/2√(Dt), so demanding a concentration at a depth demands a
 * value of **Dt** — not of D, and not of t. Everything else follows: raise the
 * temperature and the time falls in exact proportion to D.
 *
 *   (C − C₀)/(C_s − C₀) = 1 − erf(z),  z = x / 2√(Dt)   ⟹   Dt = x²/4z².
 *
 * Null when the target is at or outside (C₀, C_s), where no time and no
 * temperature reach it. **Absent, not clamped** — clamping a value computed
 * outside its domain is what hid the missing α field in iteration 9.
 */
export function dtForTarget(
  target: number,
  x: number,
  C0: number,
  Cs: number,
): number | null {
  if (!(x > 0) || Cs === C0) return null;
  const frac = (target - C0) / (Cs - C0);
  if (!(frac > 0) || !(frac < 1)) return null;
  const z = erfInverse(1 - frac);
  if (z == null || !(z > 0)) return null;
  return (x * x) / (4 * z * z);
}

/** Time to reach `target` at depth `x` at a given diffusivity, seconds. */
export function timeForTarget(
  target: number,
  x: number,
  D: number,
  C0: number,
  Cs: number,
): number | null {
  const Dt = dtForTarget(target, x, C0, Cs);
  if (Dt == null || !(D > 0)) return null;
  return Dt / D;
}

export interface EqualDtCurve {
  /** The invariant product, m². Every point on the curve shares it. */
  dt: number;
  /** (temperature, time) pairs that all produce the same profile. */
  points: { tempC: number; seconds: number }[];
}

/**
 * Every (temperature, time) pair that reaches the same target — the locus of
 * equivalent processes, sampled across a temperature range.
 *
 * The curve is steep because D is exponential in T while depth goes only as
 * √t, which is the module's existing claim that "heating is a far more
 * powerful lever than waiting" made drawable.
 */
export function equalDtCurve(
  sys: DiffusionSystem,
  target: number,
  x: number,
  C0: number,
  Cs: number,
  tMinC: number,
  tMaxC: number,
  steps = 80,
): EqualDtCurve | null {
  const dt = dtForTarget(target, x, C0, Cs);
  if (dt == null) return null;
  const points: { tempC: number; seconds: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const tempC = tMinC + ((tMaxC - tMinC) * i) / steps;
    const D = diffusionCoefficient(sys, tempC + 273.15);
    if (!(D > 0)) return null;
    points.push({ tempC, seconds: dt / D });
  }
  return { dt, points };
}
