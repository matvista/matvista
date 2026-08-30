/**
 * The polymers, and how little of this is data.
 *
 * A repeat unit is a *structure*, not a measurement: PVC's repeat unit is
 * C₂H₃Cl whoever is looking. So the module carries formulas and computes molar
 * masses from `data/elements.json` — the same atomic masses the periodic table
 * is coloured by — rather than tabulating 62.50 g/mol beside a name and hoping
 * the two stay in step. `polymers.test.ts` checks the arithmetic against the
 * published masses.
 *
 * Where a polymer also appears in `selection/materials.ts` it is joined to it
 * by name, so its density comes from Appendix B rather than from here. Three
 * of the nine have no Appendix B row; they carry a formula and nothing else,
 * and the crystallinity panel does not offer them. That is the same shape as
 * `DOPABLE` restricting the semiconductor doping panel to four of seven: the
 * structure is known for all of them, a measured density is not.
 */

import elementsRaw from '../data/elements.json';
import { SELECTION_MATERIALS } from '../selection/materials';
import { crystalDensity } from './model';

interface ElementRow {
  symbol: string;
  atomic_mass: number;
}

const ATOMIC_MASS = new Map(
  (elementsRaw as unknown as ElementRow[]).map((e) => [e.symbol, e.atomic_mass]),
);

/**
 * Molar mass of a repeat unit from its formula.
 *
 * Deliberately a small parser rather than a lookup: the formulas here are all
 * `C₁₂H₂₂N₂O₂`-shaped, and anything it cannot read throws at module load
 * instead of silently contributing zero — a repeat unit that quietly weighed
 * less than it should would put every degree of polymerisation out by a factor
 * nobody would question.
 */
export function repeatUnitMass(formula: string): number {
  const parts = formula.match(/[A-Z][a-z]?\d*/g);
  if (!parts || parts.join('') !== formula) {
    throw new Error(`cannot read repeat unit formula '${formula}'`);
  }
  return parts.reduce((sum, part) => {
    const [, symbol, count] = part.match(/^([A-Z][a-z]?)(\d*)$/)!;
    const mass = ATOMIC_MASS.get(symbol);
    if (mass === undefined) throw new Error(`no element '${symbol}' in the dataset`);
    return sum + mass * (count === '' ? 1 : Number(count));
  }, 0);
}

export interface Polymer {
  id: string;
  label: string;
  /** Repeat unit, as a formula over the app's own element data. */
  formula: string;
  /** Backbone C–C bonds contributed by one repeat unit. */
  backboneBonds: number;
  /** Molar mass of the repeat unit, g/mol — computed, never typed in. */
  mass: number;
  /** Appendix B entry name, where this polymer has one. */
  selectionName?: string;
  /** Measured density from Appendix B, g/cm³, where there is a row for it. */
  density?: number;
}

function build(
  id: string,
  label: string,
  formula: string,
  backboneBonds: number,
  selectionName?: string,
): Polymer {
  const row = selectionName
    ? SELECTION_MATERIALS.find((m) => m.name === selectionName)
    : undefined;
  if (selectionName && !row) throw new Error(`no Appendix B entry named '${selectionName}'`);
  return {
    id,
    label,
    formula,
    backboneBonds,
    mass: repeatUnitMass(formula),
    selectionName,
    density: row?.density,
  };
}

export const POLYMERS: Polymer[] = [
  build('pe', 'Polyethylene', 'C2H4', 2, 'HDPE'),
  build('pvc', 'Poly(vinyl chloride)', 'C2H3Cl', 2),
  build('pp', 'Polypropylene', 'C3H6', 2, 'Polypropylene (PP)'),
  build('ps', 'Polystyrene', 'C8H8', 2),
  build('ptfe', 'PTFE', 'C2F4', 2),
  build('pmma', 'PMMA', 'C5H8O2', 2, 'PMMA (acrylic)'),
  build('nylon66', 'Nylon 6,6', 'C12H22N2O2', 12, 'Nylon 6,6 (dry)'),
  build('pet', 'PET', 'C10H8O4', 6, 'PET'),
  build('pc', 'Polycarbonate', 'C16H14O3', 8, 'Polycarbonate (PC)'),
];

/* ========================================================== crystallinity == */

/**
 * The crystalline polyethylene cell.
 *
 * Orthorhombic, two ethylene repeat units per cell. These are *structural*
 * parameters and they are checkable by what they produce: run them through
 * `crystalDensity` and the answer is 0.998 g/cm³, the published density of
 * fully crystalline polyethylene. A wrong edge length would not land there.
 * `polymers.test.ts` asserts it, which makes the cell corroborate itself.
 */
export const PE_CELL = { a: 0.741, b: 0.494, c: 0.255, unitsPerCell: 2 };

/**
 * Density of fully amorphous polyethylene, g/cm³.
 *
 * The one measured number in this file that is neither computed nor joined,
 * because a glass has no unit cell to derive it from. It does not stand
 * unchecked: with the crystalline density derived above, it puts the three
 * polyethylene grades of Appendix B at 46%, 58% and 72% crystalline — each
 * inside its published range and in the right order, which is asserted. A ρ_a
 * that was wrong by much would push one of the three outside its range.
 */
export const PE_AMORPHOUS = 0.87;

export function peCrystallineDensity(): number {
  const pe = POLYMERS.find((p) => p.id === 'pe')!;
  return crystalDensity(
    PE_CELL.unitsPerCell,
    pe.mass,
    PE_CELL.a * PE_CELL.b * PE_CELL.c,
  );
}

export interface PeGrade {
  id: string;
  label: string;
  /** Appendix B entry name. */
  selectionName: string;
  density: number;
  /** Published crystallinity range for the grade, per cent. */
  expected: [number, number];
}

/**
 * The three polyethylene grades Appendix B carries, with the crystallinity
 * range each is known for. The ranges are the *test's* business rather than
 * the UI's: the module computes a number and the suite checks it lands where
 * that grade is supposed to.
 */
export const PE_GRADES: PeGrade[] = (
  [
    { id: 'ldpe', label: 'LDPE', selectionName: 'LDPE', expected: [40, 55] },
    { id: 'uhmwpe', label: 'UHMWPE', selectionName: 'UHMWPE', expected: [50, 65] },
    { id: 'hdpe', label: 'HDPE', selectionName: 'HDPE', expected: [65, 80] },
  ] as const
).map((g): PeGrade => {
  const row = SELECTION_MATERIALS.find((m) => m.name === g.selectionName);
  if (!row) throw new Error(`no Appendix B entry named '${g.selectionName}'`);
  return { ...g, expected: [g.expected[0], g.expected[1]], density: row.density };
});
