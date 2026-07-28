/**
 * Binary phase diagram models.
 *
 * Every invariant point, solubility limit and melting temperature below is
 * taken from Callister & Rethwisch ch. 9. The *curves between* those fixed
 * points are fitted or linearised — documented per system — so read the
 * labelled points as data and the boundaries as interpolation.
 */

export interface PhaseAmount {
  name: string;
  /** Composition of this phase, in the diagram's x units. */
  composition: number;
  /** Mass fraction, 0–1. */
  fraction: number;
}

export interface PhasePoint {
  /** Name of the region, e.g. "α + L". */
  region: string;
  phases: PhaseAmount[];
  /** Tie line endpoints when two phases coexist. */
  tieLine: { x1: number; x2: number } | null;
  /** Set when the point lies outside the modelled window. */
  outside?: boolean;
}

export interface Boundary {
  label: string;
  /** Polyline in (composition, temperature) space. */
  points: [number, number][];
  kind: 'liquidus' | 'solidus' | 'solvus' | 'isotherm';
}

export interface Invariant {
  label: string;
  x: number;
  T: number;
  reaction: string;
  type: 'eutectic' | 'eutectoid';
}

export interface PhaseSystem {
  id: string;
  name: string;
  xLabel: string;
  xMin: number;
  xMax: number;
  tMin: number;
  tMax: number;
  boundaries: Boundary[];
  invariants: Invariant[];
  regionLabels: { text: string; x: number; T: number }[];
  note: string;
  evaluate(x: number, T: number): PhasePoint;
}

/** Lever rule: fraction of the phase at C1, given overall C0 between C1 and C2. */
export function lever(C0: number, C1: number, C2: number): number {
  if (C2 === C1) return 1;
  return (C2 - C0) / (C2 - C1);
}

function twoPhase(
  region: string,
  a: { name: string; composition: number },
  b: { name: string; composition: number },
  C0: number,
): PhasePoint {
  const fa = Math.min(1, Math.max(0, lever(C0, a.composition, b.composition)));
  return {
    region,
    phases: [
      { ...a, fraction: fa },
      { ...b, fraction: 1 - fa },
    ],
    tieLine: { x1: a.composition, x2: b.composition },
  };
}

function singlePhase(name: string, C0: number): PhasePoint {
  return {
    region: name,
    phases: [{ name, composition: C0, fraction: 1 }],
    tieLine: null,
  };
}

// ===================== Cu–Ni : isomorphous =====================
//
// Anchors: Cu melts at 1085 °C, Ni at 1455 °C (Callister §9.6). The lens shape
// is a two-point fit to his worked tie line — a 35 wt% Ni alloy at 1250 °C has
// liquid of 31.5 wt% Ni and α of 42.5 wt% Ni — which fixes both exponents.

const CU_MP = 1085;
const NI_MP = 1455;
const SPAN = NI_MP - CU_MP;
const A_LIQ = Math.log(165 / SPAN) / Math.log(0.315); // ≈ 0.699
const A_SOL = Math.log(165 / SPAN) / Math.log(0.425); // ≈ 0.944

const liquidusT = (x: number) => CU_MP + SPAN * Math.pow(x / 100, A_LIQ);
const solidusT = (x: number) => CU_MP + SPAN * Math.pow(x / 100, A_SOL);
const liquidusX = (T: number) => 100 * Math.pow((T - CU_MP) / SPAN, 1 / A_LIQ);
const solidusX = (T: number) => 100 * Math.pow((T - CU_MP) / SPAN, 1 / A_SOL);

function sampled(f: (x: number) => number, from: number, to: number, n = 60): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = from + ((to - from) * i) / n;
    out.push([x, f(x)]);
  }
  return out;
}

