// @vitest-environment jsdom
/**
 * Behavioural gate for the index-it-yourself panel (A1).
 *
 * The model is asserted in `xrd/indexing.test.ts`. What matters here is that
 * the reader is made to do the work: the labels are withheld until a lattice
 * is chosen, a wrong choice is refused with the reason, and where the lines
 * genuinely cannot decide the panel says so rather than picking.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { XRD_SAMPLES, XRD_SOURCES, computePattern } from '../xrd/diffraction';
import { MIN_LINES_TO_INDEX, identifyLattice, indexPattern } from '../xrd/indexing';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
await warmRoutes('xrd');

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

async function renderIndexing(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByText(/Index it yourself/)).toBeDefined());
  return screen.getByText(/Index it yourself/).closest('div') as HTMLElement;
}

const cu = XRD_SOURCES.find((s) => s.id === 'cu')!;

describe('the panel withholds the answer until the work is done', () => {
  it('shows no N, no (hkl) and no a before a lattice is chosen', async () => {
    const box = await renderIndexing('#/xrd?sample=cu&source=cu');
    const heads = [...box.querySelectorAll('thead th')].map((h) => h.textContent);
    expect(heads).toEqual(['2θ', 'sin²θ', 'ratio']);
    expect(box.textContent).not.toMatch(/It was /);
  });

  it('adds the worked columns once a lattice is picked', async () => {
    const box = await renderIndexing('#/xrd?sample=cu&source=cu&guess=fcc');
    const heads = [...box.querySelectorAll('thead th')].map((h) => h.textContent);
    expect(heads).toEqual(['2θ', 'sin²θ', 'ratio', 'N', '(hkl)', 'a (nm)']);
  });

  it('reveals the sample only when asked', async () => {
    const box = await renderIndexing('#/xrd?sample=cu&source=cu&reveal=yes');
    expect(box.textContent).toMatch(/It was /);
    expect(box.textContent).toMatch(/Copper/);
  });
});

describe('the panel judges the reader’s choice the way the model does', () => {
  it('rules out a lattice whose rules the ratios break', async () => {
    const box = await renderIndexing('#/xrd?sample=cu&source=cu&guess=bcc');
    const peaks = computePattern('fcc', XRD_SAMPLES.find((s) => s.id === 'cu')!.a, cu.lambda);
    expect(indexPattern(peaks, cu.lambda, 'bcc')!.consistent).toBe(false);
    expect(box.textContent).toMatch(/Ruled out/);
  });

  /** Diamond's set is inside FCC's, so FCC is consistent and still wrong. */
  it('accepts fcc for silicon but names the lines it cannot explain', async () => {
    const box = await renderIndexing('#/xrd?sample=si&source=cu&guess=fcc');
    expect(box.textContent).toMatch(/Consistent, but incomplete/);
    expect(box.textContent).toMatch(/\b4\b/);
  });

  it('accepts diamond for silicon outright', async () => {
    const box = await renderIndexing('#/xrd?sample=si&source=cu&guess=diamond');
    expect(box.textContent).toMatch(/Consistent\./);
    expect(box.textContent).not.toMatch(/incomplete/);
  });

  /**
   * Six lines cannot separate simple cubic from BCC, and the panel says that
   * instead of asserting one.
   */
  it('declares the sc/bcc ambiguity on a six-line pattern', async () => {
    const fe = XRD_SAMPLES.find((s) => s.id === 'fe')!;
    const peaks = computePattern(fe.lattice, fe.a, cu.lambda);
    expect(peaks.length).toBe(6);
    expect(identifyLattice(peaks, cu.lambda)!.ambiguousWith.length).toBeGreaterThan(0);

    const box = await renderIndexing('#/xrd?sample=fe&source=cu');
    expect(box.textContent).toMatch(/cannot decide/);
    expect(box.textContent).toMatch(/seventh/);
  });

  it('makes no ambiguity claim where the lines do decide', async () => {
    const box = await renderIndexing('#/xrd?sample=al&source=cu');
    expect(box.textContent).not.toMatch(/cannot decide/);
  });

  /** Too few lines to try at all: the panel refuses rather than guessing. */
  it('refuses a pattern with fewer than five lines', async () => {
    const short = XRD_SAMPLES.find(
      (s) => computePattern(s.lattice, s.a, XRD_SOURCES.find((x) => x.id === 'cr')!.lambda).length <
        MIN_LINES_TO_INDEX,
    );
    if (short == null) return;
    const box = await renderIndexing(`#/xrd?sample=${short.id}&source=cr`);
    expect(box.textContent).toMatch(/does not become decisive/);
  });
});
