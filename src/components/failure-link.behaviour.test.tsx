// @vitest-environment jsdom
/**
 * Behavioural gate for pre-P8 failure links — the `?Y=` form, which carries a
 * geometry factor and no geometry.
 *
 * **Why the load path is not enough.** The regression this file exists to stop
 * resolved a legacy link *correctly on load* and then lost it on the first
 * drag: `geom`'s fallback was derived from `Y`'s presence in the hash, and
 * `useRouteNumber` deletes a param whose value formats identically to its
 * fallback. `Y`'s fallback is 1, so pulling the slider to exactly 1.00 removed
 * `Y`, which moved the fallback from `custom` to `centre` — a different
 * geometry, a different slider, and a different meaning for `a`. Every
 * assertion here therefore *interacts* first and reads afterwards.
 *
 * The whole app is rendered at the route rather than the panel on its own, so
 * the hash the reader would copy out of the address bar is what gets asserted.
 * No 3D module is on this route, so nothing is stubbed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CRACK_GEOMETRIES } from '../failure/model';

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
// Resolve the lazy route modules before anything is timed. Without this the
// first render in the file pays a cold dynamic import inside a `waitFor`
// budget meant for a render — see route-warmup.ts.
await warmRoutes('failure');

// jsdom ships no `matchMedia`, and the nav reads one on mount. Nothing here
// depends on what it answers, so it answers "no" to everything.
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

async function renderRoute(hash: string) {
  window.location.hash = hash;
  // Flush the hashchange from this assignment (and from the previous test's
  // cleanup) before mounting, or the route resets to the landing page a tick
  // after render.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByLabelText('Crack geometry')).toBeDefined());
  return screen.getByLabelText('Crack geometry') as HTMLSelectElement;
}

/** The hash as the address bar would hold it, past the 200 ms write debounce. */
async function settledHash() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300));
  });
  return window.location.hash;
}

const setSlider = async (label: string, value: string) => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  });
};

const geomSlidersOnScreen = () =>
  ['Crack across the width 2a/W', 'Geometry factor Y'].filter(
    (l) => screen.queryByLabelText(l) != null,
  );

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('a pre-P8 ?Y= link keeps its geometry through interaction', () => {
  // Both panels that carry the picker. The growth panel is included because the
  // legacy key was shared by both, so a fix that only reached the panel it was
  // found on would be a half fix.
  const ROUTES: [string, string][] = [
    ['fracture', '#/failure?Y=1.2'],
    ['growth', '#/failure?panel=growth&Y=1.35'],
  ];

  it.each(ROUTES)('%s: opens on the custom slider', async (_panel, hash) => {
    const select = await renderRoute(hash);
    expect(select.value).toBe('custom');
    expect(geomSlidersOnScreen()).toEqual(['Geometry factor Y']);
  });

  it.each(ROUTES)('%s: writes the resolved geometry into the hash', async (_panel, hash) => {
    await renderRoute(hash);
    expect(await settledHash()).toContain('geom=custom');
  });

  it.each(ROUTES)(
    '%s: dragging Y to exactly its old fallback does not change the geometry',
    async (_panel, hash) => {
      const select = await renderRoute(hash);
      await setSlider('Geometry factor Y', '1');
      // 1 is `Y`'s fallback, so the param is dropped from the URL here. That is
      // the trigger: nothing downstream may depend on `Y` still being present.
      expect(await settledHash()).not.toMatch(/[?&]Y=/);
      expect(select.value).toBe('custom');
      expect(geomSlidersOnScreen()).toEqual(['Geometry factor Y']);
      expect(screen.getByText(/a is whatever the chosen Y is defined against/)).toBeDefined();
    },
  );

  it('survives a panel switch after Y has dropped out of the hash', async () => {
    await renderRoute('#/failure?Y=1.2');
    await setSlider('Geometry factor Y', '1');
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Crack growth' }));
    });
    await waitFor(() => expect(screen.getByLabelText('Crack geometry')).toBeDefined());
    expect((screen.getByLabelText('Crack geometry') as HTMLSelectElement).value).toBe('custom');
  });

  it('leaves a link that names its geometry alone', async () => {
    const select = await renderRoute('#/failure?geom=finite&Y=1.2&aw=0.4');
    expect(select.value).toBe('finite');
    expect(geomSlidersOnScreen()).toEqual(['Crack across the width 2a/W']);
  });

  it('still defaults a link with neither key to the centre crack', async () => {
    const select = await renderRoute('#/failure');
    expect(select.value).toBe('centre');
    expect(await settledHash()).toBe('#/failure');
  });
});

