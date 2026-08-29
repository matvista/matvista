/**
 * Crystal structure definitions.
 * Conventions and numeric values follow Callister & Rethwisch, ch. 3
 * ("The structure of crystalline solids"): atoms per cell N, coordination
 * number CN, atomic packing factor APF, and the a↔R relations.
 */

export interface SpeciesDef {
  label: string;
  color: string;
  /** Display radius as a fraction of the lattice parameter a (ball-and-stick mode). */
  ballRadius: number;
  /** Display radius as a fraction of a for space-filling mode (spheres just touch). */
  fillRadius: number;
}

export interface StructureDef {
  id: string;
  name: string;
  system: string;
  cell: 'cubic' | 'hexagonal';
  /** c/a ratio, hexagonal cells only. */
  coa?: number;
  /** Basis positions in fractional coordinates, with species key. */
  basis: { pos: [number, number, number]; species: string }[];
  species: Record<string, SpeciesDef>;
  /** Atoms per unit cell. */
  N: number;
  /** Coordination number. */
  CN: number;
  /** Atomic packing factor. */
  APF: number;
  /** Human-readable a-in-terms-of-R relation. */
  aFromR: string;
  /** Numeric a/R, for density computation. Undefined for compounds. */
  aOverR?: number;
  /** Unit-cell volume as a multiple of a³ (1 for cubic). */
  volumeOverA3: number;
  /** Bond cutoff as a fraction of a; null suppresses bond drawing. */
  bondCutoff: number | null;
  examples: string;
  note: string;
}

const METAL: SpeciesDef = {
  label: 'Metal atom',
  color: '#3987e5',
  ballRadius: 0.13,
  fillRadius: 0.5,
};

