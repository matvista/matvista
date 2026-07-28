/**
 * Material property dataset for Ashby-style selection charts.
 *
 * Every value is from Callister & Rethwisch **Appendix B** — density (B.1),
 * modulus of elasticity (B.2), and tensile strength (B.4). Where the book
 * gives a range, the midpoint is used and the entry is marked `ranged`.
 *
 * Two caveats the book itself attaches, carried through here:
 *  - For graphite, ceramics and semiconductors the quoted "strength" is
 *    **flexural strength**, not tensile.
 *  - Concrete's strength is measured in **compression**.
 * Ceramics are far weaker in tension than these numbers suggest, so do not
 * read the ceramic strengths as tensile values.
 */

export type MaterialClass =
  | 'metal'
  | 'ceramic'
  | 'polymer'
  | 'elastomer'
  | 'composite';

export interface SelectionMaterial {
  name: string;
  cls: MaterialClass;
  /** Density, g/cm³ (Mg/m³). */
  density: number;
  /** Modulus of elasticity, GPa. */
  modulus: number;
  /** Strength, MPa — tensile except as noted in the module docstring. */
  strength: number;
  /** True when one or more values is the midpoint of a published range. */
  ranged?: boolean;
  note?: string;
}

export const SELECTION_MATERIALS: SelectionMaterial[] = [
  // ---------------- metals ----------------
  { name: 'Steel 1020 (annealed)', cls: 'metal', density: 7.85, modulus: 207, strength: 395 },
  { name: 'Steel 4140 (Q&T 315 °C)', cls: 'metal', density: 7.85, modulus: 207, strength: 1720 },
  { name: 'Stainless 304 (annealed)', cls: 'metal', density: 8.0, modulus: 193, strength: 515 },
  { name: 'Grey cast iron G3000', cls: 'metal', density: 7.3, modulus: 101, strength: 207, ranged: true },
  { name: 'Aluminium 1100 (annealed)', cls: 'metal', density: 2.71, modulus: 69, strength: 90 },
  { name: 'Aluminium 2024 (aged)', cls: 'metal', density: 2.77, modulus: 72.4, strength: 485 },
  { name: 'Aluminium 6061 (aged)', cls: 'metal', density: 2.7, modulus: 69, strength: 310 },
  { name: 'Aluminium 7075 (aged)', cls: 'metal', density: 2.8, modulus: 71, strength: 572 },
  { name: 'Copper C11000 (hot-rolled)', cls: 'metal', density: 8.89, modulus: 115, strength: 220 },
  { name: 'Brass C26000 (annealed)', cls: 'metal', density: 8.53, modulus: 110, strength: 332, ranged: true },
  { name: 'Magnesium AZ31B (rolled)', cls: 'metal', density: 1.77, modulus: 45, strength: 290 },
  { name: 'Titanium Ti–6Al–4V (annealed)', cls: 'metal', density: 4.43, modulus: 114, strength: 900 },
  { name: 'Nickel 200 (annealed)', cls: 'metal', density: 8.89, modulus: 204, strength: 462 },
  { name: 'Molybdenum', cls: 'metal', density: 10.22, modulus: 320, strength: 630 },
  { name: 'Tantalum', cls: 'metal', density: 16.6, modulus: 185, strength: 205 },
  { name: 'Tungsten', cls: 'metal', density: 19.3, modulus: 407, strength: 960 },
  { name: 'Gold (annealed)', cls: 'metal', density: 19.32, modulus: 77, strength: 130 },
  { name: 'Platinum (annealed)', cls: 'metal', density: 21.45, modulus: 171, strength: 145, ranged: true },
  { name: 'Silver (annealed)', cls: 'metal', density: 10.49, modulus: 74, strength: 170 },

  // ---------------- ceramics (strength = flexural) ----------------
  { name: 'Alumina 99.9%', cls: 'ceramic', density: 3.98, modulus: 380, strength: 417, ranged: true },
  { name: 'Alumina 96%', cls: 'ceramic', density: 3.72, modulus: 303, strength: 358 },
  { name: 'Silicon carbide (hot-pressed)', cls: 'ceramic', density: 3.3, modulus: 345, strength: 528, ranged: true },
  { name: 'Silicon nitride (hot-pressed)', cls: 'ceramic', density: 3.3, modulus: 304, strength: 850, ranged: true },
  { name: 'Zirconia (3 mol% Y₂O₃)', cls: 'ceramic', density: 6.0, modulus: 205, strength: 1150, ranged: true },
  { name: 'Glass, soda–lime', cls: 'ceramic', density: 2.5, modulus: 69, strength: 69 },
  { name: 'Glass, borosilicate (Pyrex)', cls: 'ceramic', density: 2.23, modulus: 70, strength: 69 },
  { name: 'Glass-ceramic (Pyroceram)', cls: 'ceramic', density: 2.6, modulus: 120, strength: 247, ranged: true },
  { name: 'Silica, fused', cls: 'ceramic', density: 2.2, modulus: 73, strength: 104 },
  { name: 'Silicon (single crystal)', cls: 'ceramic', density: 2.33, modulus: 129, strength: 130 },
  { name: 'Diamond (natural)', cls: 'ceramic', density: 3.51, modulus: 950, strength: 1050, ranged: true },
  { name: 'Graphite (extruded)', cls: 'ceramic', density: 1.71, modulus: 11, strength: 24, ranged: true },
  {
    name: 'Concrete',
    cls: 'ceramic',
    density: 2.4,
    modulus: 31,
    strength: 39,
    ranged: true,
    note: 'Strength is compressive — concrete is roughly ten times weaker in tension, which is why it is reinforced.',
  },

  // ---------------- polymers ----------------
  { name: 'Epoxy', cls: 'polymer', density: 1.25, modulus: 2.41, strength: 59, ranged: true },
  { name: 'Nylon 6,6 (dry)', cls: 'polymer', density: 1.14, modulus: 2.69, strength: 94.5, ranged: true },
  { name: 'Phenolic', cls: 'polymer', density: 1.28, modulus: 3.8, strength: 48, ranged: true },
  { name: 'Polycarbonate (PC)', cls: 'polymer', density: 1.2, modulus: 2.38, strength: 68, ranged: true },
  { name: 'Polyester (thermoset)', cls: 'polymer', density: 1.25, modulus: 3.24, strength: 66, ranged: true },
  { name: 'PEEK', cls: 'polymer', density: 1.31, modulus: 1.1, strength: 87, ranged: true },
  { name: 'PET', cls: 'polymer', density: 1.35, modulus: 3.45, strength: 60, ranged: true },
  { name: 'PMMA (acrylic)', cls: 'polymer', density: 1.19, modulus: 2.74, strength: 60, ranged: true },
  { name: 'Polypropylene (PP)', cls: 'polymer', density: 0.905, modulus: 1.34, strength: 36, ranged: true },
  { name: 'HDPE', cls: 'polymer', density: 0.959, modulus: 1.08, strength: 27, ranged: true },
  { name: 'LDPE', cls: 'polymer', density: 0.925, modulus: 0.227, strength: 20, ranged: true },
  { name: 'UHMWPE', cls: 'polymer', density: 0.94, modulus: 0.69, strength: 43, ranged: true },
  { name: 'PBT', cls: 'polymer', density: 1.34, modulus: 2.47, strength: 58, ranged: true },

  // ---------------- elastomers ----------------
  { name: 'Nitrile rubber', cls: 'elastomer', density: 0.98, modulus: 0.0034, strength: 15.5, ranged: true },
  { name: 'Styrene–butadiene (SBR)', cls: 'elastomer', density: 0.94, modulus: 0.006, strength: 16.6, ranged: true },

  // ---------------- composites (longitudinal, Vf = 0.6) ----------------
  {
    name: 'Carbon–epoxy (longitudinal)',
    cls: 'composite',
    density: 1.6,
    modulus: 145,
    strength: 1520,
    note: 'Aligned continuous fibres, Vf = 0.60. Transverse modulus is only 10 GPa — the anisotropy is enormous and is the whole design problem with composites.',
  },
  {
    name: 'Aramid–epoxy (longitudinal)',
    cls: 'composite',
    density: 1.4,
    modulus: 76,
    strength: 1240,
    note: 'Aligned continuous Kevlar 49, Vf = 0.60. Transverse modulus 5.5 GPa.',
  },
  {
    name: 'E-glass–epoxy (longitudinal)',
    cls: 'composite',
    density: 2.1,
    modulus: 45,
    strength: 1020,
    note: 'Aligned continuous E-glass, Vf = 0.60 — the cheapest of the three and by far the most used.',
  },
  { name: 'Carbon fibre (standard modulus)', cls: 'composite', density: 1.78, modulus: 230, strength: 4000, ranged: true, note: 'The bare fibre, not a composite — shown to make the matrix penalty visible.' },
  { name: 'Aramid fibre (Kevlar 49)', cls: 'composite', density: 1.44, modulus: 131, strength: 3850, ranged: true, note: 'Bare fibre.' },
  { name: 'E-glass fibre', cls: 'composite', density: 2.58, modulus: 72.5, strength: 3450, note: 'Bare fibre.' },
  { name: 'Wood, Douglas fir (along grain)', cls: 'composite', density: 0.48, modulus: 13.4, strength: 108, ranged: true, note: 'Nature’s fibre composite — cellulose fibres in a lignin matrix. Perpendicular to the grain its strength collapses to 2.4 MPa.' },
];

