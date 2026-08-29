// @vitest-environment jsdom
/**
 * The band-gap chart's wavelength axis, measured off the drawing.
 *
 * The comment on `NM_TICKS` used to say the ticks "crowd together toward the
 * right" and that the visible band is "squeezed into its right-hand third".
 * Both are backwards: the axis is linear in energy, λ = hc/E, so a fixed Δλ
 * covers *more* of it the shorter the wavelength, and the visible band sits in
 * the middle and right rather than the right-hand third.
 *
 * Asserted from the rendered tick positions rather than from the constants, so
 * this measures the axis a reader sees and not the arithmetic behind it — it
 * would catch a scale that stopped being linear in energy as readily as a
 * changed tick list.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { photonEnergy } from '../electronic/model';

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
// Resolve the lazy route modules before anything is timed. Without this the
// first render in the file pays a cold dynamic import inside a `waitFor`
// budget meant for a render — see route-warmup.ts.
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

/** The nm ticks as { nm, x }, in the order they are drawn. */
function ticks() {
  return [...document.querySelectorAll('text.dd-tick')]
    .map((n) => ({ nm: Number(n.textContent), x: Number(n.getAttribute('x')) }))
    .filter((t) => Number.isFinite(t.nm) && t.nm >= 300 && Number.isFinite(t.x));
}

beforeEach(async () => {
  window.location.hash = '#/semiconductors';
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByLabelText('Temperature, K')).toBeDefined());
});

describe('the wavelength axis on the band-gap chart', () => {
  it('draws the ticks the constant lists, left to right in wavelength', () => {
    const t = ticks();
    expect(t.map((v) => v.nm)).toEqual([2000, 1200, 800, 600, 500, 450, 400, 360]);
    // Shorter wavelength is higher energy is further right.
    for (let i = 1; i < t.length; i++) expect(t[i].x).toBeGreaterThan(t[i - 1].x);
  });

  /**
   * The axis is linear in energy: recovered from two ticks and checked against
   * the rest. Everything below is measured in fractions of that plot width.
   */
  const scale = () => {
    const t = ticks();
    const e = (nm: number) => photonEnergy(nm)!;
    const first = t[0];
    const last = t[t.length - 1];
    const perEv = (last.x - first.x) / (e(last.nm) - e(first.nm));
    const x0 = first.x - e(first.nm) * perEv;
    for (const v of t) expect(x0 + e(v.nm) * perEv).toBeCloseTo(v.x, 6);
    // EV_MAX is where the axis ends, so the plot is that many eV wide.
    return { perEv, x0, widthEv: 3.6 };
  };

  it('spreads equal wavelength steps toward the right, not the left', () => {
    const { perEv, widthEv } = scale();
    const plotW = perEv * widthEv;
    const step = (from: number) =>
      ((photonEnergy(from - 200)! - photonEnergy(from)!) * perEv) / plotW;
    expect(step(2000)).toBeCloseTo(0.0191, 4);
    expect(step(1000)).toBeCloseTo(0.0861, 4);
    expect(step(800)).toBeCloseTo(0.1435, 4);
    expect(step(600)).toBeCloseTo(0.287, 4);
    // Fifteen times wider at the right-hand end than at the left.
    expect(step(600) / step(2000)).toBeCloseTo(15.0, 1);
    // Monotone, which is the direction claim itself.
    for (const from of [2000, 1800, 1600, 1400, 1200, 1000, 800]) {
      expect(step(from - 200)).toBeGreaterThan(step(from));
    }
  });

  /**
   * The drawn ticks, unlike equal wavelength steps, come out roughly evenly
   * spaced — the list is chosen to undo the spreading, which is what the
   * comment now says and what the old one obscured.
   */
  it('keeps the drawn ticks within a factor of two of each other', () => {
    const t = ticks();
    const { perEv, widthEv } = scale();
    const plotW = perEv * widthEv;
    const gaps = t.slice(1).map((v, i) => (v.x - t[i].x) / plotW);
    expect(Math.min(...gaps)).toBeCloseTo(0.0765, 3);
    expect(Math.max(...gaps)).toBeCloseTo(0.1435, 3);
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(2);
  });

  it('puts the visible band across the middle and right, not the right-hand third', () => {
    const { perEv, x0, widthEv } = scale();
    const plotW = perEv * widthEv;
    const at = (nm: number) => (x0 + photonEnergy(nm)! * perEv - x0) / plotW;
    // 750 nm and 400 nm, the ends of the visible band.
    expect(at(750)).toBeCloseTo(0.459, 3);
    expect(at(400)).toBeCloseTo(0.861, 3);
    expect(at(400) - at(750)).toBeCloseTo(0.402, 3);
    // A right-hand third would start past 0.667. It does not.
    expect(at(750)).toBeLessThan(2 / 3);
  });
});
