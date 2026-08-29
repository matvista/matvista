// @vitest-environment jsdom
/**
 * What each module announces when a control moves.
 *
 * A live region is a promise about *what changed*. Wrapping a whole results
 * pane in one and then growing the pane breaks that promise quietly: nothing
 * looks wrong, the markup still validates, and a screen-reader user gets the
 * entire panel read out on every step of a spin box.
 *
 * These assertions are about the size and contents of the announced text, not
 * about the presence of an attribute, because presence is what was already
 * true when the defect was introduced.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { SEMICONDUCTORS } from '../electronic/materials';

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
// Resolve the lazy route modules before anything is timed. Without this the
// first render in the file pays a cold dynamic import inside a `waitFor`
// budget meant for a render — see route-warmup.ts.
await warmRoutes('phase', 'semiconductors');

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

async function renderRoute(hash: string, ready: () => unknown) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(ready()).toBeDefined());
}

/** Every polite live region on the page, as normalised text. */
const announced = () =>
  [...document.querySelectorAll('[aria-live="polite"]')]
    .map((n) => n.textContent!.replace(/\s+/g, ' ').trim())
    // The app header announces the current module name; not this module's.
    .filter((t) => t.length > 40);

describe('the phase diagram announces the result, not the whole pane', () => {
  const ready = () => screen.getByLabelText('Phase system');

  it('announces the field, the point and the phase fractions', async () => {
    await renderRoute('#/phase?sys=pb-sn&x=40&T=200', ready);
    expect(announced()).toHaveLength(1);
    const [text] = announced();
    expect(text).toContain('α + L');
    expect(text).toContain('40.00 wt% Sn · 200 °C');
    expect(text).toMatch(/α\s*\d+\.\d% · C = /);
  });

  /**
   * The bound is the point. M7 and M8 added the Gibbs phase rule, the invariant
   * list and the microconstituent panel inside the announced element, taking it
   * from 436 to 1688 characters — every one of which is re-read on each 1 °C
   * step of the temperature box.
   */
  it('keeps the announcement short enough to be an announcement', async () => {
    await renderRoute('#/phase?sys=pb-sn&x=40&T=200', ready);
    const [text] = announced();
    expect(text.length).toBeLessThan(200);
  });

  it('leaves the Gibbs rule and the microconstituent panel outside it', async () => {
    await renderRoute('#/phase?sys=pb-sn&x=40&T=200', ready);
    const [text] = announced();
    // Both are on the page…
    expect(screen.getByText(/Degrees of freedom F/)).toBeDefined();
    expect(screen.getByText(/Eutectic constituent/)).toBeDefined();
    // …and neither is in the announcement.
    expect(text).not.toContain('Degrees of freedom');
    expect(text).not.toContain('Eutectic constituent');
    expect(text).not.toContain('Invariant reactions');
  });

  /**
   * And it still announces: a live region that never changes is worse than
   * none, because it reads as working.
   */
  it('changes when the point moves', async () => {
    await renderRoute('#/phase?sys=pb-sn&x=40&T=200', ready);
    const a = announced()[0];
    cleanup();
    await renderRoute('#/phase?sys=pb-sn&x=42&T=200', ready);
    const b = announced()[0];
    expect(b).not.toBe(a);
    expect(b).toContain('42.00 wt% Sn');
  });
});

/**
 * The band-gap panel's photon slider had neither: its results pane carried no
 * live region while both sibling panels in the same module do, and the slider
 * itself announced only the number a reader had just set. The question that
 * control exists to answer — what absorbs and what stays transparent — reached
 * a screen-reader user nowhere at all.
 */
describe('the photon slider says what it is for', () => {
  const ready = () => screen.getByLabelText('Temperature, K');
  const photon = () =>
    document.querySelector('input[aria-label^="Illuminating photon"]') as HTMLInputElement;

  it('carries the answer in its value text, not just its value', async () => {
    await renderRoute('#/semiconductors', ready);
    const text = photon().getAttribute('aria-valuetext');
    expect(text).toBe('2.00 eV, 620 nm — absorbed by 4 of the 7, transparent to 3');
    // aria-valuetext replaces the announced number, so it has to carry it.
    expect(text).toContain('2.00 eV');
  });

  it('counts against the shipped data, at both ends of the slider', async () => {
    for (const [ph, absorbing] of [
      [0.3, 1],
      [1.0, 2],
      [2.0, 4],
      [3.5, 7],
    ] as [number, number][]) {
      const expected = SEMICONDUCTORS.filter((s) => ph >= s.Eg).length;
      expect(expected).toBe(absorbing);
      await renderRoute(`#/semiconductors?ph=${ph}`, ready);
      expect(photon().getAttribute('aria-valuetext')).toContain(
        `absorbed by ${absorbing} of the ${SEMICONDUCTORS.length}, transparent to ` +
          `${SEMICONDUCTORS.length - absorbing}`,
      );
      cleanup();
    }
  });

  it('announces the same sentence, and only that sentence', async () => {
    await renderRoute('#/semiconductors', ready);
    const live = announced().filter((t) => t.includes('absorbed by'));
    expect(live).toHaveLength(1);
    expect(live[0]).toBe(photon().getAttribute('aria-valuetext'));
    // Not the seven-row verdict table, which would be re-read on every step.
    expect(live[0]).not.toContain('transparent\n');
    expect(live[0].length).toBeLessThan(80);
    // …while the table is still on the page.
    expect(screen.getAllByText('absorbs').length).toBeGreaterThan(0);
  });

  it('changes with the slider', async () => {
    await renderRoute('#/semiconductors?ph=2', ready);
    const a = announced().find((t) => t.includes('absorbed by'))!;
    cleanup();
    await renderRoute('#/semiconductors?ph=1', ready);
    const b = announced().find((t) => t.includes('absorbed by'))!;
    expect(b).not.toBe(a);
    expect(b).toContain('1.00 eV, 1240 nm');
  });
});
