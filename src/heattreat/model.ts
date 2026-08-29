/**
 * Isothermal transformation curves, continuous-cooling paths and the products
 * they produce.
 *
 * The honest caveat, stated here because the UI states it too: superimposing a
 * continuous cooling path on an *isothermal* diagram is an approximation. Real
 * CCT curves sit below and to the right of the TTT curves, so a TTT reading
 * predicts pearlite slightly sooner than reality does. Callister teaches the
 * construction this way, and it gets the ordering and the mechanism right; it
 * is not a substitute for a measured CCT diagram.
 */

import { EUTECTOID_X, FERRITE_MAX, steelMicrostructure } from '../phase/systems';
import {
  martensiteFractionTemp,
  martensiteStart,
  type Steel,
} from './steels';

/** Undercooling exponent in the nucleation term; sets how sharp the nose is. */
const DRIVE_EXPONENT = 2.4;

export interface CurvePoint {
  /** Seconds. */
  t: number;
  /** °C. */
  T: number;
}

/**
 * A C-shaped TTT curve.
 *
 * Transformation needs both a driving force (which grows as you cool below A₁)
 * and diffusion (which dies as you cool), so the rate peaks in between and the
 * incubation time is shortest there. That competition is the whole reason the
 * curve is a C, and it is modelled here as the product of the two effects
 * rather than as a fitted spline, so the shape stays physical when the nose
 * moves.
 */
export function tttCurve(steel: Steel, timeScale: number, samples = 140): CurvePoint[] {
  const { a1, nose, bainiteFloor } = steel;
  const out: CurvePoint[] = [];

  // The two competing terms must balance exactly at the stated nose, or the
  // curve's minimum drifts away from the temperature the data specifies.
  // Setting d(ln t)/dT = 0 at the nose gives q = n·T_nose(K)² / (A₁ − T_nose).
  const q = (DRIVE_EXPONENT * (nose.temp + 273.15) ** 2) / (a1 - nose.temp);

  for (let i = 0; i <= samples; i++) {
    const T = a1 - 1 - ((a1 - 1 - bainiteFloor) * i) / samples;
    out.push({ t: incubationTime(steel, T) * timeScale, T });
  }
  return out.filter((p) => Number.isFinite(p.t) && p.t > 0);

  function incubationTime(s: Steel, T: number): number {
    // Undercooling below A₁ drives nucleation; the term diverges at A₁ itself,
    // where there is no driving force and transformation takes forever.
    const undercooling = Math.max(a1 - T, 1e-6);
    const noseUndercooling = a1 - nose.temp;
    const drive = (noseUndercooling / undercooling) ** DRIVE_EXPONENT;

    // Diffusion falls off as an Arrhenius term in absolute temperature.
    const diffusion = Math.exp(q * (1 / (T + 273.15) - 1 / (nose.temp + 273.15)));

    return s.nose.time * drive * diffusion;
  }
}

/**
 * Equilibrium proeutectoid ferrite fraction, by the lever rule.
 *
 * Delegated to `steelMicrostructure` in `phase/systems.ts` — the same function
 * that reproduces Callister's 0.35 wt% C worked example (44% pearlite, 56%
 * proeutectoid ferrite) — rather than retyping 0.76 and 0.022 here, so the
 * phase diagram and the TTT module cannot drift apart. For the two 0.40 wt% C
 * steels it is (0.76 − 0.40)/(0.76 − 0.022) ≈ 0.488.
 *
 * Returns 0 for any steel that is not hypoeutectoid. 1080 is nominally the
 * eutectoid grade and its note says it forms no proeutectoid phase; its 0.79
 * wt% C actually sits 0.03 above the eutectoid, so a real 1080 rejects a trace
 * (≈0.5%) of proeutectoid *cementite*. This model does not report that, which
 * is the pre-existing simplification the note describes, and it is left alone
 * here — nothing about 1080's output changes.
 */
export function equilibriumFerriteFraction(steel: Steel): number {
  const micro = steelMicrostructure(steel.composition.C);
  if (!micro || micro.proeutectoid !== 'α (ferrite)') return 0;
  return micro.proeutectoidFraction;
}