export const STRUCTURES: StructureDef[] = [
  {
    id: 'sc',
    name: 'Simple cubic',
    system: 'Cubic',
    cell: 'cubic',
    basis: [{ pos: [0, 0, 0], species: 'M' }],
    species: { M: { ...METAL, fillRadius: 0.5 } },
    N: 1,
    CN: 6,
    APF: 0.52,
    aFromR: 'a = 2R',
    aOverR: 2,
    volumeOverA3: 1,
    bondCutoff: 1.05,
    examples: 'Polonium — essentially the only element that adopts it',
    note: 'The reference case: so loosely packed (APF 0.52) that almost nothing uses it. Compare its CN of 6 against FCC’s 12 to see why nature prefers dense packing.',
  },
  {
    id: 'fcc',
    name: 'Face-centred cubic (FCC)',
    system: 'Cubic',
    cell: 'cubic',
    basis: [
      { pos: [0, 0, 0], species: 'M' },
      { pos: [0.5, 0.5, 0], species: 'M' },
      { pos: [0.5, 0, 0.5], species: 'M' },
      { pos: [0, 0.5, 0.5], species: 'M' },
    ],
    species: { M: { ...METAL, fillRadius: Math.SQRT2 / 4 } },
    N: 4,
    CN: 12,
    APF: 0.74,
    aFromR: 'a = 2R√2',
    aOverR: 2 * Math.SQRT2,
    volumeOverA3: 1,
    bondCutoff: 0.75,
    examples: 'Copper, aluminium, silver, gold, nickel, lead, platinum',
    note: 'Atoms touch along the face diagonal. APF 0.74 is the densest packing possible for equal spheres — and the many close-packed slip planes are why FCC metals are so ductile.',
  },
  {
    id: 'bcc',
    name: 'Body-centred cubic (BCC)',
    system: 'Cubic',
    cell: 'cubic',
    basis: [
      { pos: [0, 0, 0], species: 'M' },
      { pos: [0.5, 0.5, 0.5], species: 'M' },
    ],
    species: { M: { ...METAL, fillRadius: Math.sqrt(3) / 4 } },
    N: 2,
    CN: 8,
    APF: 0.68,
    aFromR: 'a = 4R/√3',
    aOverR: 4 / Math.sqrt(3),
    volumeOverA3: 1,
    bondCutoff: 0.9,
    examples: 'α-iron, chromium, tungsten, molybdenum, tantalum',
    note: 'Atoms touch along the body diagonal. Fewer neighbours (CN 8) and looser packing than FCC — BCC metals are generally stronger but less ductile, and can turn brittle when cold.',
  },
  {
    id: 'hcp',
    name: 'Hexagonal close-packed (HCP)',
    system: 'Hexagonal',
    cell: 'hexagonal',
    coa: 1.633,
    basis: [],
    species: { M: { ...METAL, fillRadius: 0.5 } },
    N: 6,
    CN: 12,
    APF: 0.74,
    aFromR: 'a = 2R, ideal c/a = 1.633',
    aOverR: 2,
    // V = (3√3/2)·a²·c, with c = 1.633a
    volumeOverA3: ((3 * Math.sqrt(3)) / 2) * 1.633,
    bondCutoff: 1.05,
    examples: 'Magnesium, titanium (α), zinc, cadmium, cobalt',
    note: 'Just as densely packed as FCC (APF 0.74, CN 12) — the two differ only in stacking sequence, ABAB… here versus ABCABC… for FCC. Far fewer slip systems, which is why HCP metals are comparatively brittle.',
  },
  {
    id: 'diamond',
    name: 'Diamond cubic',
    system: 'Cubic',
    cell: 'cubic',
    basis: [
      { pos: [0, 0, 0], species: 'M' },
      { pos: [0.5, 0.5, 0], species: 'M' },
      { pos: [0.5, 0, 0.5], species: 'M' },
      { pos: [0, 0.5, 0.5], species: 'M' },
      { pos: [0.25, 0.25, 0.25], species: 'M' },
      { pos: [0.75, 0.75, 0.25], species: 'M' },
      { pos: [0.75, 0.25, 0.75], species: 'M' },
      { pos: [0.25, 0.75, 0.75], species: 'M' },
    ],
    species: {
      M: { label: 'Atom', color: '#898781', ballRadius: 0.1, fillRadius: Math.sqrt(3) / 8 },
    },
    N: 8,
    CN: 4,
    APF: 0.34,
    aFromR: 'a = 8R/√3',
    aOverR: 8 / Math.sqrt(3),
    volumeOverA3: 1,
    bondCutoff: 0.46,
    examples: 'Diamond, silicon, germanium, grey (α) tin',
    note: 'Covalent bonding is directional, so geometry is dictated by bond angles (109.5°) rather than by packing. The result is CN 4 and a startlingly empty APF of 0.34 — yet diamond is the hardest natural material. Packing density and hardness are different questions.',
  },
  {
    id: 'rocksalt',
    name: 'Rock salt (NaCl)',
    system: 'Cubic',
    cell: 'cubic',
    basis: [
      { pos: [0, 0, 0], species: 'A' },
      { pos: [0.5, 0.5, 0], species: 'A' },
      { pos: [0.5, 0, 0.5], species: 'A' },
      { pos: [0, 0.5, 0.5], species: 'A' },
      { pos: [0.5, 0, 0], species: 'B' },
      { pos: [0, 0.5, 0], species: 'B' },
      { pos: [0, 0, 0.5], species: 'B' },
      { pos: [0.5, 0.5, 0.5], species: 'B' },
    ],
    species: {
      A: { label: 'Cation (Na⁺)', color: '#eb6834', ballRadius: 0.1, fillRadius: 0.18 },
      B: { label: 'Anion (Cl⁻)', color: '#1baf7a', ballRadius: 0.14, fillRadius: 0.32 },
    },
    N: 8,
    CN: 6,
    APF: 0.67,
    aFromR: 'a = 2(r_cation + r_anion)',
    volumeOverA3: 1,
    bondCutoff: 0.55,
    examples: 'NaCl, MgO, LiF, FeO, most alkali halides',
    note: 'Two interpenetrating FCC lattices, offset by half a cell edge. Each ion is octahedrally surrounded by six of the opposite charge — ionic bonding is non-directional, so the structure is set by charge balance and the radius ratio.',
  },
  {
    id: 'cscl',
    name: 'Caesium chloride (CsCl)',
    system: 'Cubic',
    cell: 'cubic',
    basis: [
      { pos: [0, 0, 0], species: 'A' },
      { pos: [0.5, 0.5, 0.5], species: 'B' },
    ],
    species: {
      A: { label: 'Anion (Cl⁻)', color: '#1baf7a', ballRadius: 0.13, fillRadius: 0.28 },
      B: { label: 'Cation (Cs⁺)', color: '#eb6834', ballRadius: 0.15, fillRadius: 0.31 },
    },
    N: 2,
    CN: 8,
    APF: 0.68,
    aFromR: 'a = 2(r_cation + r_anion)/√3',
    volumeOverA3: 1,
    bondCutoff: 0.9,
    examples: 'CsCl, CsBr, CsI, β-brass (ordered)',
    note: 'Not BCC — the centre atom is a different species, so this is simple cubic with a two-atom basis. A bigger cation (Cs⁺ vs Na⁺) raises the radius ratio and buys a higher coordination number: 8 instead of rock salt’s 6.',
  },
  {
    id: 'perovskite',
    name: 'Perovskite (ABO₃)',
    system: 'Cubic',
    cell: 'cubic',
    basis: [
      { pos: [0, 0, 0], species: 'A' },
      { pos: [0.5, 0.5, 0.5], species: 'B' },
      { pos: [0.5, 0.5, 0], species: 'O' },
      { pos: [0.5, 0, 0.5], species: 'O' },
      { pos: [0, 0.5, 0.5], species: 'O' },
    ],
    species: {
      A: { label: 'A cation (e.g. Ba²⁺)', color: '#eda100', ballRadius: 0.15, fillRadius: 0.28 },
      B: { label: 'B cation (e.g. Ti⁴⁺)', color: '#4a3aa7', ballRadius: 0.1, fillRadius: 0.16 },
      O: { label: 'Oxygen', color: '#e34948', ballRadius: 0.12, fillRadius: 0.26 },
    },
    N: 5,
    CN: 6,
    APF: 0.68,
    aFromR: 'set by the A–O and B–O bond lengths',
    volumeOverA3: 1,
    bondCutoff: 0.55,
    examples: 'BaTiO₃, SrTiO₃, CaTiO₃, and the halide perovskites used in solar cells',
    note: 'The B cation sits inside an octahedron of six oxygens. Displace it slightly off-centre and the cell acquires a permanent dipole — that is ferroelectricity, and it is why BaTiO₃ ends up in capacitors and piezoelectric sensors.',
  },
];

