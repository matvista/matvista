/**
 * Mechanical property data and engineering stress–strain curve construction.
 *
 * Property values are Callister & Rethwisch tables 6.1 (elastic and shear
 * moduli, Poisson's ratio) and 6.2 (yield strength, tensile strength,
 * ductility for annealed metals).
 *
 * IMPORTANT: the curves themselves are *constructed*, not measured. Each is
 * built to pass exactly through that material's published E, σy, UTS and %EL.
 * The shape between those anchors is a standard elastic → power-law-hardening
 * → necking model, so read the anchor points as data and the curve between
 * them as an interpolation.
 */

export interface MechMaterial {
  id: string;
  name: string;
  /** Modulus of elasticity, GPa (table 6.1). */
  E: number;
  /** Shear modulus, GPa (table 6.1). */
  G: number;
  /** Poisson's ratio (table 6.1). */
  nu: number;
  /** Yield strength, MPa (table 6.2, annealed). */
  yield: number;
  /** Tensile strength, MPa (table 6.2). */
  uts: number;
  /** Ductility, % elongation in 50 mm (table 6.2). */
  elongation: number;
  note: string;
}

export const MECH_MATERIALS: MechMaterial[] = [
  {
    id: 'al',
    name: 'Aluminium',
    E: 69,
    G: 25,
    nu: 0.33,
    yield: 35,
    uts: 90,
    elongation: 40,
    note: 'Low modulus and low strength annealed, but very ductile and a third the density of steel. Nearly all structural aluminium is strengthened by alloying and cold work — annealed pure aluminium is the soft baseline.',
  },
  {
    id: 'cu',
    name: 'Copper',
    E: 110,
    G: 46,
    nu: 0.34,
    yield: 69,
    uts: 200,
    elongation: 45,
    note: 'FCC and extremely ductile — 45% elongation. Note the large gap between yield (69) and tensile strength (200): copper work-hardens strongly, which is why drawn copper wire is far stronger than the annealed value suggests.',
  },
  {
    id: 'brass',
    name: 'Brass (70Cu–30Zn)',
    E: 97,
    G: 37,
    nu: 0.34,
    yield: 75,
    uts: 300,
    elongation: 68,
    note: 'The most ductile entry here at 68% elongation, and the largest yield-to-UTS gap. Zinc in solid solution strengthens copper while the FCC structure keeps its many slip systems — strength and formability at once, which is why brass is the classic deep-drawing alloy.',
  },
  {
    id: 'fe',
    name: 'Iron',
    E: 207,
    G: 83,
    nu: 0.3,
    yield: 130,
    uts: 262,
    elongation: 45,
    note: 'BCC, with roughly twice the stiffness of copper. Pure iron is weak; everything useful about steel comes from what carbon and heat treatment do to it.',
  },
  {
    id: 'ni',
    name: 'Nickel',
    E: 207,
    G: 76,
    nu: 0.31,
    yield: 138,
    uts: 480,
    elongation: 40,
    note: 'Same stiffness as iron and steel — modulus is set by bonding, not by strength — but far higher tensile strength, and it holds that strength at temperature. The basis of superalloys.',
  },
  {
    id: 'steel1020',
    name: 'Steel (1020)',
    E: 207,
    G: 83,
    nu: 0.3,
    yield: 180,
    uts: 380,
    elongation: 25,
    note: 'Plain low-carbon steel. Compare it with iron: 0.2% carbon roughly doubles the yield strength while nearly halving the ductility — the strength/ductility trade-off in one line of a table.',
  },
  {
    id: 'ti',
    name: 'Titanium',
    E: 107,
    G: 45,
    nu: 0.34,
    yield: 450,
    uts: 520,
    elongation: 25,
    note: 'Highest yield strength here, at roughly half the stiffness of steel — so it is strong but springy, and at 4.5 g/cm³ its strength-to-weight ratio is exceptional. Note how close yield sits to UTS: little hardening capacity left after yielding.',
  },
];

export interface CurvePoint {
  strain: number;
  stress: number;
}

export interface CurveResult {
  points: CurvePoint[];
  /** Strain where the 0.002-offset construction meets the curve. */
  yieldStrain: number;
  /** Elastic strain at the yield stress, σy/E — the resilience triangle's base. */
  elasticYieldStrain: number;
  /** Strain at UTS (onset of necking). */
  utsStrain: number;
  /** Strain at fracture. */
  fractureStrain: number;
  /** Engineering stress at fracture. */
  fractureStress: number;
  /** Modulus of resilience, MJ/m³ = MPa. */
  resilience: number;
  /** Static toughness — area under the whole curve, MJ/m³. */
  toughness: number;
}

