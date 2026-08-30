/**
 * Constituents for the composites module — and there is almost no new data
 * here, which is the point.
 *
 * A fibre and a matrix are entries of `selection/materials.ts`, resolved by
 * name. That dataset is Callister & Rethwisch Appendix B, it already carries
 * the three bare fibres and every candidate matrix, and it is the same 54
 * materials the Ashby chart plots — so a composite specified from these
 * constituents can be handed back to `indexValue` and ranked among them
 * without a second source to disagree with the first.
 *
 * `resolve` throws on a name that is not in the dataset, and
 * `composite/materials.test.ts` walks every id, so a rename in Appendix B
 * fails the suite rather than emptying a selector at runtime.
 *
 * Two things genuinely are new, and neither is a property of a material:
 *
 *  - **Filament diameter** is nominal, not tabulated. Commercial fibre comes
 *    in a range and the value only enters through `l_c = σ*_f·d/2τ_c`, where
 *    it scales the answer linearly. It is stated as nominal in the UI.
 *  - **τ_c, the interfacial bond strength, is not here at all.** It belongs to
 *    a fibre–matrix *pair* and to its sizing and cure, not to a fibre. It is an
 *    input the reader supplies, for the reason `failure/materials.ts` keeps
 *    Paris constants out of `MECH_MATERIALS`.
 */

import { SELECTION_MATERIALS } from '../selection/materials';
import type { SelectionMaterial } from '../selection/materials';
import type { Constituent } from './model';
import { longitudinalModulus, longitudinalStrength, mixtureDensity } from './model';

function resolve(name: string): SelectionMaterial {
  const m = SELECTION_MATERIALS.find((x) => x.name === name);
  if (!m) throw new Error(`no Appendix B entry named '${name}'`);
  return m;
}

function asConstituent(name: string): Constituent {
  const m = resolve(name);
  return { name: m.name, modulus: m.modulus, density: m.density, strength: m.strength };
}

export interface Fibre extends Constituent {
  id: string;
  /** Short label for a control; the Appendix B name is often too long. */
  label: string;
  /** Nominal filament diameter, mm. Commercial fibre spans a range. */
  diameter: number;
  /** True where the fibre is isotropic, so the isostress bound is fair for it. */
  isotropic: boolean;
}

export interface Matrix extends Constituent {
  id: string;
  label: string;
}

export const FIBRES: Fibre[] = [
  {
    id: 'e-glass',
    label: 'E-glass',
    ...asConstituent('E-glass fibre'),
    diameter: 0.010,
    isotropic: true,
  },
  {
    id: 'carbon',
    label: 'Carbon (standard modulus)',
    ...asConstituent('Carbon fibre (standard modulus)'),
    diameter: 0.007,
    // Axial modulus far exceeds transverse: the isostress bound is not fair here.
    isotropic: false,
  },
  {
    id: 'aramid',
    label: 'Aramid (Kevlar 49)',
    ...asConstituent('Aramid fibre (Kevlar 49)'),
    diameter: 0.012,
    isotropic: false,
  },
];

export const MATRICES: Matrix[] = [
  { id: 'epoxy', label: 'Epoxy', ...asConstituent('Epoxy') },
  { id: 'polyester', label: 'Polyester (thermoset)', ...asConstituent('Polyester (thermoset)') },
  { id: 'nylon', label: 'Nylon 6,6', ...asConstituent('Nylon 6,6 (dry)') },
  { id: 'pc', label: 'Polycarbonate', ...asConstituent('Polycarbonate (PC)') },
  { id: 'al', label: 'Aluminium 1100', ...asConstituent('Aluminium 1100 (annealed)') },
];

/**
 * The three composites Appendix B tabulates as *measured* materials, each
 * pinned to the constituents this module would build it from.
 *
 * They are what makes the strength caveat checkable instead of asserted. The
 * modulus and density rules of mixtures reproduce these rows to a few per
 * cent; the strength rule of mixtures overshoots them by a factor near two,
 * every time, in the same direction. Both facts are measured by
 * `agreement()` below and asserted in the tests.
 */
export interface MeasuredComposite {
  fibre: string;
  matrix: string;
  vf: number;
  /** The Appendix B row this should be compared against. */
  name: string;
}

export const MEASURED: MeasuredComposite[] = [
  { fibre: 'e-glass', matrix: 'epoxy', vf: 0.6, name: 'E-glass–epoxy (longitudinal)' },
  { fibre: 'carbon', matrix: 'epoxy', vf: 0.6, name: 'Carbon–epoxy (longitudinal)' },
  { fibre: 'aramid', matrix: 'epoxy', vf: 0.6, name: 'Aramid–epoxy (longitudinal)' },
];

export interface Agreement {
  name: string;
  modulus: { predicted: number; measured: number; ratio: number };
  density: { predicted: number; measured: number; ratio: number };
  strength: { predicted: number; measured: number; ratio: number };
}

/** What the mixtures predict for each measured composite, against what is tabulated. */
export function agreement(): Agreement[] {
  return MEASURED.map((c) => {
    const f = FIBRES.find((x) => x.id === c.fibre)!;
    const m = MATRICES.find((x) => x.id === c.matrix)!;
    const row = resolve(c.name);
    const modulus = longitudinalModulus(f, m, c.vf);
    const density = mixtureDensity(f, m, c.vf);
    const strength = longitudinalStrength(f, m, c.vf);
    return {
      name: c.name,
      modulus: { predicted: modulus, measured: row.modulus, ratio: modulus / row.modulus },
      density: { predicted: density, measured: row.density, ratio: density / row.density },
      strength: { predicted: strength, measured: row.strength, ratio: strength / row.strength },
    };
  });
}
