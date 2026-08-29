// @vitest-environment jsdom
/**
 * Behavioural gate for the concentration-cell readout — A12.
 *
 * **Why a rendering test and not another model test.** The defect was not in
 * the model's arithmetic. `ConcentrationCellResult` carried two meanings of
 * "high" and "low" — potentials sorted by activity, an `anode` field named by
 * argument order — and the panel read one row's number off the other row's
 * ordering. Every model assertion passed while the screen showed the 0.0 mV
 * electrode labelled anode and the −118.3 mV one cathode, the inverse of this
 * module's own rule. Nothing but rendering the table catches that.
 *
 * The two activity sliders are independent (both −6…0), so the labelled
 * "open surface" is not necessarily the more concentrated electrode. Every
 * case here is driven through the URL, which is how a reader reaches it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

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
  await waitFor(() => expect(screen.getByRole('group', { name: 'Cell type' })).toBeDefined());
}

/** The one table row whose header is `label`, header and cell joined by a space. */
const row = (label: string) =>
  [...screen
    .getAllByRole('row')
    .find((r) => r.querySelector('th')?.textContent === label)!
    .querySelectorAll('th, td')]
    .map((c) => c.textContent!.replace(/\s+/g, ' ').trim())
    .join(' ');

describe('the concentration-cell table names the electrode it is quoting', () => {
  /**
   * The case the review reproduced: `ah` below `al`, so the open surface is
   * the depleted electrode and the crevice is the concentrated one. Before the
   * fix this printed "Open surface 0.0 mV — anode" and "Inside the crevice
   * −118.3 mV — cathode".
   */
  it('with the depleted electrode on the first slider', async () => {
    await renderRoute('#/corrosion?panel=cell&cm=Iron&ah=-4&al=0');
    expect(row('Open surface')).toBe('Open surface -118.3 mV — anode');
    expect(row('Inside the crevice')).toBe('Inside the crevice 0.0 mV — cathode');
    expect(screen.getByText(/driving the open surface anodic/)).toBeDefined();
  });

  /** The mirror. The same two numbers must change rows, not stay put. */
  it('with the depleted electrode on the second slider', async () => {
    await renderRoute('#/corrosion?panel=cell&cm=Iron&ah=0&al=-4');
    expect(row('Open surface')).toBe('Open surface 0.0 mV — cathode');
    expect(row('Inside the crevice')).toBe('Inside the crevice -118.3 mV — anode');
    expect(screen.getByText(/driving the inside the crevice anodic/)).toBeDefined();
  });

  /**
   * The rule this module states at model.ts:64 — the more negative electrode
   * is the one that corrodes — read off the rendered millivolts rather than
   * off the model, in both slider orderings and in both cell modes.
   */
  it.each([
    ['#/corrosion?panel=cell&cm=Iron&ah=-4&al=0', 'Open surface', 'Inside the crevice'],
    ['#/corrosion?panel=cell&cm=Iron&ah=0&al=-4', 'Open surface', 'Inside the crevice'],
    ['#/corrosion?panel=cell&cm=Zinc&ah=-1&al=-5', 'Open surface', 'Inside the crevice'],
    ['#/corrosion?panel=cell&cmode=oxygen&ah=-6&al=0', 'Aerated side', 'Starved side'],
    ['#/corrosion?panel=cell&cmode=oxygen&ah=0&al=-6', 'Aerated side', 'Starved side'],
  ])('%s: the anode is the more negative electrode', async (hash, first, second) => {
    await renderRoute(hash);
    const rows = [row(first), row(second)];
    const mv = (r: string) => Number(/(-?\d+\.\d) mV/.exec(r)![1]);
    expect(rows.filter((r) => r.endsWith('— anode'))).toHaveLength(1);
    expect(rows.filter((r) => r.endsWith('— cathode'))).toHaveLength(1);
    const anode = rows.find((r) => r.endsWith('— anode'))!;
    const cathode = rows.find((r) => r.endsWith('— cathode'))!;
    expect(mv(anode)).toBeLessThan(mv(cathode));
  });

  it('names neither electrode when the two sides are identical', async () => {
    await renderRoute('#/corrosion?panel=cell&cm=Iron&ah=-2&al=-2');
    expect(row('Open surface')).toBe('Open surface -59.2 mV');
    expect(row('Inside the crevice')).toBe('Inside the crevice -59.2 mV');
    expect(screen.getByText(/no driving force/)).toBeDefined();
  });
});
