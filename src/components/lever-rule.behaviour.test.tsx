// @vitest-environment jsdom
/**
 * Behavioural gate for the landing page's one live figure.
 *
 * The arithmetic is asserted in `phase/eutectoid.test.ts`, against the phase
 * module's own function, across the whole domain. Nothing there says the right
 * numbers reach the screen, and nothing there notices if the bars are drawn at
 * the wrong widths — which on a page whose argument is "computed, not drawn to
 * look right" would be the worst available failure.
 *
 * So this file renders the page and reads it:
 *
 *   - the four fractions the copy has always quoted are on screen at the
 *     default composition, which is what `docs.test.ts` used to assert about a
 *     string in the source and can no longer assert now that the page computes
 *     them (the model checked against itself would guard nothing);
 *   - the proeutectoid constituent flips at 0.76 wt% C, and *vanishes* exactly
 *     on it — three states, not two;
 *   - the two bars' geometry follows the fractions, so a marker or a segment
 *     cannot drift;
 *   - the live region stays one sentence, rather than re-announcing the whole
 *     readout on every step of a two-hundred-stop slider.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Landing } from './Landing';
import { LEVER_DEFAULT, LEVER_GEOMETRY, LEVER_RANGE } from '../landing/lever';
import { EUTECTOID_X, PEARLITE_FERRITE, asPercent, eutectoidSplit } from '../phase/eutectoid';

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

async function renderLanding() {
  await act(async () => {
    render(<Landing />);
  });
  return screen.getByLabelText('Carbon content') as HTMLInputElement;
}

async function setCarbon(slider: HTMLInputElement, value: number) {
  await act(async () => {
    fireEvent.change(slider, { target: { value: String(value) } });
  });
}

/** The readout, as `{ term: value }`. */
function readout(): Record<string, string> {
  const list = document.querySelector('.ld-live .ld-readout')!;
  const terms = [...list.querySelectorAll('dt')].map((n) => n.textContent!.trim());
  const values = [...list.querySelectorAll('dd')].map((n) => n.textContent!.trim());
  return Object.fromEntries(terms.map((t, i) => [t, values[i]]));
}

/** The rendered width of one bar segment, in viewBox units. */
function segmentWidth(key: string): number {
  const rect = document.querySelector(`.ld-live-seg[data-seg="${key}"]`);
  return rect ? Number(rect.getAttribute('width')) : Number.NaN;
}

