/**
 * Binary phase diagram models.
 *
 * Every invariant point, solubility limit and melting temperature below is
 * taken from Callister & Rethwisch ch. 9. The *curves between* those fixed
 * points are fitted or linearised — documented per system — so read the
 * labelled points as data and the boundaries as interpolation.
 *
 * The Fe–C eutectoid's four fixed points and the lever rule itself live one
 * file down, in `eutectoid.ts`, and are re-exported here so every existing
 * import site is unchanged. The landing page needs exactly those four numbers
 * and cannot afford this file to get them — see that file's header.
 */
import { CEMENTITE_X, EUTECTOID_T, EUTECTOID_X, FERRITE_MAX, GAMMA_MAX, lever } from './eutectoid';

export { CEMENTITE_X, EUTECTOID_T, EUTECTOID_X, FERRITE_MAX, GAMMA_MAX, lever };

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
  /**
   * The two **solid** phases the reaction leaves behind, with their
   * compositions at the invariant temperature, left one first.
   *
   * Present only where the invariant bounds a fully solid two-phase field,
   * which is what makes a microconstituent split meaningful. The Fe–C eutectic
   * at 1147 °C does not qualify: it produces γ, and γ is gone by 727 °C.
   *
   * These are a second copy of numbers the boundary polylines already carry,
   * so a test cross-checks them against `evaluate`'s own tie line.
   */
  products?: [
    { name: string; composition: number },
    { name: string; composition: number },
  ];
  /** What the eutectic/eutectoid mixture is called, where it has a name. */
  microconstituent?: string;
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
      products: [
        { name: 'α', composition: ALPHA_MAX },
        { name: 'β', composition: BETA_MAX },
      ],
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

/* EUTECTOID_X, EUTECTOID_T, GAMMA_MAX, FERRITE_MAX and CEMENTITE_X are defined
   in `eutectoid.ts` and re-exported at the top of this file. The eutectic pair
   below stays here: nothing outside this module needs it. */
export const FE_EUT_X = 4.3;
export const FE_EUT_T = 1147;
const FE_MP = 1538;
const FERRITE_RT = 0.005;
const FEC_TMIN = 400;
const A3_PURE = 912;

const a3X = (T: number) => lerp(T, A3_PURE, 0, EUTECTOID_T, EUTECTOID_X);
/**
 * The α/(α+γ) boundary between the eutectoid and pure iron's A₃.
 *
 * Ferrite's carbon solubility runs from 0.022 wt% at 727 °C to nothing at
 * 912 °C, so there is a narrow single-phase α field hard against the left axis
 * in that temperature band. It is easy to leave out — the field is a sliver —
 * but leaving it out means pure iron at 800 °C is reported as a two-phase
 * α + γ mixture, when α is the only phase present up to 912 °C.
 */
