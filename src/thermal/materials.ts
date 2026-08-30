/**
 * Thermal data, and what checks each entry.
 *
 * Two numbers per material are genuinely new here — the coefficient of linear
 * expansion and the thermal conductivity — and a third, electrical
 * resistivity, is carried for the metals because it is what checks the second.
 * Everything else is joined: modulus, strength and density come from
 * `selection/materials.ts` (Appendix B), and atomic mass and melting point
 * from `data/elements.json`.
 *
 * **The metals are cross-checked twice and the ceramics once**, and the
 * difference is stated rather than smoothed over:
 *
 *  - Every metal's `conductivity` and `resistivity` must give a Lorenz number
 *    in the band real metals occupy. Either one wrong by much falls outside.
 *  - Every metal's `alpha` times its melting point must land near 0.02. A
 *    misplaced decimal cannot survive that.
 *  - The ceramics have neither check: they carry no free electrons, so
 *    Wiedemann–Franz says nothing about them, and they are compounds with no
 *    element row to take a melting point from. What they have is an
 *    **ordering** — fused silica shrugs off a quench that shatters soda-lime
 *    glass, by a wide and well-known margin — and that ordering is asserted.
 *    It is weaker, and `thermal/model.test.ts` says which entries rest on
 *    which.
 *
 * The element join itself lives in `thermal/elements.ts` — see the note there
 * for why this file must not import the JSON.
 */

import { SELECTION_MATERIALS } from '../selection/materials';
import type { SelectionMaterial } from '../selection/materials';

function appendixB(name: string): SelectionMaterial {
  const m = SELECTION_MATERIALS.find((x) => x.name === name);
  if (!m) throw new Error(`no Appendix B entry named '${name}'`);
  return m;
}

export interface ThermalMaterial {
  id: string;
  label: string;
  kind: 'metal' | 'ceramic';
  /** Appendix B row this takes modulus, strength and density from. */
  selectionName: string;
  /** Element symbol for the metals, for atomic mass and melting point. */
  element?: string;
  /** Coefficient of linear expansion, 1e-6/K, near room temperature. */
  alpha: number;
  /** Thermal conductivity, W/m·K. */
  conductivity: number;
  /** Electrical resistivity, nΩ·m. Metals only — it is what checks `conductivity`. */
  resistivity?: number;
  modulus: number;
  strength: number;
  density: number;
}

function build(
  m: Omit<ThermalMaterial, 'modulus' | 'strength' | 'density'>,
): ThermalMaterial {
  const row = appendixB(m.selectionName);
  return { ...m, modulus: row.modulus, strength: row.strength, density: row.density };
}

export const THERMAL_MATERIALS: ThermalMaterial[] = [
  build({ id: 'al', label: 'Aluminium', kind: 'metal', selectionName: 'Aluminium 1100 (annealed)', element: 'Al', alpha: 23.6, conductivity: 247, resistivity: 26.5 }),
  build({ id: 'cu', label: 'Copper', kind: 'metal', selectionName: 'Copper C11000 (hot-rolled)', element: 'Cu', alpha: 17.0, conductivity: 398, resistivity: 16.8 }),
  build({ id: 'ag', label: 'Silver', kind: 'metal', selectionName: 'Silver (annealed)', element: 'Ag', alpha: 19.7, conductivity: 428, resistivity: 15.9 }),
  build({ id: 'au', label: 'Gold', kind: 'metal', selectionName: 'Gold (annealed)', element: 'Au', alpha: 14.2, conductivity: 315, resistivity: 22.1 }),
  build({ id: 'ni', label: 'Nickel', kind: 'metal', selectionName: 'Nickel 200 (annealed)', element: 'Ni', alpha: 13.3, conductivity: 90, resistivity: 69.3 }),
  build({ id: 'w', label: 'Tungsten', kind: 'metal', selectionName: 'Tungsten', element: 'W', alpha: 4.5, conductivity: 178, resistivity: 52.8 }),
  build({ id: 'mo', label: 'Molybdenum', kind: 'metal', selectionName: 'Molybdenum', element: 'Mo', alpha: 4.9, conductivity: 142, resistivity: 53.4 }),
  build({ id: 'ta', label: 'Tantalum', kind: 'metal', selectionName: 'Tantalum', element: 'Ta', alpha: 6.5, conductivity: 57.5, resistivity: 131 }),
  build({ id: 'pt', label: 'Platinum', kind: 'metal', selectionName: 'Platinum (annealed)', element: 'Pt', alpha: 8.8, conductivity: 71.6, resistivity: 106 }),

  build({ id: 'alumina', label: 'Alumina 99.9%', kind: 'ceramic', selectionName: 'Alumina 99.9%', alpha: 7.4, conductivity: 39 }),
  build({ id: 'sic', label: 'Silicon carbide', kind: 'ceramic', selectionName: 'Silicon carbide (hot-pressed)', alpha: 4.6, conductivity: 16 }),
  build({ id: 'soda', label: 'Glass, soda–lime', kind: 'ceramic', selectionName: 'Glass, soda–lime', alpha: 9.0, conductivity: 1.7 }),
  build({ id: 'pyrex', label: 'Glass, borosilicate', kind: 'ceramic', selectionName: 'Glass, borosilicate (Pyrex)', alpha: 3.3, conductivity: 1.14 }),
  build({ id: 'silica', label: 'Silica, fused', kind: 'ceramic', selectionName: 'Silica, fused', alpha: 0.55, conductivity: 1.38 }),
];

export const METALS = THERMAL_MATERIALS.filter((m) => m.kind === 'metal');
export const CERAMICS = THERMAL_MATERIALS.filter((m) => m.kind === 'ceramic');

/**
 * The three elements the heat-capacity panel names as *failures* of
 * Dulong–Petit, with the specific heat each actually has at room temperature.
 *
 * They are the reason the panel exists. Light atoms held by stiff bonds have a
 * Debye temperature above 300 K, so their vibrational modes are not all
 * excited and the classical `3R` per mole is an overestimate — by 15% for
 * silicon, 50% for beryllium, and threefold for carbon as diamond. Every other
 * element in the table lands within a few per cent, which is what makes these
 * three worth drawing rather than hiding.
 */
export const DEBYE_STIFF: { symbol: string; label: string; measured: number }[] = [
  { symbol: 'C', label: 'Carbon (diamond)', measured: 0.709 },
  { symbol: 'Be', label: 'Beryllium', measured: 1.825 },
  { symbol: 'Si', label: 'Silicon', measured: 0.705 },
];

/**
 * Room-temperature specific heats for the metals above, to show that
 * Dulong–Petit is not merely self-consistent but right. Not used by the model
 * — the model computes `3R/A` and never reads these — so they are a check on
 * the rule rather than an input to it.
 */
export const MEASURED_SPECIFIC_HEAT: Record<string, number> = {
  Al: 0.897,
  Cu: 0.385,
  Ag: 0.235,
  Au: 0.129,
  Ni: 0.444,
  W: 0.132,
  Mo: 0.251,
  Ta: 0.14,
  Pt: 0.133,
};
