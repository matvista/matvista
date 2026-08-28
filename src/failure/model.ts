/**
 * Failure analysis: linear-elastic fracture mechanics, fatigue and creep.
 * Follows Callister & Rethwisch ch. 8 ("Failure").
 *
 * Every relation here has a domain, and the domains are narrow enough that
 * applying one outside it is the usual way to get a confidently wrong answer:
 *
 * - **Griffith** (`griffithCrackLength`) describes *ideally brittle* fracture,
 *   where all the work goes into new surface. For a metal, plastic work at the
 *   crack tip dominates by orders of magnitude, so Griffith under-predicts the
 *   tolerable flaw enormously. Use `K_IC` for metals; Griffith is offered only
 *   for the brittle solids.
 * - **LEFM** (`criticalCrackSize`, `criticalStress`) assumes small-scale
 *   yielding: the plastic zone must be small beside the crack and the section.
 *   As the applied stress approaches yield that ceases to hold, which
 *   `plasticZoneRadius` and `lefmValid` exist to flag rather than hide.
 * - **Paris** (`parisLife`) describes stage II growth only. Below ΔK_th cracks
 *   effectively do not propagate, and above K_IC the component is already
 *   broken; the published constants are fits within that middle band.
 * - **Larson–Miller** interpolates a measured master curve. Off the ends of the
 *   digitised range it is extrapolation, and is reported as such.
 */

/* --------------------------------------------------------------- fracture */

/**
 * Stress intensity at a crack tip: K = Y·σ·√(πa)   (Callister eq. 8.5)
 *
 * @param sigma applied stress, MPa
 * @param a     crack length, m (surface crack) or half-length (internal)
 * @param Y     dimensionless geometry factor
 * @returns MPa·√m
 */
export function stressIntensity(sigma: number, a: number, Y: number): number {
  return Y * sigma * Math.sqrt(Math.PI * a);
}

/**
 * Largest crack a component tolerates before fast fracture, from
 * K_IC = Y·σ·√(π·a_c)  rearranged  (Callister eq. 8.7):
 *
 *   a_c = (1/π)·(K_IC / (Y·σ))²
 *
 * @param kic   plane-strain fracture toughness, MPa·√m
 * @param sigma design stress, MPa
 * @returns critical crack length, m
 */
export function criticalCrackSize(kic: number, sigma: number, Y: number): number {
  if (sigma <= 0 || Y <= 0) return Infinity;
  return (1 / Math.PI) * (kic / (Y * sigma)) ** 2;
}

/** Stress at which a crack of length `a` runs: σ_c = K_IC / (Y·√(πa)), MPa. */
export function criticalStress(kic: number, a: number, Y: number): number {
  if (a <= 0 || Y <= 0) return Infinity;
  return kic / (Y * Math.sqrt(Math.PI * a));
}

/**
 * Griffith's criterion for an ideally brittle solid (Callister eq. 8.3):
 *
 *   σ_c = √(2·E·γs / (π·a))     →     a = 2·E·γs / (π·σ²)
 *
 * @param E     modulus, GPa
 * @param gamma specific surface energy, J/m²
 * @param sigma applied stress, MPa
 * @returns maximum tolerable surface flaw length, m
 */
export function griffithCrackLength(E: number, gamma: number, sigma: number): number {
  const E_Pa = E * 1e9;
  const sigma_Pa = sigma * 1e6;
  return (2 * E_Pa * gamma) / (Math.PI * sigma_Pa ** 2);
}

/** Griffith critical stress for a flaw of length a (m), in MPa. */
export function griffithStress(E: number, gamma: number, a: number): number {
  const E_Pa = E * 1e9;
  return Math.sqrt((2 * E_Pa * gamma) / (Math.PI * a)) / 1e6;
}

/**
 * Plane-strain plastic zone radius, r_y = (1/6π)·(K/σy)².
 *
 * The number itself is less useful than the comparison: LEFM is only
 * trustworthy while this is small beside the crack and the remaining section.
 *
 * @returns metres
 */
export function plasticZoneRadius(K: number, yieldStrength: number): number {
  return (1 / (6 * Math.PI)) * (K / yieldStrength) ** 2;
}

/**
 * Whether small-scale yielding still holds.
 *
 * ASTM E399 requires the crack length and remaining ligament to exceed
 * 2.5·(K_IC/σy)² for a valid plane-strain measurement; the same group is the
 * usual sanity check on applying the result. Reported alongside the answer so a
 * reader can see when the number stops meaning what the label says.
 */
export function lefmSizeRequirement(kic: number, yieldStrength: number): number {
  return 2.5 * (kic / yieldStrength) ** 2;
}

/* ---------------------------------------------------------------- fatigue */

