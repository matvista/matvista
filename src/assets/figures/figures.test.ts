import { describe, expect, it } from 'vitest';
import { IDX_H, IDX_W, buildFigures, gridRules } from '../../../scripts/gen-module-figures.ts';
import phaseCommitted from './PhaseFigure.tsx?raw';
import fatigueCommitted from './FatigueFigure.tsx?raw';
import ashbyCommitted from './AshbyFigure.tsx?raw';
import xrdCommitted from './XrdFigure.tsx?raw';
import indexCommitted from './ModuleIndexPlate.tsx?raw';
import { NAV_GROUPS } from '../../nav';
import elementsRaw from '../../data/elements.json';
import { EUTECTOID_T, EUTECTOID_X, FE_C } from '../../phase/systems';
import { MECH_MATERIALS } from '../../mechanical/materials';
import { FATIGUE_BEHAVIOUR, getFatigueBehaviour } from '../../failure/materials';
import { fatigueStrength, fitSn } from '../../failure/model';
import { INDICES, SELECTION_MATERIALS, indexValue } from '../../selection/materials';
import { XRD_SAMPLES, XRD_SOURCES, computePattern, familyLabel } from '../../xrd/diffraction';

/**
 * The landing page's figures are *generated* from the app's models and then
 * committed, so the page can paint without pulling four model modules into its
 * chunk. That makes them a cache, and a cache goes stale silently: change a
 * lattice parameter or a tensile strength and the front page keeps showing the
 * old curve, with nothing to say so.
 *
 * So the generator's rendering is re-run here, in process, against the same
 * data the app uses, and compared with what is on disk. A model change that
 * would move a line now fails the suite until the figures are regenerated:
 *
 *   node --experimental-strip-types scripts/gen-module-figures.ts
 *
 * What this file cannot assert is that a figure *looks* right — that labels
 * clear one another under real font metrics, that a curve is readable at
 * 300 px wide. Those were checked by eye when the plates were made, and the
 * collision arithmetic in the generator is an approximation of a renderer, not
 * a substitute for looking. Everything below is about the numbers.
 */

const committed: Record<string, string> = {
  'src/assets/figures/PhaseFigure.tsx': phaseCommitted,
  'src/assets/figures/FatigueFigure.tsx': fatigueCommitted,
  'src/assets/figures/AshbyFigure.tsx': ashbyCommitted,
  'src/assets/figures/XrdFigure.tsx': xrdCommitted,
  'src/assets/figures/ModuleIndexPlate.tsx': indexCommitted,
};

const generated = await buildFigures();
const sourceFor = (path: string): string => generated.find((g) => g.path === path)!.source;

describe('committed figures are in step with the models', () => {
  it('generates exactly the five committed files', () => {
    expect(generated.map((g) => g.path)).toEqual(Object.keys(committed));
  });

  for (const path of Object.keys(committed)) {
    it(`${path} matches what the generator produces today`, () => {
      // Line-by-line first: a whole-file diff of a 12 kB component is unreadable,
      // and the first differing line is what actually says what moved.
      const want = sourceFor(path).split('\n');
      const have = committed[path].split('\n');
      const firstDiff = want.findIndex((line, i) => line !== have[i]);
      if (firstDiff !== -1) {
        expect(`line ${firstDiff + 1}: ${have[firstDiff]}`).toBe(
          `line ${firstDiff + 1}: ${want[firstDiff]}`,
        );
      }
      expect(committed[path]).toBe(sourceFor(path));
    });
  }

  it('is deterministic, so a re-run does not churn the diff', async () => {
    const again = await buildFigures();
    expect(again.map((g) => g.source)).toEqual(generated.map((g) => g.source));
  });
});

/**
 * The equality checks above catch *any* drift but say nothing about what a
 * figure means. These assert the specific model output each plate exists to
 * show, so a failure names the thing that changed.
 */