export const CU_NI: PhaseSystem = {
  id: 'cu-ni',
  name: 'Copper–Nickel (isomorphous)',
  xLabel: 'wt% Ni',
  xMin: 0,
  xMax: 100,
  tMin: 1000,
  tMax: 1550,
  boundaries: [
    { label: 'Liquidus', points: sampled(liquidusT, 0, 100), kind: 'liquidus' },
    { label: 'Solidus', points: sampled(solidusT, 0, 100), kind: 'solidus' },
  ],
  invariants: [],
  regionLabels: [
    { text: 'L', x: 20, T: 1480 },
    { text: 'α', x: 75, T: 1080 },
    { text: 'α + L', x: 52, T: 1290 },
  ],
  note: 'The simplest binary diagram: copper and nickel are soluble in one another in **all** proportions, solid and liquid alike — they satisfy every Hume-Rothery rule. There is no eutectic, no compound, and only one solid phase. Everything between the liquidus and solidus is the two-phase α + L lens where the lever rule applies.',
  evaluate(x, T) {
    if (T >= liquidusT(x)) return singlePhase('L', x);
    if (T <= solidusT(x)) return singlePhase('α', x);
    return twoPhase(
      'α + L',
      { name: 'α', composition: solidusX(T) },
      { name: 'L', composition: liquidusX(T) },
      x,
    );
  },
};

// ===================== Pb–Sn : eutectic =====================
//
// Invariant point and solubility limits are exact (Callister §9.12): eutectic
// 61.9 wt% Sn at 183 °C; maximum solid solubility 18.3 wt% Sn in α and
// 97.8 wt% Sn in β, both at 183 °C; Pb melts at 327 °C, Sn at 232 °C. The
// boundary lines joining those points are linearised.

const EUT_X = 61.9;
const EUT_T = 183;
const ALPHA_MAX = 18.3;
const BETA_MAX = 97.8;
const PB_MP = 327;
const SN_MP = 232;
/** Room-temperature solvus limits — Callister quotes α from "about 2" wt% Sn. */
const ALPHA_RT = 2;
const BETA_RT = 99.5;
const PBSN_TMIN = 20;

const lerp = (x: number, x1: number, y1: number, x2: number, y2: number) =>
  y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);

const pbsnLiquidus = (x: number) =>
  x <= EUT_X ? lerp(x, 0, PB_MP, EUT_X, EUT_T) : lerp(x, EUT_X, EUT_T, 100, SN_MP);
const pbsnAlphaSolidus = (x: number) => lerp(x, 0, PB_MP, ALPHA_MAX, EUT_T);
const pbsnBetaSolidus = (x: number) => lerp(x, 100, SN_MP, BETA_MAX, EUT_T);
/** Solvus in composition-as-function-of-temperature form. */
const alphaSolvusX = (T: number) => lerp(T, PBSN_TMIN, ALPHA_RT, EUT_T, ALPHA_MAX);
const betaSolvusX = (T: number) => lerp(T, PBSN_TMIN, BETA_RT, EUT_T, BETA_MAX);
/** Liquidus in composition form, per branch. */
const pbsnLiquidusXLeft = (T: number) => lerp(T, PB_MP, 0, EUT_T, EUT_X);
const pbsnLiquidusXRight = (T: number) => lerp(T, SN_MP, 100, EUT_T, EUT_X);
const alphaSolidusX = (T: number) => lerp(T, PB_MP, 0, EUT_T, ALPHA_MAX);
const betaSolidusX = (T: number) => lerp(T, SN_MP, 100, EUT_T, BETA_MAX);