/**
 * Estimated S–N curve.
 *
 * These are *constructed* from tensile strength by the standard design rules,
 * not measured fatigue data — the UI says so, because a smooth curve through
 * invented points is exactly the kind of thing that reads as a measurement.
 *
 * Basquin form S = a·N^b anchored at:
 *   N = 10³ cycles, S = f·UTS       (f = 0.9, bending)
 *   N = `kneeCycles`, S = ratio·UTS  (the endurance limit, or the quoted
 *                                     fatigue strength for alloys without one)
 *
 * Whether the curve then flattens is the physically important part and is a
 * property of the alloy, not of the fit — see `hasEnduranceLimit`.
 */
export const BASQUIN_ANCHOR_CYCLES = 1e3;
export const BASQUIN_ANCHOR_FRACTION = 0.9;

export interface SnFit {
  /** Coefficient a in S = a·N^b, MPa. */
  a: number;
  /** Exponent b (negative). */
  b: number;
  /** Stress at the knee, MPa. */
  kneeStress: number;
  kneeCycles: number;
  hasEnduranceLimit: boolean;
}

export function fitSn(
  uts: number,
  ratio: number,
  kneeCycles: number,
  hasEnduranceLimit: boolean,
): SnFit {
  const s1 = BASQUIN_ANCHOR_FRACTION * uts;
  const s2 = ratio * uts;
  const b =
    Math.log10(s2 / s1) / (Math.log10(kneeCycles) - Math.log10(BASQUIN_ANCHOR_CYCLES));
  const a = s1 / BASQUIN_ANCHOR_CYCLES ** b;
  return { a, b, kneeStress: s2, kneeCycles, hasEnduranceLimit };
}

/** Fatigue strength at N cycles, MPa. */
export function fatigueStrength(fit: SnFit, N: number): number {
  if (N <= BASQUIN_ANCHOR_CYCLES) return fit.a * BASQUIN_ANCHOR_CYCLES ** fit.b;
  if (N >= fit.kneeCycles) {
    // Past the knee a ferrous alloy holds; one without an endurance limit keeps
    // descending, and pretending otherwise is the classic non-ferrous error.
    return fit.hasEnduranceLimit ? fit.kneeStress : fit.a * N ** fit.b;
  }
  return fit.a * N ** fit.b;
}

/**
 * Cycles to failure at a given stress amplitude.
 * Returns null when the amplitude sits below an endurance limit — "infinite
 * life" is the answer, and a number would misrepresent it.
 */
export function cyclesToFailure(fit: SnFit, stress: number): number | null {
  if (fit.hasEnduranceLimit && stress <= fit.kneeStress) return null;
  return (stress / fit.a) ** (1 / fit.b);
}

/* ----------------------------------------------------------- crack growth */

/**
 * Paris law: da/dN = C·(ΔK)^m, with ΔK = Y·Δσ·√(πa).
 *
 * Integrated in closed form, which is exact for constant Δσ and Y and avoids a
 * quadrature that would need care as a → a_c:
 *
 *   N = [a_f^(1−m/2) − a_0^(1−m/2)] / [C·Y^m·Δσ^m·π^(m/2)·(1 − m/2)]   (m ≠ 2)
 *
 * @param C  m/cycle with ΔK in MPa·√m
 * @param dSigma stress *range*, MPa
 * @returns cycles, or null when the crack is already critical
 */
export function parisLife(
  C: number,
  m: number,
  a0: number,
  af: number,
  dSigma: number,
  Y: number,
): number | null {
  if (a0 >= af || dSigma <= 0) return null;
  const k = C * Y ** m * dSigma ** m * Math.PI ** (m / 2);
  if (Math.abs(m - 2) < 1e-9) return Math.log(af / a0) / k;
  const p = 1 - m / 2;
  return (af ** p - a0 ** p) / (k * p);
}

/** Crack growth rate at a crack length, m/cycle. */
export function growthRate(
  C: number,
  m: number,
  a: number,
  dSigma: number,
  Y: number,
): number {
  return C * (Y * dSigma * Math.sqrt(Math.PI * a)) ** m;
}

/* ------------------------------------------------------------------ creep */

/**
 * Larson–Miller parameter:  P = T·(C + log₁₀ t_r)
 *
 * @param T_K temperature, kelvin
 * @param hours rupture time, hours
 * @param C   material constant, ~20 for many alloys
 * @returns P in K·(dimensionless), conventionally quoted in thousands
 */
export function larsonMiller(T_K: number, hours: number, C = 20): number {
  return T_K * (C + Math.log10(hours));
}

/** Rupture time in hours implied by a Larson–Miller parameter. */
export function ruptureHours(P: number, T_K: number, C = 20): number {
  return 10 ** (P / T_K - C);
}
