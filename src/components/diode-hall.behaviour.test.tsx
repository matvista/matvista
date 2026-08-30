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
import { SEMICONDUCTORS, getSemiconductor } from '../electronic/materials';

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

describe('every material id the app knows is safe to land on', () => {
  /**
   * `cds`, `gap` and `znte` are valid ids with no carrier data. The panels
   * read `carriers!.ni300` off whatever `getSemiconductor` returned, which for
   * a *known* id is that material — so a hand-typed hash threw, and with no
   * error boundary in the app that is a white screen. `useRouteNumber`'s
   * docstring promises the URL cannot drive a control outside its domain; the
   * material select had no such guard.
   */
  it.each(SEMICONDUCTORS.map((s) => s.id))('diode renders for m=%s', async (id) => {
    const box = await renderPanel(`#/semiconductors?panel=diode&m=${id}`, /mV per decade/);
    expect(box.textContent).toMatch(/mV per decade/);
  });

  it.each(SEMICONDUCTORS.map((s) => s.id))('hall renders for m=%s', async (id) => {
    const box = await renderPanel(`#/semiconductors?panel=hall&m=${id}`, /Hall coefficient/);
    expect(box.textContent).toMatch(/Hall coefficient/);
  });

  /** And the select shows the material actually being computed, not another. */
  it('never labels the selector with a material it is not modelling', async () => {
    for (const id of ['gap', 'cds', 'si']) {
      await renderPanel(`#/semiconductors?panel=diode&m=${id}`, /mV per decade/);
      const sel = document.querySelector('select[aria-label="Material"]') as HTMLSelectElement;
      const shown = sel.options[sel.selectedIndex].textContent;
      const chosen = getSemiconductor(sel.value);
      expect(shown).toBe(chosen.name);
      expect(chosen.carriers).not.toBeNull();
      cleanup();
      window.location.hash = '';
    }
  });
});

describe('the diode plot stays inside its own canvas', () => {
  /**
   * The y-axis was fixed at twelve decades while the curve's height depends on
   * temperature, so the operating point left the top of the plot over the
   * whole upper bias range below 336 K — with the table beside it still
   * printing the value.
   */
  it.each([
    [300, 0.8],
    [200, 0.8],
    [120, 0.6],
    [800, 0.8],
    [300, -1],
  ])('at %s K and %s V the marker is on the canvas', async (T, V) => {
    await renderPanel(`#/semiconductors?panel=diode&T=${T}&V=${V}`, /mV per decade/);
    const svg = document.querySelector('svg[aria-label^="Diode current"]')!;
    const box = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const c = svg.querySelector('circle')!;
    const cy = Number(c.getAttribute('cy'));
    const cx = Number(c.getAttribute('cx'));
    expect(cy).toBeGreaterThanOrEqual(box[1]);
    expect(cy).toBeLessThanOrEqual(box[1] + box[3]);
    expect(cx).toBeGreaterThanOrEqual(box[0]);
    expect(cx).toBeLessThanOrEqual(box[0] + box[2]);
  });

  /** The depletion story the panel claims, actually shown and actually moving. */
  it('narrows the depletion region in forward bias and widens it in reverse', async () => {
    const widthAt = async (V: number) => {
      const box = await renderPanel(`#/semiconductors?panel=diode&m=si&T=300&V=${V}`, /Depletion width/);
      const t = rowValue(box, /^Depletion width/);
      cleanup();
      window.location.hash = '';
      return t;
    };
    const rev = await widthAt(-5);
    const zero = await widthAt(0);
    const fwd = await widthAt(0.3);
    const nm = (t: string) => Number(t.split(' ')[0]);
    expect(nm(rev)).toBeGreaterThan(nm(zero));
    expect(nm(fwd)).toBeLessThan(nm(zero));
  });
});
