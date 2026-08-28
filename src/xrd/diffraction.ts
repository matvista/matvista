/**
 * Powder X-ray diffraction for cubic crystals.
 *
 * Bragg's law (Callister eq. 3.20):        nλ = 2·d_hkl·sin θ
 * Cubic interplanar spacing (eq. 3.21):    d_hkl = a / √(h² + k² + l²)
 * Reflection rules (table 3.5):            BCC — (h+k+l) even
 *                                          FCC — h, k, l all odd or all even
 *                                          SC  — all reflections present
 *
 * Relative peak intensities use I ∝ m · |F|² · LP(θ) · exp(−c·s²), with m the
 * planar multiplicity, F the structure factor, LP the Lorentz–polarisation
 * factor, and the exponential folding together the atomic scattering factor's
 * angular falloff and thermal (Debye–Waller) damping under one empirical
 * coefficient. Absorption and preferred orientation are omitted, and the
 * damping coefficient is generic rather than per-element, so **intensities are
 * indicative**. Peak **positions are exact**: copper's first four lines come
 * out at 43.32, 50.45, 74.13 and 89.95° against literature 43.3, 50.4, 74.1
 * and 90.0°, and silicon's (111) at 28.44°.
 */
import { dSpacing as millerDSpacing } from '../crystal/miller';

export type XrdLattice = 'sc' | 'bcc' | 'fcc' | 'diamond';

export interface XrdSource {
  id: string;
  label: string;
  /** Wavelength, nm. */
  lambda: number;
}

/** Characteristic Kα wavelengths of the common laboratory anodes. */
export const XRD_SOURCES: XrdSource[] = [
  { id: 'cu', label: 'Cu Kα (0.15406 nm)', lambda: 0.15406 },
  { id: 'mo', label: 'Mo Kα (0.07107 nm)', lambda: 0.07107 },
  { id: 'cr', label: 'Cr Kα (0.22897 nm)', lambda: 0.22897 },
  { id: 'co', label: 'Co Kα (0.17890 nm)', lambda: 0.1789 },
];

export interface Peak {
  h: number;
  k: number;
  l: number;
  /** Interplanar spacing, nm. */
  d: number;
  /** Diffraction angle 2θ, degrees. */
  twoTheta: number;
  /** Planar multiplicity. */
  multiplicity: number;
  /** Relative intensity, scaled so the strongest peak is 100. */
  intensity: number;
}

/** True when (hkl) produces a reflection for this lattice. */
export function isAllowed(lattice: XrdLattice, h: number, k: number, l: number): boolean {
  const allOdd = h % 2 !== 0 && k % 2 !== 0 && l % 2 !== 0;
  const allEven = h % 2 === 0 && k % 2 === 0 && l % 2 === 0;
  switch (lattice) {
    case 'sc':
      return true;
    case 'bcc':
      return (h + k + l) % 2 === 0;
    case 'fcc':
      return allOdd || allEven;
    case 'diamond':
      // FCC rules, plus: all-even reflections vanish unless h+k+l ≡ 0 (mod 4).
      if (allOdd) return true;
      if (allEven) return (h + k + l) % 4 === 0;
      return false;
  }
}

/** |F|² in units of f², for a monatomic cubic cell. */
export function structureFactorSquared(
  lattice: XrdLattice,
  h: number,
  k: number,
  l: number,
): number {
  const allOdd = h % 2 !== 0 && k % 2 !== 0 && l % 2 !== 0;
  switch (lattice) {
    case 'sc':
      return 1;
    case 'bcc':
      return 4; // (2f)²
    case 'fcc':
      return 16; // (4f)²
    case 'diamond':
      // |F| = 4f√2 for all-odd; 8f for all-even with h+k+l ≡ 0 (mod 4).
      return allOdd ? 32 : 64;
  }
}

/**
 * Planar multiplicity — the number of symmetry-equivalent {hkl} planes,
 * counted exactly by enumerating distinct signed permutations.
 */
export function multiplicity(h: number, k: number, l: number): number {
  const seen = new Set<string>();
  const perms = [
    [h, k, l], [h, l, k], [k, h, l], [k, l, h], [l, h, k], [l, k, h],
  ];
  for (const [a, b, c] of perms) {
    for (const sa of [1, -1]) {
      for (const sb of [1, -1]) {
        for (const sc of [1, -1]) {
          seen.add(`${a * sa},${b * sb},${c * sc}`);
        }
      }
    }
  }
  return seen.size;
}

/** Lorentz–polarisation factor for a powder diffractometer. */
export function lorentzPolarisation(thetaRad: number): number {
  const s = Math.sin(thetaRad);
  const c = Math.cos(thetaRad);
  return (1 + Math.cos(2 * thetaRad) ** 2) / (s * s * c);
}

/**
 * Angular damping of the scattered intensity.
 *
 * The Lorentz–polarisation factor diverges as θ → 90°, so without this the
 * high-angle peaks dominate and copper's (111) is no longer the strongest
 * line — plainly wrong against any real pattern. Two physical effects damp
 * the high-angle end:
 *   - the **atomic scattering factor** f falls as scattering angle rises,
 *     because the electron cloud is comparable in size to the wavelength;
 *   - the **Debye–Waller** factor, from thermal vibration of the atoms.
 *
 * Both go as exp(−c·s²) with s = sin θ / λ, so they are folded into a single
 * empirical coefficient here rather than tabulated per element. This is an
 * approximation, and the reason intensities are described as indicative.
 *
 * @param thetaRad Bragg angle θ in radians
 * @param lambdaNm wavelength in nm
 */
const ANGULAR_DAMPING = 6.55; // Å², covering f(θ) falloff plus thermal motion