describe('the worked example is live', () => {
  it('opens on the composition the prose is written about', async () => {
    const slider = await renderLanding();
    expect(Number(slider.value)).toBe(LEVER_DEFAULT);
    expect(Number(slider.min)).toBe(LEVER_RANGE.min);
    expect(Number(slider.max)).toBe(LEVER_RANGE.max);
  });

  it('shows the four fractions the page has always claimed for Fe–0.4 wt% C', async () => {
    await renderLanding();
    const rows = readout();
    expect(rows['Proeutectoid α (ferrite)']).toBe('48.8 %');
    expect(rows['Pearlite (α + Fe₃C)']).toBe('51.2 %');
    expect(rows['Total α (ferrite)']).toBe('94.3 %');
    expect(rows['Total Fe₃C (cementite)']).toBe('5.7 %');
  });

  it('flips the proeutectoid constituent from ferrite to cementite across 0.76', async () => {
    const slider = await renderLanding();

    await setCarbon(slider, 0.6);
    expect(Object.keys(readout())).toContain('Proeutectoid α (ferrite)');
    expect(Object.keys(readout())).not.toContain('Proeutectoid Fe₃C (cementite)');

    await setCarbon(slider, 1.2);
    expect(Object.keys(readout())).toContain('Proeutectoid Fe₃C (cementite)');
    expect(Object.keys(readout())).not.toContain('Proeutectoid α (ferrite)');
    expect(readout()['Pearlite (α + Fe₃C)']).toBe('92.6 %');
  });

  it('reports no proeutectoid phase at all at exactly the eutectoid', async () => {
    const slider = await renderLanding();
    await setCarbon(slider, EUTECTOID_X);

    const rows = readout();
    expect(rows['Pearlite (α + Fe₃C)']).toBe('100.0 %');
    expect(Object.keys(rows).filter((k) => k.startsWith('Proeutectoid'))).toHaveLength(0);
    expect(screen.getByText(/wholly pearlite/)).toBeDefined();
  });

  it('keeps both pairs summing to 100 % at every stop of the control', async () => {
    const slider = await renderLanding();
    const value = (s: string) => Number(s.replace(' %', ''));

    for (let x = LEVER_RANGE.min; x <= LEVER_RANGE.max + 1e-9; x += 0.07) {
      const carbon = Number(x.toFixed(2));
      await setCarbon(slider, carbon);
      const rows = readout();
      const micro = Object.entries(rows)
        .filter(([k]) => k.startsWith('Proeutectoid') || k.startsWith('Pearlite'))
        .map(([, v]) => value(v));
      const phase = Object.entries(rows)
        .filter(([k]) => k.startsWith('Total'))
        .map(([, v]) => value(v));

      // One decimal place each, so the rounded pair can miss by 0.1.
      expect(micro.reduce((a, b) => a + b, 0), `microconstituents at ${carbon}`).toBeCloseTo(100, 0);
      expect(phase.reduce((a, b) => a + b, 0), `phases at ${carbon}`).toBeCloseTo(100, 0);
    }
  });

  /**
   * The lesson the figure exists to draw, asserted as the geometry it is drawn
   * as: **the ferrite in the microconstituent bar adds up to the ferrite in the
   * phase bar**, so the boundary between the two colours falls at the same x in
   * both. Pearlite is itself 88.9 % ferrite, and that share is why.
   *
   * An earlier version of this test compared the phase bar's ferrite against
   * `segmentWidth('proeutectoid')` and substituted 0 above the eutectoid, which
   * made the assertion `width >= 0` for every hypereutectoid composition — the
   * half where the claim is actually interesting.
   */
  it('adds the microconstituent bar’s ferrite up to the phase bar’s, at every composition', async () => {
    const slider = await renderLanding();
    for (const carbon of [0.05, 0.2, 0.4, 0.75, EUTECTOID_X, 0.8, 1.0, 1.6, 2.14]) {
      await setCarbon(slider, carbon);
      const split = eutectoidSplit(carbon)!;
      const where = `at ${carbon} wt% C`;

      // Every ferrite-coloured segment of the top bar.
      const microFerrite =
        (Number.isFinite(segmentWidth('proeutectoid')) && carbon < EUTECTOID_X
          ? segmentWidth('proeutectoid')
          : 0) + segmentWidth('pearlite-ferrite');
      expect(microFerrite, where).toBeCloseTo(segmentWidth('ferrite'), 6);

      // And the cementite side, which is the interesting one above 0.76 —
      // there the proeutectoid segment is cementite and sits in the second run.
      const microCementite =
        segmentWidth('pearlite-cementite') +
        (Number.isFinite(segmentWidth('proeutectoid')) && carbon > EUTECTOID_X
          ? segmentWidth('proeutectoid')
          : 0);
      expect(microCementite, where).toBeCloseTo(segmentWidth('cementite'), 6);

      // The same identity in the model, which is what makes it drawable.
      const pearliteFerrite = split.pearliteFraction * PEARLITE_FERRITE;
      const modelFerrite =
        (carbon < EUTECTOID_X ? split.proeutectoidFraction : 0) + pearliteFerrite;
      expect(modelFerrite, where).toBeCloseTo(split.totalFerrite, 9);
    }
  });
});

/**
 * The plate cannot be checked by eye in a test, but it can be checked for
 * consistency with the numbers beside it. Every other figure on the page is
 * generated and guarded by `figures.test.ts`; this one is drawn at runtime, and
 * would otherwise be the one plate on the page with no drift guard at all.
 */
