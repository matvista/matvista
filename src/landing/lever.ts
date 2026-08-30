/**
 * Drawing constants for the landing page's live lever rule.
 *
 * A separate file from `components/LeverRule.tsx` for two reasons. The small
 * one is that a module exporting both a component and plain constants defeats
 * fast refresh, and oxlint says so. The larger one is that
 * `lever-rule.behaviour.test.tsx` checks the *geometry* of the two bars — that
 * a segment's rendered width really is its fraction of the span, and that the
 * composition marker sits where the composition is. A test that restated those
 * numbers would be checking its own copy of them; importing them from here
 * means the assertion is about the component's arithmetic and nothing else.
 *
 * It sits beside `landing/lattice.ts` because it is the same kind of thing:
 * geometry the landing page owns, that no module imports.
 */

/**
 * The instrument's drawing box. Exported so `lever-rule.behaviour.test.tsx` can
 * do the same arithmetic the component does and compare, rather than restating
 * it.
 *
 * Row labels sit *above* their bars rather than in a left gutter. The gutter
 * version read better at full width and much worse everywhere else: it spent
 * 15% of an 1100-unit box on three words, and since the box scrolls rather than
 * shrinks below about 900 CSS px, that 15% was the part of the figure a phone
 * showed first. Labels on top cost 60 units of height, which nothing is
 * competing for, and give the bars the whole width.
 */
export const LEVER_GEOMETRY = {
  viewW: 1100,
  viewH: 226,

  /** The composition scale — the full width, matching the slider above it. */
  axisLeft: 6,
  axisRight: 1094,
  axisY: 34,

  /*
   * The bars are inset from the axis, and that inset is load-bearing rather
   * than decorative. Drawn edge to edge under a composition scale, a boundary
   * at 48.8 % of the width sits under 1.07 wt% C, and a reader will read it
   * there — two different quantities on one span, in a figure whose subject is
   * a tie line. The inset, plus the 0 % and 100 % in the gutters it opens, says
   * the bars are measured in something else.
   */
  barLeft: 42,
  barRight: 1052,
  barH: 30,

  microLabelY: 86,
  microY: 96,
  /** The bracket under the two pearlite segments, and its label. */
  bracketY: 134,
  bracketLabelY: 148,
  phaseLabelY: 180,
  phaseY: 190,
} as const;

/** Composition range of the control, wt% C.
 *
 *  Both ends are inside `eutectoidSplit`'s domain — 0.022 to 2.14 — and both
 *  0.76 and 2.14 land exactly on a step, so the eutectoid itself and the
 *  austenite solubility limit are reachable rather than jumped over. An earlier
 *  draft opened at 0.02, which is below the ferrite solubility limit, where the
 *  model correctly returns nothing at all. */
export const LEVER_RANGE = { min: 0.05, max: 2.14, step: 0.01 } as const;

/** The composition the page opens on, and the one the prose is written about. */
export const LEVER_DEFAULT = 0.4;
