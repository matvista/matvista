// @vitest-environment jsdom
/**
 * Behavioural gate for the microstructure strip (M5).
 *
 * `coolingSequence` is asserted in `phase/cooling.test.ts`. Here: that the
 * strip is the sequence, that it is honestly labelled as schematic, and that
 * it is *deterministic* — a link that draws different grains each time it is
 * opened is decoration, not a diagram.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { PHASE_SYSTEMS, coolingSequence } from '../phase/systems';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
await warmRoutes('phase');

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

async function renderPhase(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByText(/Cooling it down/)).toBeDefined());
  return document.querySelector('.ms-strip') as HTMLElement;
}

const captions = (strip: HTMLElement) =>
  [...strip.querySelectorAll('.ms-caption')].map((c) => c.textContent ?? '');

describe('the strip is the cooling sequence', () => {
  it.each([
    ['pb-sn', 40, 100],
    ['pb-sn', 61.9, 100],
    ['fe-c', 0.4, 600],
    ['cu-ni', 35, 1100],
    // Stops above the eutectic, so the α + β card must not appear. Without a
    // case like this the strip could ignore the marker entirely and every
    // other row would still pass.
    ['pb-sn', 40, 200],
    ['fe-c', 0.4, 800],
  ])('%s at x=%s down to %s °C', async (sys, x, T) => {
    const strip = await renderPhase(`#/phase?sys=${sys}&x=${x}&T=${T}`);
    const system = PHASE_SYSTEMS.find((s) => s.id === sys)!;
    const stages = coolingSequence(system, x as number, system.tMax, T as number);
    expect(strip.querySelectorAll('.ms-fig')).toHaveLength(stages.length);
    const caps = captions(strip);
    stages.forEach((st, i) => {
      expect(caps[i]).toContain(st.region);
      expect(caps[i]).toContain(`${st.T.toFixed(0)} °C`);
    });
  });

  /**
   * The contrast the panel exists for: at the eutectic composition there is no
   * primary-α stage, so the strip is a card shorter and never shows α + L.
   */
  it('drops the primary-α card at the eutectic composition', async () => {
    const off = await renderPhase('#/phase?sys=pb-sn&x=40&T=100');
    const offCaps = captions(off);
    cleanup();
    window.location.hash = '';
    const on = await renderPhase('#/phase?sys=pb-sn&x=61.9&T=100');
    const onCaps = captions(on);

    expect(offCaps.some((c) => c.includes('α + L'))).toBe(true);
    expect(onCaps.some((c) => c.includes('α + L'))).toBe(false);
    expect(onCaps.length).toBeLessThan(offCaps.length);
    // Both still end in the same two phases.
    expect(offCaps.at(-1)).toContain('α + β');
    expect(onCaps.at(-1)).toContain('α + β');
  });

  /** The marker is the end of the walk, so raising it must shorten the strip. */
  it('shortens as the marker is raised', async () => {
    const low = captions(await renderPhase('#/phase?sys=pb-sn&x=40&T=100')).length;
    cleanup();
    window.location.hash = '';
    const high = captions(await renderPhase('#/phase?sys=pb-sn&x=40&T=200')).length;
    expect(high).toBeLessThan(low);
    cleanup();
    window.location.hash = '';
    const strip = await renderPhase('#/phase?sys=pb-sn&x=40&T=200');
    expect(captions(strip).some((c) => c.includes('α + β'))).toBe(false);
  });

  /**
   * The number of solid grains drawn tracks the solid fraction: none while it
   * is all liquid, every cell once it is fully solid. Otherwise the picture is
   * the same whatever the lever rule says.
   */
  it('draws grains in proportion to how much has solidified', async () => {
    const solidGrains = (strip: HTMLElement) =>
      [...strip.querySelectorAll('.ms-fig')].map(
        (f) => [...f.querySelectorAll('polygon')].filter((p) => p.getAttribute('fill') === '#3987e5').length,
      );
    const strip = await renderPhase('#/phase?sys=cu-ni&x=35&T=1100');
    const counts = solidGrains(strip);
    // First card is all liquid, last is fully solid.
    expect(counts[0]).toBe(0);
    expect(counts.at(-1)).toBeGreaterThan(0);
    expect(counts.at(-1)).toBeGreaterThan(counts[1] ?? 0);
  });

  it('says it is schematic, and why the grains are not a measurement', async () => {
    await renderPhase('#/phase?sys=pb-sn&x=40&T=100');
    const box = screen.getByText(/Cooling it down/).closest('div')!;
    expect(box.textContent).toMatch(/Schematic/);
    expect(box.textContent).toMatch(/not a micrograph/);
  });
});

describe('the same link always draws the same picture', () => {
  const shapes = (strip: HTMLElement) =>
    [...strip.querySelectorAll('polygon')].map((p) => p.getAttribute('points')).join('|');

  it('is identical across two independent renders', async () => {
    const a = shapes(await renderPhase('#/phase?sys=pb-sn&x=40&T=150'));
    cleanup();
    window.location.hash = '';
    const b = shapes(await renderPhase('#/phase?sys=pb-sn&x=40&T=150'));
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(50);
  });

  it('differs for a different composition, so the seed is doing something', async () => {
    const a = shapes(await renderPhase('#/phase?sys=pb-sn&x=40&T=150'));
    cleanup();
    window.location.hash = '';
    const b = shapes(await renderPhase('#/phase?sys=pb-sn&x=30&T=150'));
    expect(a).not.toBe(b);
  });
});
