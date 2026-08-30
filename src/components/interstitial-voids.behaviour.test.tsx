// @vitest-environment jsdom
/**
 * Behavioural gate for the interstitial-hole overlay (S5/M4).
 *
 * The model is asserted in `crystal/interstitial.test.ts`. What that file
 * cannot say is whether any of it reaches the reader, so this one traces the
 * checkbox through the real `CrystalScene` to the meshes it draws, and reads
 * the panel the way someone looking at the page would.
 *
 * Only `<Canvas>` and `<OrbitControls>` are stubbed, for the reason given at
 * length in `auto-rotate.behaviour.test.tsx`: stubbing the scene itself would
 * put the thing under test below the stub. `<Canvas>` renders its children, so
 * the scene's `<mesh>` elements land in the DOM as unknown elements and can be
 * counted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { interstitialSites } from '../crystal/interstitial';
import { STRUCTURES, getStructure } from '../crystal/structures';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
await warmRoutes('crystals');

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

async function renderStructure(id: string) {
  window.location.hash = `#/crystals?s=${id}`;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByLabelText(/Interstitial holes/)).toBeDefined());
  return screen.getByLabelText(/Interstitial holes/) as HTMLInputElement;
}

const meshCount = () => document.querySelectorAll('mesh').length;

describe('the interstitial overlay reaches the scene', () => {
  /**
   * Positions, not sites-per-cell: the overlay draws every shared site on the
   * cell boundary, so FCC's four octahedral sites are thirteen spheres.
   */
  it.each([
    ['fcc', 21],
    ['bcc', 42],
    ['sc', 1],
  ])('%s: ticking the box adds %s meshes', async (id, expected) => {
    const box = await renderStructure(id);
    const before = meshCount();
    await act(async () => {
      fireEvent.click(box);
    });
    expect(meshCount() - before).toBe(expected as number);

    // And the count is the model's, not a number typed twice.
    const declared = (interstitialSites(getStructure(id)) ?? []).reduce(
      (t, s) => t + s.positions.length,
      0,
    );
    expect(expected).toBe(declared);
  });

  /**
   * The count alone let a mutation through that drew every hole at the host
   * radius: the spheres were there and were the wrong size, which is the one
   * thing the overlay exists to show. r3f props stringify into attributes
   * under the stub, so the drawn radius and centre can both be read back.
   */
  it.each(['fcc', 'bcc', 'sc'])('%s: every hole is drawn at the size that fits', async (id) => {
    const box = await renderStructure(id);
    await act(async () => {
      fireEvent.click(box);
    });
    const s = getStructure(id);
    const drawn = new Map<string, number>();
    for (const m of document.querySelectorAll('mesh')) {
      const geom = m.querySelector('sphereGeometry');
      const args = geom?.getAttribute('args');
      const pos = m.getAttribute('position');
      if (args && pos) drawn.set(pos, Number(args.split(',')[0]));
    }
    for (const set of interstitialSites(s)!) {
      const expected = set.radiusRatio / s.aOverR!;
      for (const p of set.positions) {
        const key = [p[0] - 0.5, p[1] - 0.5, p[2] - 0.5].join(',');
        expect(drawn.has(key), `${id} ${set.kind} at ${key}`).toBe(true);
        expect(drawn.get(key)!, `${id} ${set.kind} at ${key}`).toBeCloseTo(expected, 9);
      }
    }
  });

  it('draws nothing extra until it is asked to', async () => {
    const box = await renderStructure('fcc');
    expect(box.checked).toBe(false);
    const before = meshCount();
    await act(async () => {
      fireEvent.click(box);
    });
    await act(async () => {
      fireEvent.click(box);
    });
    expect(meshCount()).toBe(before);
  });
});

describe('the panel says what the structure can hold', () => {
  it('fcc: prints the octahedral and tetrahedral counts and ratios', async () => {
    await renderStructure('fcc');
    const rows = [...document.querySelectorAll('.density-box tr')].map((r) => r.textContent);
    expect(rows.some((t) => t?.includes('Octahedral') && t.includes('4') && t.includes('0.414'))).toBe(
      true,
    );
    expect(
      rows.some((t) => t?.includes('Tetrahedral') && t.includes('8') && t.includes('0.225')),
    ).toBe(true);
  });

  it('bcc: prints its own, and flags the octahedral site as not octahedral', async () => {
    await renderStructure('bcc');
    const box = screen.getByText(/The holes between the atoms/).closest('div')!;
    expect(box.textContent).toContain('0.155');
    expect(box.textContent).toContain('0.291');
    expect(box.textContent).toMatch(/not a regular octahedron/);
  });

  /**
   * The caption is the whole reason the distorted flag exists, so it must not
   * appear where the site is genuinely regular.
   */
  it('fcc: does not carry the distortion caption', async () => {
    await renderStructure('fcc');
    const box = screen.getByText(/The holes between the atoms/).closest('div')!;
    expect(box.textContent).not.toMatch(/not a regular octahedron/);
  });

  it('hcp: says why there is nothing to draw, and disables the control', async () => {
    const box = await renderStructure('hcp');
    expect(box.disabled).toBe(true);
    const panel = screen.getByText(/The holes between the atoms/).closest('div')!;
    expect(panel.textContent).toMatch(/Not defined here/);
  });

  it('offers the control on exactly the structures the model covers', async () => {
    for (const s of STRUCTURES) {
      const box = await renderStructure(s.id);
      expect(box.disabled).toBe(interstitialSites(s) == null);
      cleanup();
      window.location.hash = '';
    }
  });
});