export const PB_SN: PhaseSystem = {
  id: 'pb-sn',
  name: 'Lead–Tin (eutectic)',
  xLabel: 'wt% Sn',
  xMin: 0,
  xMax: 100,
  tMin: PBSN_TMIN,
  tMax: 350,
  boundaries: [
    {
      label: 'Liquidus',
      points: [
        [0, PB_MP],
        [EUT_X, EUT_T],
        [100, SN_MP],
      ],
      kind: 'liquidus',
    },
    { label: 'α solidus', points: [[0, PB_MP], [ALPHA_MAX, EUT_T]], kind: 'solidus' },
    { label: 'β solidus', points: [[100, SN_MP], [BETA_MAX, EUT_T]], kind: 'solidus' },
    { label: 'α solvus', points: [[ALPHA_MAX, EUT_T], [ALPHA_RT, PBSN_TMIN]], kind: 'solvus' },
    { label: 'β solvus', points: [[BETA_MAX, EUT_T], [BETA_RT, PBSN_TMIN]], kind: 'solvus' },
    { label: 'Eutectic isotherm', points: [[ALPHA_MAX, EUT_T], [BETA_MAX, EUT_T]], kind: 'isotherm' },
  ],
  invariants: [
    {
      label: 'Eutectic',
      x: EUT_X,
      T: EUT_T,
      reaction: 'L (61.9 wt% Sn) ⇌ α (18.3 wt% Sn) + β (97.8 wt% Sn)',
      type: 'eutectic',
    },
  ],
  regionLabels: [
    { text: 'L', x: 50, T: 320 },
    { text: 'α', x: 6, T: 150 },
    { text: 'β', x: 99, T: 150 },
    { text: 'α + L', x: 28, T: 250 },
    { text: 'β + L', x: 85, T: 215 },
    { text: 'α + β', x: 55, T: 100 },
  ],
  note: 'The eutectic: a single composition (61.9 wt% Sn) that melts at a **lower temperature than either pure component** — 183 °C, against 327 °C for lead and 232 °C for tin. On cooling through that point liquid transforms directly into two solids at once, giving the layered α + β lamellar microstructure. This is why solder is a near-eutectic Pb–Sn alloy: it melts low and freezes sharply.',
  evaluate(x, T) {
    if (T >= pbsnLiquidus(x)) return singlePhase('L', x);

    if (T > EUT_T) {
      // Above the eutectic isotherm.
      if (x < ALPHA_MAX && T <= pbsnAlphaSolidus(x)) return singlePhase('α', x);
      if (x > BETA_MAX && T <= pbsnBetaSolidus(x)) return singlePhase('β', x);
      if (x < EUT_X) {
        return twoPhase(
          'α + L',
          { name: 'α', composition: alphaSolidusX(T) },
          { name: 'L', composition: pbsnLiquidusXLeft(T) },
          x,
        );
      }
      return twoPhase(
        'β + L',
        { name: 'L', composition: pbsnLiquidusXRight(T) },
        { name: 'β', composition: betaSolidusX(T) },
        x,
      );
    }

    // At or below the eutectic isotherm.
    const aSolvus = alphaSolvusX(T);
    const bSolvus = betaSolvusX(T);
    if (x <= aSolvus) return singlePhase('α', x);
    if (x >= bSolvus) return singlePhase('β', x);
    return twoPhase(
      'α + β',
      { name: 'α', composition: aSolvus },
      { name: 'β', composition: bSolvus },
      x,
    );
  },
};

// ===================== Fe–Fe3C : eutectoid =====================
//
// Exact points (Callister §9.18): eutectoid 0.76 wt% C at 727 °C; eutectic
// 4.30 wt% C at 1147 °C; maximum C in austenite 2.14 wt% at 1147 °C; maximum C
// in ferrite 0.022 wt% at 727 °C; cementite is 6.70 wt% C. The δ-ferrite and
// peritectic region near pure iron is omitted — Callister notes δ-ferrite "is
// of no technological importance".

export const EUTECTOID_X = 0.76;
export const EUTECTOID_T = 727;
export const FE_EUT_X = 4.3;
export const FE_EUT_T = 1147;
export const GAMMA_MAX = 2.14;
export const FERRITE_MAX = 0.022;
export const CEMENTITE_X = 6.7;
const FE_MP = 1538;
const FERRITE_RT = 0.005;
const FEC_TMIN = 400;
const A3_PURE = 912;