/**
 * The picker, driven the way a reader drives it.
 *
 * The legacy-link tests above all arrive by URL. Nothing covered *selecting* a
 * geometry, and that is the path on which the module's own default geometry
 * was unreachable: `useRouteEnum` elides a param equal to its fallback, so
 * choosing the centre crack deleted `geom` from the hash, which re-satisfied
 * "no `geom`, but a `Y`" — the legacy test — which forced `custom` back on the
 * same render and rewrote `geom=custom` from the effect. Silently, and only
 * for the one id that is the fallback.
 */
describe('the picker honours the reader’s choice, whatever else is in the hash', () => {
  // Both panels share one hook, so a fix reaching only the one it was found on
  // would be a half fix — the same reason the legacy block covers both.
  const PANELS: [string, string][] = [
    ['fracture', '#/failure'],
    ['growth', '#/failure?panel=growth'],
  ];

  const picker = () => screen.getByLabelText('Crack geometry') as HTMLSelectElement;

  const selectGeom = async (id: string) => {
    await act(async () => {
      fireEvent.change(picker(), { target: { value: id } });
    });
  };

  it.each(PANELS)('%s: every geometry can be chosen from a clean start', async (_panel, hash) => {
    await renderRoute(hash);
    for (const g of CRACK_GEOMETRIES) {
      await selectGeom(g.id);
      expect(picker().value, g.id).toBe(g.id);
    }
  });

  /**
   * The blocking case, in the three interactions that reach it from `#/failure`
   * with no legacy link anywhere: pick Custom Y, move the slider so `Y` is in
   * the hash, then pick the default back.
   */
  it.each(PANELS)(
    '%s: the default geometry is still choosable once Y is in the hash',
    async (_panel, hash) => {
      await renderRoute(hash);
      await selectGeom('custom');
      await setSlider('Geometry factor Y', '1.3');
      expect(await settledHash()).toMatch(/[?&]Y=1\.3\b/);

      await selectGeom('centre');
      expect(picker().value).toBe('centre');
      // The centre crack carries neither geometry slider; Custom Y carries one.
      expect(geomSlidersOnScreen()).toEqual([]);
      // And it must still be centre after the debounced write lands, not bounce
      // back once the hash settles.
      await settledHash();
      expect(picker().value).toBe('centre');
    },
  );

  it.each(PANELS)(
    '%s: every geometry stays chosen with a Y already in the hash',
    async (_panel, hash) => {
      await renderRoute(hash);
      await selectGeom('custom');
      await setSlider('Geometry factor Y', '1.3');
      for (const g of CRACK_GEOMETRIES) {
        await selectGeom(g.id);
        expect(picker().value, `${g.id} with Y present`).toBe(g.id);
      }
    },
  );

  /**
   * The choice has to survive being shared, not just being made. A hash that
   * renders as one geometry in the tab that produced it and another in a fresh
   * one is the same defect wearing a link.
   */
  it('round-trips the chosen default through the hash it produces', async () => {
    await renderRoute('#/failure');
    await selectGeom('custom');
    await setSlider('Geometry factor Y', '1.3');
    await selectGeom('centre');
    const shared = await settledHash();

    cleanup();
    const reopened = await renderRoute(shared);
    expect(reopened.value, shared).toBe('centre');
  });
});
