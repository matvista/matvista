/**
 * Data for the failure module.
 *
 * Three separate datasets rather than one, because the properties come from
 * different places and are *not* interchangeable:
 *
 * - `FRACTURE_ALLOYS` — plane-strain fracture toughness is a property of a
 *   specific alloy in a specific heat treatment, not of "steel". Callister &
 *   Rethwisch table 8.1 pairs each K_IC with the yield strength it was measured
 *   against, and both are carried together for that reason.
 * - `BRITTLE_SOLIDS` — for Griffith, which needs a modulus and a surface energy
 *   and only applies where fracture really is ideally brittle.
 * - `GROWTH_CLASSES` — Barsom & Rolfe's crack-growth equations are published per
 *   *class* of steel, as upper-bound design curves. They are not aluminium
 *   constants and must not be offered as such.
 *
 * The S–N curves are built from the tensile strengths already in
 * `mechanical/materials.ts`; see `FATIGUE_BEHAVIOUR`.
 */

export interface FractureAlloy {
  id: string;
  name: string;
  /** Yield strength, MPa (Callister table 8.1). */
  yieldStrength: number;
  /** Plane-strain fracture toughness, MPa·√m (Callister table 8.1). */
  kic: number;
  note: string;
}

/**
 * Callister & Rethwisch table 8.1, room temperature. The two 4340 entries are
 * the same steel at two tempering temperatures and are the point of the table:
 * toughness and strength trade against one another.
 */
export const FRACTURE_ALLOYS: FractureAlloy[] = [
  {
    id: '4340-425',
    name: 'Steel 4340 (tempered 425 °C)',
    yieldStrength: 1420,
    kic: 87.4,
    note: 'Tempered warm: 87.4 MPa√m of toughness bought with 220 MPa of yield strength, against the same steel tempered at 260 °C. For a cracked component that is a good trade — it tolerates a flaw three times longer.',
  },
  {
    id: '4340-260',
    name: 'Steel 4340 (tempered 260 °C)',
    yieldStrength: 1640,
    kic: 50,
    note: 'The strong, brittle end of the same steel. Higher yield strength, barely half the toughness, and a critical crack size that can fall below what routine inspection will find — which is how a stronger part ends up being the one that breaks.',
  },
  {
    id: 'ti-6al-4v',
    name: 'Titanium Ti–6Al–4V',
    yieldStrength: 910,
    kic: 55,
    note: 'The aerospace workhorse: two-thirds the yield strength of hard 4340 with slightly more toughness, at 60% of the density.',
  },
  {
    id: '7075',
    name: 'Aluminium 7075-T651',
    yieldStrength: 495,
    kic: 24,
    note: 'The lowest toughness here. High-strength aluminium is notch-sensitive, and 7075 in particular is chosen for strength and stiffness rather than for damage tolerance.',
  },
  {
    id: '2024',
    name: 'Aluminium 2024-T351',
    yieldStrength: 325,
    kic: 36,
    note: 'Lower strength than 7075 but half again as tough — which is why 2024 is the traditional choice for fuselage skin, where cracks must be allowed to grow slowly enough to be found.',
  },
];

export function getFractureAlloy(id: string): FractureAlloy {
  return FRACTURE_ALLOYS.find((a) => a.id === id) ?? FRACTURE_ALLOYS[0];
}

export interface BrittleSolid {
  id: string;
  name: string;
  /** Modulus of elasticity, GPa. */
  E: number;
  /** Specific surface energy, J/m². */
  gamma: number;
  note: string;
}

/**
 * For the Griffith calculation only. Values follow Callister's worked example
 * for soda-lime glass (E = 69 GPa, γs = 0.3 J/m²); the others are of the same
 * order and are labelled in the UI as representative rather than exact.
 */
