// @vitest-environment jsdom
/**
 * M12's austenitising control, and the one place its invariance is not benign.
 *
 * `predict` is deliberately independent of the start temperature: every C-curve
 * is anchored at A₁ and nothing above it transforms, so the products and the
 * hardness are identical whether you start at 730 °C or 1050 °C. That is a
 * consequence on the high side and an error on the low side — a steel
 * austenitised below A₃ never fully became austenite, so part of the section
 * cannot transform at all and stays soft whatever the quench, and the model
 * hardens it anyway.
 *
 * The independence is asserted here rather than assumed, because it is what
 * makes the caveat necessary; and the caveat is asserted as rendered, because
 * the headline is what a reader takes away.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { STEELS, getSteel } from '../heattreat/steels';
import { buildTtt, predict } from '../heattreat/model';
import { FE_C, boundaryTemperature } from '../phase/systems';

const { default: App } = await import('../App');

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

async function renderRoute(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByLabelText('Steel')).toBeDefined());
}

const headline = () => document.querySelector('.detail .crystal-title')!.textContent!;

describe('austenitising below A₃', () => {
  /**
   * The invariance the caveat exists because of. If this ever stopped holding,
   * the caveat would be describing a model that no longer behaves that way.
   */
  it.each(STEELS.map((s) => s.id))('%s: the hardness does not depend on the start temperature', (id) => {
    const steel = getSteel(id);
    const ttt = buildTtt(steel);
    for (const rate of [1, 10, 100, 1000]) {
      const at = (T: number) => predict(steel, ttt, T, rate).hardness;
      const reference = at(850);
      for (const T of [730, 780, 900, 1050]) expect(at(T)).toBe(reference);
    }
  });

  /**
   * 5140 at 780 °C: A₃ is above that, so the equilibrium field is α + γ and
   * about a quarter of the section is ferrite that never dissolves.
   */
  it('reproduces the case the caveat is written for', () => {
    const steel = getSteel('5140');
    const a3 = boundaryTemperature(FE_C, 'A₃', steel.composition.C)!;
    expect(a3).toBeGreaterThan(780);
    const ferrite =
      FE_C.evaluate(steel.composition.C, 780).phases.find((p) => p.name === 'α')?.fraction ?? 0;
    expect(ferrite).toBeCloseTo(0.27018, 5);
  });

  it('qualifies the headline hardness and says why', async () => {
    await renderRoute('#/heattreat?steel=5140&austT=780');
    expect(headline()).toMatch(/HRC of the austenitised part$/);
    expect(screen.getByText(/Not the hardness of the part\./)).toBeDefined();
    expect(screen.getByText(/27% of this steel is still ferrite when the quench starts/)).toBeDefined();
  });

  /**
   * And above A₃ it does not, or the qualifier would be noise on every reading
   * rather than a signal on the ones that need it.
   */
  it.each([['5140', 850], ['4340', 850], ['1080', 780]])(
    '%s at %i °C: no qualifier, because none is owed',
    async (id, T) => {
      await renderRoute(`#/heattreat?steel=${id}&austT=${T}`);
      expect(headline()).toMatch(/^\d+ HRC$/);
      expect(screen.queryByText(/Not the hardness of the part\./)).toBeNull();
    },
  );

  /** The number the qualifier is attached to is still the model's own. */
  it('leaves the hardness figure itself alone', async () => {
    const steel = getSteel('5140');
    const expected = predict(steel, buildTtt(steel), 780, 50).hardness.toFixed(0);
    await renderRoute('#/heattreat?steel=5140&austT=780&rate=50');
    expect(headline()).toBe(`${expected} HRC of the austenitised part`);
  });
});
