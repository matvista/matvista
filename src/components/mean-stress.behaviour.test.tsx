// @vitest-environment jsdom
/**
 * Behavioural gate for the Haigh diagram (P4).
 *
 * The criteria are asserted in `failure/meanstress.test.ts`. This checks the
 * panel reports the factor for the *selected* material and loading, and that
 * the governing criterion is the smallest factor rather than a fixed one —
 * the disagreement between criteria is the lesson, so naming the wrong winner
 * would invert it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MECH_MATERIALS } from '../mechanical/materials';
import { getFatigueBehaviour } from '../failure/materials';
import {
  MEAN_STRESS_CRITERIA,
  factorOfSafety,
  fromStressRatio,
} from '../failure/model';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
await warmRoutes('failure');

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

async function renderPanel(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByText(/Governing/)).toBeDefined());
  return screen.getByText(/Governing/).closest('table') as HTMLElement;
}

const rowValue = (t: HTMLElement, heading: RegExp) =>
  [...t.querySelectorAll('tr')]
    .find((r) => heading.test(r.querySelector('th')?.textContent ?? ''))
    ?.querySelector('td')?.textContent ?? '';

function expected(matId: string, smax: number, R: number) {
  const mat = MECH_MATERIALS.find((m) => m.id === matId)!;
  const beh = getFatigueBehaviour(mat.id);
  const Se = beh.ratio * mat.uts;
  const { m, a } = fromStressRatio(R, smax);
  return MEAN_STRESS_CRITERIA.map((c) => ({
    c,
    n: factorOfSafety(c, m, a, Se, mat.uts, mat.yield),
  }));
}

describe('the Haigh panel', () => {
  it.each([
    ['steel1020', 300, 0],
    ['steel1020', 500, 0.5],
    ['al', 200, -1],
  ])('%s at %s MPa, R=%s: prints each factor', async (matId, smax, R) => {
    const t = await renderPanel(`#/failure?panel=mean&m=${matId}&smax=${smax}&R=${R}`);
    for (const { c, n } of expected(matId as string, smax as number, R as number)) {
      expect(rowValue(t, new RegExp(`n against .*${c === 'yield' ? 'Yield' : c[0].toUpperCase() + c.slice(1)}`))).toBe(
        n == null ? '—' : n.toFixed(2),
      );
    }
  });

  /** The governing criterion is whichever gives the smallest factor. */
  it.each([
    ['steel1020', 700, 0.6],
    ['steel1020', 200, -1],
    ['cu', 250, 0.3],
  ])('%s at %s MPa, R=%s: names the smallest factor as governing', async (matId, smax, R) => {
    const t = await renderPanel(`#/failure?panel=mean&m=${matId}&smax=${smax}&R=${R}`);
    const fs = expected(matId as string, smax as number, R as number).filter((f) => f.n != null);
    const min = fs.reduce((lo, f) => (f.n! < lo.n! ? f : lo));
    expect(rowValue(t, /^Governing/)).toMatch(
      new RegExp(min.c === 'yield' ? 'Yield' : min.c[0].toUpperCase() + min.c.slice(1)),
    );
  });

  it('draws all four criteria plus the load line', async () => {
    await renderPanel('#/failure?panel=mean&m=steel1020&smax=300&R=0');
    const svg = document.querySelector('svg[aria-label^="Haigh diagram"]')!;
    expect(svg.querySelectorAll('polyline')).toHaveLength(4);
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
  });

  /** R = −1 must land the point on the σ_a axis: that is fully reversed. */
  it('puts the operating point on the amplitude axis at R = −1', async () => {
    const t = await renderPanel('#/failure?panel=mean&m=steel1020&smax=300&R=-1');
    expect(rowValue(t, /σ_m/)).toBe('0 / 300 MPa');
  });

  /**
   * The operating point must be inside the drawn box for every material at
   * every slider position. It was off-canvas for four of the seven at the
   * default peak stress — aluminium's marker sat at cy = −648 in a viewBox
   * 320 tall, with the table beside it printing a factor.
   */
  it.each([
    ['al', 300, 0],
    ['al', 1200, 0.5],
    ['cu', 300, 0],
    ['brass', 600, 0.5],
    ['steel1020', 1200, -1],
    ['ti', 300, -1],
    ['ni', 900, 0.9],
  ])('%s at %s MPa, R=%s: the point is on the canvas', async (m, smax, R) => {
    await renderPanel(`#/failure?panel=mean&m=${m}&smax=${smax}&R=${R}`);
    const svg = document.querySelector('svg[aria-label^="Haigh diagram"]')!;
    const box = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const c = svg.querySelector('circle')!;
    const cx = Number(c.getAttribute('cx'));
    const cy = Number(c.getAttribute('cy'));
    expect(cx).toBeGreaterThanOrEqual(box[0]);
    expect(cx).toBeLessThanOrEqual(box[0] + box[2]);
    expect(cy).toBeGreaterThanOrEqual(box[1]);
    expect(cy).toBeLessThanOrEqual(box[1] + box[3]);
  });

  /**
   * The panel used to claim the criteria disagree and that the governing row
   * was the interesting one. For every annealed material shipped here
   * S_e > σ_y, so the Langer line governs at every load and no fatigue
   * criterion ever binds. The panel now says that, and this pins it to the
   * data rather than to the sentence.
   */
  it('explains that yielding governs, where the data says it does', async () => {
    for (const id of ['al', 'cu', 'steel1020']) {
      const mat = MECH_MATERIALS.find((m) => m.id === id)!;
      const beh = getFatigueBehaviour(id);
      expect(beh.ratio * mat.uts).toBeGreaterThan(mat.yield);
      const t = await renderPanel(`#/failure?panel=mean&m=${id}&smax=300&R=0`);
      expect(rowValue(t, /^Governing/)).toMatch(/Yield/);
      expect(t.closest('section')!.textContent).toMatch(/yielding governs at every/);
      cleanup();
      window.location.hash = '';
    }
  });

  it('says whose criteria these are', async () => {
    await renderPanel('#/failure?panel=mean');
    expect(document.body.textContent).toMatch(/Shigley/);
  });
});
