/**
 * WCAG 2.2.2 guard for the three 3D views.
 *
 * A cell that spins on its own is auto-updating motion: it has to be
 * stoppable, and it has to respect `prefers-reduced-motion`. That was fixed
 * once, for `MillerScene` only — `CrystalScene` went on hardcoding
 * `autoRotate` on its `<OrbitControls>`, and both `#/crystals` and `#/defects`
 * render it, so two of the three views spun forever with no control.
 *
 * These are source-level assertions rather than rendered ones: the suite runs
 * under Vitest's Node environment with no DOM (see `motion.test.ts`), and the
 * defect being guarded is structural — a scene taking the flag as a literal
 * instead of a prop, or a second copy of the media-query helper drifting from
 * the first. Both are visible in the text.
 *
 * **These assertions were rebuilt after review.** The first version was
 * defeated by three realistic mutations that every gate passed: shadowing the
 * prop with `const autoRotate = true` inside the scene (tsc, 537 tests and
 * lint all clean, checkbox dead); `disabled` on the input; and an unlabelled
 * checkbox, because `/Rotate/` matches the identifier `autoRotate` and not
 * only the label text. Each has an assertion below.
 */
import { describe, expect, it } from 'vitest';
import crystalScene from './CrystalScene.tsx?raw';
import millerScene from './MillerScene.tsx?raw';
import crystalStructures from './CrystalStructures.tsx?raw';
import defectsDiffusion from './DefectsDiffusion.tsx?raw';
import millerIndices from './MillerIndices.tsx?raw';
import { prefersReducedMotion } from '../motion';

const SCENES: [string, string][] = [
  ['CrystalScene', crystalScene],
  ['MillerScene', millerScene],
];

const VIEWS: [string, string][] = [
  ['CrystalStructures', crystalStructures],
  ['DefectsDiffusion', defectsDiffusion],
  ['MillerIndices', millerIndices],
];

/** The `<label>` block that owns the Rotate checkbox, for the checks below. */
function rotateLabel(source: string): string {
  const at = source.indexOf('checked={autoRotate}');
  expect(at, 'no checkbox bound to autoRotate').toBeGreaterThan(-1);
  const open = source.lastIndexOf('<label', at);
  const close = source.indexOf('</label>', at);
  expect(open).toBeGreaterThan(-1);
  expect(close).toBeGreaterThan(open);
  return source.slice(open, close + 8);
}

describe('auto-rotate is stoppable in every 3D view', () => {
  it.each(SCENES)('%s takes autoRotate as a prop, never as a literal', (_name, source) => {
    // `autoRotate` bare on the JSX element is the literal-true form.
    expect(source).not.toMatch(/<OrbitControls[^>]*\sautoRotate(?![=\w])/);
    expect(source).toMatch(/autoRotate=\{(props\.)?autoRotate\}/);
    expect(source).toMatch(/autoRotate: boolean/);
  });

  /**
   * The mutation that defeated every gate: leave `Props`, the forwarding and
   * both call sites intact, drop the prop from the destructure, and shadow it
   * with a local. The value forwarded to `OrbitControls` must come from props
   * and nowhere else.
   */
  it.each(SCENES)('%s forwards the prop itself, not a local binding', (_name, source) => {
    expect(source, 'autoRotate is re-declared locally, so the prop is dead').not.toMatch(
      /\b(?:const|let|var)\s+autoRotate\b/,
    );
    const destructured = /^\s*autoRotate,\s*$/m.test(source);
    const viaProps = /autoRotate=\{props\.autoRotate\}/.test(source);
    expect(
      destructured || viaProps,
      'autoRotate is neither destructured from props nor read off props',
    ).toBe(true);
  });

  it.each(VIEWS)('%s renders a Rotate checkbox wired to its own state', (_name, source) => {
    expect(source).toMatch(/const \[autoRotate, setAutoRotate\] = useState\(/);
    expect(source).toMatch(/autoRotate=\{autoRotate\}/);
    expect(source).toMatch(/checked=\{autoRotate\}/);
    expect(source).toMatch(/setAutoRotate\(e\.target\.checked\)/);
  });

  /** `/Rotate/` also matches the identifier `autoRotate`, so it proved nothing. */
  it.each(VIEWS)('%s labels the checkbox with visible text', (_name, source) => {
    expect(rotateLabel(source)).toMatch(/\/>\s*Rotate\s*</);
  });

  /** A disabled checkbox satisfies every structural check and still cannot be used. */
  it.each(VIEWS)('%s leaves the checkbox operable', (_name, source) => {
    expect(rotateLabel(source)).not.toMatch(/\bdisabled\b/);
    expect(rotateLabel(source)).not.toMatch(/\breadOnly\b/);
    expect(rotateLabel(source)).toMatch(/type="checkbox"/);
  });

  it.each(VIEWS)('%s defaults auto-rotate off under reduced motion', (_name, source) => {
    // Bound to this state, not merely present somewhere in the file.
    expect(source).toMatch(
      /const \[autoRotate, setAutoRotate\] = useState\(!prefersReducedMotion\(\)\)/,
    );
    // From the shared module, not a local re-declaration.
    expect(source).toMatch(/import \{[^}]*prefersReducedMotion[^}]*\} from '\.\.\/motion'/);
  });

  /**
   * Scans every source file in `src`, not a hardcoded list — the previous
   * version claimed "the whole app" while checking five files, so a fourth
   * copy of the helper anywhere else would have gone unnoticed.
   */
  it('has exactly one definition of prefersReducedMotion in src', () => {
    const modules = import.meta.glob('../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const paths = Object.keys(modules).filter((p) => !/\.test\.tsx?$/.test(p));
    // The glob is load-bearing: if it matched nothing the assertion below
    // would pass vacuously.
    expect(paths.length).toBeGreaterThan(30);
    const definers = paths.filter((p) => /function prefersReducedMotion/.test(modules[p]));
    expect(definers).toEqual(['../motion.ts']);
    expect(typeof prefersReducedMotion()).toBe('boolean');
  });
});
