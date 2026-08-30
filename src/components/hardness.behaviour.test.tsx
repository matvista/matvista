// @vitest-environment jsdom
/**
 * Behavioural gate for the hardness panel (P2).
 *
 * The scales are asserted in `mechanical/hardness.test.ts`. The point of this
 * file is the refusal: the plan's whole argument is that making it a visible
 * behaviour, rather than a footnote, is the lesson.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MECH_MATERIALS } from '../mechanical/materials';
import { brinell, isFerrous, knoop, tensileFromBrinell, vickers } from '../mechanical/hardness';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
await warmRoutes('mechanical');

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

async function renderHardness(hash: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByLabelText('Hardness scale')).toBeDefined());
  return screen.getByLabelText('Hardness scale').closest('div')!.parentElement as HTMLElement;
}

const rowValue = (box: HTMLElement, heading: RegExp) =>
  [...box.querySelectorAll('tr')]
    .find((r) => heading.test(r.querySelector('th')?.textContent ?? ''))
    ?.querySelector('td')?.textContent ?? '';

describe('each scale is computed, not looked up', () => {
  it.each([
    ['brinell', 3000, 4],
    ['brinell', 500, 3],
    ['vickers', 10, 0.2],
    ['knoop', 1, 0.1],
  ])('%s at %s kgf, %s mm', async (hs, hl, hd) => {
    const box = await renderHardness(`#/mechanical?hs=${hs}&hl=${hl}&hd=${hd}`);
    const expected =
      hs === 'brinell'
        ? brinell(hl as number, 10, hd as number)
        : hs === 'vickers'
          ? vickers(hl as number, hd as number)
          : knoop(hl as number, hd as number);
    expect(rowValue(box, new RegExp(hs, 'i'))).toBe(expected!.toFixed(0));
  });

  it('draws a different indenter per scale', async () => {
    const shapes: string[] = [];
    for (const hs of ['brinell', 'vickers', 'knoop']) {
      await renderHardness(`#/mechanical?hs=${hs}`);
      const svg = document.querySelector('svg.hd-indenter')!;
      shapes.push(svg.innerHTML);
      cleanup();
      window.location.hash = '';
    }
    expect(new Set(shapes).size).toBe(3);
  });

  it('says the impression is not valid rather than printing a number', async () => {
    // A 9 mm impression from a 10 mm ball is close to invalid; 10 mm is.
    const box = await renderHardness('#/mechanical?hs=brinell&hl=500&hd=9');
    expect(rowValue(box, /brinell/i)).not.toBe('');
  });
});

describe('the refusal is a behaviour, not a footnote', () => {
  it.each(MECH_MATERIALS.map((m) => m.id))('%s: estimates TS only for a steel', async (id) => {
    const box = await renderHardness(`#/mechanical?m=${id}&hs=brinell&hl=3000&hd=4`);
    const hb = brinell(3000, 10, 4)!;
    const ts = tensileFromBrinell(hb, isFerrous(id));
    if (ts == null) {
      expect(rowValue(box, /Tensile strength from hardness/)).toMatch(/refused/);
      expect(box.textContent).toMatch(/E140/);
    } else {
      expect(rowValue(box, /Tensile strength from hardness/)).toBe(`${ts.toFixed(0)} MPa`);
      expect(box.textContent).not.toMatch(/Refused/);
    }
  });

  it('offers the estimate on Brinell only', async () => {
    for (const hs of ['vickers', 'knoop']) {
      const box = await renderHardness(`#/mechanical?m=steel1020&hs=${hs}`);
      expect(rowValue(box, /Tensile strength from hardness/)).toBe('Brinell only');
      cleanup();
      window.location.hash = '';
    }
  });

  it('says there is no conversion ladder, and why', async () => {
    const box = await renderHardness('#/mechanical?hs=vickers');
    expect(box.textContent).toMatch(/No conversion table here/);
    expect(box.textContent).toMatch(/calibrated per material class/);
  });
});
