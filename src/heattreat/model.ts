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

export interface TttModel {
  start: CurvePoint[];
  finish: CurvePoint[];
  ms: number;
  m50: number;
  m90: number;
  a1: number;
}

export function buildTtt(steel: Steel): TttModel {
  const ms = martensiteStart(steel.composition);
  return {
    start: tttCurve(steel, 1),
    finish: tttCurve(steel, steel.finishFactor),
    ms,
    m50: martensiteFractionTemp(ms, 0.5),
    m90: martensiteFractionTemp(ms, 0.9),
    a1: steel.a1,
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

export type Product = 'coarse pearlite' | 'fine pearlite' | 'bainite' | 'martensite';

export interface Outcome {
  /** Product fractions, summing to 1. */
  fractions: { product: Product; fraction: number }[];
  /** Estimated hardness, HRC. */
  hardness: number;
  /** Temperature at which diffusional transformation began, if it did. */
  startTemp: number | null;
  /** Whether the diffusional transformation ran to completion. */
  complete: boolean;
  summary: string;
}

/** Which diffusional product forms at a given transformation temperature. */
function productAt(steel: Steel, T: number): Product {
  if (T >= steel.nose.temp) return 'coarse pearlite';
  if (T >= (steel.nose.temp + steel.bainiteFloor) / 2) return 'fine pearlite';
  return 'bainite';
}

/**
 * Read a cooling rate against the diagram.
 *
 * Three outcomes, and the boundaries between them are the point of the whole
 * construction: miss the nose entirely and you get martensite; clip it and you
 * get a mixture; cool slowly through it and you get pearlite.
 */
export function predict(steel: Steel, ttt: TttModel, startTemp: number, rate: number): Outcome {
  const startRun = scheil(ttt.start, startTemp, rate, ttt.ms);

  if (!startRun.reached) {
    return {
      fractions: [{ product: 'martensite', fraction: 1 }],
      hardness: steel.hardness.martensite,
      startTemp: null,
      complete: true,
      summary:
        'The path outruns the nose — nowhere along it does the accumulated incubation reach one — so austenite survives to Mˢ and shears to martensite. Fully hard, and fully brittle until tempered.',
    };
  }

  const hitStart = startRun.reached;
  const product = productAt(steel, hitStart.T);
  const finishRun = scheil(ttt.finish, startTemp, rate, ttt.ms);

  if (finishRun.reached) {
    return {
      fractions: [{ product, fraction: 1 }],
      hardness: hardnessOf(steel, product),
      startTemp: hitStart.T,
      complete: true,
      summary: `Transformation begins at ${Math.round(hitStart.T)} °C and runs to completion above Mˢ, giving ${product} throughout. Quenching afterwards changes nothing — there is no austenite left to harden.`,
    };
  }

  // Ran out of temperature before the finish curve was satisfied: whatever had
  // transformed stays, and the remaining austenite goes martensitic at Mˢ.
  const fraction = Math.min(1, Math.max(0, finishRun.sum));
  return {
    fractions: [
      { product, fraction },
      { product: 'martensite', fraction: 1 - fraction },
    ],
    hardness:
      hardnessOf(steel, product) * fraction + steel.hardness.martensite * (1 - fraction),
    startTemp: hitStart.T,
    complete: false,
    summary: `The path clips the nose: transformation starts at ${Math.round(hitStart.T)} °C but is cut short at Mˢ, leaving roughly ${Math.round(fraction * 100)}% ${product} embedded in martensite. Mixed microstructures like this are why a quench that is nearly fast enough is not good enough.`,
  };
}

function hardnessOf(steel: Steel, product: Product): number {
  switch (product) {
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
 * The cooling rate that just misses the nose — the slowest quench that still
 * gives fully martensitic structure. This single number is what "hardenability"
 * names, and it is why the alloy grades exist.
 */
export function criticalCoolingRate(steel: Steel, startTemp: number): number {
  return (startTemp - steel.nose.temp) / steel.nose.time;
}
