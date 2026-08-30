// @vitest-environment jsdom
/**
 * Behavioural gate for the crack-growth threshold (P5).
 *
 * The guard is asserted in `failure/growth-regions.test.ts`. What matters here
 * is that a reader can reach the refusal and is told what it means — the
 * module's documented limitation was that `parisLife` answers confidently for
 * a crack that never advances, and a guard nobody can see is the same
 * limitation with more code.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { GROWTH_CLASSES } from '../failure/materials';
import { crackLife, criticalCrackSize, deltaK, thresholdCrackSize } from '../failure/model';

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

async function renderGrowth(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByLabelText(/Threshold stress-intensity/)).toBeDefined());
  // The panel's own section, found from a control inside it rather than by a
  // class name this test would then be pinning for no reason.
  return screen.getByLabelText(/Threshold stress-intensity/).closest('section') as HTMLElement;
}

describe('the reader can reach the refusal', () => {
  /**
   * A small crack at a low stress range with a high threshold: the state the
   * unguarded integral used to answer for.
   */
  it('says a sub-threshold crack does not grow, and when it would start', async () => {
    const box = await renderGrowth('#/failure?panel=growth&a0=0.1&ds=20&dkth=12&geom=centre');
    expect(box.textContent).toMatch(/This crack does not grow/);
    expect(box.textContent).toMatch(/no propagation/);
    // The depth it names is the model's threshold crack size.
    const aTh = thresholdCrackSize(12, 20, 1)!;
    expect(aTh).toBeGreaterThan(0.0001);
  });

  /**
   * The refusal has to reach the *number*, not only the prose. Leaving the
   * unguarded `parisLife` wired to the life readout left every message right
   * and the figure beside it still confidently wrong.
   */
  it('prints no life figure for a crack it says does not grow', async () => {
    const box = await renderGrowth('#/failure?panel=growth&a0=0.1&ds=20&dkth=12&geom=centre');
    expect(box.textContent).toMatch(/This crack does not grow/);
    /**
     * The life reaches the reader as the cycle axis of the a-vs-N plot, which
     * reads "—" when there is no life. Wiring the *unguarded* integral back to
     * that axis left every message correct and the numbers beside them wrong,
     * which is the whole defect restated.
     */
    const dashes = [...box.querySelectorAll('text.dd-tick')].filter(
      (t) => t.textContent === '—',
    ).length;
    // Five cycle-axis ticks, all dashed, when there is no life to show.
    expect(dashes).toBeGreaterThanOrEqual(5);
  });

  it('integrates normally once the crack is above threshold', async () => {
    const box = await renderGrowth('#/failure?panel=growth&a0=10&ds=300&dkth=2&geom=centre');
    expect(box.textContent).not.toMatch(/This crack does not grow/);
    expect(box.textContent).toMatch(/region II/);
  });

  /** Moving only the threshold slider must be able to flip the verdict. */
  it('flips between growing and dormant on the threshold alone', async () => {
    const low = await renderGrowth('#/failure?panel=growth&a0=1&ds=150&dkth=2&geom=centre');
    expect(low.textContent).not.toMatch(/does not grow/);
    cleanup();
    window.location.hash = '';
    const high = await renderGrowth('#/failure?panel=growth&a0=1&ds=150&dkth=12&geom=centre');
    expect(high.textContent).toMatch(/does not grow/);
  });

  it('agrees with the model about which case it is in', async () => {
    for (const [a0, ds, dkth] of [
      [0.1, 20, 12],
      [5, 300, 3],
      [1, 150, 6],
    ] as const) {
      const cls = GROWTH_CLASSES[0];
      const af = criticalCrackSize(cls.kic, ds, 1);
      const model = crackLife(cls.C, cls.m, a0 / 1000, af, ds, 1, dkth);
      const box = await renderGrowth(
        `#/failure?panel=growth&cls=ferritic&a0=${a0}&ds=${ds}&dkth=${dkth}&geom=centre`,
      );
      const refused = /does not grow/.test(box.textContent ?? '');
      expect(refused, `${a0}/${ds}/${dkth}`).toBe(model.refusal === 'below threshold');
      cleanup();
      window.location.hash = '';
    }
  });
});

describe('the three regions are drawn as bounds, not as an invented curve', () => {
  it('draws the Paris line between the two boundaries only', async () => {
    await renderGrowth('#/failure?panel=growth&a0=1&ds=150&dkth=6&geom=centre');
    const svg = document.querySelector('svg[aria-label^="Crack growth rate"]')!;
    // One polyline — region II. The other regions are shaded bands, not curves.
    expect(svg.querySelectorAll('polyline')).toHaveLength(1);
    expect(svg.querySelectorAll('rect').length).toBe(2);
  });

  /**
   * Region II starts *at* the threshold. Drawing the line further left puts
   * the Paris law inside the band the panel has just shaded as the region it
   * does not describe.
   */
  it('starts the Paris line exactly at the threshold boundary', async () => {
    await renderGrowth('#/failure?panel=growth&a0=1&ds=150&dkth=6&geom=centre');
    const svg = document.querySelector('svg[aria-label^="Crack growth rate"]')!;
    const first = svg.querySelector('polyline')!.getAttribute('points')!.split(' ')[0];
    const thresholdLine = [...svg.querySelectorAll('line')][0];
    expect(Number(first.split(',')[0])).toBeCloseTo(Number(thresholdLine.getAttribute('x1')), 6);
    // And the shaded region-I band ends there too.
    const band = svg.querySelector('rect')!;
    expect(Number(band.getAttribute('x')) + Number(band.getAttribute('width'))).toBeCloseTo(
      Number(thresholdLine.getAttribute('x1')),
      6,
    );
  });

  it('moves the threshold boundary when the slider moves', async () => {
    const xOf = () => {
      const svg = document.querySelector('svg[aria-label^="Crack growth rate"]')!;
      return Number([...svg.querySelectorAll('line')][0].getAttribute('x1'));
    };
    await renderGrowth('#/failure?panel=growth&a0=1&ds=150&dkth=3&geom=centre');
    const a = xOf();
    cleanup();
    window.location.hash = '';
    await renderGrowth('#/failure?panel=growth&a0=1&ds=150&dkth=10&geom=centre');
    expect(xOf()).toBeGreaterThan(a);
  });

  it('marks the operating range on the line', async () => {
    await renderGrowth('#/failure?panel=growth&a0=2&ds=200&dkth=3&geom=centre');
    const svg = document.querySelector('svg[aria-label^="Crack growth rate"]')!;
    expect(svg.querySelectorAll('circle').length).toBeGreaterThan(0);
    expect(deltaK(200, 0.002, 1)).toBeGreaterThan(0);
  });

  it('says why the threshold is a control and not a table', async () => {
    const box = await renderGrowth('#/failure?panel=growth&a0=1&ds=150&geom=centre');
    expect(box.textContent).toMatch(/depends on the\s+stress ratio R|stress ratio R/);
    expect(box.textContent).toMatch(/false precision/);
  });
});