export function getStructure(id: string): StructureDef {
  return STRUCTURES.find((s) => s.id === id) ?? STRUCTURES[1];
}

/** The arithmetic behind an atomic packing factor, in units of R³. */
export interface PackingDerivation {
  /** Atoms per unit cell. */
  N: number;
  /** Lattice parameter as a multiple of R. */
  aOverR: number;
  /** Total hard-sphere volume in the cell, N·(4/3)πR³, as a multiple of R³. */
  sphereVolume: number;
  /** Unit-cell volume as a multiple of R³. */
  cellVolume: number;
  /** The quotient. R cancels, so this is a property of the packing alone. */
  apf: number;
}

/**
 * APF derived rather than recalled: N × (4/3)πR³ ÷ V꜀, with the a↔R relation
 * supplying V꜀. Returns null for the compound structures, which have no single
 * radius and therefore no hard-sphere derivation — their `APF` field stays a
 * tabulated value. The same `aOverR == null` boundary `theoreticalDensity`
 * respects.
 */
export function packingFactor(s: StructureDef): PackingDerivation | null {
  if (s.aOverR == null) return null;
  const sphereVolume = s.N * (4 / 3) * Math.PI;
  const cellVolume = s.volumeOverA3 * s.aOverR ** 3;
  return {
    N: s.N,
    aOverR: s.aOverR,
    sphereVolume,
    cellVolume,
    apf: sphereVolume / cellVolume,
  };
}
