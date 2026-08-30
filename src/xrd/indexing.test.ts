import { describe, expect, it } from 'vitest';
import { XRD_SAMPLES, XRD_SOURCES, computePattern } from './diffraction';
import {
  MIN_LINES_TO_INDEX,
  allowedNSequence,
  identifyLattice,
  indexPattern,
  unlabelledLines,
} from './indexing';

const cu = XRD_SOURCES.find((s) => s.id === 'cu')!;

describe('the ratio sequences are the textbook fingerprints', () => {
  /**
   * These are the sequences a student memorises, and they come out of
   * `isAllowed` rather than being typed here — the sequence is a consequence
   * of the extinction rule, which is the point.
   */
  /**
   * BCC's sequence has no gap: 14 = 3²+2²+1², so it is there. The gap belongs
   * to simple cubic, where 7 cannot be written as a sum of three squares. An
   * earlier version of this file asserted the reverse.
   */
  it('bcc runs 2,4,6,8,10,12,14,16 — unbroken', () => {
    expect(allowedNSequence('bcc', 8)).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
    expect(allowedNSequence('bcc', 8).map((n, _, r) => n / r[0])).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it('fcc runs 3,4,8,11,12', () => {
    expect(allowedNSequence('fcc', 5)).toEqual([3, 4, 8, 11, 12]);
  });

  it('sc runs 1,2,3,4,5,6,8 — no 7, for the same reason', () => {
    expect(allowedNSequence('sc', 7)).toEqual([1, 2, 3, 4, 5, 6, 8]);
  });

  it('diamond drops fcc’s 4 and 12', () => {
    const d = allowedNSequence('diamond', 5);
    expect(d).toContain(3);
    expect(d).toContain(8);
    expect(d).toContain(11);
    expect(d).not.toContain(4);
    expect(d).not.toContain(12);
  });

  /** Ratios, which is what the reader actually computes. */
  it('gives bcc 1:2:3 and fcc 1:1.33:2.67', () => {
    const b = allowedNSequence('bcc', 3);
    expect(b.map((n) => n / b[0])).toEqual([1, 2, 3]);
    const f = allowedNSequence('fcc', 3);
    expect(f.map((n) => +(n / f[0]).toFixed(2))).toEqual([1, 1.33, 2.67]);
  });
});

describe('working a pattern up recovers the material it came from', () => {
  const samples = XRD_SAMPLES.filter(
    (s) => computePattern(s.lattice, s.a, cu.lambda).length >= MIN_LINES_TO_INDEX,
  );

  it('has enough samples to be worth asserting', () => {
    expect(samples.length).toBeGreaterThanOrEqual(5);
  });

  /**
   * The whole claim: from angles alone, with the labels withheld, the correct
   * lattice comes back and the lattice parameter with it to better than 0.5%.
   */
  it.each(samples.map((s) => s.id))('%s: identifies its own lattice and a', (id) => {
    const s = XRD_SAMPLES.find((x) => x.id === id)!;
    const peaks = computePattern(s.lattice, s.a, cu.lambda);
    const verdict = identifyLattice(peaks, cu.lambda)!;
    const answer =
      verdict.best.lattice === s.lattice
        ? verdict.best
        : verdict.candidates.find((c) => c.lattice === s.lattice)!;
    // The true lattice is always among the surviving hypotheses...
    expect([verdict.best.lattice, ...verdict.ambiguousWith]).toContain(s.lattice);
    // ...and reading the pattern under it returns the right cell size.
    expect(Math.abs(answer.a - s.a) / s.a).toBeLessThan(0.005);
  });

  /**
   * And it is decisive, not a coin toss: the runner-up's lines disagree about
   * `a` by orders of magnitude more than the winner's.
   */
  it.each(samples.map((s) => s.id))('%s: the winning assignment is self-consistent', (id) => {
    const s = XRD_SAMPLES.find((x) => x.id === id)!;
    const verdict = identifyLattice(computePattern(s.lattice, s.a, cu.lambda), cu.lambda)!;
    expect(verdict.best.spread).toBeLessThan(1e-9);
    expect(verdict.best.ratioError).toBeLessThan(1e-6);
    expect(verdict.best.consistent).toBe(true);
  });

  /**
   * Where the answer is not unique, it is named as not unique. SC and BCC give
   * the same ratio sequence until the seventh line, so a six-line pattern is
   * honestly consistent with both — and every sample with seven or more lines
   * is decided outright.
   */
  it.each(samples.map((s) => s.id))('%s: reports ambiguity only where it is real', (id) => {
    const s = XRD_SAMPLES.find((x) => x.id === id)!;
    const peaks = computePattern(s.lattice, s.a, cu.lambda);
    const v = identifyLattice(peaks, cu.lambda)!;
    const decided = v.ambiguousWith.length === 0;
    if (peaks.length >= 7) {
      expect(decided, `${id} has ${peaks.length} lines and should be decided`).toBe(true);
      expect(v.best.lattice).toBe(s.lattice);
    } else {
      // Six lines: sc and bcc are genuinely the same list.
      expect([v.best.lattice, ...v.ambiguousWith]).toContain(s.lattice);
    }
  });

  /**
   * Independent of the lattice parameter, which is the reason the method is
   * taught this way: the same structure at a different size gives the same
   * ratios and so the same answer.
   */
  it('gives the same ratios for the same structure at a different size', () => {
    const a1 = computePattern('fcc', 0.36, cu.lambda);
    const a2 = computePattern('fcc', 0.41, cu.lambda);
    const r1 = indexPattern(a1, cu.lambda, 'fcc')!.lines.slice(0, 4).map((l) => +l.ratio.toFixed(6));
    const r2 = indexPattern(a2, cu.lambda, 'fcc')!.lines.slice(0, 4).map((l) => +l.ratio.toFixed(6));
    expect(r1).toEqual(r2);
  });

  it('assigns the wrong lattice lines that disagree about a', () => {
    const s = XRD_SAMPLES.find((x) => x.lattice === 'fcc')!;
    const peaks = computePattern('fcc', s.a, cu.lambda);
    const wrong = indexPattern(peaks, cu.lambda, 'bcc')!;
    expect(wrong.spread).toBeGreaterThan(0.01);
  });
});

describe('the panel refuses what it cannot decide', () => {
  it('will not index fewer than five lines', () => {
    const peaks = computePattern('fcc', 0.36, cu.lambda);
    expect(identifyLattice(peaks.slice(0, MIN_LINES_TO_INDEX - 1), cu.lambda)).toBeNull();
    expect(identifyLattice(peaks.slice(0, MIN_LINES_TO_INDEX), cu.lambda)).not.toBeNull();
  });

  /**
   * The reason for the floor: with three lines a BCC pattern and an SC one
   * both read 1 : 2 : 3, so the sequence cannot separate them.
   */
  /**
   * The floor exists because the ratio sequence has to become decisive, and
   * for SC against BCC it does not until the seventh line: both read
   * 1 : 2 : 3 : 4 : 5 : 6, and only then does SC skip 7.
   */
  it('cannot separate bcc from sc until the seventh line', () => {
    const ratios = (l: 'sc' | 'bcc', n: number) =>
      allowedNSequence(l, n).map((v, _, arr) => v / arr[0]);
    for (const n of [3, 5, 6]) expect(ratios('bcc', n)).toEqual(ratios('sc', n));
    expect(ratios('bcc', 7)).not.toEqual(ratios('sc', 7));
  });

  it('says so rather than guessing, on a six-line pattern', () => {
    const fe = XRD_SAMPLES.find((x) => x.id === 'fe')!;
    const peaks = computePattern(fe.lattice, fe.a, cu.lambda);
    expect(peaks.length).toBe(6);
    const v = identifyLattice(peaks, cu.lambda)!;
    expect([v.best.lattice, ...v.ambiguousWith].sort()).toEqual(['bcc', 'sc']);
  });

  it('hands over angles and intensities only, never the labels', () => {
    const peaks = computePattern('fcc', 0.36, cu.lambda);
    const lines = unlabelledLines(peaks);
    expect(lines).toHaveLength(peaks.length);
    for (const l of lines) expect(Object.keys(l).sort()).toEqual(['intensity', 'twoTheta']);
    // Ascending, as a reader would read them off the trace.
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].twoTheta).toBeGreaterThan(lines[i - 1].twoTheta);
    }
  });
});

