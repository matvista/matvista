// @vitest-environment jsdom
/**
 * S12's cross-module link, followed.
 *
 * The XRD module's extinction chips say "allowed" or "extinct" and link into
 * the Miller module, which answers the same question. Nothing checked that the
 * two answers agree, and they did not: Miller reads its lattice off its
 * **selected metal**, not off the `s` param the link sets, so a sample with no
 * entry in `crystal/metals.ts` linked to a page that had fallen back to copper.
 * Six of polonium's twelve chips read "allowed" here and "extinct" on arrival,
 * and silicon's (111) went from 28.44° to copper's 43.32°.
 *
 * A model-level test comparing `isAllowed` with `isAllowed` would restate the
 * implementation. This one renders the XRD route, takes the hrefs off the
 * anchors as a reader would click them, renders the Miller route at each, and
 * compares what the two pages actually say.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { XRD_SAMPLES, XRD_SOURCES } from '../xrd/diffraction';

// The Miller route draws a unit cell. jsdom has no WebGL and no
// ResizeObserver, and nothing here is about the 3D view, so the two entry
// points into it are stubbed and the rest of the module renders for real.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
}));

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

const xrdReady = () => screen.getByRole('columnheader', { name: 'hkl' });
const millerReady = () => screen.getByLabelText('Crystal structure');

/** The extinction chips, as { label, allowed, href }. */
const chips = () =>
  [...document.querySelectorAll('.xrd-extinct .xrd-chip')].map((el) => ({
    label: el.textContent!.trim().split(' ·')[0],
    allowed: !el.classList.contains('xrd-off'),
    href: el.getAttribute('href'),
  }));

/** What the Miller module says about the plane it was linked to. */
function millerVerdict() {
  const rows = [...screen.getAllByRole('row')];
  const find = (re: RegExp) =>
    rows.find((r) => re.test(r.querySelector('th')?.textContent ?? ''))?.querySelector('td')
      ?.textContent ?? null;
  return { reflection: find(/^Reflection in /), twoTheta: find(/^2θ,/) };
}

describe('the XRD extinction chips link somewhere that agrees with them', () => {
  /**
   * The five samples that are also entries in `crystal/metals.ts`. Every
   * allowed chip on these is a link, and following it must reproduce the same
   * verdict — and, now that the link carries the anode, the same angle.
   */
  const LINKED = ['cu', 'al', 'fe', 'w', 'cr'];
  const UNLINKED = ['si', 'po'];

  /** The 2θ cell of the peak table's row for `label`, or null if it has none. */
  const tableAngle = (label: string) => {
    const th = [...document.querySelectorAll('th[scope="row"]')].find(
      (n) => n.textContent!.trim() === label,
    );
    return th?.parentElement?.querySelector('td')?.textContent ?? null;
  };

  it.each(LINKED)('%s: every allowed chip is a link, at every anode', async (id) => {
    for (const src of XRD_SOURCES) {
      await renderRoute(`#/xrd?sample=${id}&source=${src.id}`, xrdReady);
      const all = chips();
      expect(all).toHaveLength(12);
      const linked = all.filter((c) => c.href != null);
      expect(linked.map((c) => c.label)).toEqual(
        all.filter((c) => c.allowed).map((c) => c.label),
      );
      expect(linked.length).toBeGreaterThan(0);
      // Each link carries the metal and the anode, or the page it opens is
      // answering about a different crystal or at a different wavelength.
      for (const c of linked) {
        expect(c.href, c.label).toContain(`&metal=`);
        expect(c.href, c.label).toContain(`&source=${src.id}`);
      }
      cleanup();
    }
  });

  /**
   * Following them. Two anodes rather than four — the verdict does not depend
   * on the anode and the angle does, so Cu Kα and Mo Kα between them exercise
   * both a reachable and an out-of-reach reflection without rendering the
   * Miller route 240 times.
   */
  it.each(LINKED)('%s: the page each link opens says the same thing', async (id) => {
    for (const srcId of ['cu', 'mo']) {
      await renderRoute(`#/xrd?sample=${id}&source=${srcId}`, xrdReady);
      const linked = chips().filter((c) => c.href != null);
      const angles = Object.fromEntries(linked.map((c) => [c.label, tableAngle(c.label)]));
      cleanup();

      let checkedAngles = 0;
      for (const c of linked) {
        await renderRoute(c.href!, millerReady);
        const v = millerVerdict();
        expect(v.reflection, `${id}/${srcId} ${c.label}`).toBe('allowed');
        // The chip's family may be outside the plotted 2θ window, in which
        // case the table has no row for it and there is nothing to compare.
        if (angles[c.label] != null) {
          expect(v.twoTheta, `${id}/${srcId} ${c.label}`).toBe(angles[c.label]);
          checkedAngles++;
        }
        cleanup();
      }
      expect(checkedAngles, `${id}/${srcId}: no angle was compared`).toBeGreaterThan(0);
    }
  });

  /**
   * Silicon and polonium have no metal entry, so there is nowhere honest to
   * link. The chips stay — they are the reflection rule, which is the point of
   * the panel — but they are not anchors, and the panel says why.
   */
  it.each(UNLINKED)('%s: the chips are not links, and the panel says why', async (id) => {
    await renderRoute(`#/xrd?sample=${id}&source=cu`, xrdReady);
    const all = chips();
    expect(all.length).toBe(12);
    expect(all.filter((c) => c.allowed).length).toBeGreaterThan(0);
    expect(all.filter((c) => c.href != null)).toEqual([]);
    expect(screen.getByText(/These indices are not links/)).toBeDefined();
  });

  /** Every shipped sample is one case or the other, so nothing is unchecked. */
  it('covers every shipped sample', () => {
    expect([...LINKED, ...UNLINKED].sort()).toEqual(XRD_SAMPLES.map((s) => s.id).sort());
  });
});