/** Fraction of total elongation reached at UTS, before necking begins. */
const UNIFORM_FRACTION = 0.5;
/** Engineering stress at fracture, as a fraction of UTS. */
const FRACTURE_DROP = 0.82;
/** Proportional limit, as a fraction of the 0.2%-offset yield strength. */
const PROPORTIONAL_FRACTION = 0.85;

/** Strain offset used to define yield strength — Callister's 0.002. */
export const YIELD_OFFSET = 0.002;

/**
 * Builds an engineering stress–strain curve through the material's published
 * anchor points: elastic to the proportional limit, power-law hardening to UTS,
 * then a necking decline to fracture.
 *
 * The published yield strength is a **0.2% offset** value, not the elastic
 * limit, so the hardening exponent is solved rather than assumed: it is chosen
 * so the curve passes through the point where the offset construction line
 * actually meets it. Draw the construction on this curve and it lands on σy,
 * which is the whole point of the 0.002-offset definition.
 */
export function buildCurve(m: MechMaterial, samples = 240): CurveResult {
  const E_MPa = m.E * 1000;
  const fractureStrain = m.elongation / 100;
  const fractureStress = m.uts * FRACTURE_DROP;

  // End of the linear-elastic region.
  const propStress = m.yield * PROPORTIONAL_FRACTION;
  const propStrain = propStress / E_MPa;

  // Where the 0.002-offset line, of slope E, reaches the yield stress.
  const offsetYieldStrain = YIELD_OFFSET + m.yield / E_MPa;

  const utsStrain = propStrain + (fractureStrain - propStrain) * UNIFORM_FRACTION;

  // Solve n so that stress(offsetYieldStrain) === m.yield exactly.
  const fYield = (offsetYieldStrain - propStrain) / (utsStrain - propStrain);
  const stressRatio = (m.yield - propStress) / (m.uts - propStress);
  const n =
    fYield > 0 && fYield < 1 && stressRatio > 0 && stressRatio < 1
      ? Math.log(stressRatio) / Math.log(fYield)
      : 0.5;

  const points: CurvePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const strain = (fractureStrain * i) / samples;
    points.push({ strain, stress: stressAt(strain) });
  }

  function stressAt(strain: number): number {
    if (strain <= propStrain) return E_MPa * strain;
    if (strain <= utsStrain) {
      const f = (strain - propStrain) / (utsStrain - propStrain);
      return propStress + (m.uts - propStress) * Math.pow(f, n);
    }
    const f = (strain - utsStrain) / (fractureStrain - utsStrain);
    // Concave decline: flat at the peak, steepening into fracture.
    return m.uts - (m.uts - fractureStress) * f * f;
  }

  const yieldStrain = offsetYieldStrain;

  // Modulus of resilience, Callister eq. 6.14: U_r = σy² / 2E
  const resilience = (m.yield * m.yield) / (2 * E_MPa);

  // Static toughness: trapezoidal area under the engineering curve.
  let toughness = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].strain - points[i - 1].strain;
    toughness += ((points[i].stress + points[i - 1].stress) / 2) * dx;
  }

  return {
    points,
    yieldStrain,
    elasticYieldStrain: m.yield / E_MPa,
    utsStrain,
    fractureStrain,
    fractureStress,
    resilience,
    toughness,
  };
}

/** True stress from engineering values, Callister eq. 6.18 (valid to necking). */
export function trueStress(engStress: number, engStrain: number): number {
  return engStress * (1 + engStrain);
}

/** True strain from engineering strain, Callister eq. 6.19 (valid to necking). */
export function trueStrain(engStrain: number): number {
  return Math.log(1 + engStrain);
}

/**
 * Hall–Petch: σy = σ0 + k_y · d^(−1/2)   (Callister eq. 7.7)
 * @param d grain diameter, mm
 * @param sigma0 friction stress, MPa
 * @param ky strengthening coefficient, MPa·mm^(1/2)
 */
export function hallPetch(d: number, sigma0: number, ky: number): number {
  return sigma0 + ky / Math.sqrt(d);
}

/** Per cent cold work, Callister eq. 7.8: %CW = (A₀ − A_d)/A₀ × 100 */
export function percentColdWork(A0: number, Ad: number): number {
  return ((A0 - Ad) / A0) * 100;
}