export function angularDamping(thetaRad: number, lambdaNm: number): number {
  const lambdaAngstrom = lambdaNm * 10;
  const s = Math.sin(thetaRad) / lambdaAngstrom; // Å⁻¹
  return Math.exp(-ANGULAR_DAMPING * s * s);
}

/**
 * Interplanar spacing for a cubic lattice, nm. Delegates to the crystallography
 * module so the Miller and XRD views can never drift apart; the argument order
 * here is kept for the existing callers.
 */
export function dSpacing(a: number, h: number, k: number, l: number): number {
  return millerDSpacing([h, k, l], a);
}

/**
 * Generates the powder pattern.
 *
 * @param lattice  cubic lattice type
 * @param a        lattice parameter, nm
 * @param lambda   wavelength, nm
 * @param maxTwoTheta upper 2θ limit, degrees
 */
export function computePattern(
  lattice: XrdLattice,
  a: number,
  lambda: number,
  maxTwoTheta = 140,
): Peak[] {
  const peaks: Peak[] = [];
  const seenFamilies = new Set<string>();
  const MAX_INDEX = 8;

  for (let h = 0; h <= MAX_INDEX; h++) {
    for (let k = 0; k <= MAX_INDEX; k++) {
      for (let l = 0; l <= MAX_INDEX; l++) {
        if (h + k + l === 0) continue;
        // One representative per family: sorted descending.
        const fam = [h, k, l].sort((x, y) => y - x);
        const key = fam.join(',');
        if (seenFamilies.has(key)) continue;
        if (h !== fam[0] || k !== fam[1] || l !== fam[2]) continue;
        if (!isAllowed(lattice, h, k, l)) continue;

        const d = dSpacing(a, h, k, l);
        const sinTheta = lambda / (2 * d);
        if (sinTheta > 1) continue; // beyond the diffraction limit
        const theta = Math.asin(sinTheta);
        const twoTheta = (2 * theta * 180) / Math.PI;
        if (twoTheta > maxTwoTheta) continue;

        seenFamilies.add(key);
        const m = multiplicity(h, k, l);
        const raw =
          m *
          structureFactorSquared(lattice, h, k, l) *
          lorentzPolarisation(theta) *
          angularDamping(theta, lambda);
        peaks.push({ h, k, l, d, twoTheta, multiplicity: m, intensity: raw });
      }
    }
  }

  peaks.sort((p, q) => p.twoTheta - q.twoTheta);
  const max = Math.max(...peaks.map((p) => p.intensity), 1);
  return peaks.map((p) => ({ ...p, intensity: (p.intensity / max) * 100 }));
}

/**
 * Lattice parameter from atomic radius, for the elemental cubic structures
 * (Callister ch. 3): FCC a = 2R√2, BCC a = 4R/√3, SC a = 2R,
 * diamond cubic a = 8R/√3.
 */
export function latticeParameter(lattice: XrdLattice, R: number): number {
  switch (lattice) {
    case 'fcc':
      return 2 * R * Math.SQRT2;
    case 'bcc':
      return (4 * R) / Math.sqrt(3);
    case 'sc':
      return 2 * R;
    case 'diamond':
      return (8 * R) / Math.sqrt(3);
  }
}

export interface XrdSample {
  id: string;
  name: string;
  lattice: XrdLattice;
  /** Lattice parameter, nm. */
  a: number;
  note: string;
}

/**
 * Lattice parameters computed from the atomic radii of Callister table 3.1
 * via the relations above, so they are consistent with the crystal-structure
 * module rather than independently sourced.
 */
export const XRD_SAMPLES: XrdSample[] = [
  {
    id: 'cu',
    name: 'Copper (FCC)',
    lattice: 'fcc',
    a: latticeParameter('fcc', 0.1278),
    note: 'The standard teaching pattern. With Cu Kα the first four peaks fall at roughly 43.3°, 50.4°, 74.1° and 90.0° — worth memorising as a sanity check on any FCC pattern.',
  },
  {
    id: 'al',
    name: 'Aluminium (FCC)',
    lattice: 'fcc',
    a: latticeParameter('fcc', 0.1431),
    note: 'Same FCC peak sequence as copper (111, 200, 220, 311…) but shifted to lower angles, because the larger lattice parameter means larger d-spacings.',
  },
  {
    id: 'fe',
    name: 'α-Iron (BCC)',
    lattice: 'bcc',
    a: latticeParameter('bcc', 0.1241),
    note: 'BCC opens on 110, not 111 — the single quickest way to tell a BCC pattern from an FCC one by eye.',
  },
  {
    id: 'w',
    name: 'Tungsten (BCC)',
    lattice: 'bcc',
    a: latticeParameter('bcc', 0.1371),
    note: 'BCC with a larger cell than iron, so the same 110, 200, 211… sequence appears at lower angles.',
  },
  {
    id: 'cr',
    name: 'Chromium (BCC)',
    lattice: 'bcc',
    a: latticeParameter('bcc', 0.1249),
    note: 'Nearly the same lattice parameter as α-iron — their patterns overlap closely, which is why phase identification needs peak intensities and not just positions.',
  },
  {
    id: 'si',
    name: 'Silicon (diamond cubic)',
    lattice: 'diamond',
    a: 0.5431,
    note: 'The diamond lattice adds a second extinction condition on top of the FCC rules: 200 and 222 vanish entirely. Lattice parameter is the standard measured value, 0.5431 nm.',
  },
  {
    id: 'po',
    name: 'Polonium (simple cubic)',
    lattice: 'sc',
    a: latticeParameter('sc', 0.168),
    note: 'Simple cubic allows every reflection, so the pattern is the densest of the four — the reference case that shows how much the FCC and BCC rules actually remove.',
  },
];
