import type { Atom } from './geometry';
import { buildAtoms, distance } from './geometry';
import type { StructureDef } from './structures';

export type DefectKind =
  | 'none'
  | 'vacancy'
  | 'self-interstitial'
  | 'substitutional-large'
  | 'substitutional-small'
  | 'interstitial-impurity';

export interface DefectDef {
  kind: DefectKind;
  label: string;
  /** Callister's classification of the defect. */
  category: string;
  note: string;
}

export const DEFECTS: DefectDef[] = [
  {
    kind: 'none',
    label: 'Perfect lattice',
    category: '—',
    note: 'The idealisation. No real crystal is ever like this: thermodynamics guarantees vacancies, because their disorder raises the entropy of the crystal.',
  },
  {
    kind: 'vacancy',
    label: 'Vacancy',
    category: 'Point defect',
    note: 'A lattice site that should hold an atom but does not. The simplest defect, and an unavoidable one — every crystalline solid contains vacancies, and their equilibrium number rises exponentially with temperature. Just below melting, roughly 1 site in 10 000 is empty.',
  },
  {
    kind: 'self-interstitial',
    label: 'Self-interstitial',
    category: 'Point defect',
    note: 'A host atom crowded into a void space that is not normally occupied. In metals the atom is far larger than the space, so it badly distorts the surrounding lattice — which makes the defect improbable and far rarer than vacancies.',
  },
  {
    kind: 'substitutional-large',
    label: 'Substitutional impurity (larger)',
    category: 'Point defect · solid solution',
    note: 'A foreign atom replacing a host atom. Hume-Rothery: appreciable solubility needs the radii within about ±15%, matching crystal structures, similar electronegativities, and preferably a higher-valence solute. Cu–Ni satisfies all four and is soluble in all proportions.',
  },
  {
    kind: 'substitutional-small',
    label: 'Substitutional impurity (smaller)',
    category: 'Point defect · solid solution',
    note: 'The same defect with an undersized solute. Either way the lattice is strained — and that strain field is exactly what impedes dislocation motion, which is why solid-solution alloying strengthens a metal.',
  },
  {
    kind: 'interstitial-impurity',
    label: 'Interstitial impurity',
    category: 'Point defect · solid solution',
    note: 'A small foreign atom — carbon, nitrogen, hydrogen — wedged into a void between host atoms. Carbon in iron is the case that matters: it is why steel exists, and because it needs no vacancy to move, it diffuses orders of magnitude faster than iron itself.',
  },
];

export function getDefect(kind: DefectKind): DefectDef {
  return DEFECTS.find((d) => d.kind === kind) ?? DEFECTS[0];
}

export interface DefectAtom extends Atom {
  /** Marks the atom as the defect itself, for highlighting. */
  defect?: 'impurity' | 'interstitial';
  /** Radius override in cell units, for differently sized solutes. */
  radiusScale?: number;
}

export interface DefectResult {
  atoms: DefectAtom[];
  /** Position of the removed atom, drawn as an empty outline. */
  vacancySite: [number, number, number] | null;
}

/**
 * Applies a point defect to the unit cell.
 * Targets the atom nearest the cell centre so the defect is visible rather
 * than buried at a corner shared with neighbouring cells.
 */
export function applyDefect(s: StructureDef, kind: DefectKind): DefectResult {
  const atoms: DefectAtom[] = buildAtoms(s).map((a) => ({ ...a }));
  if (kind === 'none') return { atoms, vacancySite: null };

  // Prefer a non-image atom genuinely inside this cell.
  const interior = atoms.filter((a) => !a.image);
  const pool = interior.length > 0 ? interior : atoms;
  let target = pool[0];
  let best = Infinity;
  for (const a of pool) {
    const d = distance(a.pos, [0, 0, 0]);
    if (d < best) {
      best = d;
      target = a;
    }
  }

  const index = atoms.indexOf(target);

  switch (kind) {
    case 'vacancy':
      atoms.splice(index, 1);
      return { atoms, vacancySite: target.pos };

    case 'substitutional-large':
      atoms[index] = { ...target, defect: 'impurity', radiusScale: 1.45 };
      return { atoms, vacancySite: null };

    case 'substitutional-small':
      atoms[index] = { ...target, defect: 'impurity', radiusScale: 0.62 };
      return { atoms, vacancySite: null };

    case 'self-interstitial':
    case 'interstitial-impurity': {
      const site = interstitialSite(s, atoms);
      atoms.push({
        pos: site,
        species: target.species,
        image: false,
        defect: 'interstitial',
        radiusScale: kind === 'interstitial-impurity' ? 0.45 : 1,
      });
      return { atoms, vacancySite: null };
    }

    default:
      return { atoms, vacancySite: null };
  }
}

/**
 * Finds the roomiest void in the cell by sampling a grid and keeping the point
 * furthest from any atom — a cheap stand-in for a proper interstitial-site
 * calculation, but it lands on the octahedral site for FCC and BCC.
 */
function interstitialSite(s: StructureDef, atoms: DefectAtom[]): [number, number, number] {
  const extent = s.cell === 'hexagonal' ? 0.8 : 0.45;
  let bestPoint: [number, number, number] = [0, 0, 0];
  let bestGap = -1;
  const STEPS = 12;

  for (let i = 0; i <= STEPS; i++) {
    for (let j = 0; j <= STEPS; j++) {
      for (let k = 0; k <= STEPS; k++) {
        const p: [number, number, number] = [
          -extent + (2 * extent * i) / STEPS,
          -extent + (2 * extent * j) / STEPS,
          -extent + (2 * extent * k) / STEPS,
        ];
        let nearest = Infinity;
        for (const a of atoms) {
          const d = distance(p, a.pos);
          if (d < nearest) nearest = d;
        }
        if (nearest > bestGap) {
          bestGap = nearest;
          bestPoint = p;
        }
      }
    }
  }
  return bestPoint;
}