export interface TttModel {
  start: CurvePoint[];
  finish: CurvePoint[];
  ms: number;
  m50: number;
  m90: number;
  a1: number;
  /** Lever-rule proeutectoid ferrite fraction, at full transformation. */
  equilibriumFerrite: number;
}

export function buildTtt(steel: Steel): TttModel {
  const ms = martensiteStart(steel.composition);
  const equilibriumFerrite = equilibriumFerriteFraction(steel);
  return {
    start: tttCurve(steel, 1),
    finish: tttCurve(steel, steel.finishFactor),
    ms,
    m50: martensiteFractionTemp(ms, 0.5),
    m90: martensiteFractionTemp(ms, 0.9),
    a1: steel.a1,
    equilibriumFerrite,
  };
}

/** Linear cooling from the austenitising temperature: T = T₀ − rate·t. */
export function coolingPath(
  startTemp: number,
  rate: number,
  tMin: number,
  tMax: number,
  samples = 200,
): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    // Even spacing in log time, since that is the axis it is drawn on.
    const t = tMin * (tMax / tMin) ** (i / samples);
    const T = startTemp - rate * t;
    if (T < 0) break;
    out.push({ t, T });
  }
  return out;
}

/**
 * How far transformation has progressed along a cooling path, by Scheil's
 * additivity rule.
 *
 * A cooling path spends a moment at each temperature, and each moment consumes
 * a fraction dt/τ(T) of the incubation the curve demands there. Transformation
 * arrives when those fractions sum to one. This is the standard way to read a
 * continuous cooling path off isothermal data, and it matters here because a
 * path that merely touches the curve at one temperature keeps descending into
 * territory where τ is shorter still — judging the outcome at the first
 * crossing alone would badly underestimate how much pearlite forms.
 */
function scheil(
  curve: CurvePoint[],
  startTemp: number,
  rate: number,
  floor: number,
): { reached: CurvePoint | null; sum: number } {
  let sum = 0;
  let prev: CurvePoint | null = null;

  for (const p of curve) {
    if (p.T > startTemp) continue; // path has not cooled this far yet
    if (p.T < floor) break; // below the floor the mechanism changes

    if (prev) {
      // Time the path takes to fall from prev.T to p.T.
      const dt = (prev.T - p.T) / rate;
      // Trapezoid on 1/τ, which varies by orders of magnitude across the step.
      const contribution = (dt / 2) * (1 / prev.t + 1 / p.t);
      if (sum + contribution >= 1) {
        return { reached: p, sum: 1 };
      }
      sum += contribution;
    }
    prev = p;
  }
  return { reached: null, sum };
}

export type Product =
  | 'proeutectoid ferrite'
  | 'coarse pearlite'
  | 'fine pearlite'
  | 'bainite'
  | 'martensite';

/**
 * Below this fraction a diffusional product is reported as a trace rather than
 * as a phase in its own right. Shared with the UI so the bar chart and the
 * prose can never disagree about whether there is anything there: without it,
 * a path just under the critical rate renders a zero-width segment captioned
 * "0%" beside a sentence claiming that much product formed.
 */
export const TRACE_FRACTION = 0.005;

export interface Outcome {
  /** Product fractions, summing to 1. */
  fractions: { product: Product; fraction: number }[];
  /** Estimated hardness, HRC. */
  hardness: number;
  /** Temperature at which diffusional transformation began, if it did. */
  startTemp: number | null;
  /** Whether the diffusional transformation ran to completion. */
  complete: boolean;
  /**
   * Martensite-start temperature actually used for this path, °C.
   *
   * Not `TttModel.ms`: rejecting proeutectoid ferrite enriches the austenite
   * that is left, and carbon dominates Andrews' equation, so the austenite
   * quenching at the end of a ferrite-forming path has a much lower Mˢ than
   * the steel as a whole — 183 °C against 335 for 5140 at its saturation
   * point. This is the figure the Scheil floor, the plot's Mˢ line and the
   * retained-austenite warning all use.
   */
  ms: number;
  /** Temperature for 50% martensite, from `ms`. */
  m50: number;
  /** Temperature for 90% martensite, from `ms`. */
  m90: number;
  summary: string;
}

