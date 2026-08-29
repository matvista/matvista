/**
 * Code-shape guard for the three 3D views. **This file gates shape, not
 * behaviour** — `auto-rotate.behaviour.test.tsx` gates behaviour, and the two
 * cover different things.
 *
 * The scope statement matters, because two earlier rounds of this file each
 * claimed to close the mutation class and each was wrong. Regex over source is
 * satisfied by any decoy occurrence of the token it looks for, including one
 * inside a comment, so it cannot tell a live call site from a dead one. That
 * is a category limit, not a bug to be patched a third time.
 *
 * What this file does still catch, and the behavioural file cannot: the
 * behavioural tests stub `CrystalScene` and `MillerScene`, because `<Canvas>`
 * needs WebGL that jsdom does not have. So a mutation *inside a scene* — the
 * round-1 defeat, where the prop was dropped from the destructure and shadowed
 * with `const autoRotate = true` — is invisible there and caught here.
 * Measured, that mutation: 1 failure in this file, 0 in the behavioural file.
 *
 * The reverse holds for everything on the view side. A call site set to
 * `autoRotate={true}` with the token parked in a JSX comment, a `useEffect`
 * that resets the state, `preventDefault` on the input, an arrow-const
 * duplicate of the reduced-motion helper, and a CSS rule hiding the control
 * all pass here; four of the five fail the behavioural file, and the fifth
 * (the duplicate helper) fails both.
 *
 * So the view-side assertions below are kept deliberately narrow — they record
 * the intended shape and catch accidental drift — and the load-bearing
 * guarantee for the control lives in the behavioural file.
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