export const BRITTLE_SOLIDS: BrittleSolid[] = [
  {
    id: 'glass',
    name: 'Soda-lime glass',
    E: 69,
    gamma: 0.3,
    note: 'Callister’s worked example. A 40 MPa stress makes an 8.2 µm flaw critical — smaller than a speck of dust, which is why glass strength is set by surface damage rather than by chemistry.',
  },
  {
    id: 'alumina',
    name: 'Aluminium oxide (Al₂O₃)',
    E: 393,
    gamma: 0.9,
    note: 'Stiffer and with a higher surface energy than glass, so it tolerates a larger flaw at the same stress — but still measured in tens of microns.',
  },
  {
    id: 'mgo',
    name: 'Magnesium oxide (MgO)',
    E: 225,
    gamma: 1.2,
    note: 'A representative rock-salt ceramic. The point of comparing these three is how little the tolerable flaw changes: brittle solids fail from tiny defects whatever their bonding.',
  },
];

export interface GrowthClass {
  id: string;
  name: string;
  /** Paris coefficient C, m/cycle with ΔK in MPa·√m. */
  C: number;
  /** Paris exponent m. */
  m: number;
  /** Representative plane-strain toughness for the class, MPa·√m. */
  kic: number;
  note: string;
}

/**
 * Barsom & Rolfe's upper-bound crack-growth equations for steels in air
 * (*Fracture and Fatigue Control in Structures*), the form quoted in most
 * design codes:
 *
 *   ferritic–pearlitic     da/dN = 6.9 × 10⁻¹² (ΔK)^3.00
 *   martensitic            da/dN = 1.35 × 10⁻¹⁰ (ΔK)^2.25
 *   austenitic stainless   da/dN = 5.6 × 10⁻¹² (ΔK)^3.25
 *
 * Units are m/cycle with ΔK in MPa·√m. These are **steel** equations — the
 * module does not offer aluminium here, because the constants are not
 * transferable and the resulting life would be wrong by orders of magnitude.
 */
export const GROWTH_CLASSES: GrowthClass[] = [
  {
    id: 'ferritic',
    name: 'Ferritic–pearlitic steel',
    C: 6.9e-12,
    m: 3.0,
    kic: 110,
    note: 'Structural steel: bridges, pressure vessels, ships. The exponent of 3 is the value to remember — halving the stress range multiplies the life by eight.',
  },
  {
    id: 'martensitic',
    name: 'Martensitic steel',
    C: 1.35e-10,
    m: 2.25,
    kic: 70,
    note: 'Quenched and tempered. A lower exponent but a far larger coefficient, so it grows cracks faster than ferritic–pearlitic steel at every practical ΔK — strength again bought at the cost of damage tolerance.',
  },
  {
    id: 'austenitic',
    name: 'Austenitic stainless steel',
    C: 5.6e-12,
    m: 3.25,
    kic: 150,
    note: 'The most crack-tolerant of the three, and the toughest — the reason austenitic grades are used where a leak must be preferred to a break.',
  },
];

export function getGrowthClass(id: string): GrowthClass {
  return GROWTH_CLASSES.find((g) => g.id === id) ?? GROWTH_CLASSES[0];
}

export interface FatigueBehaviour {
  /** Matches an id in `mechanical/materials.ts`. */
  id: string;
  /**
   * True for the alloys that show a genuine fatigue limit — ferrous alloys and
   * titanium. For everything else the S–N curve keeps descending, and drawing a
   * horizontal asymptote would promise infinite life that does not exist.
   */
  hasEnduranceLimit: boolean;
  /** Fatigue strength at `kneeCycles`, as a fraction of tensile strength. */
  ratio: number;
  /** Where the endurance limit sets in, or where the quoted strength is read. */
  kneeCycles: number;
}

/**
 * Standard design estimates, not measured S–N data — the UI states this plainly.
 *
 * Ferrous alloys: endurance limit ≈ 0.5·UTS at 10⁶ cycles, the long-standing
 * rule quoted by Shigley and others. Aluminium has no fatigue limit and its
 * strength is conventionally quoted at 5 × 10⁸ cycles, around 0.4·UTS; copper
 * alloys are quoted near 0.35·UTS at 10⁸. Titanium does show a limit.
 */
