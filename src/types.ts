export interface ElementData {
  number: number;
  symbol: string;
  name: string;
  category: string;
  group: number;
  period: number;
  xpos: number;
  ypos: number;
  atomic_mass: number | null;
  density: number | null;
  melt: number | null;
  boil: number | null;
  electronegativity: number | null;
  electron_affinity: number | null;
  first_ionization: number | null;
  electron_configuration: string;
  block: string;
  phase: string;
  summary: string;
}

export interface PropertyDef {
  key: keyof ElementData;
  label: string;
  unit: string;
  /** Short note shown under the table explaining the trend to look for. */
  trendNote: string;
  /** Use log scale for heavily skewed distributions. */
  log?: boolean;
}

export const PROPERTIES: PropertyDef[] = [
  {
    key: 'electronegativity',
    label: 'Electronegativity',
    unit: 'Pauling',
    trendNote:
      'Increases left→right across a period (nuclear charge grows) and decreases top→bottom (valence electrons sit farther out). Fluorine is the peak.',
  },
  {
    key: 'first_ionization',
    label: 'First ionization energy',
    unit: 'kJ/mol',
    trendNote:
      'Energy to remove one electron. Same trend as electronegativity — noble gases are hardest to ionize, alkali metals easiest.',
  },
  {
    key: 'electron_affinity',
    label: 'Electron affinity',
    unit: 'kJ/mol',
    trendNote:
      'Energy released on gaining an electron. Halogens (group 17) are the standouts — one electron short of a full shell.',
  },
  {
    key: 'melt',
    label: 'Melting point',
    unit: 'K',
    trendNote:
      'Peaks mid-transition-metal (tungsten, ~3695 K) where d-electron bonding is strongest. Noble gases barely hold together.',
  },
  {
    key: 'boil',
    label: 'Boiling point',
    unit: 'K',
    trendNote:
      'Tracks bond/cohesion strength like melting point. The gap between melt and boil hints at liquid-range chemistry.',
  },
  {
    key: 'density',
    label: 'Density',
    unit: 'g/cm³',
    trendNote:
      'Peaks at osmium/iridium (~22.6) — heavy nuclei packed in tight lattices. Log-scaled: gases are ~1000× less dense than metals.',
    log: true,
  },
  {
    key: 'atomic_mass',
    label: 'Atomic mass',
    unit: 'u',
    trendNote:
      'Grows monotonically with atomic number — a sanity check that the color mapping works, not a periodic trend.',
  },
];