const alphaGammaX = (T: number) => lerp(T, A3_PURE, 0, EUTECTOID_T, FERRITE_MAX);
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
    { label: 'α/(α+γ)', points: [[0, A3_PURE], [FERRITE_MAX, EUTECTOID_T]], kind: 'solvus' },
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
      products: [
        { name: 'α', composition: FERRITE_MAX },
        { name: 'Fe₃C', composition: CEMENTITE_X },
      ],
      microconstituent: 'Pearlite',
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
    { text: 'α + γ', x: 0.28, T: 800 },
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
      const alphaEdge = alphaGammaX(T);
      // Left of ferrite's solubility limit there is no austenite to mix with:
      // this is the single-phase α sliver that reaches pure iron at 912 °C.
      if (x <= alphaEdge) return singlePhase('α', x);
      if (x < a3X(T)) {
        return twoPhase(
          'α + γ',
          // The α end of the tie line is the solubility limit *at this
          // temperature*, not the 0.022 wt% value fixed at the eutectoid.
          { name: 'α', composition: alphaEdge },
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

/**
 * Temperature of a named boundary at a composition, °C — read off the polyline
 * the diagram actually draws, by linear interpolation between its points.
 *
 * M12 needs A₁, A₃ and A_cm in the heat-treatment module, and reading them
 * from `boundaries` rather than re-deriving them is what stops the two modules
 * describing different steels. Null when the composition is off the end of the
 * boundary, or when no boundary carries that label — an alloy past 0.76 wt% C
 * has no A₃, and saying so is the point.
 */
export function boundaryTemperature(
  system: PhaseSystem,
  label: string,
  x: number,
): number | null {
  const pts = system.boundaries.find((b) => b.label === label)?.points;
  if (!pts || pts.length < 2) return null;
  for (let i = 1; i < pts.length; i++) {
    const [x1, t1] = pts[i - 1];
    const [x2, t2] = pts[i];
    const lo = Math.min(x1, x2);
    const hi = Math.max(x1, x2);
    if (x < lo || x > hi) continue;
    if (x1 === x2) return t1;
    return t1 + ((t2 - t1) * (x - x1)) / (x2 - x1);
  }
  return null;
}

// ===================== the Gibbs phase rule =====================

export interface PhaseRuleResult {
  /** Phases present, P. */
  P: number;
  /** Components, C. Two, for a binary. */
  C: number;
  /** Non-compositional variables, N. One — temperature, at fixed pressure. */
  N: number;
  /** Degrees of freedom, F = C + N − P. */
  F: number;
  /** The invariant reaction the point is sitting on, when it is on one. */
  invariant: Invariant | null;
}

/**
 * Float slack on the invariant temperature. Not a band a reader can sit inside.
 *
 * This used to be 1% *of each axis*, which on Fe–C is ±0.067 wt% C and ±12.0 °C
 * — so `?sys=fe-c&x=0.76&T=739` reported three phases and F = 0 while the
 * region readout on the same screen said γ, one phase, and the temperature box
 * stepping 1 °C walked a reader through eleven consecutive false readings. The
 * justification was wrong as well: the arrow keys move 1% of the axis *from
 * wherever the point already is*, so they never land on an invariant anyway,
 * while the number boxes step 1 °C and 0.01 wt% and land on every shipped
 * invariant temperature exactly. The band bought nothing and cost the false
 * readings, so it is gone; reaching an invariant is the number box's job, or
 * the link's.
 */
export const INVARIANT_T_EPSILON = 1e-9;

/**
 * The composition range over which an invariant reaction is under way.
 *
 * Three phases coexist along the **whole** invariant isotherm, not only at the
 * invariant composition: at 40 wt% Sn and 183 °C the alloy holds α, β and the
 * last of the liquid together exactly as it does at 61.9 wt% Sn, and F is 0 at
 * both. What is special about the invariant composition is that the reaction
 * consumes *everything* there — nowhere else on the line is the primary phase
 * absent.
 *
 * The span is read off the isotherm the system already draws rather than
 * declared a second time, so the set this module calls invariant is exactly
 * the line the reader can see. An invariant with no isotherm drawn for it
 * would therefore never be flagged, which `systems.test.ts` refuses.
 */
function isothermSpan(system: PhaseSystem, invariant: Invariant): [number, number] | null {
  const line = system.boundaries.find(
    (b) =>
      b.kind === 'isotherm' &&
      b.points.length > 1 &&
      b.points.every(([, T]) => Math.abs(T - invariant.T) <= INVARIANT_T_EPSILON),
  );
  if (!line) return null;
  const xs = line.points.map(([x]) => x);
  return [Math.min(...xs), Math.max(...xs)];
}

/**
 * Degrees of freedom at a point, by the Gibbs phase rule.
 *
 * P + F = C + N. Both components are condensed and pressure is fixed, so N
 * counts temperature alone and F = 3 − P: two in a single-phase field, one
 * inside a two-phase field, zero on an invariant isotherm.
 *
 * **The invariant case has to override the evaluator.** The evaluator draws
 * fields, and an isotherm is the seam between two of them, so it reports
 * whichever side it resolves to — the Pb–Sn eutectic composition at 183 °C
 * evaluates as single-phase L, sitting exactly on the liquidus. Taking P from
 * that would report F = 2 on the one line in the diagram where nothing at all
 * can move.
 */
export function gibbsPhaseRule(system: PhaseSystem, x: number, T: number): PhaseRuleResult {
  const invariant =
    system.invariants.find((i) => {
      if (Math.abs(T - i.T) > INVARIANT_T_EPSILON) return false;
      const span = isothermSpan(system, i);
      return span != null && x >= span[0] && x <= span[1];
    }) ?? null;
  const P = invariant ? 3 : system.evaluate(x, T).phases.length;
  return { P, C: 2, N: 1, F: 2 + 1 - P, invariant };
}

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

/** The microconstituent split of an alloy cooled just past an invariant. */
export interface MicroconstituentResult {
  /** The invariant the structure forms at. */
  invariant: Invariant;
  kind: 'hypoeutectic' | 'hypereutectic' | 'eutectic' | 'hypoeutectoid' | 'hypereutectoid' | 'eutectoid';
  /** Name of the primary (proeutectic / proeutectoid) phase; null at the invariant composition. */
  primary: string | null;
  /** The primary phase's own composition — the terminal solubility limit on its side. */
  primaryComposition: number;
  primaryFraction: number;
  /** Mass fraction of the eutectic / eutectoid microconstituent. */
  eutecticFraction: number;
  /** Total phase fractions, which are **not** the microconstituent fractions. */
  left: { name: string; composition: number; fraction: number };
  right: { name: string; composition: number; fraction: number };
}

/**
 * Primary phase, eutectic constituent and total phase fractions for an alloy
 * cooled to just below its invariant isotherm.
 *
 * Three lever rules over three different segments of the same tie line, which
 * is the point: for 40 wt% Sn just below 183 °C the alloy is 50% primary α and
 * 50% eutectic constituent, and yet **73%** α by phase, because the eutectic
 * constituent contains α as well. Students who have understood
 * pearlite-vs-ferrite very often fail to transfer it, because Fe–C is taught
 * with different vocabulary.
 *
 * The invariant used is the **lowest-temperature one that declares solid
 * products** — the eutectoid for Fe–C, whose 1147 °C eutectic produces γ that
 * no longer exists by 727 °C.
 *
 * Returns null inside the terminal solid solutions, where there is no eutectic
 * constituent to report. Absent, not zeroed: clamping a fraction to hide an
 * out-of-domain computation is what hid the missing α field in iteration 9.
 */
export function microconstituents(
  system: PhaseSystem,
  x: number,
): MicroconstituentResult | null {
  const invariant = system.invariants
    .filter((i) => i.products)
    .reduce<Invariant | null>((best, i) => (best == null || i.T < best.T ? i : best), null);
  if (!invariant?.products) return null;

  const [a, b] = invariant.products;
  if (x < a.composition || x > b.composition) return null;

  const leftFraction = lever(x, a.composition, b.composition);
  const left = { name: a.name, composition: a.composition, fraction: leftFraction };
  const right = { name: b.name, composition: b.composition, fraction: 1 - leftFraction };

  const eutectoid = invariant.type === 'eutectoid';
  if (Math.abs(x - invariant.x) < 1e-9) {
    return {
      invariant,
      kind: eutectoid ? 'eutectoid' : 'eutectic',
      primary: null,
      primaryComposition: x,
      primaryFraction: 0,
      eutecticFraction: 1,
      left,
      right,
    };
  }

  // The mixture forms from whatever reached the invariant composition; the
  // primary phase is what separated out before that, sitting at its own
  // solubility limit.
  const hypo = x < invariant.x;
  const primaryComposition = hypo ? a.composition : b.composition;
  const eutecticFraction = hypo
    ? (x - a.composition) / (invariant.x - a.composition)
    : (b.composition - x) / (b.composition - invariant.x);

  return {
    invariant,
    kind: eutectoid
      ? hypo
        ? 'hypoeutectoid'
        : 'hypereutectoid'
      : hypo
        ? 'hypoeutectic'
        : 'hypereutectic',
    primary: hypo ? a.name : b.name,
    primaryComposition,
    primaryFraction: 1 - eutecticFraction,
    eutecticFraction,
    left,
    right,
  };
}

/**
 * Microconstituent and total-phase fractions just below the eutectoid, for a
 * steel of overall composition C0 (Callister §9.19).
 *
 * A thin wrapper over `microconstituents` since M8 generalised it, keeping the
 * shape `heattreat/model.ts` and the Fe–C panel read, and keeping the **steel**
 * domain: past 2.14 wt% C the primary constituent comes from the 1147 °C
 * eutectic instead, and the alloy is a cast iron rather than a steel.
 */
export function steelMicrostructure(C0: number): SteelResult | null {
  if (C0 < FERRITE_MAX || C0 > GAMMA_MAX) return null;
  const m = microconstituents(FE_C, C0);
  if (!m) return null;
  return {
    kind: m.kind as SteelResult['kind'],
    proeutectoid:
      m.primary == null ? null : m.primary === 'α' ? 'α (ferrite)' : 'Fe₃C (cementite)',
    pearlite: m.eutecticFraction,
    proeutectoidFraction: m.primaryFraction,
    totalFerrite: m.left.fraction,
    totalCementite: m.right.fraction,
  };
}

/* ================================== M5 — microstructure development == */

export interface CoolingStage {
  /** Temperature at which this region is entered on the way down, °C. */
  T: number;
  region: string;
  /** The phase point just inside the region. */
  point: PhasePoint;
}

/**
 * The regions an alloy passes through as it cools at fixed composition, and
 * the temperature it enters each.
 *
 * The module answers "what phases are present here", which is one step of what
 * Callister spends four sections on. The misconception it leaves standing is
 * that phase fractions and microstructure are the same thing: a 40 wt% Sn
 * alloy and a 61.9 wt% Sn alloy are both α + β with different fractions and
 * look nothing alike down a microscope, and only one of them is solder.
 *
 * Crossings are found by bisection rather than reported at the sampling step,
 * so a breadcrumb reads 183.0 °C rather than "somewhere near 183" — and can be
 * checked against `boundaryTemperature`, which derives the same number from
 * the boundary polyline instead of from `evaluate`.
 */
export function coolingSequence(
  system: PhaseSystem,
  x: number,
  tFrom: number,
  tTo: number,
  samples = 600,
): CoolingStage[] {
  const hi = Math.min(tFrom, system.tMax);
  const lo = Math.max(tTo, system.tMin);
  if (!(hi > lo)) return [];

  const regionAt = (T: number) => system.evaluate(x, T).region;
  const stages: CoolingStage[] = [
    { T: hi, region: regionAt(hi), point: system.evaluate(x, hi) },
  ];

  let prevT = hi;
  let prevRegion = stages[0].region;
  for (let i = 1; i <= samples; i++) {
    const T = hi - ((hi - lo) * i) / samples;
    const region = regionAt(T);
    if (region === prevRegion) {
      prevT = T;
      continue;
    }
    // Bisect between the last temperature still in the old region and this one.
    let a = prevT;
    let b = T;
    for (let k = 0; k < 60; k++) {
      const mid = (a + b) / 2;
      if (regionAt(mid) === prevRegion) a = mid;
      else b = mid;
    }
    stages.push({ T: b, region, point: system.evaluate(x, b) });
    prevRegion = region;
    prevT = T;
  }
  return stages;
}
