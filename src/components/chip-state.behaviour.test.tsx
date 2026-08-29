// @vitest-environment jsdom
/**
 * A selected chip carries its state in more than a colour.
 *
 * Three modules render `.mi-chip` buttons where one of the group is current:
 * the Miller plane family, the Jominy steel key and the equal-Dt equivalents.
 * `mi-chip-on` is a background colour and a font weight, so which one was
 * selected was available to a reader looking at the screen and to nobody else —
 * no `aria-pressed`, no `aria-current`, nothing in the accessible name.
 *
 * The distinction that matters is *selection* versus *shortcut*: the Miller
 * module's preset chips share the class and are not a selection — they fill a
 * text box and nothing stays pressed — so giving them a toggle state would be
 * a different lie. That boundary is asserted here too.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
// Resolve the lazy route modules before anything is timed. Without this the
// first render in the file pays a cold dynamic import inside a `waitFor`
// budget meant for a render — see route-warmup.ts.
await warmRoutes('miller', 'heattreat', 'defects');

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

async function renderRoute(hash: string, readySelector: string) {
  window.location.hash = hash;
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  // `not.toBeNull`, not `toBeDefined`: querySelector returns null when it finds
  // nothing, and null *is* defined — so the lazy module would be given no time
  // to arrive and every assertion below would run against an empty page.
  await waitFor(() => expect(document.querySelector(readySelector)).not.toBeNull());
}

const chipsIn = (selector: string) =>
  [...document.querySelectorAll(`${selector} button.mi-chip`)];

/** name, route, container of the selection group, expected selected label. */
const GROUPS: [string, string, string, string][] = [
  ['miller plane family', '#/miller?plane=111', '.mi-family .mi-family-list', '(111)'],
  ['jominy steel key', '#/heattreat?steel=4340', '.ht-jominy-key', '4340'],
  [
    'equal-Dt equivalents',
    '#/defects?panel=diffusion&sys=c-fe-fcc&difT=950&h=5',
    '.dd-equaldt .mi-family-list',
    '950 °C',
  ],
];

describe('a selected chip says so', () => {
  it.each(GROUPS)('%s', async (_name, hash, container, selectedLabel) => {
    await renderRoute(hash, container);
    const all = chipsIn(container);
    expect(all.length).toBeGreaterThan(1);
    for (const c of all) {
      // Every chip in the group carries the attribute, not only the selected
      // one: a button with no `aria-pressed` is not "off", it is "not a toggle".
      expect(c.getAttribute('aria-pressed')).toMatch(/^(true|false)$/);
      // …and it tracks the class, so the two cannot drift apart.
      expect(c.getAttribute('aria-pressed')).toBe(String(c.classList.contains('mi-chip-on')));
    }
    const on = all.filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(on).toHaveLength(1);
    expect(on[0].textContent).toContain(selectedLabel);
  });

  /**
   * The class is a colour and a weight and nothing else, which is why the
   * attribute is carrying the state rather than duplicating a visible marker.
   * If a tick or a "selected" ever appears in the label this fails and the
   * claim above needs rewording.
   */
  it('has no textual marker distinguishing the selected chip', async () => {
    await renderRoute('#/heattreat?steel=4340', '.ht-jominy-key');
    const all = chipsIn('.ht-jominy-key');
    const on = all.find((c) => c.classList.contains('mi-chip-on'))!;
    const off = all.find((c) => !c.classList.contains('mi-chip-on'))!;
    expect(on.textContent!.trim()).toMatch(/^\w+$/);
    expect(off.textContent!.trim()).toMatch(/^\w+$/);
  });

  /**
   * And the boundary: the Miller module's preset chips fill a text box. None
   * of them stays pressed, so none of them may claim to.
   */
  it('leaves the preset shortcuts without a toggle state', async () => {
    await renderRoute('#/miller?plane=111', '.mi-presets');
    const presets = chipsIn('.mi-presets');
    expect(presets.length).toBeGreaterThan(3);
    for (const c of presets) expect(c.getAttribute('aria-pressed')).toBeNull();
  });
});
