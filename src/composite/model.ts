/**
 * Fibre-reinforced composite mechanics — the rule of mixtures and what it is
 * a rule *for*.
 *
 * Equations follow Callister & Rethwisch ch. 16 ("Composites"). Everything
 * here is closed form: two bounds on the modulus, a density that is exact, a
 * strength that is an upper bound and is labelled one, and the critical fibre
 * length below which a discontinuous fibre never reaches its own strength.
 *
 * The constituents are not a new dataset. They are entries of
 * `selection/materials.ts` — the same Callister Appendix B the Ashby chart
 * plots — so a composite specified here can be handed straight back to
 * `indexValue` as a point among the 54. See `composite/materials.ts`.
 *
 * ## Units
 *
 * Modulus GPa, strength MPa, density g/cm³, length mm, diameter mm. The mixed
 * GPa/MPa is deliberate: it is how both are tabulated and how a reader will
 * check the arithmetic. Nothing below multiplies one by the other without
 * converting, and `matrixStressAtFibreFailure` is the only place it matters.
 */

/** A fibre or a matrix: the three Appendix B properties the mixtures need. */
export interface Constituent {
  name: string;
  /** Modulus of elasticity, GPa. */
  modulus: number;
  /** Density, g/cm³. */
  density: number;
  /** Tensile strength, MPa. For a fibre this is a *pristine filament* value — see `strengthOverprediction`. */
  strength: number;
}

/** Fibre volume fraction, clamped to the physical range. */
export function clampFraction(vf: number): number {
  return Math.min(1, Math.max(0, vf));
}

/**
 * Isostrain (longitudinal) modulus — the upper bound.
 *
 * Load along the fibres strains both phases equally, so the stiffnesses add in
 * proportion to area, and area fraction is volume fraction for aligned
 * continuous fibres. `E_cl = E_f·V_f + E_m·(1 − V_f)`.
 */
export function longitudinalModulus(f: Constituent, m: Constituent, vf: number): number {
  const v = clampFraction(vf);
  return f.modulus * v + m.modulus * (1 - v);
}

/**
 * Isostress (transverse) modulus — the lower bound.
 *
 * Load across the fibres puts the two phases in series: the same stress, and
 * strains that add. `E_ct = E_f·E_m / (V_m·E_f + V_f·E_m)`.
 *
 * **It assumes an isotropic fibre, and carbon and aramid are not.** Their axial
 * modulus is many times their transverse one, so feeding the axial value here
 * understates the real transverse modulus badly — the app's own dataset notes
 * carbon–epoxy at 10 GPa transverse where this expression gives about 6. Glass
 * is isotropic and the bound is fair for it. The UI says so; this function
 * cannot know which fibre it was handed.
 */
export function transverseModulus(f: Constituent, m: Constituent, vf: number): number {
  const v = clampFraction(vf);
  const denom = (1 - v) * f.modulus + v * m.modulus;
  return (f.modulus * m.modulus) / denom;
}

/**
 * Density, and it is not a bound — mass is conserved and volumes add, so the
 * rule of mixtures is exact here rather than approximate. This is the value
 * that makes a specific stiffness meaningful.
 */
export function mixtureDensity(f: Constituent, m: Constituent, vf: number): number {
  const v = clampFraction(vf);
  return f.density * v + m.density * (1 - v);
}

/**
 * The share of an applied longitudinal load carried by the fibres.
 *
 * Equal strain means the stress ratio is the modulus ratio, so
 * `F_f/F_m = E_f·V_f / (E_m·V_m)`. Returned as a *fraction of the total*
 * rather than as the book's ratio, because a fraction stays finite at V_f = 1
 * where the ratio does not.
 */
export function fibreLoadFraction(f: Constituent, m: Constituent, vf: number): number {
  const v = clampFraction(vf);
  const fibre = f.modulus * v;
  const matrix = m.modulus * (1 - v);
  return fibre / (fibre + matrix);
}

/** The book's `F_f/F_m`. Infinite at V_f = 1, which is why the UI uses the fraction. */
export function loadRatio(f: Constituent, m: Constituent, vf: number): number {
  const frac = fibreLoadFraction(f, m, vf);
  return frac / (1 - frac);
}

/** Longitudinal strain under an applied stress (MPa) — the same in both phases. */
export function longitudinalStrain(
  f: Constituent,
  m: Constituent,
  vf: number,
  stressMPa: number,
): number {
  return stressMPa / (longitudinalModulus(f, m, vf) * 1000);
}

/**
 * The stress the matrix is carrying when the fibres reach their failure
 * strain — the `σ'_m` of the strength rule of mixtures, which is *not* the
 * matrix tensile strength.
 *
 * `ε*_f = σ*_f / E_f`, then `σ'_m = E_m·ε*_f`, with the GPa→MPa factor of 1000
 * on the modulus. Returned alongside a flag, because for a stiff fibre in a
 * compliant matrix the answer routinely exceeds the matrix's own tensile
 * strength: E-glass fails at 4.8% strain and epoxy does not survive it. When
 * that happens the matrix has already cracked and the expression is being used
 * outside its assumption, so the value is capped at the matrix strength and the
 * flag says why.
 */
