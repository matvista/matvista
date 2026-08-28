import { describe, expect, it } from 'vitest';
import { DEFAULT_TAB, buildHash, formatNumber, isTab, parseHash, parseNumber } from './router';
import { NAV_GROUPS } from './nav';

const ALL_TABS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));

describe('tab recognition', () => {
  it.each(ALL_TABS)('%s is a route', (t) => expect(isTab(t)).toBe(true));
  it('accepts the landing page, which is a route with no nav entry', () => {
    expect(isTab('home')).toBe(true);
  });
  it.each(['', 'nope', 'TRENDS', '../etc', 'trends2'])('rejects %s', (bad) => {
    expect(isTab(bad)).toBe(false);
  });
});

describe('parsing', () => {
  it.each([
    ['#/miller', { tab: 'miller', params: {} }],
    ['/miller', { tab: 'miller', params: {} }],
    ['#/heattreat?steel=4340&rate=120', { tab: 'heattreat', params: { steel: '4340', rate: '120' } }],
    ['#/xrd/', { tab: 'xrd', params: {} }],
    ['#//xrd', { tab: 'xrd', params: {} }],
    ['#/xrd?', { tab: 'xrd', params: {} }],
    ['#/xrd?a', { tab: 'xrd', params: { a: '' } }],
  ])('parses %s', (hash, expected) => {
    expect(parseHash(hash)).toEqual(expected);
  });

  it('degrades an unknown module to the default rather than throwing', () => {
    expect(parseHash('#/bogus?a=1')).toEqual({ tab: DEFAULT_TAB, params: { a: '1' } });
    expect(parseHash('')).toEqual({ tab: DEFAULT_TAB, params: {} });
    expect(parseHash('#')).toEqual({ tab: DEFAULT_TAB, params: {} });
  });

  it('does not let a ? inside a value truncate the query', () => {
    expect(parseHash('#/miller?plane=1?1&dir=110')).toEqual({
      tab: 'miller',
      params: { plane: '1?1', dir: '110' },
    });
  });
});

describe('round trips', () => {
  const CASES: { tab: string; params: Record<string, string> }[] = [
    // The Miller module's default direction carries a combining macron.
    { tab: 'miller', params: { plane: '111', dir: '1̄10', axis: '123' } },
    { tab: 'miller', params: { plane: '(1̅0 2)', dir: '−110' } },
    { tab: 'heattreat', params: { steel: '4340', rate: '229.087' } },
    { tab: 'phase', params: { sys: 'fe-c', x: '0.4', T: '650' } },
    { tab: 'xrd', params: { a: 'x y', b: 'a&b=c', c: '100%', d: '#frag', e: 'π/2' } },
  ];

  it.each(CASES)('preserves every byte of $tab', ({ tab, params }) => {
    const back = parseHash(buildHash(tab as never, params));
    expect(back.tab).toBe(tab);
    for (const [k, v] of Object.entries(params)) expect(back.params[k]).toBe(v);
  });

  it.each([...ALL_TABS, 'home'])('%s survives build → parse', (t) => {
    expect(parseHash(buildHash(t as never, {})).tab).toBe(t);
  });
});

describe('building', () => {
  it('omits an empty query', () => expect(buildHash('miller', {})).toBe('#/miller'));
  it('drops empty values', () => expect(buildHash('miller', { a: '', b: '1' })).toBe('#/miller?b=1'));

  /** One visible state must always produce one URL, whatever order the reader
   *  touched the controls in — so keys are sorted, not insertion-ordered. */
  it('sorts keys so the same state always gives the same URL', () => {
    expect(buildHash('heattreat', { steel: '1', rate: '2' })).toBe('#/heattreat?rate=2&steel=1');
    expect(buildHash('heattreat', { rate: '2', steel: '1' })).toBe('#/heattreat?rate=2&steel=1');
  });
});

describe('numbers', () => {
  it.each([
    [229.08665231934, '229.087'],
    [50, '50'],
    [0.05, '0.05'],
    [-27.4, '-27.4'],
    [NaN, ''],
    [Infinity, ''],
  ])('formats %s as %s', (v, expected) => expect(formatNumber(v)).toBe(expected));

  it.each([
    ['120', 5, 120],
    [undefined, 5, 5],
    ['', 5, 5],
    ['abc', 5, 5],
    ['12abc', 5, 5],
    ['0.82', 0, 0.82],
  ])('parses %s to %s', (raw, fallback, expected) => {
    expect(parseNumber(raw as string | undefined, fallback)).toBe(expected);
  });

  it('survives format → parse at the precision it keeps', () => {
    for (const v of [0.001, 0.05, 0.82, 1, 23.4, 50, 229.08665231934, 5000, -27.4]) {
      expect(parseNumber(formatNumber(v), NaN)).toBeCloseTo(Number(v.toPrecision(6)), 12);
    }
  });
});
