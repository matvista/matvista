// @vitest-environment jsdom
/**
 * Behavioural gate for the junction-profile panel (P13).
 *
 * The model is asserted in `electronic/doping.test.ts`. Here: that the two
 * boundary conditions are visibly different, that the junction depth on screen
 * is the model's, and that both refusals — no junction, and an over-driven
 * profile — are reachable and explained.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  driveInJunction,
  predepositionDose,
  predepositionJunction,
} from '../electronic/doping';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
await warmRoutes('semiconductors');

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

async function renderProfile(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByText(/Junction depth/)).toBeDefined());
  return document.querySelector('section.dd-block') as HTMLElement;
}

const rowValue = (box: HTMLElement, heading: RegExp) =>
  [...box.querySelectorAll('tr')]
    .find((r) => heading.test(r.querySelector('th')?.textContent ?? ''))
    ?.querySelector('td')?.textContent ?? '';

const M3 = 1e6; // cm⁻³ → m⁻³

describe('the junction depth on screen is the model’s', () => {
  it.each([
    [60, 20, 15],
    [120, 20, 15],
    [200, 19, 16],
  ])('predeposition at √(Dt)=%s nm, Cs=1e%s, CB=1e%s', async (rdt, cs, cb) => {
    const box = await renderProfile(
      `#/semiconductors?panel=profile&step=predep&rdt=${rdt}&Cs=${cs}&CB=${cb}`,
    );
    const xj = predepositionJunction(10 ** (cs as number) * M3, 10 ** (cb as number) * M3, ((rdt as number) * 1e-9) ** 2)!;
    expect(rowValue(box, /Junction depth/)).toBe(`${(xj * 1e9).toFixed(0)} nm`);
  });

  it('drive-in uses the dose from the predeposition step', async () => {
    const box = await renderProfile(
      '#/semiconductors?panel=profile&step=drivein&rdt=200&rdt0=20&Cs=20&CB=15',
    );
    const Q = predepositionDose(1e20 * M3, (20e-9) ** 2);
    const xj = driveInJunction(Q, 1e15 * M3, (200e-9) ** 2)!;
    expect(rowValue(box, /Junction depth/)).toBe(`${(xj * 1e9).toFixed(0)} nm`);
  });

  /**
   * The contrast the panel exists for: the surface is pinned in one step and
   * falls in the other.
   */
  it('holds the surface in predeposition and lets it fall in drive-in', async () => {
    const a = await renderProfile('#/semiconductors?panel=profile&step=predep&rdt=60&Cs=20');
    const surfA = rowValue(a, /Surface concentration/);
    cleanup();
    window.location.hash = '';
    const b = await renderProfile('#/semiconductors?panel=profile&step=predep&rdt=400&Cs=20');
    expect(rowValue(b, /Surface concentration/)).toBe(surfA);

    cleanup();
    window.location.hash = '';
    const c = await renderProfile(
      '#/semiconductors?panel=profile&step=drivein&rdt=60&rdt0=20&Cs=20',
    );
    const surfC = rowValue(c, /Surface concentration/);
    cleanup();
    window.location.hash = '';
    const d = await renderProfile(
      '#/semiconductors?panel=profile&step=drivein&rdt=400&rdt0=20&Cs=20',
    );
    expect(rowValue(d, /Surface concentration/)).not.toBe(surfC);
  });
});

describe('both refusals are reachable and explained', () => {
  it('says there is no junction when the background is not overcome', async () => {
    const box = await renderProfile(
      '#/semiconductors?panel=profile&step=predep&rdt=60&Cs=18&CB=18',
    );
    expect(rowValue(box, /Junction depth/)).toBe('no junction');
    expect(box.textContent).toMatch(/never overcomes/);
  });

  it('says an over-driven profile erases its own junction', async () => {
    const box = await renderProfile(
      '#/semiconductors?panel=profile&step=drivein&rdt=600&rdt0=5&Cs=18&CB=18',
    );
    expect(rowValue(box, /Junction depth/)).toBe('no junction');
    expect(box.textContent).toMatch(/erases it/);
  });

  it('draws the junction marker only when there is one', async () => {
    await renderProfile('#/semiconductors?panel=profile&step=predep&rdt=60&Cs=20&CB=15');
    const svg = document.querySelector('svg[aria-label^="Dopant concentration"]')!;
    expect([...svg.querySelectorAll('text')].some((t) => t.textContent === 'x_j')).toBe(true);
    cleanup();
    window.location.hash = '';
    await renderProfile('#/semiconductors?panel=profile&step=predep&rdt=60&Cs=18&CB=18');
    const svg2 = document.querySelector('svg[aria-label^="Dopant concentration"]')!;
    expect([...svg2.querySelectorAll('text')].some((t) => t.textContent === 'x_j')).toBe(false);
  });

  it('names the approximation it is showing the failure of', async () => {
    const box = await renderProfile('#/semiconductors?panel=profile&rdt=60&Cs=20&CB=15');
    expect(box.textContent).toMatch(/abrupt-junction/);
    expect(box.textContent).toMatch(/Fick/);
  });
});