describe('the absent reflections are half the argument', () => {
  const cuSrc = XRD_SOURCES.find((s) => s.id === 'cu')!;

  /**
   * Diamond's allowed set is a subset of FCC's, so consistency alone cannot
   * separate them: every diamond line is a legal FCC line. What separates them
   * is what FCC *promises and does not deliver* — (200) at N = 4 and (222) at
   * N = 12 are absent from a silicon trace.
   */
  it('silicon is consistent with fcc, and fcc leaves lines unexplained', () => {
    const si = XRD_SAMPLES.find((x) => x.id === 'si')!;
    const peaks = computePattern(si.lattice, si.a, cuSrc.lambda);
    const asFcc = indexPattern(peaks, cuSrc.lambda, 'fcc')!;
    const asDiamond = indexPattern(peaks, cuSrc.lambda, 'diamond')!;

    expect(asFcc.consistent).toBe(true);
    expect(asFcc.spread).toBeLessThan(1e-9);
    expect(asDiamond.unexplained).toEqual([]);
    expect(asFcc.unexplained).toContain(4);
    expect(asFcc.unexplained).toContain(12);
    expect(identifyLattice(peaks, cuSrc.lambda)!.best.lattice).toBe('diamond');
  });

  it('leaves nothing unexplained under the lattice the pattern came from', () => {
    for (const s of XRD_SAMPLES) {
      const peaks = computePattern(s.lattice, s.a, cuSrc.lambda);
      if (peaks.length < MIN_LINES_TO_INDEX) continue;
      expect(indexPattern(peaks, cuSrc.lambda, s.lattice)!.unexplained, s.id).toEqual([]);
    }
  });

  /** A forbidden reflection rules a lattice out outright, not by degree. */
  it('rejects a lattice whose rules the ratios break', () => {
    const cuS = XRD_SAMPLES.find((x) => x.id === 'cu')!;
    const peaks = computePattern('fcc', cuS.a, cuSrc.lambda);
    expect(indexPattern(peaks, cuSrc.lambda, 'bcc')!.consistent).toBe(false);
    expect(identifyLattice(peaks, cuSrc.lambda)!.candidates.map((c) => c.lattice)).not.toContain(
      'bcc',
    );
  });
});
