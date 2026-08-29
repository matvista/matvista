// @vitest-environment jsdom
/**
 * Rendering gate for Miller labels — the class the source scan cannot close.
 *
 * `diffraction.test.ts` scans `src` and `scripts` for spellings that
 * concatenate h, k and l with nothing between them. That scan has now been
 * defeated twice, and it will be again: it enumerates source forms, and there
 * are unboundedly many. `<span>{[h, k, l]}</span>` has no operator, no
 * template literal and no adjacent braces — React joins an array child with
 * nothing, so it prints (11,1,1) as "1111" — and it passed all 882 assertions
 * of the shipped suite. So did `` {`${h}·${k}${l}`} ``, because the pattern was
 * anchored on `h}${` and could not see a pair beginning at k.
 *
 * This file asserts the other end. Whatever a label is built from, it has to
 * arrive on screen separated, and here that is checked against `familyLabel`
 * applied to the model's own indices — not against a list of strings, which
 * would go stale the first time the pattern changed.
 *
 * LABEL GUARD EXEMPTION: this file names the broken forms deliberately.
 * `diffraction.test.ts`'s repo-wide scan would otherwise flag the examples
 * quoted above, which are here precisely because they are what a label must
 * never be built from.
 *
 * **Its limit, stated rather than left implicit.** It covers what the XRD
 * route paints, and nothing else. Miller, defects and the other eight modules
 * are still on the source scan alone. A label built off-screen, or on a panel
 * this file does not open, is not covered here.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { XRD_SAMPLES, XRD_SOURCES, computePattern, familyLabel } from '../xrd/diffraction';

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
// Resolve the lazy route modules before anything is timed. Without this the
// first render in the file pays a cold dynamic import inside a `waitFor`
// budget meant for a render — see route-warmup.ts.
await warmRoutes('xrd');

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
  await waitFor(() => expect(screen.getByRole('columnheader', { name: 'hkl' })).toBeDefined());
}

/** The hkl column, in the order the table lists it. */
const renderedLabels = () =>
  [...document.querySelectorAll('th[scope="row"]')].map((n) => n.textContent!.trim());

const sample = (id: string) => XRD_SAMPLES.find((s) => s.id === id)!;
const source = (id: string) => XRD_SOURCES.find((s) => s.id === id)!;

/**
 * Silicon under Mo Kα, because it is the pair that reaches two-digit indices
 * at all: 79 reflections inside the 2θ ≤ 140° window, including (10,2,0),
 * (11,1,1), (13,5,3) and (10,10,0). Under Cu Kα silicon has six lines, none
 * of them multi-digit, and every broken form in the world renders those
 * correctly.
 */
describe('the XRD peak table prints separated Miller labels', () => {
  it('lists exactly the model’s reflections, each formatted', async () => {
    await renderRoute('#/xrd?sample=si&source=mo');
    const s = sample('si');
    const peaks = computePattern(s.lattice, s.a, source('mo').lambda, 140);
    expect(renderedLabels()).toEqual(peaks.map((p) => familyLabel(p.h, p.k, p.l)));
  });

  /**
   * Without this the case above is satisfied by a pattern with no multi-digit
   * family in it, which is every pattern that cannot go wrong.
   */
  it('reaches enough two-digit families for the separation to matter', async () => {
    await renderRoute('#/xrd?sample=si&source=mo');
    const multi = renderedLabels().filter((t) => t.includes(','));
    expect(renderedLabels()).toHaveLength(79);
    expect(multi.length).toBeGreaterThanOrEqual(20);
    expect(multi).toContain('10,2,0');
    expect(multi).toContain('11,1,1');
    expect(multi).toContain('10,10,0');
  });

  /**
   * The backstop, and the part that does not care how the label was built: a
   * concatenated multi-digit family is a run of four or more digits with
   * nothing between them, and no legitimate string this route paints is that.
   * `familyLabel` puts commas in exactly the cases that would otherwise
   * produce one, so the count of such runs is zero — checked over every text
   * node the module renders, chart labels and extinction chips included, not
   * only the table.
   */
  it.each([
    ['#/xrd?sample=si&source=mo'],
    ['#/xrd?sample=cu&source=mo'],
    ['#/xrd?sample=po&source=cr'],
    ['#/xrd?sample=w&source=co'],
  ])('%s: paints no run of four or more digits anywhere', async (hash) => {
    await renderRoute(hash);
    const offenders: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      // `<style>` is not painted text: the app's stylesheet is in the document
      // and its hex colours read as digit runs.
      if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
      // The *direct* text children of each element, joined — not each text
      // node on its own. React renders an array child as one text node per
      // element, so `{[10, 2, 0]}` is three nodes reading "10", "2", "0"
      // that a reader sees as "1020"; scanning nodes individually would miss
      // the very form this file was written for.
      const text = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent ?? '')
        .join('');
      // Guarded against a decimal point on either side, so "0.5431 nm" and
      // "43.32°" are not runs — a decimal separates its own digits.
      for (const m of text.matchAll(/(?<![\d.])\d{4,}(?![\d.])/g)) offenders.push(m[0]);
    }
    expect(offenders).toEqual([]);
  });

  /**
   * And the same for the reflection-rule chips, which are a second, separate
   * call site for `familyLabel` — the one 11ea25d said it had converted and
   * had not.
   */
  it('formats the reflection-rule chips too', async () => {
    await renderRoute('#/xrd?sample=si&source=mo');
    const chips = [...document.querySelectorAll('.xrd-chip')]
      .map((n) => n.textContent!.trim().split(' ·')[0])
      .filter((t) => /^\d/.test(t));
    expect(chips.length).toBeGreaterThan(8);
    for (const c of chips) {
      // Every chip is a family this module could also have printed unseparated.
      expect(c).toMatch(/^(\d{1,3}|\d{1,2},\d{1,2},\d{1,2})$/);
      const digits = c.includes(',') ? c.split(',') : [...c];
      expect(familyLabel(Number(digits[0]), Number(digits[1]), Number(digits[2]))).toBe(c);
    }
  });
});
