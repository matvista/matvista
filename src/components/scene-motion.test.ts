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

describe('auto-rotate is stoppable in every 3D view', () => {
  it.each(SCENES)('%s takes autoRotate as a prop, never as a literal', (_name, source) => {
    // `autoRotate` bare on the JSX element is the literal-true form.
    expect(source).not.toMatch(/<OrbitControls[^>]*\sautoRotate(?![=\w])/);
    expect(source).toMatch(/autoRotate=\{(props\.)?autoRotate\}/);
    expect(source).toMatch(/autoRotate: boolean/);
  });

  it.each(VIEWS)('%s renders a Rotate checkbox wired to its own state', (_name, source) => {
    expect(source).toMatch(/const \[autoRotate, setAutoRotate\] = useState\(/);
    expect(source).toMatch(/autoRotate=\{autoRotate\}/);
    expect(source).toMatch(/checked=\{autoRotate\}/);
    expect(source).toMatch(/setAutoRotate\(e\.target\.checked\)/);
    expect(source).toMatch(/Rotate/);
  });

  it.each(VIEWS)('%s defaults auto-rotate off under reduced motion', (_name, source) => {
    expect(source).toMatch(/useState\(!prefersReducedMotion\(\)\)/);
    // From the shared module, not a local re-declaration.
    expect(source).toMatch(/import \{[^}]*prefersReducedMotion[^}]*\} from '\.\.\/motion'/);
    expect(source).not.toMatch(/function prefersReducedMotion/);
  });

  it('has exactly one definition of prefersReducedMotion in the whole app', () => {
    const sources = [...SCENES, ...VIEWS].map(([, s]) => s);
    for (const s of sources) expect(s).not.toMatch(/function prefersReducedMotion/);
    // and the shared one is real
    expect(typeof prefersReducedMotion()).toBe('boolean');
  });
});
