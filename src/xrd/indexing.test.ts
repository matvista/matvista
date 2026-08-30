import { describe, expect, it } from 'vitest';
import { XRD_SAMPLES, XRD_SOURCES, computePattern } from './diffraction';
import {
  MIN_LINES_TO_INDEX,
  allowedNSequence,
  hklForN,
  identifyLattice,
  indexPattern,
  twoThetaFor,
  unlabelledLines,
} from './indexing';
import { isAllowed } from './diffraction';

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

describe('an assignment has to be an assignment', () => {
  const src = XRD_SOURCES.find((s) => s.id === 'cu')!;

  /**
   * Simple cubic "explained" a copper pattern by putting two different angles
   * on (100) and two more on (200), with the derived a spanning 12%, and the
   * panel captioned it "every line fits". Allowed-ness is not enough: the
   * assignment must be one-to-one and ordered.
   */
  it('rejects a hypothesis that puts two lines on one reflection', () => {
    const cu = XRD_SAMPLES.find((x) => x.id === 'cu')!;
    const peaks = computePattern(cu.lattice, cu.a, src.lambda);
    const asSc = indexPattern(peaks, src.lambda, 'sc')!;
    const Ns = asSc.lines.map((l) => l.N);
    expect(new Set(Ns).size).toBeLessThan(Ns.length); // it really does collide
    expect(asSc.consistent).toBe(false);
    expect(identifyLattice(peaks, src.lambda)!.candidates.map((c) => c.lattice)).not.toContain('sc');
  });

  it('rejects ratios too far from whole numbers to round honestly', () => {
    const cu = XRD_SAMPLES.find((x) => x.id === 'cu')!;
    const peaks = computePattern(cu.lattice, cu.a, src.lambda);
    expect(indexPattern(peaks, src.lambda, 'sc')!.ratioError).toBeGreaterThan(0.12);
    expect(indexPattern(peaks, src.lambda, 'fcc')!.ratioError).toBeLessThan(1e-9);
  });

  /**
   * Distinct {hkl} families can share an N — (300) and (221) both give 9 — so
   * `computePattern` emits two peaks at the same angle. A trace shows one
   * line, and the worksheet must too.
   */
  it('merges reflections that arrive at the same angle', () => {
    const po = XRD_SAMPLES.find((x) => x.id === 'po')!;
    const peaks = computePattern(po.lattice, po.a, src.lambda);
    const lines = unlabelledLines(peaks);
    expect(lines.length).toBeLessThan(peaks.length);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].twoTheta).toBeGreaterThan(lines[i - 1].twoTheta);
    }
    // Coincident families superimpose rather than one being dropped. Find the
    // merged line rather than assuming where it is.
    const coincident = lines.find(
      (l) => peaks.filter((p) => Math.abs(p.twoTheta - l.twoTheta) < 1e-6).length > 1,
    )!;
    expect(coincident).toBeDefined();
    const parts = peaks.filter((p) => Math.abs(p.twoTheta - coincident.twoTheta) < 1e-6);
    expect(parts.length).toBeGreaterThan(1);
    expect(coincident.intensity).toBeCloseTo(parts.reduce((t, p) => t + p.intensity, 0), 9);
  });

  it('has strictly ascending lines for every shipped sample and anode', () => {
    for (const s of XRD_SAMPLES) {
      for (const source of XRD_SOURCES) {
        const lines = unlabelledLines(computePattern(s.lattice, s.a, source.lambda));
        for (let i = 1; i < lines.length; i++) {
          expect(lines[i].twoTheta, `${s.id}/${source.id}`).toBeGreaterThan(lines[i - 1].twoTheta);
        }
      }
    }
  });
});

