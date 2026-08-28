/**
 * Semiconductor data, Callister & Rethwisch table 18.3 (band gap and carrier
 * mobilities at 300 K), with intrinsic carrier concentrations from the standard
 * published values.
 *
 * Not every entry carries `carriers`. Band gap and mobility are tabulated for
 * all seven; a reliable n_i and relative permittivity are not, and the wide-gap
 * compounds (GaP, CdS, ZnTe) are here for the **band-gap comparison only**.
 * Fabricating an n_i for them so every panel could offer every material would
 * put a confident number where there is no source — so those materials are
 * simply not offered in the panels that need one.
 *
 * Conductivity is *computed* from n_i and the mobilities rather than stored.
 * Callister tabulates σ as well, to one significant figure; recomputing silicon
 * gives 3.0 × 10⁻⁴ (Ω·m)⁻¹ against his 4 × 10⁻⁴, and gallium arsenide is the
 * worst case at about three times his 10⁻⁶. That spread is what an
 * order-of-magnitude table means, and it is better shown than papered over.
 */

export interface CarrierData {
  /** Intrinsic carrier concentration at 300 K, m⁻³. */
  ni300: number;
  /** Relative permittivity, for the junction calculation. */
  epsR: number;
}

export interface Semiconductor {
  id: string;
  name: string;
  formula: string;
  /** Band gap at 300 K, eV (Callister table 18.3). */
  Eg: number;
  /** Electron mobility, m²/V·s. */
  mu_e: number;
  /** Hole mobility, m²/V·s. Null where no reliable value is tabulated. */
  mu_h: number | null;
  /** Present only for the materials with a dependable n_i. */
  carriers: CarrierData | null;
  /** Indirect gaps cannot emit light efficiently — the reason for the label. */
  gapKind: 'direct' | 'indirect';
  note: string;
}

export const SEMICONDUCTORS: Semiconductor[] = [
  {
    id: 'ge',
    name: 'Germanium',
    formula: 'Ge',
    Eg: 0.67,
    mu_e: 0.38,
    mu_h: 0.18,
    carriers: { ni300: 2.4e19, epsR: 16.0 },
    gapKind: 'indirect',
    note: 'The narrowest common gap, and the reason germanium lost to silicon: at 0.67 eV there are already 2.4 × 10¹³ intrinsic carriers per cm³ at room temperature, so a germanium device runs out of extrinsic behaviour not far above it.',
  },
  {
    id: 'si',
    name: 'Silicon',
    formula: 'Si',
    Eg: 1.11,
    mu_e: 0.14,
    mu_h: 0.05,
    carriers: { ni300: 1.0e16, epsR: 11.7 },
    gapKind: 'indirect',
    note: 'The industry standard, and not because its mobility is good — gallium arsenide moves electrons six times faster. A 1.11 eV gap puts n_i at 10¹⁰ per cm³, low enough that doping still dominates well above 400 K, and silicon grows a stable native oxide. Neither property is about speed.',
  },
  {
    id: 'gaas',
    name: 'Gallium arsenide',
    formula: 'GaAs',
    Eg: 1.42,
    mu_e: 0.85,
    mu_h: 0.04,
    carriers: { ni300: 2.1e12, epsR: 12.9 },
    gapKind: 'direct',
    note: 'A direct gap, so it emits light — lasers and LEDs — and its electron mobility is six times silicon’s. Its hole mobility is not: 0.04 against silicon’s 0.05, which is why complementary logic in GaAs never worked out.',
  },
  {
    id: 'insb',
    name: 'Indium antimonide',
    formula: 'InSb',
    Eg: 0.17,
    mu_e: 7.7,
    mu_h: 0.07,
    carriers: { ni300: 2.0e22, epsR: 16.8 },
    gapKind: 'direct',
    note: 'The extreme case: a 0.17 eV gap gives 2 × 10¹⁶ intrinsic carriers per cm³ at room temperature — more than many people dope silicon — so InSb is essentially a conductor unless cooled. That tiny gap is exactly what makes it an infrared detector.',
  },
  {
    id: 'gap',
    name: 'Gallium phosphide',
    formula: 'GaP',
    Eg: 2.25,
    mu_e: 0.05,
    mu_h: 0.002,
    carriers: null,
    gapKind: 'indirect',
    note: 'A wide gap in the visible range, used in green and red LEDs — though its indirect gap means it needs help to emit at all.',
  },
  {
    id: 'cds',
    name: 'Cadmium sulfide',
    formula: 'CdS',
    Eg: 2.4,
    mu_e: 0.03,
    mu_h: null,
    carriers: null,
    gapKind: 'direct',
    note: 'Wide and direct. Long used in photoresistors, because 2.4 eV sits in the visible: light of shorter wavelength has enough energy to lift an electron across the gap, and the resistance falls.',
  },
  {
    id: 'znte',
    name: 'Zinc telluride',
    formula: 'ZnTe',
    Eg: 2.26,
    mu_e: 0.03,
    mu_h: 0.01,
    carriers: null,
    gapKind: 'direct',
    note: 'A II–VI compound with a gap near GaP’s. The trend across this table is the useful part: gap widens as the bonding becomes more ionic, and mobility collapses with it.',
  },
];

export function getSemiconductor(id: string): Semiconductor {
  return SEMICONDUCTORS.find((s) => s.id === id) ?? SEMICONDUCTORS[1];
}

/** The materials with enough data for the carrier and junction panels. */
export const DOPABLE = SEMICONDUCTORS.filter(
  (s): s is Semiconductor & { carriers: CarrierData; mu_h: number } =>
    s.carriers != null && s.mu_h != null,
);

export interface Dopant {
  id: string;
  name: string;
  type: 'donor' | 'acceptor';
  note: string;
}

/** Group V donates an electron to silicon; group III leaves a hole behind. */
export const DOPANTS: Dopant[] = [
  { id: 'p', name: 'Phosphorus (V)', type: 'donor', note: 'Five valence electrons against silicon’s four: the extra one is bound so loosely that room temperature frees it.' },
  { id: 'as', name: 'Arsenic (V)', type: 'donor', note: 'The other common donor, chosen where a shallower diffusion profile is wanted.' },
  { id: 'b', name: 'Boron (III)', type: 'acceptor', note: 'Three valence electrons: the missing bond is a hole, and it accepts an electron from the valence band to fill it.' },
  { id: 'ga', name: 'Gallium (III)', type: 'acceptor', note: 'An acceptor like boron, with a slightly deeper level.' },
];
