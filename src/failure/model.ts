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

/* ------------------------------------------------------- crack geometries */

/**
 * The geometry factor Y is not a fudge factor, and offering it as a bare
 * slider taught that it was. It encodes where the crack sits and how the
 * section constrains it, and it is where a hand calculation goes wrong.
 *
 * Every expression below is a standard handbook closed form — Tada, Paris &
 * Irwin's stress-analysis handbook for the free-surface and elliptical
 * corrections, Feddersen's secant for the finite-width panel. Nothing new is
 * shipped; what is new is that the number is computed rather than dialled.
 */
export interface CrackGeometry {
  id: string;
  name: string;
  /** What the crack size `a` means in this configuration. */
  aMeaning: string;
  /** True when Y depends on the crack-to-width ratio. */
  finiteWidth: boolean;
  /**
   * Y for a crack-to-width ratio 2a/W. Null outside the expression's validity.
   * Width-independent geometries ignore the argument entirely.
   */
  Y(ratio: number): number | null;
  note: string;
}

/**
 * Validity limit on Feddersen's secant, as 2a/W.
 *
 * Past this the expression is outside its fit and running toward its
 * singularity at 2a/W = 1. It **refuses** rather than extrapolating: a
 * confident number for a case the formula does not describe is the failure
 * mode this whole module is written against.
 */
export const SECANT_MAX_RATIO = 0.7;

export const CRACK_GEOMETRIES: CrackGeometry[] = [
  {
    id: 'centre',
    name: 'Centre crack, wide plate',
    aMeaning: 'a is the half-length of the crack',
    finiteWidth: false,
    Y: () => 1,
    note: 'The reference case Y = 1 is defined against: an internal crack of length 2a in a plate wide enough that the edges do not know it is there. Note that a is the HALF-length — the commonest arithmetic slip in the whole subject.',
  },
  {
    id: 'edge',
    name: 'Single-edge notch, wide plate',
    aMeaning: 'a is the notch depth from the free edge',
    finiteWidth: false,
    Y: () => 1.12,
    note: 'A crack that breaks the surface has nothing holding one flank shut, so it opens more than a buried crack of the same size: 12% more K for the same stress and depth. That 1.12 is the free-surface correction, and it reappears in the surface flaw below.',
  },
  {
    id: 'surface',
    name: 'Semicircular surface flaw',
    aMeaning: 'a is the flaw depth, at the deepest point',
    finiteWidth: false,
    // Y = 1.12/Φ, with Φ the complete elliptic integral of the second kind.
    // For a semicircular flaw (a/c = 1) that integral is exactly π/2.
    Y: () => 1.12 / (Math.PI / 2),
    note: 'The same 1.12 free-surface term, divided by the elliptical crack front Φ — exactly π/2 for a semicircular flaw. The result, 0.713, is smaller than the edge notch: a rounded flaw of a given depth is less severe than a notch of that depth, because the curved front shares the load.',
  },
  {
    id: 'finite',
    name: 'Through-crack, finite-width plate',
    aMeaning: 'a is the half-length; the slider sets 2a/W',
    finiteWidth: true,
    Y: (ratio: number) => {
      if (!(ratio >= 0) || ratio > SECANT_MAX_RATIO) return null;
      return Math.sqrt(1 / Math.cos((Math.PI * ratio) / 2));
    },
    note: 'Feddersen’s secant correction. Once the crack is a real fraction of the width the remaining ligament is carrying the load, and Y climbs: 1.19 at 2a/W = 0.5 and 1.48 at 0.7. Past 0.7 the expression is outside its fit and this panel refuses rather than extrapolating toward its singularity.',
  },
  {
    id: 'vessel',
    name: 'Thin-walled pressure vessel',
    aMeaning: 'a is the half-length of a through-wall crack',
    finiteWidth: false,
    Y: () => 1,
    note: 'A through-wall crack in a thin shell behaves as a centre crack in a wide sheet, so Y = 1; what changes is that the stress is not chosen but set by the pressure, σ = pr/t. That is what makes leak-before-break a wall-thickness question.',
  },
  {
    id: 'custom',
    name: 'Custom Y — no named geometry',
    aMeaning: 'a is whatever the chosen Y is defined against',
    finiteWidth: false,
    Y: () => null,
    note: 'The free slider this panel used to offer, kept so that links written against ?Y= keep working. It is the only entry here that is not a closed form, and it is deliberately last: a number with no geometry behind it is exactly what the rest of this list exists to replace.',
  },
];

export function getCrackGeometry(id: string): CrackGeometry {
  return CRACK_GEOMETRIES.find((g) => g.id === id) ?? CRACK_GEOMETRIES[0];
}

/** Y for a geometry at a crack-to-width ratio. Null where undefined. */
export function geometryFactor(g: CrackGeometry, ratio: number): number | null {
  return g.Y(ratio);
}

/* --------------------------------------------------- leak before break */

/** Hoop stress in a thin-walled cylinder under internal pressure, σ = pr/t. */
export function hoopStress(p: number, r: number, t: number): number {
  if (!(t > 0)) return Infinity;
  return (p * r) / t;
}

/**
 * The r/t below which σ = pr/t stops describing the vessel.
 *
 * The thin-wall form assumes the hoop stress is uniform through the wall. It
 * is not — it peaks at the bore and falls outward — and the error grows as the
 * wall thickens. Ten is the usual textbook cut, where the thin-wall value is a
 * few per cent below the true peak. This module's own sliders reach well
 * inside it: at p = 10 MPa and r = 500 mm the leak-before-break wall for
 * 7075-T651 is 68 mm, an r/t near 7.
 */
export const THIN_WALL_MIN_RATIO = 10;

/**
 * Peak hoop stress by Lamé's thick-wall solution, at the bore:
 *
 *   σ_θ(r_i) = p·(r_o² + r_i²) / (r_o² − r_i²),   r_o = r_i + t
 *
 * Here only to say *by how much* the thin-wall figure is out where the wall is
 * too thick for it — it is always the larger of the two, so the thin-wall form
 * errs unsafely. Takes `r` as the bore, which is the reading that makes
 * σ = pr/t the conservative limit of this expression as t → 0.
 */
export function lameHoopStress(p: number, r: number, t: number): number {
  if (!(t > 0) || !(r > 0)) return Infinity;
  const ro = r + t;
  return (p * (ro * ro + r * r)) / (ro * ro - r * r);
}

/**
 * Minimum wall thickness that leaks before it breaks, m.
 *
 * A through-wall crack that reaches the far side leaks — loudly, detectably,
 * at low consequence. A buried crack that reaches its critical length bursts
 * the vessel. The design criterion is that the critical **through-wall** crack
 * length be at least the wall thickness, so a crack cannot become critical
 * while still buried:
 *
 *   2a_c ≥ t,  2a_c = (2/π)(K_IC/Yσ)²,  σ = pr/t
 *   ⟹  t ≥ (π/2)·(Y·p·r / K_IC)²
 *
 * Toughness enters squared, and the pressure and radius do too — which is why
 * a tougher, **lower-strength** alloy can be the correct engineering choice
 * here, directly against the default that stronger is safer.
 *
 * @param kic MPa·√m
 * @param p   internal pressure, MPa
 * @param r   vessel radius, m
 */
export function leakBeforeBreakThickness(
  kic: number,
  p: number,
  r: number,
  Y: number,
): number | null {
  if (!(kic > 0) || !(p > 0) || !(r > 0) || !(Y > 0)) return null;
  return (Math.PI / 2) * ((Y * p * r) / kic) ** 2;
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