/**
 * Lowest temperature at which this model will call a product pearlitic.
 *
 * **Hypoeutectoid steels: the pearlite nose.** Below it the product is
 * bainite. This is the floor the whole ferrite series needed and did not have.
 * Pearlite in a hypoeutectoid steel implies proeutectoid ferrite before it —
 * that is what `splitProeutectoid` encodes — so wherever this function says
 * "pearlite", the model reports ferrite. With the divide at the arithmetic
 * midpoint below, 4340 called everything down to 395 °C fine pearlite and the
 * model duly reported proeutectoid ferrite forming at 396.5 °C, against a
 * measured ferrite start near 700 °C that only appears at 0.01–0.1 °C/s
 * (dilatometric CCT for 4340, Materials 2020, 13, 5585; 42CrMo4 agrees as a
 * 0.4 wt% C proxy, Materials 2022, 15, 3076).
 *
 * The nose is shipped digitised data and it is the lowest temperature at which
 * this model has any evidence of a pearlitic reaction, so it is the tightest
 * bound available without inventing one. It errs toward under-reporting
 * ferrite, which is the safe direction for a number the module presents as a
 * ceiling.
 *
 * **Known limitation, deliberately not patched.** 4340's bainite start is
 * measured at 476–480 °C and is not used here. Adopting it would put a
 * fine-pearlite field between 478 and 560 °C, and ferrite-leads would then
 * report proeutectoid ferrite down to 478 °C — further from the measured
 * ferrite start than the nose is. One measured number cannot be dropped into a
 * model whose neighbouring boundary is inferred; both would have to move
 * together, and the second has no published value for 5140 that is readable
 * (the ASM atlas is paywalled). Recorded rather than extrapolated.
 *
 * **Eutectoid steels keep the shipped midpoint**, unchanged. It has no
 * metallurgical basis either, but 1080 forms no proeutectoid phase, so nothing
 * downstream of it is affected and changing it would move published output for
 * no gain. Steven & Haynes' Bs is not a fix: it is fitted to 0.10–0.55 wt% C
 * and 1080 is 0.79, outside its range.
 */
function pearliteFloor(steel: Steel): number {
  if (steel.composition.C < EUTECTOID_X) return steel.nose.temp;
  return (steel.nose.temp + steel.bainiteFloor) / 2;
}

/** Which diffusional product forms at a given transformation temperature. */
function productAt(steel: Steel, T: number): Product {
  if (T >= steel.nose.temp) return 'coarse pearlite';
  if (T >= pearliteFloor(steel)) return 'fine pearlite';
  return 'bainite';
}

/**
 * Carbon content of a transformation product, wt%.
 *
 * Proeutectoid ferrite is the α end of the eutectoid tie line and pearlite is
 * the eutectoid composition itself, both read from `phase/systems.ts` rather
 * than retyped. Bainite and martensite are diffusionless in carbon terms —
 * they inherit whatever the austenite they formed from was carrying, which
 * this model takes as the bulk composition.
 *
 * Exported so the UI can show how far ferrite rejection has enriched the
 * remaining austenite without recomputing the mass balance itself.
 */
export function productCarbon(product: Product, bulkC: number): number {
  switch (product) {
    case 'proeutectoid ferrite':
      return FERRITE_MAX;
    case 'coarse pearlite':
    case 'fine pearlite':
      return EUTECTOID_X;
    case 'bainite':
    case 'martensite':
      return bulkC;
  }
}

