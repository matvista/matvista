/**
 * Electrochemical corrosion.
 * Equations follow Callister & Rethwisch ch. 17 ("Corrosion and degradation").
 *
 * Two things here have narrow domains and are easy to misapply:
 *
 * - The **EMF series** ranks metals by standard electrode potential, measured
 *   against the standard hydrogen electrode in 1 M solution of the metal's own
 *   ion. It predicts which metal of a pure couple oxidises *under those
 *   conditions only*. The **galvanic series** ranks real alloys in seawater and
 *   is what an engineer uses; the two orders disagree — passive stainless sits
 *   near copper in seawater and nowhere near it in the EMF series — so the
 *   module keeps them apart rather than blending them into one list.
 * - A **Pourbaix diagram** says which phase is thermodynamically stable, not how
 *   fast anything happens. A region marked "corrosion" may corrode
 *   imperceptibly slowly, and passivation depends on a film that mechanical
 *   damage can remove. Thermodynamics gives the direction, never the rate.
 */

/** Gas constant, J/mol·K. */
export const R = 8.314;
/** Faraday constant, C/mol. */
export const F = 96485;
/** Standard temperature, K. */
export const T25 = 298.15;

/**
 * The Nernst slope at 25 °C: (RT/F)·ln10 = 0.0592 V per decade per electron.
 * Computed rather than hard-coded, so the temperature panel and the room-
 * temperature shortcut can never disagree.
 */
export function nernstSlope(T_K = T25): number {
  return ((R * T_K) / F) * Math.LN10;
}

/**
 * Electrode potential at a non-standard ion concentration (Callister eq. 17.19,
 * the half-cell form):
 *
 *   E = E° + (RT / nF)·ln[Mⁿ⁺]  =  E° + (0.0592/n)·log₁₀[Mⁿ⁺] at 25 °C
 *
 * Raising the ion concentration makes a metal more noble, which is why a
 * crevice depleted of metal ions becomes the anode.
 *
 * @param E0    standard electrode potential, V
 * @param n     electrons transferred
 * @param molar ion activity, mol/L
 */
export function nernstPotential(E0: number, n: number, molar: number, T_K = T25): number {
  if (molar <= 0) return -Infinity;
  return E0 + (nernstSlope(T_K) / n) * Math.log10(molar);
}

export interface Couple {
  /** The metal that corrodes. */
  anode: string;
  /** The metal that is protected. */
  cathode: string;
  /** Driving voltage, V — always positive. */
  emf: number;
}

/**
 * Which of two electrodes corrodes, and how hard the couple is driven.
 *
 * The more negative potential is the anode: it oxidises and is consumed. The
 * voltage is the difference, and it sets the thermodynamic tendency — not the
 * rate, which depends on the electrolyte, the kinetics and the areas.
 */
export function galvanicCouple(
  a: { name: string; potential: number },
  b: { name: string; potential: number },
): Couple {
  const [anode, cathode] = a.potential <= b.potential ? [a, b] : [b, a];
  return { anode: anode.name, cathode: cathode.name, emf: cathode.potential - anode.potential };
}

/**
 * The area ratio effect.
 *
 * Corrosion *current* is set by the cathode's ability to consume electrons, so
 * a large cathode drives a large total current. That current leaves through the
 * anode, and it is the anodic current **density** that eats metal. Shrink the
 * anode and the same current concentrates: a steel bolt in a copper plate
 * perforates, while a copper bolt in a steel plate is harmless.
 *
 * Returned as a multiplier on the anode's corrosion rate relative to equal
 * areas — the shape of the effect, not an absolute rate.
 */
export function areaRatioFactor(cathodeArea: number, anodeArea: number): number {
  if (anodeArea <= 0) return Infinity;
  return cathodeArea / anodeArea;
}

/**
 * Corrosion penetration rate, Callister eq. 17.23:
 *
 *   CPR = K·W / (ρ·A·t)
 *
 * with K = 87.6 giving mm/yr for W in mg, ρ in g/cm³, A in cm², t in hours.
 * (K = 534 gives mils per year, the unit most US corrosion data is quoted in.)
 */
export const CPR_K_MM_PER_YEAR = 87.6;
export const CPR_K_MILS_PER_YEAR = 534;

export function penetrationRate(
  massLoss_mg: number,
  density_g_cm3: number,
  area_cm2: number,
  hours: number,
  K = CPR_K_MM_PER_YEAR,
): number {
  if (density_g_cm3 <= 0 || area_cm2 <= 0 || hours <= 0) return 0;
  return (K * massLoss_mg) / (density_g_cm3 * area_cm2 * hours);
}

