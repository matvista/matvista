import { describe, expect, it } from 'vitest';
import {
  CEMENTITE_X,
  EUTECTOID_X,
  FERRITE_MAX,
  GAMMA_MAX,
  PEARLITE_FERRITE,
  asPercent,
  eutectoidSplit,
  lever,
} from './eutectoid';
import { steelMicrostructure } from './systems';

/**
 * `eutectoid.ts` exists so the landing page can compute a steel's
 * microconstituent split without loading `systems.ts`. That is only worth doing
 * if the two cannot disagree, so the first block here walks the whole domain
 * and holds them to the same numbers — the guarantee that lets the front page
 * put a live slider on a claim the module has to honour when the reader clicks
 * through.
 *
 * A tolerance of 1e-12 rather than exact equality: the two take the same lever
 * rule over the same endpoints but reach it by different orders of operations,
 * and demanding bit-identical doubles would be asserting something about
 * floating point rather than about the physics.
 */
describe('eutectoidSplit agrees with the phase module', () => {
  /*
   * Stepping from 50, not from 22. The grid has to be the one the landing
   * page's control produces — 0.05, 0.06, … 2.14 — or the test walks 212
   * compositions that no reader can select and never touches 0.76 or 2.14, the
   * two that matter most. It was doing exactly that.
   */
  it('matches steelMicrostructure at every stop the landing control offers', () => {
    let checked = 0;
    for (let i = 50; i <= GAMMA_MAX * 1000; i += 10) {
      const C0 = i / 1000;
      const mine = eutectoidSplit(C0);
      const theirs = steelMicrostructure(C0);
      expect(mine, `no split at ${C0}`).not.toBeNull();
      expect(theirs, `no microstructure at ${C0}`).not.toBeNull();
      expect(mine!.kind).toBe(theirs!.kind);
      expect(mine!.proeutectoid).toBe(theirs!.proeutectoid);
      expect(mine!.pearliteFraction).toBeCloseTo(theirs!.pearlite, 12);
      expect(mine!.proeutectoidFraction).toBeCloseTo(theirs!.proeutectoidFraction, 12);
      expect(mine!.totalFerrite).toBeCloseTo(theirs!.totalFerrite, 12);
      expect(mine!.totalCementite).toBeCloseTo(theirs!.totalCementite, 12);
      checked++;
    }
    // The loop is only evidence if it ran; a mis-typed bound that skipped every
    // composition would otherwise pass silently. And the two endpoints the
    // control can reach exactly must be among them.
    expect(checked).toBe(210);
  });

  it('matches at the two compositions the control lands on exactly', () => {
    for (const C0 of [EUTECTOID_X, GAMMA_MAX]) {
      const mine = eutectoidSplit(C0)!;
      const theirs = steelMicrostructure(C0)!;
      expect(mine.kind, String(C0)).toBe(theirs.kind);
      expect(mine.proeutectoid, String(C0)).toBe(theirs.proeutectoid);
      expect(mine.pearliteFraction, String(C0)).toBeCloseTo(theirs.pearlite, 12);
      expect(mine.totalFerrite, String(C0)).toBeCloseTo(theirs.totalFerrite, 12);
    }
  });

  it('agrees at the eutectoid itself, where there is no proeutectoid phase', () => {
    const mine = eutectoidSplit(EUTECTOID_X);
    const theirs = steelMicrostructure(EUTECTOID_X);
    expect(mine!.kind).toBe('eutectoid');
    expect(mine!.proeutectoid).toBeNull();
    expect(mine!.pearliteFraction).toBe(1);
    expect(mine!.kind).toBe(theirs!.kind);
    expect(mine!.proeutectoid).toBe(theirs!.proeutectoid);
  });
});

describe('the domain is refused rather than clamped', () => {
  it('returns null below the ferrite solubility limit', () => {
    expect(eutectoidSplit(0)).toBeNull();
    expect(eutectoidSplit(0.021)).toBeNull();
    expect(eutectoidSplit(FERRITE_MAX)).not.toBeNull();
  });

  it('returns null above the austenite limit, where the alloy is a cast iron', () => {
    expect(eutectoidSplit(GAMMA_MAX)).not.toBeNull();
    expect(eutectoidSplit(2.15)).toBeNull();
    expect(eutectoidSplit(4.3)).toBeNull();
  });

  it('refuses NaN rather than returning fractions built from it', () => {
    expect(eutectoidSplit(Number.NaN)).toBeNull();
  });
});