/**
 * Carbon left in the austenite that has not transformed diffusionally, wt%, or
 * **null where this model cannot resolve it**.
 *
 * Ferrite rejection is what enriches it: every unit of ferrite takes only
 * 0.022 wt% C out of a 0.40 wt% steel, so the balance concentrates in what
 * remains. This is the quantity that governs the real Mˢ.
 *
 * Martensite is excluded from the sum on purpose: it *is* the austenite that
 * survived, so counting its carbon as already consumed would report the
 * remaining austenite as depleted rather than enriched. Getting that wrong
 * once made 5140 at 10 °C/s read 0.12 wt% C instead of 0.52 and silently
 * suppressed the caveat that depends on it.
 *
 * **Three ways out of the domain, all returning null rather than a number.**
 * An earlier version returned the bulk composition in the first case and
 * nothing at all in the others, which made "outside domain" invisible to any
 * caller not already gated — and this is exported, so one caller is all that
 * kept it safe.
 *
 *  1. **No ferrite.** Without proeutectoid ferrite there is no enrichment
 *     mechanism and the balance does not close: 1080 is hyper-eutectoid, its
 *     pearlite carries 0.76 wt% against a 0.79 bulk, and the surplus belongs
 *     to cementite this model does not track. Measured with the guard removed,
 *     the quotient reaches **146.85 wt% C** on a 0.0002-decade sweep and runs
 *     higher on a finer one. (b0b4181 quoted 6.97 wt% for this, which was an
 *     understatement, not the overstatement it read as.)
 *  2. **Nothing untransformed.** A completed transformation leaves no
 *     austenite to have a composition.
 *  3. **Cancellation.** Just above the completion boundary both
 *     `bulkC − carbon` and `1 − solid` are differences of nearly equal
 *     doubles, so the quotient is noise: 4340 at 0.14224645321580959 returned
 *     1.0000 wt% C, and 64 of the 4000 consecutive representable rates above
 *     that edge exceeded 0.7605. Reachable from the URL, since
 *     `useRouteNumber` parses with a bare `Number()`.
 *
 * Case 3 is caught by checking the *result* against the range ferrite-leads
 * guarantees — at or above the bulk, at or below the eutectoid, because
 * ferrite stops at `alphaEq` which is exactly where the residue reaches
 * 0.76 wt%. A result outside that has left its domain, and saying so beats
 * clamping it into range, which would hide the evidence. That is the lesson
 * iteration 9 already paid for.
 */
export function untransformedAusteniteCarbon(outcome: Outcome, bulkC: number): number | null {
  let solid = 0;
  let carbon = 0;
  let ferrite = 0;
  for (const f of outcome.fractions) {
    if (f.product === 'martensite') continue;
    if (f.product === 'proeutectoid ferrite') ferrite += f.fraction;
    solid += f.fraction;
    carbon += f.fraction * productCarbon(f.product, bulkC);
  }
  if (ferrite <= 0 || solid >= 1) return null;
  const value = (bulkC - carbon) / (1 - solid);
  if (!Number.isFinite(value)) return null;
  if (value < bulkC - 1e-9 || value > EUTECTOID_X + 1e-9) return null;
  return value;
}

/**
 * Divide a diffusional product into the proeutectoid ferrite that leads it and
 * the pearlite that follows.
 *
 * **Ferrite leads.** In a hypoeutectoid steel the ferrite reaction is the
 * faster of the two and runs ahead of pearlite: austenite rejects carbon-poor
 * ferrite until what remains has been enriched to the eutectoid composition,
 * and only then can pearlite form. So the first `alphaEq` of any diffusional
 * transformation is ferrite, and only the remainder is pearlite:
 *
 *     ferrite  = min(f, alphaEq)
 *     pearlite = max(0, f − alphaEq)
 *
 * where `f` is the fraction of the sample that transformed diffusionally and
 * `alphaEq` is the lever-rule equilibrium fraction. At f = 1 this reduces
 * exactly to the lever rule, so a slow cool is unchanged.
 *
 * **Why not the two obvious alternatives**, both of which were shipped and
 * withdrawn. Splitting `f` proportionally at every rate implies ferrite and
 * pearlite forming together in equilibrium proportions from the first instant,
 * which is not what happens and which credits ferrite to paths that never
 * entered its range. Applying the lever rule only to a completed
 * transformation is worse still: it puts a 48.78-point step across an
 * infinitesimal change in cooling rate, and in the band just above it reports
 * up to 98.3% pearlite — a structure that needs the remaining austenite to
 * hold about −19 wt% carbon, i.e. one that cannot exist at any composition.
 *
 * Ferrite-leads is continuous, monotone in cooling rate, and conserves carbon
 * in the right direction: below `alphaEq` the product is all ferrite and the
 * untransformed austenite is *enriched* — at f = 0.1 it holds
 * (0.40 − 0.1 × 0.022) / 0.9 = 0.442 wt% C — reaching exactly 0.76 wt% at
 * f = alphaEq, which is precisely where pearlite becomes possible. All three
 * properties are asserted.
 *
 * **Bainite is excluded**, and that is a scope note rather than a physical
 * law: a slack-quenched 4340 really does come out ferrite + bainite. This
 * model has no ferrite kinetics, so it cannot say how much ferrite precedes a
 * bainitic reaction and does not invent a figure. The consequence is that
 * where `productAt` calls the product bainite, the whole diffusional fraction
 * is reported as bainite.
 *
 * **Known simplification, disclosed rather than hidden:** enriched austenite
 * has a lower Mˢ, and `martensiteStart` is computed from the *bulk*
 * composition. On a path that forms ferrite and then quenches — 5140 at
 * 10 °C/s leaves austenite at about 0.52 wt% C — the true Mˢ is some 50 °C
 * below the one shown. Propagating the enrichment would move the Scheil floor
 * and with it every critical cooling rate, which is a larger change than this
 * one and is not made here. The UI says so.
 */
