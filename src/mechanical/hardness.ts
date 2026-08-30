/**
 * Hardness — what it is, and what it does and does not convert to.
 *
 * Hardness is the most-run mechanical test in industry and the least
 * understood in a course, because students meet it as a conversion table and
 * take the table for physics. It is not: ASTM E140's own scope says the
 * conversions are approximate and not transferable between material classes.
 *
 * **What this module ships, and what it deliberately does not.** Every number
 * below comes from the *definition* of the scale — an indenter geometry, a
 * load, and a measured impression — so it is exact arithmetic on the reader's
 * own inputs. What is not shipped is a cross-scale conversion ladder: that is
 * empirical data calibrated on particular alloys, this repo cannot source it
 * honestly, and inventing one would teach the very thing the module exists to
 * correct. The panel refuses instead, and says why.
 *
 * The one correlation offered is tensile strength from Brinell, and it is
 * offered for steels only — see `tensileFromBrinell`.
 */

export type HardnessScale = 'brinell' | 'vickers' | 'knoop';

export interface ScaleDef {
  id: HardnessScale;
  name: string;
  symbol: string;
  indenter: string;
  /** Why the geometry is shaped that way. */
  note: string;
}

export const HARDNESS_SCALES: ScaleDef[] = [
  {
    id: 'brinell',
    name: 'Brinell',
    symbol: 'HB',
    indenter: '10 mm sphere',
    note: 'A large ball spreads the load over many grains, so Brinell averages a coarse or two-phase structure instead of sampling one constituent. That is why it suits castings, and why it cannot measure a thin case.',
  },
  {
    id: 'vickers',
    name: 'Vickers',
    symbol: 'HV',
    indenter: '136° diamond pyramid',
    note: 'A pyramid makes geometrically similar impressions at any load, so the number does not depend on how hard you press. One scale covers everything from lead to carbide.',
  },
  {
    id: 'knoop',
    name: 'Knoop',
    symbol: 'HK',
    indenter: 'elongated diamond pyramid',
    note: 'The long diagonal is about seven times the short one, so the impression is shallow for its length — which is how you measure a thin coating or a single phase without punching through it.',
  },
];

/**
 * Brinell hardness from load and impression diameter.
 *
 *     HB = 2F / (πD(D − √(D² − d²)))
 *
 * with F in kgf and D, d in mm — the units the scale is defined in. The
 * denominator is the curved area of the spherical cap, which is why Brinell is
 * an *area* measure and slow: you have to measure the impression.
 */
export function brinell(loadKgf: number, ballMm: number, impressionMm: number): number | null {
  if (loadKgf <= 0 || ballMm <= 0 || impressionMm <= 0 || impressionMm >= ballMm) return null;
  const cap = ballMm - Math.sqrt(ballMm ** 2 - impressionMm ** 2);
  return (2 * loadKgf) / (Math.PI * ballMm * cap);
}

/**
 * Vickers hardness.
 *
 *     HV = 1.8544 F / d²
 *
 * The constant is 2·sin(136°/2), which is where the 136° apex angle enters —
 * it is geometry, not a fitted number.
 */
export const VICKERS_CONSTANT = 2 * Math.sin((136 * Math.PI) / 180 / 2);

export function vickers(loadKgf: number, diagonalMm: number): number | null {
  if (loadKgf <= 0 || diagonalMm <= 0) return null;
  return (VICKERS_CONSTANT * loadKgf) / diagonalMm ** 2;
}

/**
 * Knoop hardness.
 *
 *     HK = 14.229 F / l²
 *
 * `l` is the *long* diagonal, and the constant follows from the indenter's
 * 172.5°/130° angles.
 */
export const KNOOP_CONSTANT = 14.229;

export function knoop(loadKgf: number, longDiagonalMm: number): number | null {
  if (loadKgf <= 0 || longDiagonalMm <= 0) return null;
  return (KNOOP_CONSTANT * loadKgf) / longDiagonalMm ** 2;
}

/** Tensile strength estimated from Brinell, MPa — Callister eq. 6.20a. */
export const TS_PER_HB = 3.45;

/**
 * The correlation, and the refusal.
 *
 * TS(MPa) ≈ 3.45·HB is calibrated on **steels**. It is not a law and it does
 * not transfer: applying it to an aluminium or copper alloy produces a
 * confident number that is simply wrong, which is exactly the mistake a
 * conversion table encourages. Returning null here rather than a value is the
 * lesson, so the panel has something to show rather than a footnote to print.
 */
export function tensileFromBrinell(hb: number, ferrous: boolean): number | null {
  if (!ferrous || hb <= 0) return null;
  return TS_PER_HB * hb;
}

/**
 * Whether a material is in the class the correlation was calibrated on.
 *
 * By id rather than by a property threshold: "ferrous" is a fact about the
 * alloy, and guessing it from modulus or density would be a second
 * correlation stacked on the first.
 */
const FERROUS_IDS = new Set(['fe', 'steel1020']);

export function isFerrous(materialId: string): boolean {
  return FERROUS_IDS.has(materialId);
}

/**
 * Cross-scale conversion is **not** offered, and this records why in code
 * rather than only in prose: E140's tables are empirical, calibrated per
 * material class, and this repo does not ship data it cannot source. A caller
 * asking for one gets null and the reason.
 */
export const CONVERSION_REFUSAL =
  'Cross-scale conversion is empirical, calibrated per material class, and not transferable — ASTM E140 says so in its own scope. This module computes each scale from its definition instead.';

export function convertScale(): null {
  return null;
}
