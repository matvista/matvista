/**
 * Corrosion data.
 *
 * Two series, deliberately separate, because they answer different questions
 * and disagree with one another:
 *
 * - `EMF_SERIES` — standard electrode potentials against the standard hydrogen
 *   electrode, 1 M, 25 °C (Callister & Rethwisch table 17.1). Exact,
 *   thermodynamic, and about *pure metals in their own ion solution*.
 * - `GALVANIC_SERIES` — real alloys ranked in seawater (Callister table 17.2).
 *   This is what predicts what happens to a fastener. Its ordering is the
 *   established part; the potentials are typical values and are shown as such.
 *
 * Merging them would be the classic error: passive 316 stainless sits beside
 * copper in seawater, and nowhere near it in the EMF series, because passivity
 * is a surface film and not a standard potential.
 */

export interface EmfEntry {
  /** Half-cell reaction, written as a reduction. */
  reaction: string;
  /** Standard electrode potential, V vs SHE. */
  E0: number;
  /** Electrons transferred. */
  n: number;
  /** Set for the entries that are a metal dissolving, which the couple panel uses. */
  metal?: string;
}

/** Callister & Rethwisch table 17.1, most noble first. */
export const EMF_SERIES: EmfEntry[] = [
  { reaction: 'Au³⁺ + 3e⁻ → Au', E0: 1.42, n: 3, metal: 'Gold' },
  { reaction: 'O₂ + 4H⁺ + 4e⁻ → 2H₂O', E0: 1.229, n: 4 },
  { reaction: 'Pt²⁺ + 2e⁻ → Pt', E0: 1.2, n: 2, metal: 'Platinum' },
  { reaction: 'Ag⁺ + e⁻ → Ag', E0: 0.8, n: 1, metal: 'Silver' },
  { reaction: 'Fe³⁺ + e⁻ → Fe²⁺', E0: 0.771, n: 1 },
  { reaction: 'O₂ + 2H₂O + 4e⁻ → 4(OH⁻)', E0: 0.401, n: 4 },
  { reaction: 'Cu²⁺ + 2e⁻ → Cu', E0: 0.34, n: 2, metal: 'Copper' },
  { reaction: '2H⁺ + 2e⁻ → H₂', E0: 0, n: 2 },
  { reaction: 'Pb²⁺ + 2e⁻ → Pb', E0: -0.126, n: 2, metal: 'Lead' },
  { reaction: 'Sn²⁺ + 2e⁻ → Sn', E0: -0.136, n: 2, metal: 'Tin' },
  { reaction: 'Ni²⁺ + 2e⁻ → Ni', E0: -0.25, n: 2, metal: 'Nickel' },
  { reaction: 'Co²⁺ + 2e⁻ → Co', E0: -0.277, n: 2, metal: 'Cobalt' },
  { reaction: 'Cd²⁺ + 2e⁻ → Cd', E0: -0.403, n: 2, metal: 'Cadmium' },
  { reaction: 'Fe²⁺ + 2e⁻ → Fe', E0: -0.44, n: 2, metal: 'Iron' },
  { reaction: 'Cr³⁺ + 3e⁻ → Cr', E0: -0.744, n: 3, metal: 'Chromium' },
  { reaction: 'Zn²⁺ + 2e⁻ → Zn', E0: -0.763, n: 2, metal: 'Zinc' },
  { reaction: 'Al³⁺ + 3e⁻ → Al', E0: -1.662, n: 3, metal: 'Aluminium' },
  { reaction: 'Mg²⁺ + 2e⁻ → Mg', E0: -2.363, n: 2, metal: 'Magnesium' },
  { reaction: 'Na⁺ + e⁻ → Na', E0: -2.714, n: 1, metal: 'Sodium' },
  { reaction: 'K⁺ + e⁻ → K', E0: -2.924, n: 1, metal: 'Potassium' },
];

export interface GalvanicEntry {
  name: string;
  /** Typical potential in seawater, V vs SCE. */
  potential: number;
  note?: string;
}

/**
 * The galvanic series in seawater, most cathodic (noble) first — Callister &
 * Rethwisch table 17.2. The **ordering** is the established, quotable part; the
 * potentials are typical values for the alloy in quiet seawater and vary with
 * aeration, velocity and temperature, so the UI reports them as approximate.
 *
 * Stainless steels appear twice on purpose. Passive is the normal state; active
 * is what the same alloy becomes where the oxide film is starved of oxygen, in
 * a crevice or under a deposit — and that shift of nearly half a volt is the
 * whole reason crevice corrosion is dangerous in an otherwise noble alloy.
 */