/**
 * Corrosion rate from a **measured** corrosion current density —
 * ASTM G102 eq. 1, Callister eq. 17.24:
 *
 *   CR = K · (i_corr / ρ) · EW
 *
 * with i_corr in µA/cm², EW in grams per mole of electrons and ρ in g/cm³.
 * K = 3.27 × 10⁻³ gives mm/yr and K = 1.288 × 10⁻¹ gives mils per year; unlike
 * Callister's pair for eq. 17.23, both of these take the area in cm², so the
 * two differ by nothing but 1 mm = 39.37 mils.
 *
 * **i_corr is an input, never an output.** It is not predictable from the
 * couple: the driving voltage sets the direction, and the kinetics of the
 * electrolyte set the rate. Anything calling this must present the current
 * density as a measurement the reader supposes, not as something the module
 * derived.
 */
export const G102_K_MM_PER_YEAR = 3.27e-3;
export const G102_K_MILS_PER_YEAR = 1.288e-1;

export function currentDensityToCPR(
  i_uA_cm2: number,
  equivalentWeight_g: number,
  density_g_cm3: number,
  K = G102_K_MM_PER_YEAR,
): number {
  if (density_g_cm3 <= 0 || i_uA_cm2 < 0 || equivalentWeight_g <= 0) return 0;
  return K * (i_uA_cm2 / density_g_cm3) * equivalentWeight_g;
}

/**
 * Grams dissolved per mole of electrons, for an element going to a single
 * ionic species: EW = A/n. A multi-phase or multi-element alloy needs a
 * composition-weighted average instead, which is why the shipped table covers
 * only entries where this form holds.
 */
export function equivalentWeight(atomicMass: number, valence: number): number {
  if (valence <= 0) return 0;
  return atomicMass / valence;
}

/* ------------------------------------------------------- Pourbaix boundaries */

/**
 * The two lines that bound water's own stability, and the most useful thing on
 * any Pourbaix diagram — outside them the water itself decomposes.
 *
 * Hydrogen (lower):  2H⁺ + 2e⁻ → H₂      E = −0.0592·pH
 * Oxygen  (upper):   O₂ + 4H⁺ + 4e⁻ → 2H₂O   E = 1.229 − 0.0592·pH
 *
 * Both at 1 atm and 25 °C. Anything below the hydrogen line evolves hydrogen;
 * anything above the oxygen line evolves oxygen.
 */
export function hydrogenLine(pH: number, T_K = T25): number {
  return -nernstSlope(T_K) * pH;
}

export function oxygenLine(pH: number, T_K = T25): number {
  return 1.229 - nernstSlope(T_K) * pH;
}

/** Standard potential of the O₂/H₂O couple in acid, V vs SHE. */
export const OXYGEN_E0 = 1.229;

/* ------------------------------------------------------ concentration cells */

export interface ConcentrationCellResult {
  /** Potential of the concentrated electrode, relative to the standard state, V. */
  eHigh: number;
  /** Potential of the depleted electrode, same reference, V. */
  eLow: number;
  /** Cell voltage, V. Never negative. */
  emf: number;
  /** Which of the two given activities belongs to the electrode that corrodes. */
  anode: 'high' | 'low' | 'neither';
}

/**
 * Two electrodes of the **same** metal at different activity.
 *
 * The commonest misconception in corrosion is that two different metals are
 * needed. They are not: crevice corrosion, pitting, waterline attack,
 * under-deposit attack and a buried pipe crossing two soil types are all this
 * cell. The EMF panel already explains the mechanism in prose, which is a
 * paragraph students skim.
 *
 *   E_cell = (RT/nF)·ln(a_high/a_low) = (0.0592/n)·log₁₀(a_high/a_low) at 25 °C
 *
 * E° cancels — it is the same metal on both sides — so this is exactly the
 * difference of two `nernstPotential` readings and carries no data of its own.
 * The **depleted** side is the anode: dilute the metal ion and that metal
 * becomes more active, so it corrodes against its own twin.
 *
 * The same arithmetic with n = 4 over the oxygen half-cell is differential
 * aeration, where "activity" is the dissolved-oxygen level instead.
 */
export function concentrationCell(
  n: number,
  activityA: number,
  activityB: number,
  T_K = T25,
): ConcentrationCellResult | null {
  if (!(n > 0) || !(activityA > 0) || !(activityB > 0)) return null;
  const shift = (a: number) => (nernstSlope(T_K) / n) * Math.log10(a);
  const eA = shift(activityA);
  const eB = shift(activityB);
  const [eHigh, eLow] = eA >= eB ? [eA, eB] : [eB, eA];
  const emf = eHigh - eLow;
  return {
    eHigh,
    eLow,
    emf,
    anode: emf === 0 ? 'neither' : eA < eB ? 'high' : 'low',
  };
}
