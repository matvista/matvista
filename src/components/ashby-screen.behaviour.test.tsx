// @vitest-environment jsdom
/**
 * Behavioural gate for attribute-limit screening (A6).
 *
 * `screenStages` is asserted in `selection/screen.test.ts`. What this checks
 * is the thing the panel is for: that screening and ranking are visibly
 * different operations, that the funnel counts are the model's, and that a
 * material failing a hard limit is shown as out however good its index.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen as rtl, waitFor } from '@testing-library/react';
import { SELECTION_MATERIALS, screenStages } from '../selection/materials';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
await warmRoutes('selection');

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

async function renderChart(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(rtl.getByLabelText('Attribute limits')).toBeDefined());
}

/** density limit implied by a limD slider position, matching the component. */
const densityFor = (pos: number) => 10 ** (Math.log10(0.3) + pos * (Math.log10(30) - Math.log10(0.3)));

describe('screening is visibly a different operation from ranking', () => {
  it('is off by default, drawing no box and no funnel', async () => {
    await renderChart('#/selection');
    expect((rtl.getByLabelText('Attribute limits') as HTMLInputElement).checked).toBe(false);
    expect(document.querySelector('.ab-funnel')).toBeNull();
    // Marker shapes are rects too, so the box is selected by its own class.
    expect(document.querySelector('svg.ss-plot rect.ab-limit-box')).toBeNull();
  });

  it('draws the allowed region once limits are on', async () => {
    await renderChart('#/selection?screen=on&limD=0.5&limY=0.3');
    expect((rtl.getByLabelText('Attribute limits') as HTMLInputElement).checked).toBe(true);
    const box = document.querySelector('svg.ss-plot rect.ab-limit-box')!;
    expect(box).toBeDefined();
    expect(Number(box.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(box.getAttribute('height'))).toBeGreaterThan(0);
  });

  /** The counts on screen have to be the model's, not a second count. */
  it.each([
    [0.4, 0.2],
    [0.6, 0.35],
    [0.8, 0.1],
  ])('prints the model’s funnel for limD=%s limY=%s', async (limD, limY) => {
    await renderChart(`#/selection?screen=on&limD=${limD}&limY=${limY}&y=modulus`);
    const yFloor = 10 ** (Math.log10(0.001) + limY * (Math.log10(1200) - Math.log10(0.001)));
    const stages = screenStages(SELECTION_MATERIALS, {
      densityMax: densityFor(limD),
      modulusMin: yFloor,
    });
    const text = document.querySelector('.ab-funnel')!.textContent!;
    for (const st of stages) expect(text).toContain(String(st.survivors.length));
    expect(stages[stages.length - 1].survivors.length).toBeLessThanOrEqual(SELECTION_MATERIALS.length);
  });

  /**
   * A material outside the box is out regardless of its index — that is what
   * makes a limit a limit. Dimming is how the chart says so.
   */
  it('dims every screened-out material and no others', async () => {
    const limD = 0.3;
    const limY = 0.4;
    await renderChart(`#/selection?screen=on&limD=${limD}&limY=${limY}&y=modulus`);
    const yFloor = 10 ** (Math.log10(0.001) + limY * (Math.log10(1200) - Math.log10(0.001)));
    const survivors = new Set(
      SELECTION_MATERIALS.filter(
        (m) => m.density <= densityFor(limD) && m.modulus >= yFloor,
      ).map((m) => m.name),
    );
    const points = [...document.querySelectorAll('svg.ss-plot g.ab-point')];
    expect(points.length).toBe(SELECTION_MATERIALS.length);
    let dimmed = 0;
    for (const g of points) {
      const name = g.getAttribute('aria-label')!;
      const op = Number(g.getAttribute('opacity') ?? '1');
      if (survivors.has(name)) expect(op, name).toBe(1);
      else {
        expect(op, name).toBeLessThan(1);
        dimmed++;
      }
    }
    // Not vacuous: the screen has to actually remove something.
    expect(dimmed).toBeGreaterThan(0);
    expect(dimmed).toBeLessThan(SELECTION_MATERIALS.length);
  });

  it('says a limit and an index are different things', async () => {
    await renderChart('#/selection?screen=on&limD=0.5&limY=0.3');
    expect(document.querySelector('.ab-funnel')!.textContent).toMatch(/allowed/);
    expect(document.querySelector('.ab-funnel')!.textContent).toMatch(/better/);
  });
});
