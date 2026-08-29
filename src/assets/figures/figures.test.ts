import { describe, expect, it } from 'vitest';
import { buildFigures } from '../../../scripts/gen-module-figures.ts';
import phaseCommitted from './PhaseFigure.tsx?raw';
import fatigueCommitted from './FatigueFigure.tsx?raw';
import ashbyCommitted from './AshbyFigure.tsx?raw';
import xrdCommitted from './XrdFigure.tsx?raw';
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
};

const generated = await buildFigures();
const sourceFor = (path: string): string => generated.find((g) => g.path === path)!.source;

describe('committed figures are in step with the models', () => {
  it('generates exactly the four committed files', () => {
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
  };

  for (const [path, prefix] of Object.entries(PREFIXES)) {
    describe(path, () => {
      const source = () => committed[path];

      it('states a viewBox and hides itself from assistive technology', () => {
        expect(source()).toContain('viewBox="0 0 640 420"');
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