function splitProeutectoid(
  ttt: TttModel,
  product: Product,
  fraction: number,
): { product: Product; fraction: number }[] {
  const alpha = ttt.equilibriumFerrite;
  if (alpha <= 0 || fraction <= 0) return [{ product, fraction }];
  if (product !== 'coarse pearlite' && product !== 'fine pearlite') {
    return [{ product, fraction }];
  }
  const ferrite = Math.min(fraction, alpha);
  const pearlite = Math.max(0, fraction - alpha);
  const parts: { product: Product; fraction: number }[] = [
    { product: 'proeutectoid ferrite', fraction: ferrite },
  ];
  if (pearlite > 0) parts.push({ product, fraction: pearlite });
  return parts;
}

/**
 * Name the diffusional products the bar will actually draw, and their total.
 *
 * Prose and bar are gated by the same `TRACE_FRACTION` on the same numbers, so
 * they cannot disagree about what formed or how much of it — the failure mode
 * that shipped once, where the prose quantified a product the bar had already
 * filtered out.
 */
function describeParts(parts: { product: Product; fraction: number }[]): {
  /** "49% proeutectoid ferrite and 25% coarse pearlite" — one figure each. */
  phrase: string;
  /** The bare names, for the branch that quantifies nothing. */
  names: string;
  total: number;
} {
  const shown = parts.filter((p) => p.fraction >= TRACE_FRACTION);
  const each = shown.map((p) => `${Math.round(p.fraction * 100)}% ${p.product}`);
  const join = (xs: string[]) =>
    xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
  return {
    phrase: join(each),
    names: join(shown.map((p) => p.product)),
    total: shown.reduce((a, p) => a + p.fraction, 0),
  };
}

/**
 * Read a cooling rate against the diagram.
 *
 * Three outcomes, and the boundaries between them are the point of the whole
 * construction: miss the nose entirely and you get martensite; clip it and you
 * get a mixture; cool slowly through it and you get pearlite.
 */
export function predict(steel: Steel, ttt: TttModel, startTemp: number, rate: number): Outcome {
  return withEnrichedMartensiteStart(steel, ttt, startTemp, rate);
}