export function matrixStressAtFibreFailure(
  f: Constituent,
  m: Constituent,
): { stress: number; matrixFailsFirst: boolean; fibreFailureStrain: number } {
  const fibreFailureStrain = f.strength / (f.modulus * 1000);
  const uncapped = m.modulus * 1000 * fibreFailureStrain;
  const matrixFailsFirst = uncapped > m.strength;
  return {
    stress: matrixFailsFirst ? m.strength : uncapped,
    matrixFailsFirst,
    fibreFailureStrain,
  };
}

/**
 * Longitudinal strength by the rule of mixtures — **an upper bound**, and the
 * module's most important caveat.
 *
 * `σ*_cl = σ*_f·V_f + σ'_m·(1 − V_f)`, which is the book's expression used
 * exactly as written. What the book supplies as `σ*_f` is the fibre strength
 * *in the composite*; what a property table supplies is a pristine
 * single-filament value, and they are not the same number. Fibres in a real
 * laminate carry handling damage, a flaw distribution over their whole length,
 * and stress concentrations beside neighbouring breaks.
 *
 * The size of the gap is not asserted from memory here — it is measured
 * against the app's own data by `strengthOverprediction`, and it is large.
 */
export function longitudinalStrength(f: Constituent, m: Constituent, vf: number): number {
  const v = clampFraction(vf);
  return f.strength * v + matrixStressAtFibreFailure(f, m).stress * (1 - v);
}

/**
 * Critical fibre length: below it a fibre debonds or pulls out before the
 * shear transferred through the interface can load it to its own strength, so
 * a shorter fibre is reinforcement that never gets used.
 *
 * `l_c = σ*_f·d / (2·τ_c)`, with σ*_f in MPa, d in mm and τ_c — the smaller of
 * the fibre–matrix bond strength and the matrix shear yield strength — in MPa.
 * The MPa cancel and the answer is in whatever length unit `d` was.
 *
 * **τ_c belongs to a fibre–matrix *pair*, not to a fibre.** It is an input
 * here rather than a column of the fibre table for the same reason
 * `failure/materials.ts` keeps Paris constants out of `MECH_MATERIALS`:
 * attaching a pair property to one member of the pair produces a confident
 * number with no basis.
 */
export function criticalLength(fibreStrength: number, diameter: number, tau: number): number {
  return (fibreStrength * diameter) / (2 * tau);
}

/**
 * Strength of an aligned *discontinuous* fibre composite, both regimes.
 *
 * Above `l_c` the fibre reaches its strength over part of its length and the
 * ends are the shortfall: `σ*_cd = σ*_f·V_f·(1 − l_c/2l) + σ'_m·V_m`. Below it
 * the fibre never reaches its strength at all and the shear transfer sets the
 * ceiling: `σ*_cd' = (l·τ_c/d)·V_f + σ'_m·V_m`.
 *
 * The two expressions meet at `l = l_c`, which is asserted rather than assumed.
 */
export function discontinuousStrength(
  f: Constituent,
  m: Constituent,
  vf: number,
  length: number,
  diameter: number,
  tau: number,
): { strength: number; regime: 'above' | 'below'; criticalLength: number } {
  const v = clampFraction(vf);
  const lc = criticalLength(f.strength, diameter, tau);
  const matrixTerm = matrixStressAtFibreFailure(f, m).stress * (1 - v);
  if (length >= lc) {
    return {
      strength: f.strength * v * (1 - lc / (2 * length)) + matrixTerm,
      regime: 'above',
      criticalLength: lc,
    };
  }
  return {
    strength: ((length * tau) / diameter) * v + matrixTerm,
    regime: 'below',
    criticalLength: lc,
  };
}

/**
 * Fibre efficiency for orientations other than aligned-and-loaded-along.
 *
 * `E_cd = K·E_f·V_f + E_m·V_m`. K is 1 for aligned fibres loaded along their
 * axis, 3/8 for fibres random in a plane, and 1/5 for fibres random in three
 * dimensions — the price of isotropy, and the reason a chopped-strand moulding
 * is nothing like a laminate.
 */
export const ORIENTATIONS = [
  { id: 'aligned', label: 'Aligned, loaded along', k: 1 },
  { id: 'random2d', label: 'Random in a plane', k: 3 / 8 },
  { id: 'random3d', label: 'Random in three dimensions', k: 1 / 5 },
] as const;

export type OrientationId = (typeof ORIENTATIONS)[number]['id'];

export function orientationModulus(
  f: Constituent,
  m: Constituent,
  vf: number,
  k: number,
): number {
  const v = clampFraction(vf);
  return k * f.modulus * v + m.modulus * (1 - v);
}
