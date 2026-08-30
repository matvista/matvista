// @vitest-environment jsdom
/**
 * Behavioural gate for the diode and Hall panels (P9, P11).
 *
 * The models are asserted in `electronic/junction.test.ts`. What matters here
 * is that the two refusals are reachable and visible — the normalised current
 * axis, and the single-carrier reading being withheld near intrinsic. A
 * refusal that exists only in the model is a footnote; the plan's whole point
 * is that it should be a behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  carriers,
  hallCoefficient,
  hallSingleCarrierValid,
  intrinsicCarriers,
  millivoltsPerDecade,
} from '../electronic/model';
import { getSemiconductor } from '../electronic/materials';

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

async function renderPanel(hash: string, ready: RegExp) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByText(ready)).toBeDefined());
  return document.querySelector('section.dd-block') as HTMLElement;
}

const rowValue = (box: HTMLElement, heading: RegExp) =>
  [...box.querySelectorAll('tr')]
    .find((r) => heading.test(r.querySelector('th')?.textContent ?? ''))
    ?.querySelector('td')?.textContent ?? '';

describe('the diode panel', () => {
  it.each([200, 300, 500])('prints the model’s own slope at %s K', async (T) => {
    const box = await renderPanel(`#/semiconductors?panel=diode&T=${T}`, /mV per decade/);
    expect(rowValue(box, /^Slope/)).toBe(`${millivoltsPerDecade(T).toFixed(1)} mV per decade`);
  });

  /** The normalisation is a scope decision and has to be visible as one. */
  it('says the current axis is normalised, and why', async () => {
    const box = await renderPanel('#/semiconductors?panel=diode', /mV per decade/);
    expect(box.textContent).toMatch(/normalised/i);
    expect(box.textContent).toMatch(/lifetimes|diffusion lengths/);
  });

  it('plots a curve and marks the operating point', async () => {
    await renderPanel('#/semiconductors?panel=diode&V=0.5', /mV per decade/);
    const svg = document.querySelector('svg[aria-label^="Diode current"]')!;
    expect(svg.querySelectorAll('polyline')).toHaveLength(1);
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
  });
});

describe('the Hall panel', () => {
  it.each([
    ['n', 'n-type'],
    ['p', 'p-type'],
  ])('reads %s doping back as %s', async (type, shown) => {
    const box = await renderPanel(
      `#/semiconductors?panel=hall&type=${type}&dope=18&T=300`,
      /Hall coefficient/,
    );
    expect(rowValue(box, /Carrier type/)).toBe(shown);
  });

  /**
   * The refusal, and it must be reachable by moving the controls the panel
   * offers: light doping and a hot sample is exactly where the single-carrier
   * reading stops meaning anything.
   */
  it('refuses the single-carrier reading near intrinsic', async () => {
    const mat = getSemiconductor('si');
    const ni = intrinsicCarriers(mat.carriers!.ni300, mat.Eg, 800);
    const c = carriers(ni, 10 ** 13 * 1e6, 0);
    expect(hallSingleCarrierValid(c, mat.mu_e, mat.mu_h!)).toBe(false);

    const box = await renderPanel(
      '#/semiconductors?panel=hall&type=n&dope=13&T=800',
      /Hall coefficient/,
    );
    expect(box.textContent).toMatch(/Refused/);
    expect(rowValue(box, /Concentration recovered/)).toMatch(/not a single-carrier sample/);
  });

  it('allows it again once the sample is strongly doped', async () => {
    const box = await renderPanel(
      '#/semiconductors?panel=hall&type=n&dope=19&T=300',
      /Hall coefficient/,
    );
    expect(box.textContent).not.toMatch(/Refused/);
    expect(rowValue(box, /Concentration recovered/)).toMatch(/cm/);
  });

  /** The sign is the whole argument, so it must actually flip. */
  it('flips the voltage sign between n-type and p-type', async () => {
    const mat = getSemiconductor('si');
    const ni = intrinsicCarriers(mat.carriers!.ni300, mat.Eg, 300);
    const n = hallCoefficient(carriers(ni, 1e24, 0), mat.mu_e, mat.mu_h!);
    const p = hallCoefficient(carriers(ni, 0, 1e24), mat.mu_e, mat.mu_h!);
    expect(Math.sign(n)).toBe(-Math.sign(p));

    const boxN = await renderPanel('#/semiconductors?panel=hall&type=n&dope=18', /Hall voltage/);
    const vN = Number(rowValue(boxN, /Hall voltage/).replace(' mV', ''));
    cleanup();
    window.location.hash = '';
    const boxP = await renderPanel('#/semiconductors?panel=hall&type=p&dope=18', /Hall voltage/);
    const vP = Number(rowValue(boxP, /Hall voltage/).replace(' mV', ''));
    expect(Math.sign(vN)).toBe(-Math.sign(vP));
  });
});