/**
 * Report the Mˢ of the austenite the martensite actually forms from.
 *
 * Rejecting proeutectoid ferrite enriches what is left, up to the eutectoid
 * 0.76 wt% C, and carbon dominates Andrews' equation — so on a ferrite-forming
 * path the austenite reaching Mˢ is 152 °C colder in 5140 and 152 °C colder in
 * 4340 than the steel as a whole. Computing the displayed Mˢ from the bulk
 * composition was wrong twice over: the row was wrong, and the
 * retained-austenite warning is gated on M90, so it stayed silent on paths
 * drawing up to 51% martensite that could not fully transform at room
 * temperature — while firing for 1080, which does not need it. Two caveats on
 * one panel contradicting each other.
 *
 * **The Scheil floor still uses the bulk Mˢ, and that is a reduction, not an
 * oversight.** Feeding the enriched value back into the floor was implemented
 * and withdrawn: the two are coupled — a lower Mˢ lets the path transform
 * further, forming more ferrite, enriching further, lowering Mˢ again — and
 * the map is not a contraction. Measured, the fixed point is bistable: at
 * 5140 3.11745 °C/s it jumps 335.2 → 182.9 °C across a 0.2% change in rate,
 * taking the pearlite fraction 2.67 points up as cooling gets *faster*. That
 * is the discontinuity class this series has already shipped twice, so it is
 * not shipped a third time.
 *
 * What the reduction leaves wrong, measured rather than hand-waved: with the
 * floor at the bulk value the path stops transforming a little early, so the
 * diffusional fraction is understated by a few points — 23.94% ferrite against
 * 24.65% for 5140 at 10 °C/s, and at most about 2.7 points anywhere. That is
 * the residual, and it is two orders of magnitude smaller than the 152 °C the
 * displayed Mˢ was out by.
 *
 * Nothing here can move a critical cooling rate: a path that misses the nose
 * forms no ferrite, so there is no enrichment, and the floor is untouched in
 * any case. Asserted bit-identical.
 */
function withEnrichedMartensiteStart(
  steel: Steel,
  ttt: TttModel,
  startTemp: number,
  rate: number,
): Outcome {
  const outcome = predictWithMs(steel, ttt, startTemp, rate, ttt.ms);
  const carbon = untransformedAusteniteCarbon(outcome, steel.composition.C);
  if (carbon === null || carbon <= steel.composition.C) return outcome;
  const ms = martensiteStart({ ...steel.composition, C: carbon });
  return {
    ...outcome,
    ms,
    m50: martensiteFractionTemp(ms, 0.5),
    m90: martensiteFractionTemp(ms, 0.9),
  };
}

function predictWithMs(
  steel: Steel,
  ttt: TttModel,
  startTemp: number,
  rate: number,
  ms: number,
): Outcome {
  const martensite = { ms, m50: martensiteFractionTemp(ms, 0.5), m90: martensiteFractionTemp(ms, 0.9) };
  const startRun = scheil(ttt.start, startTemp, rate, ms);

  if (!startRun.reached) {
    return {
      fractions: [{ product: 'martensite', fraction: 1 }],
      hardness: steel.hardness.martensite,
      startTemp: null,
      complete: true,
      ...martensite,
      summary:
        'The path outruns the nose — nowhere along it does the accumulated incubation reach one — so austenite survives to Mˢ and shears to martensite. Fully hard, and fully brittle until tempered.',
    };
  }

  const hitStart = startRun.reached;
  const product = productAt(steel, hitStart.T);
  const finishRun = scheil(ttt.finish, startTemp, rate, ms);

  if (finishRun.reached) {
    const parts = splitProeutectoid(ttt, product, 1);
    const alpha = parts.length > 1 ? parts[0].fraction : 0;
    return {
      fractions: parts,
      hardness: hardnessOf(steel, product),
      startTemp: hitStart.T,
      complete: true,
      ...martensite,
      summary:
        alpha > 0
          ? `Transformation begins at ${Math.round(hitStart.T)} °C and runs to completion above Mˢ. Because this steel is hypoeutectoid, it must first reject proeutectoid ferrite — pearlite is eutectoid at 0.76 wt% C, and rejecting the carbon-poor ferrite first is what enriches the remaining austenite to that composition. The binary Fe–Fe₃C lever rule puts that at ${Math.round(alpha * 100)}%, which is an upper bound: alloying lowers the eutectoid carbon, so the true figure for this grade is lower. Quenching afterwards changes nothing — there is no austenite left to harden.`
          : `Transformation begins at ${Math.round(hitStart.T)} °C and runs to completion above Mˢ, giving ${product} throughout. Quenching afterwards changes nothing — there is no austenite left to harden.`,
    };
  }

  // Ran out of temperature before the finish curve was satisfied: whatever had
  // transformed stays, and the remaining austenite goes martensitic at Mˢ.
  //
  // `finishRun.sum` is additivity progress accumulated from the austenitising
  // temperature, so it is already non-zero at the instant transformation
  // begins — the path has been banking fractions of the *finish* incubation
  // all the way down. Reporting it raw made the readout jump straight to
  // 7–10% product the moment the path touched the start curve, which
  // contradicts the legend's own definition of that curve as 1% transformed.
  // Re-zeroing at the start event makes the fraction run continuously from 0
  // there to 1 where the finish curve is satisfied.
  const banked = scheil(ttt.finish, startTemp, rate, hitStart.T).sum;
  const progress = banked >= 1 ? 1 : (finishRun.sum - banked) / (1 - banked);
  const fraction = Math.min(1, Math.max(0, progress));
  const parts = splitProeutectoid(ttt, product, fraction);
  const shown = describeParts(parts);
  // The matrix is subject to the same rule as the product: if the bar does not
  // draw the martensite, the prose must not say the structure is embedded in
  // it. Just below full transformation that fraction goes under the display
  // floor — 1080 at 23.44 °C/s left 0.098% — and the sentence named a phase
  // that was not on screen.
  const matrixDrawn = 1 - fraction >= TRACE_FRACTION;
  return {
    fractions: [...parts, { product: 'martensite', fraction: 1 - fraction }],
    hardness:
      hardnessOf(steel, product) * fraction + steel.hardness.martensite * (1 - fraction),
    startTemp: hitStart.T,
    complete: false,
    ...martensite,
    summary:
      shown.total < TRACE_FRACTION
        ? `The path only just clips the nose: transformation begins at ${Math.round(hitStart.T)} °C, barely above Mˢ, so no more than a trace of ${parts[0].product} forms before the remaining austenite shears to martensite. This is the boundary the critical cooling rate names — a shade faster and the nose is missed altogether.`
        : matrixDrawn
          ? `The path clips the nose: transformation starts at ${Math.round(hitStart.T)} °C but is cut short at Mˢ, leaving roughly ${shown.phrase} embedded in martensite. Mixed microstructures like this are why a quench that is nearly fast enough is not good enough.`
          : `The path very nearly completes: transformation starts at ${Math.round(hitStart.T)} °C and is all but finished before Mˢ, giving ${shown.phrase} with no more than a trace of martensite. A shade faster and that trace becomes a real fraction.`,
  };
}

