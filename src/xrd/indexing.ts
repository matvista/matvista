/**
 * Indexing an unknown pattern — the worksheet, not the answer.
 *
 * The module hands the reader an indexed table before any work is done, which
 * quietly teaches that structure is read off peak *positions*. It is not. It
 * is read off the **ratios** of sin²θ, and those are independent of the
 * lattice parameter entirely: two different metals with the same structure
 * give the same ratio sequence at different angles.
 *
 * Simple cubic allows every (hkl), so its N = h²+k²+l² runs 1, 2, 3, 4, 5, 6,
 * **8** — 7 is missing because no three squares sum to it. BCC needs h+k+l
 * even, giving 2, 4, 6, 8, 10, 12, **14**, 16, whose ratios are an unbroken
 * 1 : 2 : 3 : 4 : 5 : 6 : 7 : 8. That gap at the seventh line is the only
 * thing separating the two, and it is why a six-line pattern cannot: an
 * earlier version of this file had the gap on the wrong lattice.
 *
 * FCC needs h, k, l all odd or all even, giving 3, 4, 8, 11, 12 — ratios
 * 1 : 1.33 : 2.67 : 3.67 : 4, distinguishable from the first two immediately.
 * The *pattern of missing ratios* is the fingerprint, which is the thing the
 * extinction panel states and this makes the reader use.
 */
import {
  type Peak,
  type XrdLattice,
  braggTwoTheta,
  dSpacing,
  isAllowed,
} from './diffraction';

/**
 * Fewer lines than this and the ratio sequence stops being decisive: with
 * three lines a BCC 1:2:3 and an SC 1:2:3 are the same list. Cr Kα leaves
 * some of the shipped samples with exactly that problem, so the panel must
 * refuse rather than offer a guess.
 */
export const MIN_LINES_TO_INDEX = 5;

/** The allowed values of N = h²+k²+l², ascending, deduplicated. */
export function allowedNSequence(lattice: XrdLattice, count: number): number[] {
  const seen = new Set<number>();
  for (let h = 0; h <= 12; h++) {
    for (let k = 0; k <= h; k++) {
      for (let l = 0; l <= k; l++) {
        if (h + k + l === 0) continue;
        if (!isAllowed(lattice, h, k, l)) continue;
        seen.add(h * h + k * k + l * l);
      }
    }
  }
  return [...seen].sort((x, y) => x - y).slice(0, count);
}

/** The (hkl) with the lowest indices giving this N, for the worksheet's label. */
export function hklForN(lattice: XrdLattice, N: number): [number, number, number] | null {
  for (let h = 0; h <= 12; h++) {
    for (let k = 0; k <= h; k++) {
      for (let l = 0; l <= k; l++) {
        if (h * h + k * k + l * l !== N) continue;
        if (!isAllowed(lattice, h, k, l)) continue;
        return [h, k, l];
      }
    }
  }
  return null;
}

export interface IndexedLine {
  twoTheta: number;
  sin2: number;
  /** sin²θ divided by the first line's — what the student computes. */
  ratio: number;
  /** The integer N the ratio is claimed to correspond to. */
  N: number;
  hkl: [number, number, number] | null;
  /** Lattice parameter from this line alone, nm. */
  a: number;
}

export interface IndexingResult {
  lattice: XrdLattice;
  lines: IndexedLine[];
  /** Mean lattice parameter across the lines, nm. */
  a: number;
  /**
   * Largest relative departure of any line's own `a` from the mean.
   *
   * This is the figure of merit. A wrong lattice assignment makes the lines
   * disagree about `a`, because the N values it puts under them do not match
   * the angles. A right one makes them agree to rounding.
   */
  spread: number;
  /**
   * False when the ratios demand an N this lattice forbids, when two lines
   * are driven onto the same reflection, or when the ratios are too far from
   * whole numbers to be rounded honestly.
   */
  consistent: boolean;
  /**
   * Reflections this lattice allows, inside the range of lines observed, that
   * are not in the pattern.
   *
   * The second half of the argument, and the half a consistency check alone
   * misses. Diamond's allowed reflections are a *subset* of FCC's, so a
   * silicon pattern is perfectly consistent with FCC — until you ask why the
   * (200) and (222) lines FCC promises are not on the trace. Diamond explains
   * their absence; FCC leaves it unexplained.
   */
  unexplained: number[];
  /** How far the worst line's N is from a whole number. */
  ratioError: number;
}

