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
 * The inverse problem, as a lab report sets it: two measurements of D at two
 * temperatures, and recover Q_d and D₀.
 *
 * On a plot of ln D against 1/T the Arrhenius law is a straight line of slope
 * −Q_d/R and intercept ln D₀, so
 *
 *     Q_d = −R · (ln D₁ − ln D₂) / (1/T₁ − 1/T₂)
 *     D₀  = D₁ · exp(Q_d / R T₁)
 *
 * D₀ is where that line reaches 1/T = 0 — infinite temperature — which is the
 * point of doing this at all: students read D₀ as "the diffusion coefficient"
 * when it is an extrapolated intercept no experiment visits.
 *
 * Returns null rather than a number for inputs the line is not defined on:
 * a repeated temperature, or a non-positive D or T.
 */
export function activationFromPair(
  T1_K: number,
  D1: number,
  T2_K: number,
  D2: number,
): { Qd: number; D0: number } | null {
  if (!(T1_K > 0) || !(T2_K > 0) || !(D1 > 0) || !(D2 > 0)) return null;
  // Equal temperatures need no guard of their own: the division below gives
  // ±Infinity, or NaN when the two D values match as well, and the finite
  // check at the end rejects both. A separate `invDelta === 0` branch was
  // here and no mutation of it could be observed, which is the definition of
  // a line that is not doing anything.
  const invDelta = 1 / T1_K - 1 / T2_K;
  const Qd = (-GAS_CONSTANT * (Math.log(D1) - Math.log(D2))) / invDelta;
  const D0 = D1 * Math.exp(Qd / (GAS_CONSTANT * T1_K));
  if (!Number.isFinite(Qd) || !Number.isFinite(D0)) return null;
  return { Qd, D0 };
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

/**
 * The (temperature, time) pairs on an equal-Dt curve that a reader's own
 * controls can actually be set to.
 *
 * The panel offers these as chips. It used to build them over 500–1200 °C
 * while its temperature slider starts at 400, and dropped anything outside the
 * time slider's 0.5–40 h with no fallback — so a state near the cold end of
 * the curve produced an **empty** list, under prose reading "Every point on
 * that line is the same treatment:" followed by nothing. Offering the reader's
 * own range closes most of it; the caller still has to handle the empty case,
 * because a curve can lie wholly outside the time slider however wide the
 * temperature sweep is.
 *
 * `stepC` is the chip spacing, not the curve's resolution — round numbers a
 * reader recognises rather than every sample the curve carries.
 */
export function equalDtOptions(
  sys: DiffusionSystem,
  dt: number,
  tMinC: number,
  tMaxC: number,
  stepC: number,
  hoursMin: number,
  hoursMax: number,
): { tempC: number; hours: number }[] {
  const out: { tempC: number; hours: number }[] = [];
  // Relative slack on the bounds. The reader's own setting is on this curve by
  // construction, so at the very ends of both sliders the exact answer *is* the
  // bound — and a strict comparison drops it on float noise, leaving the panel
  // with nothing to offer at precisely the settings it should be offering back.
  const lo = hoursMin * (1 - 1e-9);
  const hi = hoursMax * (1 + 1e-9);
  for (let T = tMinC; T <= tMaxC + 1e-9; T += stepC) {
    const D = diffusionCoefficient(sys, T + 273.15);
    if (!(D > 0)) continue;
    const hours = dt / D / 3600;
    if (hours >= lo && hours <= hi) out.push({ tempC: T, hours });
  }
  return out;
}
