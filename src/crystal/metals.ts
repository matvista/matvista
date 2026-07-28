/**
 * Atomic radii and crystal structures — Callister & Rethwisch, table 3.1.
 * Radii in nm. Kept to the book's 16 metals so worked problems line up.
 */
export interface MetalEntry {
  symbol: string;
  name: string;
  structure: 'fcc' | 'bcc' | 'hcp';
  /** Atomic radius, nm. */
  R: number;
  /**
   * Measured c/a, HCP metals only. Callister notes that "for some HCP metals
   * this ratio deviates from the ideal value" of 1.633 — zinc and cadmium
   * dramatically so, which throws the density prediction out by ~15% if the
   * ideal ratio is assumed.
   */
  coa?: number;
}

export const IDEAL_COA = 1.633;

export const METALS: MetalEntry[] = [
  { symbol: 'Al', name: 'Aluminium', structure: 'fcc', R: 0.1431 },
  { symbol: 'Cd', name: 'Cadmium', structure: 'hcp', R: 0.149, coa: 1.886 },
  { symbol: 'Cr', name: 'Chromium', structure: 'bcc', R: 0.1249 },
  { symbol: 'Co', name: 'Cobalt', structure: 'hcp', R: 0.1253, coa: 1.623 },
  { symbol: 'Cu', name: 'Copper', structure: 'fcc', R: 0.1278 },
  { symbol: 'Au', name: 'Gold', structure: 'fcc', R: 0.1442 },
  { symbol: 'Fe', name: 'Iron (α)', structure: 'bcc', R: 0.1241 },
  { symbol: 'Pb', name: 'Lead', structure: 'fcc', R: 0.175 },
  { symbol: 'Mo', name: 'Molybdenum', structure: 'bcc', R: 0.1363 },
  { symbol: 'Ni', name: 'Nickel', structure: 'fcc', R: 0.1246 },
  { symbol: 'Pt', name: 'Platinum', structure: 'fcc', R: 0.1387 },
  { symbol: 'Ag', name: 'Silver', structure: 'fcc', R: 0.1445 },
  { symbol: 'Ta', name: 'Tantalum', structure: 'bcc', R: 0.143 },
  { symbol: 'Ti', name: 'Titanium (α)', structure: 'hcp', R: 0.1445, coa: 1.587 },
  { symbol: 'W', name: 'Tungsten', structure: 'bcc', R: 0.1371 },
  { symbol: 'Zn', name: 'Zinc', structure: 'hcp', R: 0.1332, coa: 1.856 },
];

const AVOGADRO = 6.022e23;

export interface DensityResult {
  /** Lattice parameter a, nm. */
  a: number;
  /** Unit cell volume, cm³. */
  Vc: number;
  /** Theoretical density, g/cm³. */
  rho: number;
}

/**
 * Theoretical density, Callister eq. 3.8:  ρ = nA / (Vc · N_A)
 *
 * @param N          atoms per unit cell
 * @param atomicMass g/mol
 * @param R          atomic radius, nm
 * @param aOverR     lattice parameter as a multiple of R
 * @param volumeOverA3 cell volume as a multiple of a³
 */
export function theoreticalDensity(
  N: number,
  atomicMass: number,
  R: number,
  aOverR: number,
  volumeOverA3: number,
): DensityResult {
  const a = aOverR * R; // nm
  const aCm = a * 1e-7; // nm → cm
  const Vc = volumeOverA3 * aCm ** 3;
  return { a, Vc, rho: (N * atomicMass) / (Vc * AVOGADRO) };
}
