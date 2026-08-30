/**
 * Thermal properties: heat capacity, expansion, conductivity, and the two
 * results that make this a module rather than a table — thermal stress and
 * thermal shock resistance.
 *
 * Equations follow Callister & Rethwisch ch. 19 ("Thermal properties").
 *
 * ## Why the laws come first here
 *
 * Expansion coefficients and thermal conductivities are measured numbers, and
 * this module needs them. What keeps them honest is that three of the
 * relationships in this file are *checks* rather than results:
 *
 *  - **Dulong–Petit** fixes the molar heat capacity of every solid at 3R, so a
 *    specific heat is `3R/A` over the atomic masses `data/elements.json`
 *    already carries. Nothing is tabulated for that panel at all.
 *  - **Wiedemann–Franz** says `k/(σT)` is near-constant across metals, so the
 *    conductivity and the resistivity of each metal check each other.
 *  - **α·T_melt** is roughly constant for metals — a stiff, strongly-bound
 *    solid both melts high and expands little — so every expansion coefficient
 *    is checked against a melting point out of the app's own element data.
 *
 * Where a material has none of those checks available, `thermal/materials.ts`
 * says so rather than implying it is as well grounded as the metals.
 */

/** Molar gas constant, J/mol·K. */
export const R = 8.314462618;

/** The Dulong–Petit molar heat capacity, 3R ≈ 24.94 J/mol·K. */
export const DULONG_PETIT = 3 * R;

/** Sommerfeld's Lorenz number, W·Ω/K² — what Wiedemann–Franz predicts. */
export const LORENZ_SOMMERFELD = 2.44e-8;

/**
 * Specific heat from Dulong–Petit, J/g·K.
 *
 * Every solid stores the same energy per *atom*, so it stores less per gram
 * the heavier its atoms are. That is the whole content of `c = 3R/A`, and it
 * is why aluminium takes more than twice as much heat per kilogram as copper
 * to raise by a degree while a mole of each takes the same.
 *
 * It is a high-temperature limit, and "high" means above the Debye
 * temperature. For most metals room temperature is well above it and the rule
 * is good to a few per cent. For a light, stiffly-bonded solid — carbon,
 * beryllium, silicon — it is not, and the rule overshoots badly; see
 * `DEBYE_STIFF` in `materials.ts`, where that failure is the point rather than
 * an embarrassment.
 */
export function dulongPetitSpecificHeat(atomicMass: number): number {
  return DULONG_PETIT / atomicMass;
}

/**
 * Lorenz number `L = k/(σT)`.
 *
 * The electrons that carry charge carry heat, so a good electrical conductor
 * is a good thermal one and the ratio between the two is nearly a constant of
 * nature rather than a property of the metal. Real metals run 2.1–3.2 × 10⁻⁸
 * against Sommerfeld's 2.44, which is close enough to be a law and loose
 * enough to be interesting.
 *
 * @param conductivity thermal conductivity, W/m·K
 * @param resistivity  electrical resistivity, nΩ·m
 * @param T            absolute temperature, K
 */
export function lorenzNumber(conductivity: number, resistivity: number, T: number): number {
  const sigma = 1 / (resistivity * 1e-9);
  return conductivity / (sigma * T);
}

/**
 * Thermal stress in a fully constrained member, MPa.
 *
 * `σ = E·α·ΔT`. A bar that cannot move develops the stress it would have taken
 * to squeeze it back to its original length, and nothing about that depends on
 * its size — which is why the answer is a stress rather than a force and why
 * making the part thicker does not help.
 *
 * @param modulus GPa
 * @param alpha   coefficient of linear expansion, 1e-6/K
 * @param deltaT  temperature change, K
 */
export function thermalStress(modulus: number, alpha: number, deltaT: number): number {
  return modulus * 1000 * alpha * 1e-6 * deltaT;
}

/** The ΔT that brings a constrained member to a given stress — `thermalStress` inverted. */
export function deltaTForStress(modulus: number, alpha: number, stress: number): number {
  return stress / (modulus * 1000 * alpha * 1e-6);
}

/**
 * Thermal shock resistance, K.
 *
 * `TSR = σ_f·k / (E·α)`. A quench sets up a stress through the temperature
 * *gradient*, so everything that reduces the gradient (conductivity) or the
 * stress it produces (a low modulus, a low expansion) helps, and strength sets
 * how much stress the material survives. It is a figure of merit with the
 * dimensions of a temperature, not a temperature a specimen will survive.
 *
 * The reason a borosilicate dish comes out of the oven onto a wet counter and
 * a soda-lime one does not is almost entirely the α in the denominator.
 *
 * @param strength MPa
 * @param conductivity W/m·K
 * @param modulus GPa
 * @param alpha 1e-6/K
 */
export function thermalShockResistance(
  strength: number,
  conductivity: number,
  modulus: number,
  alpha: number,
): number {
  return (strength * 1e6 * conductivity) / (modulus * 1e9 * alpha * 1e-6);
}

/**
 * `α·T_melt`, which is roughly constant across metals — around 0.02.
 *
 * Both quantities read the same thing: how deep the interatomic potential well
 * is. A strongly bound solid needs more heat to shake apart and expands less
 * on the way, so the product hardly moves even as α ranges over six-fold and
 * T_melt over six-fold in the other direction.
 *
 * Used here as a check on the tabulated expansion coefficients, against
 * melting points taken from `data/elements.json`.
 */
export function expansionMeltProduct(alpha: number, meltK: number): number {
  return alpha * 1e-6 * meltK;
}