const a3X = (T: number) => lerp(T, A3_PURE, 0, EUTECTOID_T, EUTECTOID_X);
const acmX = (T: number) => lerp(T, EUTECTOID_T, EUTECTOID_X, FE_EUT_T, GAMMA_MAX);
const ferriteSolvusX = (T: number) => lerp(T, FEC_TMIN, FERRITE_RT, EUTECTOID_T, FERRITE_MAX);
const feLiquidus = (x: number) =>
  x <= FE_EUT_X ? lerp(x, 0, FE_MP, FE_EUT_X, FE_EUT_T) : lerp(x, FE_EUT_X, FE_EUT_T, CEMENTITE_X, 1227);
const feLiquidusXLeft = (T: number) => lerp(T, FE_MP, 0, FE_EUT_T, FE_EUT_X);
const feLiquidusXRight = (T: number) => lerp(T, FE_EUT_T, FE_EUT_X, 1227, CEMENTITE_X);
const gammaSolidusX = (T: number) => lerp(T, FE_MP, 0, FE_EUT_T, GAMMA_MAX);

export const FE_C: PhaseSystem = {
  id: 'fe-c',
  name: 'Iron–Iron carbide (eutectoid)',
  xLabel: 'wt% C',
  xMin: 0,
  xMax: CEMENTITE_X,
  tMin: FEC_TMIN,
  tMax: 1600,
  boundaries: [
    {
      label: 'Liquidus',
      points: [
        [0, FE_MP],
        [FE_EUT_X, FE_EUT_T],
        [CEMENTITE_X, 1227],
      ],
      kind: 'liquidus',
    },
    { label: 'γ solidus', points: [[0, FE_MP], [GAMMA_MAX, FE_EUT_T]], kind: 'solidus' },
    { label: 'A₃', points: [[0, A3_PURE], [EUTECTOID_X, EUTECTOID_T]], kind: 'solvus' },
    { label: 'A_cm', points: [[EUTECTOID_X, EUTECTOID_T], [GAMMA_MAX, FE_EUT_T]], kind: 'solvus' },
    { label: 'α solvus', points: [[FERRITE_MAX, EUTECTOID_T], [FERRITE_RT, FEC_TMIN]], kind: 'solvus' },
    {
      label: 'Eutectoid isotherm',
      points: [[FERRITE_MAX, EUTECTOID_T], [CEMENTITE_X, EUTECTOID_T]],
      kind: 'isotherm',
    },
    {
      label: 'Eutectic isotherm',
      points: [[GAMMA_MAX, FE_EUT_T], [CEMENTITE_X, FE_EUT_T]],
      kind: 'isotherm',
    },
  ],
  invariants: [
    {
      label: 'Eutectoid',
      x: EUTECTOID_X,
      T: EUTECTOID_T,
      reaction: 'γ (0.76 wt% C) ⇌ α (0.022 wt% C) + Fe₃C (6.70 wt% C)',
      type: 'eutectoid',
    },
    {
      label: 'Eutectic',
      x: FE_EUT_X,
      T: FE_EUT_T,
      reaction: 'L (4.30 wt% C) ⇌ γ (2.14 wt% C) + Fe₃C (6.70 wt% C)',
      type: 'eutectic',
    },
  ],
  regionLabels: [
    { text: 'L', x: 2.2, T: 1520 },
    { text: 'γ (austenite)', x: 1.1, T: 1000 },
    { text: 'γ + Fe₃C', x: 3.4, T: 900 },
    { text: 'α + Fe₃C', x: 3.4, T: 600 },
    { text: 'γ + L', x: 3.0, T: 1250 },
  ],
  note: 'The diagram that steel is built on. The **eutectoid** at 0.76 wt% C and 727 °C is a solid-to-solid analogue of the eutectic: austenite transforms directly into ferrite plus cementite, producing the layered **pearlite** microstructure. Everything in heat treatment — annealing, normalising, quenching — is manoeuvring around this point.',
  evaluate(x, T) {
    if (T >= feLiquidus(x)) return singlePhase('L', x);

    if (T > FE_EUT_T) {
      // Between the eutectic isotherm and the liquidus the split is set by the
      // γ solidus and the *left* liquidus branch — not by the 2.14 wt% ceiling.
      // Compositions from 2.14 to 4.30 wt% C are γ + L, not L + Fe₃C.
      const gammaEdge = gammaSolidusX(T);
      const liqLeft = feLiquidusXLeft(T);
      if (x <= gammaEdge) return singlePhase('γ', x);
      if (x <= liqLeft) {
        return twoPhase(
          'γ + L',
          { name: 'γ', composition: gammaEdge },
          { name: 'L', composition: liqLeft },
          x,
        );
      }
      // Right of the right-hand liquidus branch: liquid plus primary cementite.
      return twoPhase(
        'L + Fe₃C',
        { name: 'L', composition: feLiquidusXRight(T) },
        { name: 'Fe₃C', composition: CEMENTITE_X },
        x,
      );
    }

    if (T > EUTECTOID_T) {
      // Between the eutectoid and eutectic isotherms.
      if (x < a3X(T)) {
        return twoPhase(
          'α + γ',
          { name: 'α', composition: ferriteSolvusX(EUTECTOID_T) },
          { name: 'γ', composition: a3X(T) },
          x,
        );
      }
      if (x <= acmX(T)) return singlePhase('γ', x);
      return twoPhase(
        'γ + Fe₃C',
        { name: 'γ', composition: acmX(T) },
        { name: 'Fe₃C', composition: CEMENTITE_X },
        x,
      );
    }

    // Below the eutectoid isotherm.
    const solvus = ferriteSolvusX(T);
    if (x <= solvus) return singlePhase('α', x);
    return twoPhase(
      'α + Fe₃C',
      { name: 'α', composition: solvus },
      { name: 'Fe₃C', composition: CEMENTITE_X },
      x,
    );
  },
};