describe('the bars are drawn at the fractions they report', () => {
  const span = LEVER_GEOMETRY.barRight - LEVER_GEOMETRY.barLeft;
  const axisSpan = LEVER_GEOMETRY.axisRight - LEVER_GEOMETRY.axisLeft;

  it('sizes every segment to its own fraction of the bar', async () => {
    const slider = await renderLanding();
    for (const carbon of [0.05, 0.4, 1.2, 2.14]) {
      await setCarbon(slider, carbon);
      const split = eutectoidSplit(carbon)!;
      expect(
        segmentWidth('pearlite-ferrite') + segmentWidth('pearlite-cementite'),
        `pearlite at ${carbon}`,
      ).toBeCloseTo(split.pearliteFraction * span, 6);
      expect(segmentWidth('pearlite-ferrite'), `pearlite α at ${carbon}`).toBeCloseTo(
        split.pearliteFraction * PEARLITE_FERRITE * span,
        6,
      );
      expect(segmentWidth('proeutectoid'), `proeutectoid at ${carbon}`).toBeCloseTo(
        split.proeutectoidFraction * span,
        6,
      );
      expect(segmentWidth('ferrite'), `ferrite at ${carbon}`).toBeCloseTo(
        split.totalFerrite * span,
        6,
      );
      expect(segmentWidth('cementite'), `cementite at ${carbon}`).toBeCloseTo(
        split.totalCementite * span,
        6,
      );
    }
  });

  it('puts the composition marker where the composition is', async () => {
    const slider = await renderLanding();
    for (const carbon of [LEVER_RANGE.min, 0.4, EUTECTOID_X, LEVER_RANGE.max]) {
      await setCarbon(slider, carbon);
      const marker = document.querySelector('.ld-live-art circle')!;
      const want =
        LEVER_GEOMETRY.axisLeft +
        ((carbon - LEVER_RANGE.min) / (LEVER_RANGE.max - LEVER_RANGE.min)) * axisSpan;
      expect(Number(marker.getAttribute('cx')), `marker at ${carbon}`).toBeCloseTo(want, 6);
    }
  });
});

describe('what it announces, and what it does not', () => {
  /**
   * `live-regions.behaviour.test.tsx` exists because wrapping a results pane in
   * `aria-live` and then growing the pane re-reads the whole thing on every
   * keypress. The same trap is open here — the readout is a heading and four
   * rows — so the region is one sentence and this asserts the size, not the
   * presence of the attribute.
   */
  it('announces one sentence, not the whole readout', async () => {
    const slider = await renderLanding();
    await setCarbon(slider, 1.2);

    const regions = [...document.querySelectorAll('.ld [aria-live="polite"]')];
    expect(regions).toHaveLength(1);
    const text = regions[0].textContent!.replace(/\s+/g, ' ').trim();
    expect(text.length).toBeLessThan(110);
    expect(text).toContain(asPercent(eutectoidSplit(1.2)!.pearliteFraction));
    // The phase fractions belong to the table, which is not announced.
    expect(text).not.toContain('Total');
  });

  it('says the composition on the control rather than twice', async () => {
    const slider = await renderLanding();
    await setCarbon(slider, 1.25);
    expect(slider.getAttribute('aria-valuetext')).toBe('1.25 weight percent carbon');
    // And the name is the label, not an aria-label overriding it — WCAG 2.5.3.
    expect(slider.getAttribute('aria-label')).toBeNull();
    const region = document.querySelector('.ld [aria-live="polite"]')!;
    expect(region.textContent).not.toContain('1.25');
  });

  it('carries the composition through to the module link', async () => {
    const slider = await renderLanding();
    await setCarbon(slider, 1.2);
    const link = screen.getByText(/Open this steel in the phase module/).closest('a')!;
    expect(link.getAttribute('href')).toBe('#/phase?T=650&sys=fe-c&x=1.2');
  });
});