/** Work the pattern up on the assumption that it is `lattice`. */
export function indexPattern(
  peaks: Peak[],
  lambda: number,
  lattice: XrdLattice,
): IndexingResult | null {
  if (peaks.length === 0) return null;
  // The merged trace, so the worksheet and the assignment see the same lines.
  const sorted = unlabelledLines(peaks);
  const allowed = new Set(allowedNSequence(lattice, 200));
  const N1 = Math.min(...allowed);

  /**
   * N is *derived from the ratio*, not read off a list by position:
   * N_i = round(N₁ · sin²θ_i / sin²θ₁). Taking the i-th allowed value for the
   * i-th line instead breaks whenever any reflection after the first is
   * missing from the trace, which happens at the high-angle end where the 2θ
   * window cuts off. This is also what a student actually does.
   *
   * **It does not remove the assumption, it relocates it.** N₁ is pinned to
   * the lowest allowed reflection, so the method still assumes the *first*
   * line observed is that reflection. Lose the first line and the answer is
   * not uncertain but confidently wrong — every shipped sample then indexes
   * as simple cubic with a cell about half the true size, with nothing
   * unexplained and no ambiguity reported. The 2θ window truncates the
   * high-angle end rather than the low, so this is not reachable here; it is
   * asserted in the tests so the limit is recorded rather than assumed away.
   */
  const sin2 = sorted.map((p) => Math.sin((p.twoTheta * Math.PI) / 360) ** 2);
  let worstRatioError = 0;
  const lines: IndexedLine[] = sorted.map((p, i) => {
    const raw = (N1 * sin2[i]) / sin2[0];
    const N = Math.round(raw);
    worstRatioError = Math.max(worstRatioError, Math.abs(raw - N));
    // a = λ√N / (2 sin θ), which is Bragg with d = a/√N substituted in.
    const a = (lambda * Math.sqrt(N)) / (2 * Math.sqrt(sin2[i]));
    return {
      twoTheta: p.twoTheta,
      sin2: sin2[i],
      ratio: sin2[i] / sin2[0],
      N,
      hkl: allowed.has(N) ? hklForN(lattice, N) : null,
      a,
    };
  });

  /**
   * A hypothesis has to survive three things, not one.
   *
   * Requiring only that each N is *allowed* let simple cubic "explain" a
   * copper pattern by giving two different angles the same reflection —
   * (100) twice, (200) twice — with the derived a spanning 12% and the panel
   * captioned "every line fits". An assignment that maps two lines to one
   * plane is not an assignment.
   */
  const strictlyIncreasing = lines.every((l, i) => i === 0 || l.N > lines[i - 1].N);
  const consistent =
    lines.every((l) => allowed.has(l.N)) && strictlyIncreasing && worstRatioError <= 0.12;
  const seen = new Set(lines.map((l) => l.N));
  const lo = Math.min(...lines.map((l) => l.N));
  const hi = Math.max(...lines.map((l) => l.N));
  const unexplained = [...allowed].filter((n) => n >= lo && n <= hi && !seen.has(n)).sort((x, y) => x - y);
  const mean = lines.reduce((t, l) => t + l.a, 0) / lines.length;
  const spread = Math.max(...lines.map((l) => Math.abs(l.a - mean) / mean));
  return {
    lattice,
    lines,
    a: mean,
    spread,
    consistent,
    ratioError: worstRatioError,
    unexplained,
  };
}