export const FATIGUE_BEHAVIOUR: FatigueBehaviour[] = [
  { id: 'steel1020', hasEnduranceLimit: true, ratio: 0.5, kneeCycles: 1e6 },
  { id: 'fe', hasEnduranceLimit: true, ratio: 0.5, kneeCycles: 1e6 },
  { id: 'ti', hasEnduranceLimit: true, ratio: 0.5, kneeCycles: 1e6 },
  { id: 'al', hasEnduranceLimit: false, ratio: 0.4, kneeCycles: 5e8 },
  { id: 'cu', hasEnduranceLimit: false, ratio: 0.35, kneeCycles: 1e8 },
  { id: 'brass', hasEnduranceLimit: false, ratio: 0.35, kneeCycles: 1e8 },
  { id: 'ni', hasEnduranceLimit: false, ratio: 0.4, kneeCycles: 1e8 },
];

export function getFatigueBehaviour(id: string): FatigueBehaviour {
  return FATIGUE_BEHAVIOUR.find((f) => f.id === id) ?? FATIGUE_BEHAVIOUR[0];
}

/**
 * Larson–Miller master curve for the S-590 iron-based superalloy, digitised
 * from Callister & Rethwisch fig. 8.32. Stress in MPa against P = T(20 + log t)
 * with T in kelvin and t in hours, P quoted in thousands.
 *
 * Read as **digitised and approximate**, in the same spirit as the TTT nose
 * positions in `heattreat/steels.ts`. The anchor that matters is the book's own
 * worked example: 140 MPa at 800 °C gives P ≈ 24.0 × 10³ and a rupture life of
 * about 233 hours, which this table reproduces.
 */
export const S590_CURVE: { P: number; stress: number }[] = [
  { P: 20.0, stress: 620 },
  { P: 21.0, stress: 500 },
  { P: 22.0, stress: 390 },
  { P: 23.0, stress: 260 },
  { P: 24.0, stress: 140 },
  { P: 25.0, stress: 78 },
  { P: 26.0, stress: 46 },
  { P: 27.0, stress: 28 },
];

/** P range the curve actually covers; outside it, any reading is extrapolation. */
export const S590_P_MIN = S590_CURVE[0].P;
export const S590_P_MAX = S590_CURVE[S590_CURVE.length - 1].P;

/**
 * Stress the master curve gives for a Larson–Miller parameter (P in thousands),
 * interpolating linearly in log stress — which is how the curve is plotted.
 */
export function s590Stress(P: number): number {
  const c = S590_CURVE;
  if (P <= c[0].P) return c[0].stress;
  if (P >= c[c.length - 1].P) return c[c.length - 1].stress;
  for (let i = 0; i < c.length - 1; i++) {
    if (P >= c[i].P && P <= c[i + 1].P) {
      const t = (P - c[i].P) / (c[i + 1].P - c[i].P);
      return 10 ** (Math.log10(c[i].stress) + t * (Math.log10(c[i + 1].stress) - Math.log10(c[i].stress)));
    }
  }
  return c[c.length - 1].stress;
}

/** Inverse: the P at which the curve reaches a given stress. */
export function s590Parameter(stress: number): number {
  const c = S590_CURVE;
  if (stress >= c[0].stress) return c[0].P;
  if (stress <= c[c.length - 1].stress) return c[c.length - 1].P;
  for (let i = 0; i < c.length - 1; i++) {
    if (stress <= c[i].stress && stress >= c[i + 1].stress) {
      const t =
        (Math.log10(stress) - Math.log10(c[i].stress)) /
        (Math.log10(c[i + 1].stress) - Math.log10(c[i].stress));
      return c[i].P + t * (c[i + 1].P - c[i].P);
    }
  }
  return c[c.length - 1].P;
}
