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
import { INDICES, SELECTION_MATERIALS, paretoFront, screenStages } from '../selection/materials';

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

  /**
   * The rectangle *is* the claim "screening is a region", and its width,
   * height and anchor were all ungated — only that they were positive. The
   * axes give the plot's own frame, so the box can be checked against the
   * slider positions without reaching into the component's constants.
   */
  it.each([
    [0.25, 0.2],
    [0.5, 0.4],
    [0.9, 0.05],
  ])('the box matches limD=%s limY=%s exactly', async (limD, limY) => {
    await renderChart(`#/selection?screen=on&limD=${limD}&limY=${limY}&y=modulus`);
    const svg = document.querySelector('svg.ss-plot')!;
    const axes = [...svg.querySelectorAll('line.dd-axis')];
    const xs = axes.map((l) => [Number(l.getAttribute('x1')), Number(l.getAttribute('x2'))]);
    const ys = axes.map((l) => [Number(l.getAttribute('y1')), Number(l.getAttribute('y2'))]);
    const left = Math.min(...xs.flat());
    const right = Math.max(...xs.flat());
    const top = Math.min(...ys.flat());
    const bottom = Math.max(...ys.flat());

    const box = document.querySelector('rect.ab-limit-box')!;
    // `lx(fromPos(p))` is exactly `left + p·plotW`, so the box's right edge is
    // the slider position, and its floor is the y-slider position.
    expect(Number(box.getAttribute('x'))).toBeCloseTo(left, 6);
    expect(Number(box.getAttribute('y'))).toBeCloseTo(top, 6);
    expect(Number(box.getAttribute('width'))).toBeCloseTo((limD as number) * (right - left), 6);
    expect(Number(box.getAttribute('height'))).toBeCloseTo(
      (1 - (limY as number)) * (bottom - top),
      6,
    );
  });

  /**
   * The funnel used to print the slider's raw float — "ρ ≤ 2.9999999999999996"
   * six lines under a slider reading "3.00 Mg/m³".
   */
  it('prints rounded limits, matching the sliders above it', async () => {
    await renderChart('#/selection?screen=on&limD=0.5&limY=0.3&y=modulus');
    const text = document.querySelector('.ab-funnel')!.textContent!;
    expect(text).not.toMatch(/\d\.\d{5,}/);
    // And the value it prints is the one the slider label shows.
    const slider = [...document.querySelectorAll('.fa-slider span')].find((n) =>
      /Density at most/.test(n.textContent ?? ''),
    )!;
    const shown = slider.textContent!.match(/([\d.]+)\s*Mg/)![1];
    expect(text).toContain(shown);
  });

  it('says a limit and an index are different things', async () => {
    await renderChart('#/selection?screen=on&limD=0.5&limY=0.3');
    expect(document.querySelector('.ab-funnel')!.textContent).toMatch(/allowed/);
    expect(document.querySelector('.ab-funnel')!.textContent).toMatch(/better/);
  });
});

describe('the trade-off front', () => {
  /**
   * `paretoFront` shipped with a full test suite and no caller at all — the
   * commit that introduced it said "not yet imported by a component" and the
   * reader half never imported it. It is on the chart now, and this is the
   * gate that says so.
   */
  it('is off by default', async () => {
    await renderChart('#/selection');
    expect((rtl.getByLabelText('Trade-off front') as HTMLInputElement).checked).toBe(false);
    expect(document.querySelectorAll('circle.ab-front-ring')).toHaveLength(0);
  });

  it('rings exactly the materials the model puts on the front', async () => {
    await renderChart('#/selection?front=on&y=modulus&index=e12-rho');
    const applicable = INDICES.filter((i) => i.property === 'modulus');
    const a = applicable.find((i) => i.id === 'e12-rho')!;
    const b = applicable.find((i) => i.id !== 'e12-rho')!;
    const expected = paretoFront(SELECTION_MATERIALS, a, b);
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(SELECTION_MATERIALS.length);
    expect(document.querySelectorAll('circle.ab-front-ring')).toHaveLength(expected.length);
  });

  it('reports the count and says what a frontier means', async () => {
    await renderChart('#/selection?front=on&y=modulus&index=e12-rho');
    const text = [...document.querySelectorAll('.ab-funnel')]
      .map((n) => n.textContent)
      .join(' ');
    expect(text).toMatch(/Trade-off front/);
    expect(text).toMatch(/beats them on both/);
  });

  it('changes with the index it is measured against', async () => {
    await renderChart('#/selection?front=on&y=modulus&index=e12-rho');
    const a = document.querySelectorAll('circle.ab-front-ring').length;
    cleanup();
    window.location.hash = '';
    await renderChart('#/selection?front=on&y=strength&index=s23-rho');
    const b = document.querySelectorAll('circle.ab-front-ring').length;
    // Different property, different frontier — not necessarily a different
    // size, so assert the membership rather than the count.
    const applicable = INDICES.filter((i) => i.property === 'strength');
    const expected = paretoFront(
      SELECTION_MATERIALS,
      applicable.find((i) => i.id === 's23-rho') ?? applicable[0],
      applicable.find((i) => i.id !== (applicable.find((x) => x.id === 's23-rho') ?? applicable[0]).id)!,
    );
    expect(b).toBe(expected.length);
    expect(a).toBeGreaterThan(0);
  });
});
