// @vitest-environment jsdom
/**
 * Behavioural gate for the isothermal-hold panel (M10).
 *
 * `isothermalHold` is asserted in `heattreat/isothermal.test.ts`. What that
 * cannot say is whether the reader can reach the two cases the panel exists
 * for — austempering, and the refusal below Mˢ that introduces martempering.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { STEELS, getSteel } from '../heattreat/steels';
import { buildTtt, isothermalHold } from '../heattreat/model';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
await warmRoutes('heattreat');

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

async function renderHold(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByText(/Hold at temperature instead/)).toBeDefined());
  return screen.getByText(/Hold at temperature instead/).closest('div')!;
}

const rowValue = (box: HTMLElement, heading: RegExp) =>
  [...box.querySelectorAll('tr')]
    .find((r) => heading.test(r.querySelector('th')?.textContent ?? ''))
    ?.querySelector('td')?.textContent ?? '';

const bandProducts = (box: HTMLElement) =>
  [...box.querySelectorAll('.ht-frac-list li')].map((li) => li.textContent ?? '');

describe('the reader can reach both constructions', () => {
  it.each(STEELS.map((s) => s.id))('%s: a long hold in the bainite range leaves no martensite', async (id) => {
    const steel = getSteel(id);
    const ttt = buildTtt(steel);
    const T = Math.round((ttt.ms + steel.nose.temp) / 2);
    const box = await renderHold(`#/heattreat?steel=${id}&holdT=${T}&holdS=1000000`);
    const model = isothermalHold(steel, ttt, T, 1000000);
    expect(model.transformed).toBe(1);
    expect(rowValue(box, /^Transformed/)).toBe('100%');
    expect(bandProducts(box).join(' ')).not.toMatch(/martensite/);
  });

  it.each(STEELS.map((s) => s.id))('%s: below Mˢ the panel explains martempering', async (id) => {
    const ttt = buildTtt(getSteel(id));
    const T = Math.max(20, Math.round(ttt.ms) - 30);
    const box = await renderHold(`#/heattreat?steel=${id}&holdT=${T}&holdS=1000`);
    expect(box.textContent).toMatch(/[Mm]artemper/);
    expect(rowValue(box, /^Transformed/)).toBe('0%');
  });

  it('a short hold leaves the austenite untransformed', async () => {
    const steel = getSteel('1080');
    const ttt = buildTtt(steel);
    const T = Math.round((ttt.ms + ttt.a1) / 2);
    const box = await renderHold(`#/heattreat?steel=1080&holdT=${T}&holdS=0.1`);
    expect(rowValue(box, /^Transformed/)).toBe('0%');
    expect(bandProducts(box).join(' ')).toMatch(/martensite/);
  });

  it('prints the curve crossings the model reads at that temperature', async () => {
    const steel = getSteel('5140');
    const ttt = buildTtt(steel);
    const T = Math.round((ttt.ms + steel.nose.temp) / 2);
    const box = await renderHold(`#/heattreat?steel=5140&holdT=${T}&holdS=100`);
    const m = isothermalHold(steel, ttt, T, 100);
    expect(rowValue(box, /^Start \/ finish/)).toBe(
      `${m.tStart!.toFixed(1)} s / ${m.tFinish!.toFixed(0)} s`,
    );
  });

  it('draws the quench–hold–quench path and both curves', async () => {
    await renderHold('#/heattreat?steel=1080&holdT=400&holdS=100');
    const svg = document.querySelector('svg[aria-label^="Isothermal transformation path"]')!;
    expect(svg.querySelectorAll('polyline')).toHaveLength(3);
  });
});
