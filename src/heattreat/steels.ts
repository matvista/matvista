/**
 * Steel data for isothermal (TTT) transformation and end-quench hardenability.
 *
 * Read the fixed points as data and the curves as interpolation, the same
 * convention `phase/systems.ts` uses. Specifically:
 *
 * - Compositions are nominal AISI/SAE grade midpoints.
 * - A₁ (727 °C) is the Fe–Fe₃C eutectoid temperature, consistent with the
 *   phase-diagram module.
 * - Mˢ comes from Andrews' linear equation (see `martensiteStart`), not from a
 *   hard-coded number, so it stays tied to the composition on screen.
 * - TTT nose positions and Jominy hardness values are digitised from published
 *   diagrams (Callister & Rethwisch ch. 10–11; ASM atlas shapes) and are
 *   approximate — good to a few degrees and a factor of order 1.5 in time.
 *   They are teaching curves, not design data.
 */

export interface Steel {
  id: string;
  name: string;
  /** Weight percent of each alloying element. */
  composition: { C: number; Mn: number; Ni: number; Cr: number; Mo: number };
  /** Eutectoid/A₁ temperature, °C. */
  a1: number;
  /**
   * Nose of the pearlite-start curve: the shortest incubation time and the
   * temperature it occurs at. Alloying pushes the nose right — that, and
   * nothing else, is what "hardenability" buys you.
   */
  nose: { time: number; temp: number };
  /** Time multiplier from the start curve to the finish curve at the nose. */
  finishFactor: number;
  /** Lower bound of the bainite field, °C — below this, only martensite forms. */
  bainiteFloor: number;
  /** Hardness of each product for this carbon level, HRC. */
  hardness: {
    coarsePearlite: number;
    finePearlite: number;
    bainite: number;
    martensite: number;
  };
  /** Jominy hardness, HRC, at the distances in `JOMINY_DISTANCES`. */
  jominy: number[];
  note: string;
}

/** Jominy bar positions, mm from the quenched end (ASTM A255 uses 1/16 in steps). */
export const JOMINY_DISTANCES = [1.5, 3, 5, 7, 9, 11, 13, 15, 20, 25, 30, 40, 50];

/**
 * Cooling rate at 700 °C at each Jominy distance, °C/s. A property of the bar
 * and the quench, not of the steel — which is exactly why one bar test ranks
 * every grade.
 */
export const JOMINY_RATES = [270, 170, 110, 70, 43, 32, 25, 20, 14, 10, 7.5, 5, 3.5];

export const STEELS: Steel[] = [
  {
    id: '1080',
    name: '1080 — plain carbon, eutectoid',
    composition: { C: 0.79, Mn: 0.75, Ni: 0, Cr: 0, Mo: 0 },
    a1: 727,
    nose: { time: 1, temp: 540 },
    finishFactor: 10,
    bainiteFloor: 250,
    hardness: { coarsePearlite: 15, finePearlite: 30, bainite: 45, martensite: 65 },
    jominy: [62, 40, 30, 28, 27, 26, 26, 25, 25, 24, 24, 23, 23],
    note: 'The classic teaching TTT diagram, and a cautionary one. Being eutectoid, it transforms to 100% pearlite or 100% martensite with no proeutectoid phase — but the nose sits at about one second, so anything short of a water quench misses martensite entirely. Hardness collapses within a few millimetres of the quenched end.',
  },
  {
    id: '5140',
    name: '5140 — chromium alloy',
    composition: { C: 0.4, Mn: 0.8, Ni: 0, Cr: 0.85, Mo: 0 },
    a1: 727,
    nose: { time: 6, temp: 550 },
    finishFactor: 12,
    bainiteFloor: 250,
    hardness: { coarsePearlite: 12, finePearlite: 25, bainite: 40, martensite: 57 },
    jominy: [57, 54, 47, 40, 35, 33, 31, 30, 28, 27, 26, 25, 24 ],
    note: 'Under a percent of chromium moves the nose from one second to about six, and that is the whole story of alloy steel: the chromium does little for the hardness of martensite, but it buys the time needed to form martensite at all in a section of useful thickness.',
  },
  {
    id: '4340',
    name: '4340 — Ni–Cr–Mo alloy',
    composition: { C: 0.4, Mn: 0.7, Ni: 1.8, Cr: 0.8, Mo: 0.25 },
    a1: 727,
    nose: { time: 100, temp: 560 },
    finishFactor: 15,
    bainiteFloor: 230,
    hardness: { coarsePearlite: 14, finePearlite: 27, bainite: 42, martensite: 57 },
    jominy: [60, 59, 58, 57, 57, 56, 56, 55, 54, 53, 51, 48, 45],
    note: 'The deep-hardening benchmark. With the nose pushed out past a hundred seconds, even the slowly cooled centre of a thick section escapes pearlite — 4340 is still near 50 HRC 50 mm from the quenched end, where 1080 has fallen to 23. Same martensite hardness as 5140; vastly more of the part gets to be martensite.',
  },
];

export function getSteel(id: string): Steel {
  return STEELS.find((s) => s.id === id) ?? STEELS[0];
}

/**
 * Martensite-start temperature, °C, from Andrews' linear regression (1965):
 *
 *   Mˢ = 539 − 423·C − 30.4·Mn − 17.7·Ni − 12.1·Cr − 7.5·Mo   (wt%)
 *
 * Carbon dominates by an order of magnitude. Push it high enough and Mˢ falls
 * below room temperature, which is why high-carbon steels keep untransformed
 * retained austenite after quenching.
 */
export function martensiteStart(c: Steel['composition']): number {
  return 539 - 423 * c.C - 30.4 * c.Mn - 17.7 * c.Ni - 12.1 * c.Cr - 7.5 * c.Mo;
}

/**
 * Ae₃, °C — the temperature at which a hypoeutectoid steel leaves the
 * single-phase γ field, from Andrews' linear regression (1965):
 *
 *   Ae₃ = 910 − 203·√C − 15.2·Ni + 44.7·Si + 104·V + 31.5·Mo + 13.1·W
 *              − 30·Mn − 11·Cr − 20·Cu + 700·P + 400·Al + 120·As + 400·Ti
 *
 * Same paper as `martensiteStart` above, which is why it is used here rather
 * than the binary Fe–Fe₃C boundary: that boundary is a function of carbon
 * alone, so it hands 5140 and 4340 the identical 814.63 °C and erases the only
 * difference between them, while sitting 66–82 °C above where either steel
 * actually leaves the γ field.
 *
 * **Only the terms this repo has data for are evaluated** — C, Ni, Mo, Mn, Cr.
 * The shipped `composition` carries no silicon, and these grades nominally
 * hold 0.15–0.35 wt% Si, so the values here run about 11 °C low against a
 * calculation that includes it. No silicon figure is invented to close that
 * gap; the shortfall is stated instead.
 *
 * Returns null above the eutectoid, where there is no γ → α + γ boundary to
 * report and the regression is outside its domain.
 */
export function ae3(c: Steel['composition']): number | null {
  if (c.C >= 0.76) return null;
  return (
    910 - 203 * Math.sqrt(c.C) - 15.2 * c.Ni + 31.5 * c.Mo - 30 * c.Mn - 11 * c.Cr
  );
}

/**
 * Temperature at which the given fraction of austenite has become martensite.
 * Koistinen–Marburger: f = 1 − exp(−0.011·(Mˢ − T)), inverted for T.
 */
export function martensiteFractionTemp(ms: number, fraction: number): number {
  return ms + Math.log(1 - fraction) / 0.011;
}
