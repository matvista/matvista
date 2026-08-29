// @vitest-environment jsdom
/**
 * A garbage value in the URL must land on the default the code declares.
 *
 * Every select in this module took its default twice: once as the fallback
 * given to `useRouteString`, and once as an `?? list[n]` where the lookup
 * missed. The two disagreed. `useRouteString('cm', 'Iron')` resolved through
 * `metals.find(…) ?? metals[0]`, so `#/corrosion?panel=cell&cm=Unobtanium`
 * selected the first EMF entry and not iron — an absent param and a mistyped
 * one landing on different metals. The couple panel's `?? GALVANIC_SERIES[19]`
 * *was* Carbon steel, but positionally: inserting an alloy above it would have
 * moved the default with no test noticing.
 *
 * Asserted at the rendered `<select>`, because that is where the disagreement
 * showed: the declared default and the resolved one are the same control.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { EMF_SERIES, GALVANIC_SERIES, POURBAIX } from '../corrosion/data';

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
// Resolve the lazy route modules before anything is timed. Without this the
// first render in the file pays a cold dynamic import inside a `waitFor`
// budget meant for a render — see route-warmup.ts.
await warmRoutes('corrosion');

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
  await waitFor(() => expect(screen.getByRole('tablist', { name: 'Corrosion topic' })).toBeDefined());
}

const selectValue = (label: string) =>
  (screen.getByLabelText(label) as HTMLSelectElement).value;

/** panel, param, select label, the declared default. */
const SELECTS: [string, string, string, string][] = [
  ['couple', 'a', 'First metal', 'Carbon steel'],
  ['couple', 'b', 'Second metal', 'Copper'],
  ['emf', 'metal', 'Metal', 'Zinc'],
  ['cell', 'cm', 'Metal', 'Iron'],
  ['pourbaix', 'm', 'Metal', 'fe'],
];

describe('every corrosion select resolves to the default it declares', () => {
  it.each(SELECTS)('%s ?%s: absent', async (panel, _param, label, fallback) => {
    await renderRoute(`#/corrosion?panel=${panel}`);
    expect(selectValue(label)).toBe(fallback);
  });

  it.each(SELECTS)('%s ?%s: not in the list', async (panel, param, label, fallback) => {
    await renderRoute(`#/corrosion?panel=${panel}&${param}=Unobtanium`);
    expect(selectValue(label)).toBe(fallback);
  });

  it.each(SELECTS)('%s ?%s: empty', async (panel, param, label, fallback) => {
    await renderRoute(`#/corrosion?panel=${panel}&${param}=`);
    expect(selectValue(label)).toBe(fallback);
  });

  /**
   * And a value that *is* in the list still works, or the guard above is
   * satisfied by a control that ignores its param entirely.
   */
  it.each([
    ['couple', 'a', 'First metal', 'Zinc'],
    ['emf', 'metal', 'Metal', 'Iron'],
    ['cell', 'cm', 'Metal', 'Copper'],
    ['pourbaix', 'm', 'Metal', 'zn'],
  ])('%s ?%s: a real value is honoured', async (panel, param, label, value) => {
    await renderRoute(`#/corrosion?panel=${panel}&${param}=${encodeURIComponent(value)}`);
    expect(selectValue(label)).toBe(value);
  });

  /**
   * The defaults are named as strings in the component, so they have to exist
   * in the data they select from — the failure mode a renamed alloy would
   * cause, which the rendered assertions above would report as a blank select
   * rather than as a missing entry.
   */
  it('every declared default is a member of the list it selects from', () => {
    const emfMetals = EMF_SERIES.filter((e) => e.metal).map((e) => e.metal);
    expect(GALVANIC_SERIES.map((g) => g.name)).toContain('Carbon steel');
    expect(GALVANIC_SERIES.map((g) => g.name)).toContain('Copper');
    expect(emfMetals).toContain('Zinc');
    expect(emfMetals).toContain('Iron');
    expect(POURBAIX.map((p) => p.id)).toContain('fe');
  });
});