export const CLASS_LABEL: Record<MaterialClass, string> = {
  metal: 'Metals',
  ceramic: 'Ceramics & glasses',
  polymer: 'Polymers',
  elastomer: 'Elastomers',
  composite: 'Composites & fibres',
};

/**
 * Ashby performance indices. On log–log axes, a line of constant index
 * M = P^a / ρ plots as a straight line of slope 1/a, so the exponent sets the
 * guide-line slope. Move the line up and to the left to find better materials.
 */
export interface PerformanceIndex {
  id: string;
  label: string;
  /** Which y-property the index applies to. */
  property: 'modulus' | 'strength';
  /** Exponent a in P^a / ρ. */
  exponent: number;
  /** Slope of the guide line on log–log axes, = 1/a. */
  slope: number;
  scenario: string;
}

export const INDICES: PerformanceIndex[] = [
  {
    id: 'e-rho',
    label: 'E / ρ',
    property: 'modulus',
    exponent: 1,
    slope: 1,
    scenario: 'Stiff tie rod loaded in tension — minimise mass for a given stiffness.',
  },
  {
    id: 'e12-rho',
    label: 'E^½ / ρ',
    property: 'modulus',
    exponent: 0.5,
    slope: 2,
    scenario: 'Stiff beam in bending. The square root appears because you may thicken the beam, and bending stiffness grows as the cube of depth.',
  },
  {
    id: 'e13-rho',
    label: 'E^⅓ / ρ',
    property: 'modulus',
    exponent: 1 / 3,
    slope: 3,
    scenario: 'Stiff panel in bending — the flattest guide line, and the one that most favours light materials such as wood and foams.',
  },
  {
    id: 's-rho',
    label: 'σ / ρ',
    property: 'strength',
    exponent: 1,
    slope: 1,
    scenario: 'Strong tie in tension — specific strength.',
  },
  {
    id: 's23-rho',
    label: 'σ^⅔ / ρ',
    property: 'strength',
    exponent: 2 / 3,
    slope: 1.5,
    scenario: 'Strong beam in bending.',
  },
];

/** Value of the index for a material — bigger is better. */
export function indexValue(m: SelectionMaterial, idx: PerformanceIndex): number {
  const p = idx.property === 'modulus' ? m.modulus : m.strength;
  return Math.pow(p, idx.exponent) / m.density;
}
