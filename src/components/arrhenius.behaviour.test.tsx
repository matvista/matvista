// @vitest-environment jsdom
/**
 * Behavioural gate for the Arrhenius panel (M1).
 *
 * `activationFromPair` is asserted in `diffusion/model.test.ts`. This checks
 * that the panel recovers the *selected* system's constants — the easy defect
 * here is reading the first system in the array, or the wrong temperature
 * pair, both of which still print a plausible kJ/mol.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { DIFFUSION_SYSTEMS, activationFromPair, diffusionCoefficient } from '../diffusion/model';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
await warmRoutes('defects');

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

/**
 * The value in one named row. Reading the whole panel's text is not enough:
 * it also contains the "Tabulated" row, and since recovery is exact the two
 * strings are identical — an assertion over the panel passes on the tabulated
 * row even when the recovered one is computed from the wrong system.
 */
function rowValue(box: HTMLElement, heading: RegExp): string {
  const row = [...box.querySelectorAll('tr')].find((r) => heading.test(r.querySelector('th')?.textContent ?? ''));
  return row?.querySelector('td')?.textContent ?? '';
}

async function renderPanel(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByText(/Reading Q/)).toBeDefined());
  return screen.getByText(/Reading Q/).closest('div')!;
}

describe('the panel recovers the selected system’s constants', () => {
  it.each(DIFFUSION_SYSTEMS.map((s) => s.id))('%s', async (id) => {
    const sys = DIFFUSION_SYSTEMS.find((s) => s.id === id)!;
    const box = await renderPanel(`#/defects?sys=${id}&aT1=700&aT2=1100`);
    const fit = activationFromPair(
      973.15,
      diffusionCoefficient(sys, 973.15),
      1373.15,
      diffusionCoefficient(sys, 1373.15),
    )!;
    expect(rowValue(box, /^Recovered Q/)).toBe(`${(fit.Qd / 1000).toFixed(1)} kJ/mol`);
    expect(rowValue(box, /^Recovered D/)).toBe(`${fit.D0.toExponential(2)} m²/s`);
    // Recovery is exact, so it must equal the tabulated value too — but that
    // is asserted here, on the numbers, not by matching the panel's text.
    expect((fit.Qd / 1000).toFixed(1)).toBe((sys.Qd / 1000).toFixed(1));
    expect(rowValue(box, /^Tabulated/)).toContain(`${(sys.Qd / 1000).toFixed(1)} kJ/mol`);
  });

  /**
   * Every system is drawn, not only the selected one — the comparison between
   * the two mechanism families is the reason the plot exists.
   */
  it('draws one line per tabulated system, and highlights the selected one', async () => {
    await renderPanel('#/defects?sys=c-fe-bcc');
    const svg = document.querySelector('svg[aria-label^="Arrhenius plot"]')!;
    const lines = [...svg.querySelectorAll('polyline')];
    expect(lines).toHaveLength(DIFFUSION_SYSTEMS.length);
    const bold = lines.filter((l) => Number(l.getAttribute('stroke-width')) >= 3);
    expect(bold).toHaveLength(1);
  });

  it('moves the highlight when the system changes', async () => {
    const widthOf = (i: number) =>
      Number(
        [...document.querySelectorAll('svg[aria-label^="Arrhenius plot"] polyline')][i].getAttribute(
          'stroke-width',
        ),
      );
    await renderPanel('#/defects?sys=c-fe-bcc');
    const first = widthOf(0);
    cleanup();
    window.location.hash = '';
    await renderPanel('#/defects?sys=fe-fe-fcc');
    expect(widthOf(0)).not.toBe(first);
  });

  /** Both measurement points are plotted, and they move with the sliders. */
  it('plots the two measurement points where the sliders put them', async () => {
    await renderPanel('#/defects?sys=c-fe-fcc&aT1=500&aT2=1300');
    const svg = document.querySelector('svg[aria-label^="Arrhenius plot"]')!;
    const pts = [...svg.querySelectorAll('circle')];
    expect(pts).toHaveLength(2);
    // Colder is to the right on a 1/T axis, so the 500 °C point is right of the 1300 °C one.
    expect(Number(pts[0].getAttribute('cx'))).toBeGreaterThan(Number(pts[1].getAttribute('cx')));
  });
});