describe('the method’s own limits, recorded', () => {
  const src = XRD_SOURCES.find((s) => s.id === 'cu')!;

  /**
   * The ratio method does not remove the missing-reflection assumption, it
   * moves it to the *first* line: N₁ is pinned to the lowest allowed
   * reflection, so losing the first line shifts every assignment.
   *
   * With only an allowed-ness check that produced a confident wrong answer —
   * simple cubic at about half the true cell, nothing unexplained, no
   * ambiguity reported. Requiring the assignment to be one-to-one and ordered
   * turns that into a refusal, because the shifted ratios drive two lines onto
   * the same reflection. The limit is still there; it now announces itself.
   */
  it.each(['cu', 'al', 'w', 'fe', 'si'])('%s: a missing first line is refused, not guessed', (id) => {
    const s = XRD_SAMPLES.find((x) => x.id === id)!;
    const peaks = computePattern(s.lattice, s.a, src.lambda);
    const full = identifyLattice(peaks, src.lambda);
    expect(full).not.toBeNull();

    const truncated = peaks.slice(1);
    const v = identifyLattice(truncated, src.lambda);
    if (v == null) return; // every hypothesis rejected — the honest outcome
    // If anything does survive, it must not be a confident wrong answer.
    expect(v.best.a).toBeGreaterThan(s.a * 0.9);
  });

  it('needs five lines, and that number is the one it declares', () => {
    expect(MIN_LINES_TO_INDEX).toBe(5);
    const peaks = computePattern('fcc', 0.36, src.lambda);
    expect(identifyLattice(peaks.slice(0, 4), src.lambda)).toBeNull();
    expect(identifyLattice(peaks.slice(0, 5), src.lambda)).not.toBeNull();
  });

  /** The sequence has to reach far enough for the high-N samples. */
  it('enumerates far enough to cover the longest pattern', () => {
    expect(allowedNSequence('sc', 30).length).toBe(30);
    expect(allowedNSequence('diamond', 20).length).toBe(20);
    // Thirty simple-cubic values reach N = 35, which needs h up to 5 with
    // (5,3,1); a smaller enumeration bound silently truncates the sequence.
    expect(Math.max(...allowedNSequence('sc', 30))).toBe(35);
    expect(allowedNSequence('bcc', 20).length).toBe(20);
  });

  it('never labels a line with a forbidden plane', () => {
    for (const l of ['sc', 'bcc', 'fcc', 'diamond'] as const) {
      for (const N of allowedNSequence(l, 15)) {
        const hkl = hklForN(l, N)!;
        expect(hkl, `${l} N=${N}`).not.toBeNull();
        expect(isAllowed(l, hkl[0], hkl[1], hkl[2]), `${l} ${hkl}`).toBe(true);
        expect(hkl[0] ** 2 + hkl[1] ** 2 + hkl[2] ** 2).toBe(N);
      }
    }
  });

  /**
   * `spread` is printed as a percentage, so it has to be relative — an
   * absolute spread in nanometres would read as a wildly different number
   * under the same label. Chained to the lines it summarises rather than
   * compared between patterns, since two patterns do not have the same lines.
   */
  it.each(['sc', 'bcc', 'fcc', 'diamond'] as const)('spread is relative, under %s', (lattice) => {
    const cu = XRD_SAMPLES.find((x) => x.id === 'cu')!;
    const r = indexPattern(computePattern(cu.lattice, cu.a, src.lambda), src.lambda, lattice)!;
    const mean = r.lines.reduce((t, l) => t + l.a, 0) / r.lines.length;
    const expected = Math.max(...r.lines.map((l) => Math.abs(l.a - mean) / mean));
    expect(r.spread).toBeCloseTo(expected, 12);
    expect(r.a).toBeCloseTo(mean, 12);
  });

  it('counts as unexplained only reflections inside the observed range', () => {
    const si = XRD_SAMPLES.find((x) => x.id === 'si')!;
    const asFcc = indexPattern(computePattern(si.lattice, si.a, src.lambda), src.lambda, 'fcc')!;
    const Ns = asFcc.lines.map((l) => l.N);
    for (const u of asFcc.unexplained) {
      expect(u).toBeGreaterThan(Math.min(...Ns));
      expect(u).toBeLessThan(Math.max(...Ns));
    }
  });

  /** The worksheet closes: a derived a puts every line back at its own angle. */
  it.each(['cu', 'al', 'w', 'si'])('%s: the derived a reproduces every measured angle', (id) => {
    const s = XRD_SAMPLES.find((x) => x.id === id)!;
    const peaks = computePattern(s.lattice, s.a, src.lambda);
    const r = indexPattern(peaks, src.lambda, s.lattice)!;
    for (const l of r.lines) {
      expect(twoThetaFor(r.a, l.N, src.lambda)!).toBeCloseTo(l.twoTheta, 6);
    }
  });
});