/**
 * Hardness of a transformation product for this steel.
 *
 * **Scope note: the ferrite split does not change the hardness readout, and
 * that is deliberate.**
 *
 * The argument is a solid-solution one, not a reading of the doc comment. An
 * earlier version of this note claimed `steels.ts`'s phrase "hardness of each
 * product *for this carbon level*" implied a whole-structure figure; it does
 * not, since martensite (57 vs 65) and bainite (40 vs 45) differ between the
 * grades with no proeutectoid ferrite involved anywhere, so the phrase plainly
 * means intrinsic hardness.
 *
 * The directional argument: pearlite is eutectoid whatever steel it grows in,
 * and 5140's pearlitic ferrite carries more in solid solution than 1080's —
 * +0.85 Cr, and +0.05 Mn, since 1080 already holds 0.75 Mn. (An earlier
 * version of this note said "0.85 Cr and 0.8 Mn", comparing 5140's manganese
 * against zero rather than against 1080's; the manganese term is about
 * sixteen times smaller than that implied, and chromium carries the argument.)
 * A *pure pearlite constituent* in 5140 should therefore be at least as hard
 * as 1080's, not softer, so the shipped 12 HRC against 1080's 15 points to a
 * figure that already has the proeutectoid ferrite in it.
 *
 * That is evidence, not proof, and it deliberately is not leaned on harder:
 * 12 and 15 both sit below HRC 20, the range the note below calls unreliable,
 * so a three-point difference there cannot bear a quantitative conclusion.
 * What it does support is the direction — do not dilute — and the check that
 * diluting would report ≈ 6 HRC for annealed 5140 against a real ≈ 13 HRC
 * agrees with it.
 *
 * The hardness of the pearlite constituent alone is not determined by anything
 * in this repo, and none is invented here. The claim this model makes is about
 * the **microstructure**; the hardness readout is left as it was.
 *
 * One consequence of ferrite-leads to be honest about: on a partial path the
 * diffusional product can be entirely proeutectoid ferrite, and this still
 * prices it at the pearlitic figure. Ferrite is softer, so the hardness is
 * overstated there by at most the ferrite fraction times that figure. The
 * worst reachable point is where the product is entirely ferrite at the full
 * lever-rule fraction, not where the ferrite fraction is largest in absolute
 * terms — 5140 at 5.7219 °C/s and 4340 at 0.2719 °C/s, both 48.78% ferrite,
 * bounding the overstatement at **5.85 and 6.83 HRC** against reported
 * hardnesses of 35.05 and 36.03. An earlier version of this note said "under
 * 3 HRC at 5140 @ 10 °C/s", which was the wrong point and about half the
 * figure. Both numbers are now asserted, so they cannot go stale again.
 *
 * Follow-up, not fixed here: all three coarse-pearlite values sit below
 * HRC 20, where the Rockwell C scale is unreliable and the indenter is barely
 * engaged. They would be better quoted in HB.
 */