/**
 * The worked example the landing page opens on, and its mirror image above the
 * eutectoid. These are the numbers a reader can check against a textbook, and
 * they are what `docs.test.ts` holds the page's copy to.
 */
describe('the textbook worked values', () => {
  it('0.40 wt% C: 48.8 % proeutectoid ferrite, 51.2 % pearlite', () => {
    const s = eutectoidSplit(0.4)!;
    expect(s.kind).toBe('hypoeutectoid');
    expect(s.proeutectoid).toBe('α (ferrite)');
    expect(asPercent(s.proeutectoidFraction)).toBe('48.8 %');
    expect(asPercent(s.pearliteFraction)).toBe('51.2 %');
    expect(asPercent(s.totalFerrite)).toBe('94.3 %');
    expect(asPercent(s.totalCementite)).toBe('5.7 %');
  });

  it('1.20 wt% C: the proeutectoid constituent is cementite, and there is little of it', () => {
    const s = eutectoidSplit(1.2)!;
    expect(s.kind).toBe('hypereutectoid');
    expect(s.proeutectoid).toBe('Fe₃C (cementite)');
    // (6.7 − 1.2) / (6.7 − 0.76) = 0.9259…
    expect(asPercent(s.pearliteFraction)).toBe('92.6 %');
    expect(asPercent(s.proeutectoidFraction)).toBe('7.4 %');
  });

  it('the two microconstituents and the two phases each sum to unity', () => {
    for (let i = 22; i <= 2140; i += 7) {
      const s = eutectoidSplit(i / 1000)!;
      expect(s.proeutectoidFraction + s.pearliteFraction).toBeCloseTo(1, 12);
      expect(s.totalFerrite + s.totalCementite).toBeCloseTo(1, 12);
      // Pearlite is itself mostly ferrite, so total α can never be the smaller
      // of the two — the misconception the readout is built to break.
      expect(s.totalFerrite).toBeGreaterThanOrEqual(s.proeutectoidFraction - 1e-12);
    }
  });
});

/**
 * The identity the landing page's instrument is drawn as.
 *
 * Pearlite is what the eutectoid composition itself becomes, so it is
 * 88.9 % ferrite whatever alloy it sits in. Proeutectoid ferrite plus the
 * ferrite inside pearlite therefore *is* total ferrite — the algebra cancels to
 * (c − x)/(c − a) — and the instrument draws the two bars ordered by phase so
 * that the colour boundary falls at the same place in both.
 *
 * This is asserted here rather than derived in a comment, because the drawing
 * is only honest while it holds.
 */
describe('pearlite’s own ferrite is what makes the two bars line up', () => {
  it('is the lever rule taken at the eutectoid composition', () => {
    expect(PEARLITE_FERRITE).toBeCloseTo(lever(EUTECTOID_X, FERRITE_MAX, CEMENTITE_X), 15);
    expect(asPercent(PEARLITE_FERRITE)).toBe('88.9 %');
  });

  it('accounts for total ferrite exactly, at every stop of the control', () => {
    for (let i = 50; i <= GAMMA_MAX * 1000; i += 10) {
      const C0 = i / 1000;
      const s = eutectoidSplit(C0)!;
      const inPearlite = s.pearliteFraction * PEARLITE_FERRITE;
      const proeutectoidFerrite = s.proeutectoid === 'α (ferrite)' ? s.proeutectoidFraction : 0;
      expect(proeutectoidFerrite + inPearlite, `ferrite at ${C0}`).toBeCloseTo(s.totalFerrite, 12);

      const proeutectoidCementite =
        s.proeutectoid === 'Fe₃C (cementite)' ? s.proeutectoidFraction : 0;
      const cementiteInPearlite = s.pearliteFraction - inPearlite;
      expect(proeutectoidCementite + cementiteInPearlite, `cementite at ${C0}`).toBeCloseTo(
        s.totalCementite,
        12,
      );
    }
  });
});

describe('the lever rule this is built on', () => {
  it('gives all of the phase at the composition it sits on', () => {
    expect(lever(FERRITE_MAX, FERRITE_MAX, CEMENTITE_X)).toBe(1);
    expect(lever(CEMENTITE_X, FERRITE_MAX, CEMENTITE_X)).toBe(0);
  });

  it('does not divide by zero on a degenerate tie line', () => {
    expect(lever(0.5, 0.5, 0.5)).toBe(1);
  });
});
