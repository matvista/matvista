import { describe, expect, it } from 'vitest';
import {
  SLIP_MODES, acute, angleBetween, bareIndices, dSpacing, directionSegment,
  drawnOffset, family, formatIndices, intercepts, liesInPlane, parseIndices,
  planePolygon, rankSystems, reduce, schmidFactor, slipSystems, toMillerBravais,
} from './miller';

describe('index parsing accepts what students actually type', () => {
  it.each([
    ['111', [1, 1, 1]],
    ['1 1 1', [1, 1, 1]],
    ['1,1,1', [1, 1, 1]],
    ['(111)', [1, 1, 1]],
    ['[1-10]', [1, -1, 0]],
    ['-1 1 1', [-1, 1, 1]],
    ['1̄ 1 1', [-1, 1, 1]],
    ['1̄11', [-1, 1, 1]],
    ['10 2 0', [10, 2, 0]],
  ])('parses %s', (text, expected) => {
    expect(parseIndices(text)).toEqual(expected);
  });

  it('rejects what is not an index', () => {
    for (const bad of ['', '(000)', '0 0 0', 'abc', '1 1', '1 1 1 1', '1.5 1 1']) {
      expect(parseIndices(bad)).toBeNull();
    }
  });

  it('round-trips through the text an input box would hold', () => {
    for (const idx of [[1, 1, 1], [-1, 1, 0], [10, 2, 0], [-1, -2, 3]] as [number, number, number][]) {
      expect(parseIndices(bareIndices(idx))).toEqual(idx);
    }
  });

  it('brackets planes and directions differently', () => {
    expect(formatIndices([1, 1, 1], 'plane')).toBe('(111)');
    expect(formatIndices([1, 1, 1], 'direction')).toBe('[111]');
  });
});

describe('plane geometry', () => {
  it('takes intercepts as the reciprocal of the index', () => {
    const i = intercepts([1, 2, 0]);
    expect(i[0].value).toBe(1);
    expect(i[1].value).toBe(0.5);
    expect(i[2].value).toBeNull(); // parallel to c
  });

  it('shifts the drawn plane so negative indices still cut the cell', () => {
    expect(drawnOffset([1, 1, 1])).toBe(1);
    expect(drawnOffset([-1, 1, 1])).toBe(0);
    expect(drawnOffset([-1, -1, 1])).toBe(-1);
  });

  it('draws every member of a family as a congruent polygon', () => {
    const areas = family([1, 2, 3]).map((m) => planePolygon(m)!.vertices.length);
    expect(new Set(areas).size).toBe(1);
  });

  it('gives cubic d-spacing a/√(h²+k²+l²)', () => {
    expect(dSpacing([1, 1, 1], 0.3615)).toBeCloseTo(0.3615 / Math.sqrt(3), 12);
    expect(dSpacing([2, 0, 0], 0.3615)).toBeCloseTo(0.3615 / 2, 12);
  });

  it('reduces to lowest terms', () => {
    expect(reduce([2, 2, 2])).toEqual([1, 1, 1]);
    expect(reduce([2, 4, 6])).toEqual([1, 2, 3]);
    expect(reduce([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('keeps the direction segment inside the cell', () => {
    for (const uvw of [[1, 1, 1], [-1, 1, 0], [1, 2, 3]] as [number, number, number][]) {
      const { from, to } = directionSegment(uvw);
      for (const p of [from, to]) {
        for (const c of p) {
          expect(c).toBeGreaterThanOrEqual(-0.5 - 1e-9);
          expect(c).toBeLessThanOrEqual(0.5 + 1e-9);
        }
      }
    }
  });
});

describe('families', () => {
  it.each([
    [[1, 0, 0], 3],
    [[1, 1, 0], 6],
    [[1, 1, 1], 4],
    [[1, 2, 3], 24],
  ])('{%s} has %i distinct members', (idx, count) => {
    expect(family(idx as [number, number, number])).toHaveLength(count);
  });

  it('adds the redundant hexagonal index as −(h+k)', () => {
    expect(toMillerBravais([1, 0, 0])).toEqual([1, 0, -1, 0]);
    expect(toMillerBravais([1, 1, 0])).toEqual([1, 1, -2, 0]);
  });
});

describe('slip systems', () => {
  it('gives FCC 12 and BCC 48', () => {
    expect(slipSystems(SLIP_MODES.find((m) => m.id === 'fcc')!)).toHaveLength(12);
    expect(slipSystems(SLIP_MODES.find((m) => m.id === 'bcc')!)).toHaveLength(48);
  });

  it('only generates systems whose direction lies in its plane', () => {
    for (const mode of SLIP_MODES) {
      for (const s of slipSystems(mode)) {
        expect(liesInPlane(s.plane, s.direction)).toBe(true);
      }
    }
  });

  it('caps the Schmid factor at 0.5 and reports angles consistent with it', () => {
    for (const mode of SLIP_MODES) {
      for (const s of rankSystems(mode, [1, 2, 3])) {
        expect(s.m).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(s.m).toBeGreaterThanOrEqual(0);
        // phi and lambda are reported acute, and |cos φ · cos λ| must equal m.
        expect(s.phi).toBeGreaterThanOrEqual(0);
        expect(s.phi).toBeLessThanOrEqual(90 + 1e-9);
        const check = Math.abs(
          Math.cos((s.phi * Math.PI) / 180) * Math.cos((s.lambda * Math.PI) / 180),
        );
        expect(check).toBeCloseTo(s.m, 9);
      }
    }
  });

  it('ranks the systems in descending Schmid factor', () => {
    const ranked = rankSystems(SLIP_MODES[0], [1, 2, 3]);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].m).toBeLessThanOrEqual(ranked[i - 1].m + 1e-12);
    }
  });

  it('gives the textbook 0.5 maximum for a [001] axis on (111)[1̄01]', () => {
    // cos φ = 1/√3, cos λ = 1/√2 → m = 0.408 for the classic FCC case
    expect(schmidFactor([0, 0, 1], [1, 1, 1], [-1, 0, 1])).toBeCloseTo(0.4082, 4);
  });

  it('folds obtuse angles to their acute equivalent', () => {
    expect(acute(120)).toBe(60);
    expect(acute(60)).toBe(60);
    expect(angleBetween([1, 0, 0], [0, 1, 0])).toBeCloseTo(90, 9);
    expect(angleBetween([1, 1, 1], [1, 1, 1])).toBeCloseTo(0, 9);
  });
});
