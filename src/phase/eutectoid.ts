/**
 * The Fe–Fe₃C eutectoid, on its own.
 *
 * `phase/systems.ts` already computes this, and computes it generally: it finds
 * the lowest invariant that declares solid products, takes the tie line across
 * it, and runs three lever rules over three segments. That generality is worth
 * having — it is the same code path that answers Pb–Sn — and it is why that
 * file also carries two sampled boundary sets, an evaluator per system and the
 * Gibbs phase rule, for 7.80 kB before compression.
 *
 * The landing page needs one alloy system, at one temperature, from four
 * numbers. It is also the only eagerly-loaded view in the app, so pulling
 * `systems.ts` into it would put Cu–Ni's liquidus polynomial in front of every
 * first-time visitor to buy a slider.
 *
 * So the four fixed points and the arithmetic over them live here, in a file
 * with no imports, and `systems.ts` takes them **from** this file rather than
 * restating them. There is exactly one 0.76 in the repository. What is not
 * shared is the *shape* of the answer — `microconstituents` returns invariant
 * metadata and phase objects this page has no use for — and `eutectoid.test.ts`
 * holds the two implementations to the same numbers across the whole domain, so
 * the split below cannot drift from the module the page links into.
 *
 * Everything here is a mass fraction in [0, 1], not a percentage.
 */

/**
 * Lever rule: the fraction of the phase sitting at `C1`, for an overall
 * composition `C0` on a tie line whose ends are `C1` and `C2`.
 *
 * It lives in this file rather than in `systems.ts` because this is the
 * smallest module that needs it and `systems.ts` imports from here, not the
 * other way round. `systems.ts` re-exports it, so every existing call site is
 * unchanged.
 */
export function lever(C0: number, C1: number, C2: number): number {
  if (C2 === C1) return 1;
  return (C2 - C0) / (C2 - C1);
}

/*
 * Fixed points, Callister & Rethwisch §9.18. Every one of these is a measured
 * invariant or solubility limit, not a fitted parameter — which is the
 * distinction the landing page's first commitment is about.
 */

/** Eutectoid composition, wt% C. */
export const EUTECTOID_X = 0.76;
/** Eutectoid temperature, °C. */
export const EUTECTOID_T = 727;
/** Maximum carbon in austenite, wt% C at 1147 °C — the top of the steel range. */
export const GAMMA_MAX = 2.14;
/** Maximum carbon in ferrite, wt% C at 727 °C. */
export const FERRITE_MAX = 0.022;
/** Cementite, Fe₃C, as wt% C. */
export const CEMENTITE_X = 6.7;

/**
 * The ferrite fraction *inside pearlite*.
 *
 * Pearlite is what the eutectoid composition itself transforms to, so its
 * internal split is the lever rule taken at 0.76 across the same α + Fe₃C
 * field: 88.9 % ferrite, 11.1 % cementite, whatever the alloy around it is
 * doing. That constant is why the two bars in the landing page's instrument
 * line up — proeutectoid ferrite plus the ferrite inside pearlite is exactly
 * total ferrite, and the algebra reduces to (c − x)/(c − a) with everything
 * else cancelling. `eutectoid.test.ts` asserts the identity rather than
 * trusting the derivation.
 */
export const PEARLITE_FERRITE = lever(EUTECTOID_X, FERRITE_MAX, CEMENTITE_X);

export interface EutectoidSplit {
  kind: 'hypoeutectoid' | 'eutectoid' | 'hypereutectoid';
  /**
   * The phase that separated out *before* the eutectoid reaction, as it is
   * named on screen — null at exactly 0.76 wt% C, where none does.
   *
   * This is the flip the composition slider exists to show: below 0.76 the
   * proeutectoid constituent is ferrite, above it cementite, and the same steel
   * that was soft and tough on one side of the line is hard and brittle on the
   * other.
   */
  proeutectoid: 'α (ferrite)' | 'Fe₃C (cementite)' | null;
  /** Mass fraction of that proeutectoid constituent. */
  proeutectoidFraction: number;
  /** Mass fraction of pearlite — the lamellar α + Fe₃C mixture. */
  pearliteFraction: number;
  /**
   * Total α across both constituents, which is **not** the proeutectoid
   * fraction: pearlite is itself mostly ferrite, so its share counts here too.
   * Conflating the two is the misconception this readout is built to break.
   */
  totalFerrite: number;
  /** Total Fe₃C across both constituents. */
  totalCementite: number;
}

/**
 * Microconstituent and phase fractions for a plain carbon steel of composition
 * `C0`, cooled slowly to just below the eutectoid isotherm.
 *
 * Two lever rules over two different segments of the same tie line:
 *
 *   - Across the whole α + Fe₃C field, 0.022 → 6.70, for the *phase* fractions.
 *   - Across the proeutectoid segment — 0.022 → 0.76 below the eutectoid,
 *     0.76 → 6.70 above it — for the *microconstituent* split.
 *
 * Returns null outside [0.022, 2.14]: below the ferrite solubility limit the
 * alloy is single-phase α with no eutectoid product at all, and above 2.14 wt%
 * it is a cast iron, which reaches room temperature through the 1147 °C
 * eutectic this function does not model. Absent rather than clamped — a zeroed
 * fraction would read as an answer.
 */
export function eutectoidSplit(C0: number): EutectoidSplit | null {
  if (!(C0 >= FERRITE_MAX) || C0 > GAMMA_MAX) return null;

  const totalFerrite = lever(C0, FERRITE_MAX, CEMENTITE_X);

  // The exact eutectoid composition transforms wholly to pearlite. Compared
  // with a tolerance rather than `===` for the same reason `microconstituents`
  // does: 0.76 arrived at by adding hundredths on a slider is not bit-identical
  // to the constant.
  if (Math.abs(C0 - EUTECTOID_X) < 1e-9) {
    return {
      kind: 'eutectoid',
      proeutectoid: null,
      proeutectoidFraction: 0,
      pearliteFraction: 1,
      totalFerrite,
      totalCementite: 1 - totalFerrite,
    };
  }

  const hypo = C0 < EUTECTOID_X;
  const pearliteFraction = hypo
    ? (C0 - FERRITE_MAX) / (EUTECTOID_X - FERRITE_MAX)
    : (CEMENTITE_X - C0) / (CEMENTITE_X - EUTECTOID_X);

  return {
    kind: hypo ? 'hypoeutectoid' : 'hypereutectoid',
    proeutectoid: hypo ? 'α (ferrite)' : 'Fe₃C (cementite)',
    proeutectoidFraction: 1 - pearliteFraction,
    pearliteFraction,
    totalFerrite,
    totalCementite: 1 - totalFerrite,
  };
}

/** A mass fraction as the page prints it: one decimal place, with the sign. */
export function asPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)} %`;
}