describe('each figure carries the model output it claims to', () => {
  it('the phase plate marks the eutectoid at the module’s own invariant point', () => {
    const eutectoid = FE_C.invariants.find((i) => i.type === 'eutectoid')!;
    expect([eutectoid.x, eutectoid.T]).toEqual([EUTECTOID_X, EUTECTOID_T]);
    expect(sourceFor('src/assets/figures/PhaseFigure.tsx')).toContain(
      `Eutectoid — ${EUTECTOID_X.toFixed(2)} wt% C, ${EUTECTOID_T} °C`,
    );
  });

  it('the phase plate’s tie line is FE_C.evaluate(0.4, 650), lever rule included', () => {
    const point = FE_C.evaluate(0.4, 650);
    const [alpha, cementite] = point.phases;
    expect(point.region).toBe('α + Fe₃C');
    expect(sourceFor('src/assets/figures/PhaseFigure.tsx')).toContain(
      `${point.region}:  ${alpha.name} ${(alpha.fraction * 100).toFixed(1)} wt%  +  ` +
        `${cementite.name} ${(cementite.fraction * 100).toFixed(1)} wt%`,
    );
  });

  it('the S–N plate shows the endurance limit fitSn gives 1020 steel', () => {
    const steel = MECH_MATERIALS.find((m) => m.id === 'steel1020')!;
    const behaviour = getFatigueBehaviour('steel1020');
    const fit = fitSn(steel.uts, behaviour.ratio, behaviour.kneeCycles, behaviour.hasEnduranceLimit);
    expect(sourceFor('src/assets/figures/FatigueFigure.tsx')).toContain(
      `endurance limit ${fit.kneeStress.toFixed(0)} MPa`,
    );
  });

  it('the S–N plate contrasts an alloy with a fatigue limit against one without', () => {
    const source = sourceFor('src/assets/figures/FatigueFigure.tsx');
    const shown = MECH_MATERIALS.filter((m) => source.includes(`>${m.name}<`));
    expect(shown.length).toBeGreaterThanOrEqual(2);
    const limits = shown.map((m) => getFatigueBehaviour(m.id).hasEnduranceLimit);
    expect(limits).toContain(true);
    expect(limits).toContain(false);
    // The one without a limit must really keep falling past its knee — that is
    // the whole teaching point, and it is a property of the model, not the plot.
    for (const m of shown.filter((x) => !getFatigueBehaviour(x.id).hasEnduranceLimit)) {
      const b = getFatigueBehaviour(m.id);
      const fit = fitSn(m.uts, b.ratio, b.kneeCycles, false);
      expect(fatigueStrength(fit, 1e9)).toBeLessThan(fatigueStrength(fit, b.kneeCycles));
    }
    // ...and the ones with a limit must really flatten.
    for (const m of shown.filter((x) => getFatigueBehaviour(x.id).hasEnduranceLimit)) {
      const b = getFatigueBehaviour(m.id);
      const fit = fitSn(m.uts, b.ratio, b.kneeCycles, true);
      expect(fatigueStrength(fit, 1e9)).toBe(fatigueStrength(fit, b.kneeCycles));
    }
    expect(FATIGUE_BEHAVIOUR.some((f) => f.hasEnduranceLimit)).toBe(true);
  });

  it('the Ashby plate’s guide line is the E^½/ρ index of the best material in the set', () => {
    const idx = INDICES.find((i) => i.id === 'e12-rho')!;
    const best = SELECTION_MATERIALS.reduce((a, b) =>
      indexValue(b, idx) > indexValue(a, idx) ? b : a,
    );
    expect(sourceFor('src/assets/figures/AshbyFigure.tsx')).toContain(
      `${idx.label} = ${indexValue(best, idx).toFixed(1)}`,
    );
  });

  it('the Ashby plate plots all 54 materials', () => {
    const source = sourceFor('src/assets/figures/AshbyFigure.tsx');
    // One marker element per material, plus the five legend markers.
    const markers = source.match(/<(circle|rect|path) /g)!.length;
    const guideLine = 1;
    expect(markers).toBe(SELECTION_MATERIALS.length + 5 + guideLine);
    expect(SELECTION_MATERIALS).toHaveLength(54);
  });

  /**
   * The figure index is the one plate that makes a claim about the *app* rather
   * than about a model: twelve panels, one per module. A module added to
   * `NAV_GROUPS` without a panel would leave it quietly showing eleven under a
   * heading that says twelve, which is exactly the class of drift `docs.test.ts`
   * exists to close — so the membership is checked, not assumed.
   */
  describe('the figure index covers every module, from every module', () => {
    const plate = () => sourceFor('src/assets/figures/ModuleIndexPlate.tsx');

    /**
     * Membership *and* placement. Asserting only that every label appears
     * somewhere in the plate would pass with all twelve panels filed under one
     * heading, which is the arrangement the section's own copy makes a claim
     * about — "one column per course group, which is also how the header is
     * arranged". The x of each title is read back and matched to the column its
     * group's heading sits in.
     */
    it('titles one panel per module, in the column its course group heads', () => {
      const titleX = (label: string): number => {
        const escaped = label.replace(/&/g, '&amp;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const m = plate().match(new RegExp(`<text x="(\\d+(?:\\.\\d+)?)"[^>]*>${escaped}</text>`));
        expect(m, `no title for ${label}`).not.toBeNull();
        return Number(m![1]);
      };

      NAV_GROUPS.forEach((group, column) => {
        const headX = titleX(group.label.toUpperCase());
        for (const item of group.items) {
          // Headings and panel titles are both drawn at the cell's left inset,
          // so a panel in the right column shares its heading's x exactly.
          expect(titleX(item.label), `${item.label} is not under ${group.label}`).toBe(headX);
        }
        // ...and the four columns really are four different columns, left to
        // right in `NAV_GROUPS` order.
        if (column > 0) {
          expect(headX).toBeGreaterThan(titleX(NAV_GROUPS[column - 1].label.toUpperCase()));
        }
      });

      // Deliberate-change gates, not derivations. Everything above reads the
      // plate against `NAV_GROUPS`, so it would keep passing while the app
      // quietly grew a thirteenth module — and the plate's own prose, its byte
      // budget and the ROADMAP's chunk table all still say twelve. These two
      // move by hand, with the rest.
      expect(NAV_GROUPS).toHaveLength(4);
      expect(NAV_GROUPS.flatMap((g) => g.items)).toHaveLength(14);
    });

    /**
     * The box is as deep as the deepest column, not as deep as three rows.
     * Computed here from `NAV_GROUPS` by a second route — the plate's viewBox
     * is read back out of the rendered source — so the two agree or the test
     * says which. This is what stops a seventeenth panel being drawn outside
     * the box it is supposed to sit in.
     */
    it('sizes its box to the deepest column', () => {
      const deepest = Math.max(...NAV_GROUPS.map((g) => g.items.length));
      const columns = NAV_GROUPS.length;
      expect(IDX_W).toBe(12 * 2 + columns * 300);
      expect(IDX_H).toBe(46 + deepest * 222 + 12);
      expect(plate()).toContain(`viewBox="0 0 ${IDX_W} ${IDX_H}"`);
    });

    /**
     * The ragged case, which `NAV_GROUPS` cannot exercise while every column
     * holds three. The five planned modules land 4/4/6/3, and that arrangement
     * is the reason the grid stopped being `r < 3` — so it is checked directly
     * rather than waiting for module 13 to be the first thing that runs it.
     *
     * Two behaviours matter and neither is visible at 4×3: a seam is only as
     * deep as the deeper of the columns it separates, and a rule under a row
     * covers only the columns that *have* a row below it.
     */
    describe('the grid holds when the columns stop being equal', () => {
      it('reproduces the hand-written 4×3 grid exactly', () => {
        // The shape the plate had for twelve modules, kept as the fixed point
        // the generalisation had to pass through.
        expect(gridRules([3, 3, 3, 3]).join('')).toBe(
          'M12,46H1212M312,46V712M612,46V712M912,46V712M12,268H1212M12,490H1212',
        );
      });

      it('sinks each seam to the deeper of its two columns', () => {
        const rules = gridRules([4, 4, 6, 3]);
        // 46 + 4×222 between the two four-deep columns; 46 + 6×222 either side
        // of the six-deep one, which is what makes it a seam and not a stub.
        expect(rules).toContain('M312,46V934');
        expect(rules).toContain('M612,46V1378');
        expect(rules).toContain('M912,46V1378');
      });

      it('stops a row rule where the row stops', () => {
        const rules = gridRules([4, 4, 6, 3]);
        // Rows 1 and 2 exist in every column, so those rules run the full width.
        expect(rules).toContain('M12,268H1212');
        expect(rules).toContain('M12,490H1212');
        // Row 3 exists in the first three columns only: the rule ends at 912,
        // the right edge of the third, and does not cross the empty cell.
        expect(rules).toContain('M12,712H912');
        // Rows 4 and 5 exist in the third column alone.
        expect(rules).toContain('M612,934H912');
        expect(rules).toContain('M612,1156H912');
        expect(rules.filter((d) => d.includes(',712H'))).toHaveLength(1);
      });

      it('breaks a rule into runs rather than crossing an empty cell', () => {
        // The case a full-width rule gets silently wrong: a short column
        // *between* two deep ones. Row 1 belongs to columns 0 and 2, and the
        // rule must arrive as two segments, not one from 12 to 912.
        const rules = gridRules([3, 1, 3]);
        expect(rules).toContain('M12,268H312');
        expect(rules).toContain('M612,268H912');
        expect(rules.some((d) => d.startsWith('M12,268H912'))).toBe(false);
      });
    });

    it('plots all 54 Ashby materials', () => {
      // The selection panel draws one 4-unit square per material, as path
      // subpaths grouped by class; count the move commands rather than the
      // elements.
      const squares = plate().match(/h4v4h-4z/g)!.length;
      expect(squares).toBe(SELECTION_MATERIALS.length);
    });

    /**
     * One stick per allowed line, counted inside the XRD panel's own path.
     *
     * Counting `M…L…` across the whole plate was the mistake this replaces: it
     * matched 49 segments, 24 of them the two cube frames, against 6 peaks — so
     * `>= peaks.length` passed with `renderXrdPanel` deleted entirely. The
     * panel emits exactly one `<path>` of sticks, right after a comment naming
     * it, which is a handle the assertion can hold on to.
     */
    it('draws exactly one stick per line computePattern gives α-iron on Cu Kα', () => {
      const iron = XRD_SAMPLES.find((s) => s.id === 'fe')!;
      const anode = XRD_SOURCES.find((s) => s.id === 'cu')!;
      expect(iron.lattice).toBe('bcc');
      const peaks = computePattern(iron.lattice, iron.a, anode.lambda, 140);
      expect(peaks.length).toBeGreaterThan(3);

      const marker = '{/* α-iron on Cu Kα, from computePattern() — every allowed BCC line */}';
      const from = plate().indexOf(marker);
      expect(from, 'the XRD panel is no longer in the plate').toBeGreaterThan(-1);
      // Its last element is the stick path; take the panel up to the next
      // comment, which opens the panel after it.
      const rest = plate().slice(from + marker.length);
      const panel = rest.slice(0, rest.indexOf('{/*'));
      const sticks = panel.match(/M\d+,\d+L\d+,\d+/g) ?? [];
      expect(sticks).toHaveLength(peaks.length);
    });

    it('draws all 118 elements, and leaves the ones with no melting point out of the ramp', () => {
      const cells = plate().match(/M-?\d+,-?\d+h\d+v\d+h-\d+z/g)!.length;
      const elements = elementsRaw as { melt: number | null }[];
      expect(elements).toHaveLength(118);
      // 118 table cells plus the 54 Ashby markers, which share the rect shape.
      expect(cells).toBe(elements.length + SELECTION_MATERIALS.length);

      /*
       * Eleven elements have no tabulated melting point — carbon and phosphorus
       * among them, not only the unmeasured superheavies — and they are drawn in
       * the grid colour rather than at the bottom of the ramp, the same way
       * `PeriodicTrends` draws a missing value as missing. The caption says
       * "where measured" because of these; the count is checked so the caption
       * cannot quietly become wrong.
       */
      const unmeasured = elements.filter((e) => e.melt == null).length;
      expect(unmeasured).toBe(11);
      const gridPath = plate().match(
        /<path d="((?:M-?\d+,-?\d+h\d+v\d+h-\d+z)+)" fill="var\(--fig-grid[^"]*"/,
      );
      expect(gridPath, 'no unshaded band in the table panel').not.toBeNull();
      expect(gridPath![1].match(/z/g)!.length).toBe(unmeasured);
    });

    /**
     * A budget, not a guess. This plate is the largest asset the landing page
     * can reach; it is lazily imported so it costs nothing at first paint, but
     * a lazy chunk that doubles without anyone noticing is still a regression,
     * and the periodic-table panel alone was 9.6 kB before it was rewritten
     * from 118 elements into six paths.
     *
     * Two budgets, because one number cannot do both jobs once the module
     * count moves. **Per panel** is the one that scales: it catches a single
     * panel bloating at any count, and it does not have to be touched when a
     * module ships. **In total** is a deliberate-change gate — it stops the
     * plate growing without bound and must be raised by hand, against a
     * measured build, each time it is.
     *
     * Measured: 18,824 B over 12 panels at `9b4abef` (1,569 each); 20,070 B
     * over 13 when composites landed (1,544 each, marginal 1,246); 21,195 B
     * over 14 with polymers (1,514 each, marginal 1,125).
     *
     * The per-panel budget has already earned its place. The polymers panel
     * first drew its two histograms as fifty-six separate `<path>` elements
     * and cost **4,116 B** — over this ceiling on its own, and the failure
     * said so. Two paths of subpaths, the same rewrite the periodic-table
     * panel took from 118 elements down to six, brought it to 701.
     */
    it('stays inside its byte budget', () => {
      const bytes = new TextEncoder().encode(plate()).length;
      const panels = NAV_GROUPS.flatMap((g) => g.items).length;
      expect(bytes / panels).toBeLessThan(1_700);
      expect(bytes).toBeLessThan(21_500);
    });
  });

  it('the XRD plate indexes the FCC lines computePattern actually produces', () => {
    const sample = XRD_SAMPLES.find((s) => s.id === 'cu')!;
    const source = XRD_SOURCES.find((s) => s.id === 'cu')!;
    expect(sample.lattice).toBe('fcc');
    const peaks = computePattern(sample.lattice, sample.a, source.lambda, 140);
    const svg = sourceFor('src/assets/figures/XrdFigure.tsx');
    // The strongest lines must all be indexed; weak ones may lose their label
    // to a collision, which is why the threshold is on intensity.
    // Through `familyLabel`, the same formatter the generator uses — asserting
    // the raw concatenation here would have accepted a generator that changed
    // to a sample with double-digit indices and started printing "(1111)".
    for (const p of peaks.filter((q) => q.intensity >= 3)) {
      expect(svg).toContain(`(${familyLabel(p.h, p.k, p.l)})`);
    }
    expect(svg).toContain(`a = ${sample.a.toFixed(4)} nm`);
    expect(svg).toContain(source.label);
  });
});