export const GALVANIC_SERIES: GalvanicEntry[] = [
  { name: 'Platinum', potential: 0.25 },
  { name: 'Gold', potential: 0.2 },
  { name: 'Graphite', potential: 0.2, note: 'Not a metal, but it acts as a large, efficient cathode — which is why graphite-fibre composites bolted to aluminium are a known problem.' },
  { name: 'Titanium', potential: -0.1 },
  { name: 'Silver', potential: -0.13 },
  { name: '316 stainless (passive)', potential: -0.05 },
  { name: '304 stainless (passive)', potential: -0.08 },
  { name: 'Nickel (passive)', potential: -0.12 },
  { name: 'Monel 400', potential: -0.15 },
  { name: 'Copper–nickel 70/30', potential: -0.25 },
  { name: 'Bronze', potential: -0.31 },
  { name: 'Copper', potential: -0.36 },
  { name: 'Brass', potential: -0.4 },
  { name: 'Nickel (active)', potential: -0.42 },
  { name: 'Tin', potential: -0.5 },
  { name: 'Lead', potential: -0.55 },
  { name: '316 stainless (active)', potential: -0.53, note: 'The same alloy as the passive entry near the top. Starve the film of oxygen — in a crevice, under a washer, beneath a deposit — and it drops to here.' },
  { name: '304 stainless (active)', potential: -0.57 },
  { name: 'Cast iron', potential: -0.61 },
  { name: 'Carbon steel', potential: -0.61 },
  { name: 'Aluminium 2024', potential: -0.75 },
  { name: 'Cadmium', potential: -0.8 },
  { name: 'Aluminium (commercially pure)', potential: -0.85 },
  { name: 'Zinc', potential: -1.03, note: 'Anodic to steel, which is the entire basis of galvanising: the coating is meant to corrode, and it protects bare steel at a scratch rather than leaving it exposed.' },
  { name: 'Magnesium', potential: -1.6, note: 'The most active metal in normal engineering use, and the usual sacrificial anode where the driving voltage needs to be large.' },
];

export interface PourbaixRegion {
  label: string;
  kind: 'immunity' | 'corrosion' | 'passivation';
  /** Polygon in (pH, E vs SHE) space. */
  points: [number, number][];
}

export interface PourbaixMetal {
  id: string;
  name: string;
  regions: PourbaixRegion[];
  note: string;
}

/**
 * Simplified Pourbaix diagrams, read off the standard published forms
 * (Callister ch. 17; Pourbaix's atlas) at 25 °C and an ion activity of 10⁻⁶ M,
 * which is the convention for "no significant corrosion".
 *
 * **Read these as region maps, not as measurements.** The boundaries are
 * straight-line simplifications of curves, and a Pourbaix diagram is
 * thermodynamic in any case: it says which phase is stable, never how fast the
 * change happens. The iron diagram's immunity/corrosion/passivation split and
 * aluminium's amphoteric behaviour are the teaching points, and both survive
 * the simplification.
 */
export const POURBAIX: PourbaixMetal[] = [
  {
    id: 'fe',
    name: 'Iron',
    note: 'Three lessons in one diagram. Iron is immune only when held below about −0.6 V, which is what cathodic protection does. It passivates in neutral-to-alkaline water, which is why steel survives in concrete at pH 13 — and why carbonation of that concrete, dropping the pH, starts the rebar rusting. In acid it simply dissolves.',
    regions: [
      { label: 'Immunity (Fe)', kind: 'immunity', points: [[0, -0.62], [14, -0.62], [14, -1.2], [0, -1.2]] },
      { label: 'Corrosion (Fe²⁺)', kind: 'corrosion', points: [[0, 1.2], [8.5, 1.2], [8.5, -0.62], [0, -0.62]] },
      { label: 'Passivation (Fe₂O₃)', kind: 'passivation', points: [[8.5, 1.2], [14, 1.2], [14, -0.62], [8.5, -0.62]] },
    ],
  },
  {
    id: 'al',
    name: 'Aluminium',
    note: 'Amphoteric: aluminium passivates over a broad middle band and corrodes at *both* ends of the pH scale. That is why aluminium survives rain but not oven cleaner, and why it must never be paired with wet concrete or fresh mortar, which are strongly alkaline.',
    regions: [
      { label: 'Immunity (Al)', kind: 'immunity', points: [[0, -1.8], [14, -1.8], [14, -2.4], [0, -2.4]] },
      { label: 'Corrosion (Al³⁺)', kind: 'corrosion', points: [[0, 1.2], [4, 1.2], [4, -1.8], [0, -1.8]] },
      { label: 'Passivation (Al₂O₃)', kind: 'passivation', points: [[4, 1.2], [8.5, 1.2], [8.5, -1.8], [4, -1.8]] },
      { label: 'Corrosion (AlO₂⁻)', kind: 'corrosion', points: [[8.5, 1.2], [14, 1.2], [14, -1.8], [8.5, -1.8]] },
    ],
  },
  {
    id: 'zn',
    name: 'Zinc',
    note: 'Also amphoteric, with a narrower passive band than aluminium and a much higher immunity line. Zinc corrodes readily across most of the practical range — which is exactly what a sacrificial coating is for.',
    regions: [
      { label: 'Immunity (Zn)', kind: 'immunity', points: [[0, -1.0], [14, -1.0], [14, -1.6], [0, -1.6]] },
      { label: 'Corrosion (Zn²⁺)', kind: 'corrosion', points: [[0, 1.2], [8.5, 1.2], [8.5, -1.0], [0, -1.0]] },
      { label: 'Passivation (ZnO)', kind: 'passivation', points: [[8.5, 1.2], [10.5, 1.2], [10.5, -1.0], [8.5, -1.0]] },
      { label: 'Corrosion (ZnO₂²⁻)', kind: 'corrosion', points: [[10.5, 1.2], [14, 1.2], [14, -1.0], [10.5, -1.0]] },
    ],
  },
];

export function getPourbaix(id: string): PourbaixMetal {
  return POURBAIX.find((p) => p.id === id) ?? POURBAIX[0];
}

/** Which region of a metal's diagram a (pH, E) point falls in. */
export function regionAt(metal: PourbaixMetal, pH: number, E: number): PourbaixRegion | null {
  for (const r of metal.regions) {
    const xs = r.points.map((p) => p[0]);
    const ys = r.points.map((p) => p[1]);
    if (pH >= Math.min(...xs) && pH <= Math.max(...xs) && E >= Math.min(...ys) && E <= Math.max(...ys)) {
      return r;
    }
  }
  return null;
}