function hardnessOf(steel: Steel, product: Product): number {
  switch (product) {
    case 'proeutectoid ferrite':
      // Unreachable by construction: `predict` only ever asks for the hardness
      // of the product `productAt` chose, and that is never ferrite. Returning
      // `coarsePearlite` here — as this did — silently answered a question the
      // scope note says has no answer, handing back 12 HRC for a ~80 HB phase.
      throw new Error(
        'hardnessOf: proeutectoid ferrite has no hardness in this model. ' +
          'See the scope note above — the per-product figures already include it.',
      );
    case 'coarse pearlite':
      return steel.hardness.coarsePearlite;
    case 'fine pearlite':
      return steel.hardness.finePearlite;
    case 'bainite':
      return steel.hardness.bainite;
    case 'martensite':
      return steel.hardness.martensite;
  }
}

/**
 * The by-hand construction: the straight cooling line drawn through the nose,
 * (T₀ − T_nose) / t_nose. This is what a student reads off the diagram with a
 * ruler, and it is deliberately kept alongside `criticalCoolingRate` rather
 * than replaced by it — the gap between the two is the teaching point, not an
 * error. A path that merely touches the nose has not lingered near it long
 * enough to accumulate a full incubation, so additivity permits a slower
 * quench than the ruler does.
 */
export function tangentCoolingRate(steel: Steel, startTemp: number): number {
  return (startTemp - steel.nose.temp) / steel.nose.time;
}

/** Bracket the critical-rate search runs over, °C/s. */
const RATE_MIN = 0.001;
const RATE_MAX = 1e5;

/** True when the path outruns the nose entirely, by `predict`'s own criterion. */
function missesNose(steel: Steel, ttt: TttModel, startTemp: number, rate: number): boolean {
  return predict(steel, ttt, startTemp, rate).startTemp === null;
}

/**
 * The cooling rate that just misses the nose — the slowest quench that still
 * gives fully martensitic structure. This single number is what "hardenability"
 * names, and it is why the alloy grades exist.
 *
 * Found by bisecting `predict` rather than by the textbook construction of a
 * cooling line drawn through the nose. The two disagree, and the disagreement
 * is the honest part: the tangent construction gives 310 °C/s for 1080 where
 * additivity gives 233, because a path that merely *touches* the nose has not
 * spent enough time near it to accumulate a full incubation. Deriving the
 * number from the same model that draws the outcome means the table and the
 * slider can never contradict each other — set the slider just below this rate
 * and the first pearlite appears.
 *
 * `predict` is monotone in rate (faster cooling never yields less martensite),
 * which is what licenses the bisection.
 *
 * Returns null when even `RATE_MAX` cannot outrun the nose.
 */
export function criticalCoolingRate(
  steel: Steel,
  ttt: TttModel,
  startTemp: number,
): number | null {
  if (!missesNose(steel, ttt, startTemp, RATE_MAX)) return null;
  if (missesNose(steel, ttt, startTemp, RATE_MIN)) return RATE_MIN;

  let lo = RATE_MIN; // hits the nose
  let hi = RATE_MAX; // misses it
  // 50 bisections in log space resolve the bracket far finer than the data warrants.
  for (let i = 0; i < 50; i++) {
    const mid = Math.sqrt(lo * hi);
    if (missesNose(steel, ttt, startTemp, mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