export const PHASE_SYSTEMS: PhaseSystem[] = [CU_NI, PB_SN, FE_C];

// ===================== steel microconstituents =====================

export interface SteelResult {
  kind: 'hypoeutectoid' | 'hypereutectoid' | 'eutectoid';
  proeutectoid: 'α (ferrite)' | 'Fe₃C (cementite)' | null;
  /** Mass fraction of pearlite just below the eutectoid. */
  pearlite: number;
  /** Mass fraction of the proeutectoid constituent. */
  proeutectoidFraction: number;
  /** Total phase fractions, which differ from the microconstituent fractions. */
  totalFerrite: number;
  totalCementite: number;
}

/**
 * Microconstituent and total-phase fractions just below the eutectoid, for a
 * steel of overall composition C0 (Callister §9.19).
 */
export function steelMicrostructure(C0: number): SteelResult | null {
  if (C0 < FERRITE_MAX || C0 > GAMMA_MAX) return null;

  const totalFerrite = (CEMENTITE_X - C0) / (CEMENTITE_X - FERRITE_MAX);
  const totalCementite = 1 - totalFerrite;

  if (Math.abs(C0 - EUTECTOID_X) < 1e-9) {
    return {
      kind: 'eutectoid',
      proeutectoid: null,
      pearlite: 1,
      proeutectoidFraction: 0,
      totalFerrite,
      totalCementite,
    };
  }

  if (C0 < EUTECTOID_X) {
    // Pearlite forms from austenite that reached the eutectoid composition.
    const pearlite = (C0 - FERRITE_MAX) / (EUTECTOID_X - FERRITE_MAX);
    return {
      kind: 'hypoeutectoid',
      proeutectoid: 'α (ferrite)',
      pearlite,
      proeutectoidFraction: 1 - pearlite,
      totalFerrite,
      totalCementite,
    };
  }

  const pearlite = (CEMENTITE_X - C0) / (CEMENTITE_X - EUTECTOID_X);
  return {
    kind: 'hypereutectoid',
    proeutectoid: 'Fe₃C (cementite)',
    pearlite,
    proeutectoidFraction: 1 - pearlite,
    totalFerrite,
    totalCementite,
  };
}
