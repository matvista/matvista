// @vitest-environment jsdom
/**
 * Behavioural gate for the planar/linear density panel (S10).
 *
 * The closed forms are asserted in `crystal/density.test.ts`. This checks that
 * the number a reader sees is that number, on the lattice the panel claims to
 * be using — the *selected metal's*, not the cell drawn on screen, which is
 * the same convention the S12 readout beside it follows and an easy one to
 * get backwards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { linearDensity, planarDensity, rankPlanes, type Triple } from '../crystal/density';
import { getStructure } from '../crystal/structures';
import { METALS } from '../crystal/metals';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
await warmRoutes('miller');

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

async function renderMiller(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByText(/How tightly packed is it/)).toBeDefined());
  return screen.getByText(/How tightly packed is it/).closest('div')!;
}

/** atoms/nm² for (hkl) on `symbol`'s own lattice, as the panel should show it. */
function expectedPd(symbol: string, hkl: Triple) {
  const m = METALS.find((x) => x.symbol === symbol)!;
  const s = getStructure(m.structure);
  const a = m.R * s.aOverR!;
  return planarDensity(s, hkl)! / a ** 2;
}

describe('the panel prints the density of the selected metal’s lattice', () => {
  /**
   * W (100) and W (111) are the cases that can tell the two lattices apart.
   * (110) cannot: FCC and BCC have *identical* planar density on it in units
   * of a² — 1.4142 both — so a test built only on (110) passes whether the
   * panel reads the metal's lattice or the cell drawn on screen. That is how
   * the first version of this file missed the mutation. (100) differs by 2×
   * and (111) by 4×.
   */
  it.each([
    ['Cu', [1, 1, 1] as Triple, '111'],
    ['Cu', [1, 0, 0] as Triple, '100'],
    ['W', [1, 1, 0] as Triple, '110'],
    ['W', [1, 0, 0] as Triple, '100'],
    ['W', [1, 1, 1] as Triple, '111'],
  ])('%s (%s)', async (symbol, hkl, planeText) => {
    const box = await renderMiller(`#/miller?metal=${symbol}&plane=${planeText}`);
    expect(box.textContent).toContain(`${expectedPd(symbol, hkl).toFixed(1)} atoms/nm`);
  });

  /**
   * Copper is FCC and tungsten BCC, and they rank differently. Reading the
   * cell on screen instead of the metal would make both agree with whichever
   * structure the `s` param names, so the two are asked with the same `s`.
   */
  it('ranks FCC {111} first and BCC {110} first, from the metal not the cell', async () => {
    const order = (box: HTMLElement) =>
      [...box.querySelectorAll('tbody tr')]
        .map((r) => r.querySelector('th')?.textContent?.replace(/[()]/g, '') ?? '')
        .filter((t) => /^1[01][01]$/.test(t));

    const cu = await renderMiller('#/miller?metal=Cu&s=fcc&plane=111');
    expect(order(cu)).toEqual(['111', '100', '110']);
    cleanup();
    window.location.hash = '';

    const w = await renderMiller('#/miller?metal=W&s=fcc&plane=111');
    expect(order(w)).toEqual(['110', '100', '111']);
  });

  it('agrees with the model’s own ranking', async () => {
    const w = await renderMiller('#/miller?metal=W&plane=110');
    const ranked = rankPlanes(getStructure('bcc'), [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ]);
    expect(ranked[0].hkl.join('')).toBe('110');
    expect(w.textContent).toContain(expectedPd('W', [1, 1, 0]).toFixed(1));
  });

  it('draws the in-plane net with atoms in it', async () => {
    await renderMiller('#/miller?metal=Cu&plane=111');
    const net = document.querySelector('svg.mi-net')!;
    expect(net).toBeDefined();
    expect(net.querySelectorAll('circle').length).toBeGreaterThan(6);
    expect(net.querySelectorAll('polygon')).toHaveLength(1);
  });

  /**
   * The caption says the circles are drawn at the radius the atoms touch at,
   * so they must be. Net coordinates are in units of a, so that radius is
   * R/a = 1/aOverR. Drawing half of it turned the densest plane in FCC into a
   * sparse dot pattern — with the caption underneath still claiming contact —
   * and nothing failed.
   */
  it.each([
    ['Cu', 'fcc'],
    ['W', 'bcc'],
  ])('%s: the net circles are drawn at the touching radius', async (symbol, structureId) => {
    await renderMiller(`#/miller?metal=${symbol}&plane=111`);
    const expected = 1 / getStructure(structureId).aOverR!;
    const rs = [...document.querySelectorAll('svg.mi-net circle')].map((c) =>
      Number(c.getAttribute('r')),
    );
    expect(rs.length).toBeGreaterThan(6);
    for (const r of rs) expect(r).toBeCloseTo(expected, 12);
  });

  /**
   * Two readouts shipped and only one was gated: halving the linear density
   * left every test green.
   */
  it.each([
    ['Cu', 'fcc', '110'],
    ['Cu', 'fcc', '100'],
    ['W', 'bcc', '111'],
  ])('%s: prints the linear density along [%s]', async (symbol, structureId, dirText) => {
    const box = await renderMiller(`#/miller?metal=${symbol}&plane=111&dir=${dirText}`);
    const m = METALS.find((x) => x.symbol === symbol)!;
    const st = getStructure(structureId);
    const a = m.R * st.aOverR!;
    const uvw = dirText.split('').map(Number) as Triple;
    const expected = linearDensity(st, uvw)! / a;
    expect(box.textContent).toContain(`${expected.toFixed(2)} atoms/nm`);
  });
});