export interface IndexingVerdict {
  best: IndexingResult;
  /** Every candidate that survives, best first. */
  candidates: IndexingResult[];
  /**
   * Lattices the available lines cannot separate from the winner.
   *
   * This is a real limit of the method, not a shortcoming of the code. Simple
   * cubic and BCC produce the *same* ratio sequence until the seventh line,
   * where SC skips 7 and BCC does not — so a six-line pattern is honestly
   * consistent with both, and the panel says so rather than picking one.
   */
  ambiguousWith: XrdLattice[];
}

/**
 * Which lattice the pattern is consistent with.
 *
 * Ranked by how well the lines agree about `a` — nothing here looks at the
 * true answer, so this is the same reasoning a student does with a ruler.
 */
export function identifyLattice(
  peaks: Peak[],
  lambda: number,
  candidates: XrdLattice[] = ['sc', 'bcc', 'fcc', 'diamond'],
): IndexingVerdict | null {
  if (peaks.length < MIN_LINES_TO_INDEX) return null;
  const results = candidates
    .map((c) => indexPattern(peaks, lambda, c))
    .filter((r): r is IndexingResult => r != null && r.consistent)
    // Absences first, then internal agreement: a lattice that promises lines
    // the trace does not show has been ruled out by the trace.
    .sort((x, y) => x.unexplained.length - y.unexplained.length || x.spread - y.spread);
  if (results.length === 0) return null;

  /**
   * Two lattices are indistinguishable here when every line lands on the same
   * *relative* sequence — N/N₁ identical all the way down. Comparing derived
   * `a` would not do: SC reads a BCC pattern as a cell √2 smaller and every
   * line agrees with every other, so its spread is exactly as good.
   */
  const key = (r: IndexingResult) =>
    `${r.unexplained.length}|${r.lines.map((l) => l.N / r.lines[0].N).join(',')}`;
  const bestKey = key(results[0]);
  const ambiguousWith = results
    .slice(1)
    .filter((r) => key(r) === bestKey)
    .map((r) => r.lattice);

  return { best: results[0], candidates: results, ambiguousWith };
}

/** Two reflections closer than this in 2θ are one line on a trace. */
const COINCIDENT_2THETA = 1e-6;

/**
 * The lines a reader would actually measure.
 *
 * `computePattern` emits one entry per {hkl} *family*, and distinct families
 * can share an N — (300) and (221) both give 9 — so they arrive as two peaks
 * at identical 2θ. On a trace that is one line. Polonium under Cu Kα showed
 * fifteen rows where a reader can count fourteen, with two identical
 * worksheet rows and a duplicate React key, until this merged them.
 */
export function unlabelledLines(peaks: Peak[]): { twoTheta: number; intensity: number }[] {
  const out: { twoTheta: number; intensity: number }[] = [];
  for (const p of [...peaks].sort((a, b) => a.twoTheta - b.twoTheta)) {
    const last = out[out.length - 1];
    if (last != null && Math.abs(p.twoTheta - last.twoTheta) < COINCIDENT_2THETA) {
      // Coincident families superimpose; a detector sees the sum.
      last.intensity += p.intensity;
      continue;
    }
    out.push({ twoTheta: p.twoTheta, intensity: p.intensity });
  }
  return out;
}

/**
 * Recompute 2θ from an indexed line — the worksheet closing on itself.
 *
 * Was dead code with a comment claiming a purpose nothing carried out. It is
 * now the round-trip assertion in `indexing.test.ts`: take the a a hypothesis
 * derives, put its N back through Bragg, and land on the angle the line was
 * measured at.
 */
export function twoThetaFor(a: number, N: number, lambda: number): number | null {
  for (let h = 0; h <= 12; h++) {
    for (let k = 0; k <= h; k++) {
      for (let l = 0; l <= k; l++) {
        if (h * h + k * k + l * l === N) return braggTwoTheta(dSpacing(a, h, k, l), lambda);
      }
    }
  }
  return null;
}