/**
 * The figures are inlined into the DOM, so they inherit the page's custom
 * properties and follow the light/dark/system theme. That only holds while
 * every colour goes through a token, and a single hard-coded hex would be
 * invisible in light mode and wrong in dark.
 */
describe('theming and embedding contract', () => {
  const TOKENS = ['--fig-ink', '--fig-label', '--fig-grid', '--fig-accent', '--fig-a', '--fig-b', '--fig-c', '--fig-d'];
  const PREFIXES: Record<string, string> = {
    'src/assets/figures/PhaseFigure.tsx': 'pf-',
    'src/assets/figures/FatigueFigure.tsx': 'ff-',
    'src/assets/figures/AshbyFigure.tsx': 'af-',
    'src/assets/figures/XrdFigure.tsx': 'xf-',
    'src/assets/figures/ModuleIndexPlate.tsx': 'mi-',
  };

  /* The four single plates share one box; the figure index is drawn wider and
     taller, because it is one panel per module rather than one. Its box is
     computed from `NAV_GROUPS` — a literal here would have to be re-typed with
     every module, which is the drift the landing page's reserved slot got
     caught by. */
  const VIEWBOX: Record<string, string> = {
    'src/assets/figures/ModuleIndexPlate.tsx': `viewBox="0 0 ${IDX_W} ${IDX_H}"`,
  };

  for (const [path, prefix] of Object.entries(PREFIXES)) {
    describe(path, () => {
      const source = () => committed[path];

      it('states a viewBox and hides itself from assistive technology', () => {
        expect(source()).toContain(VIEWBOX[path] ?? 'viewBox="0 0 640 420"');
        expect(source()).toContain('aria-hidden="true"');
      });

      it('carries no style element and no script', () => {
        expect(source()).not.toMatch(/<style[\s>]/);
        expect(source()).not.toMatch(/<script[\s>]/);
      });

      it('routes every colour through a --fig-* token with a fallback', () => {
        for (const match of source().matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
          const value = match[1];
          if (value === 'none') continue;
          expect(value).toMatch(/^var\(--fig-[a-z]+, #[0-9a-f]{6}\)$/);
          expect(TOKENS.some((t) => value.startsWith(`var(${t},`))).toBe(true);
        }
      });

      it('namespaces any id it defines, so two figures on one page cannot collide', () => {
        for (const match of source().matchAll(/\bid="([^"]+)"/g)) {
          expect(match[1].startsWith(prefix)).toBe(true);
        }
        for (const match of source().matchAll(/url\(#([^)]+)\)/g)) {
          expect(match[1].startsWith(prefix)).toBe(true);
        }
      });
    });
  }
});
