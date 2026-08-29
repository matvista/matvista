// @vitest-environment jsdom
/**
 * Behavioural gate for the 3D auto-rotate control — WCAG 2.2.2.
 *
 * **Why this file exists.** The source-level guards in `scene-motion.test.ts`
 * are regex over text, and regex over text can gate code *shape* but not
 * rendering *behaviour*. Two rounds of hardening were each defeated by a
 * realistic mutation that left the file looking correct: shadowing the prop
 * with a local inside the scene, and — after that was closed — setting the
 * call site to `autoRotate={true}` while parking the required token in a JSX
 * comment, `{/* autoRotate={autoRotate} *␘/}`, which every substring
 * assertion accepted while the cell span forever with a dead checkbox.
 *
 * The category limit is real: a whole-file substring match is satisfied by any
 * decoy occurrence, including one inside a comment. So this file renders the
 * views instead and asserts what a reader would experience — the checkbox
 * exists, is labelled, is operable, and changing it changes the value the
 * scene actually receives.
 *
 * The scenes are stubbed rather than rendered: `<Canvas>` needs WebGL, which
 * jsdom does not have, and the question here is not whether three.js spins but
 * whether the prop reaches it. The stub writes the prop it was handed into a
 * DOM attribute, so the assertion reads the real value the real component
 * passed down.
 *
 * jsdom and @testing-library are devDependencies. They do not reach the bundle
 * — verified against `npm run build`, first paint unchanged at 85.17 kB gzip.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
// The real stylesheet, so the "is it actually visible" assertions below see
// the rules that ship rather than jsdom's defaults. `test.css` is enabled in
// vite.config.ts for exactly this.
import '../index.css';

/** Records the `autoRotate` prop it is given, so a test can read it back. */
function sceneStub(testId: string) {
  return (props: { autoRotate: boolean }) => (
    <div data-testid={testId} data-auto-rotate={String(props.autoRotate)} />
  );
}

vi.mock('./CrystalScene', () => ({ CrystalScene: sceneStub('crystal-scene') }));
vi.mock('./MillerScene', () => ({ MillerScene: sceneStub('miller-scene') }));

const { CrystalStructures } = await import('./CrystalStructures');
const { DefectsDiffusion } = await import('./DefectsDiffusion');
const { MillerIndices } = await import('./MillerIndices');

const VIEWS: [string, () => React.ReactElement, string][] = [
  ['CrystalStructures', () => <CrystalStructures />, 'crystal-scene'],
  ['DefectsDiffusion', () => <DefectsDiffusion />, 'crystal-scene'],
  ['MillerIndices', () => <MillerIndices />, 'miller-scene'],
];

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('the Rotate control actually works', () => {
  it.each(VIEWS)('%s exposes a checkbox reachable by its label', (_name, View) => {
    render(<View />);
    // getByRole with a name is the accessible-name resolution a screen reader
    // does; an unlabelled input fails here, which a substring match did not.
    const box = screen.getByRole('checkbox', { name: /rotate/i });
    expect(box).toBeDefined();
    expect((box as HTMLInputElement).type).toBe('checkbox');
  });

  it.each(VIEWS)('%s leaves the checkbox enabled and not read-only', (_name, View) => {
    render(<View />);
    const box = screen.getByRole('checkbox', { name: /rotate/i }) as HTMLInputElement;
    expect(box.disabled).toBe(false);
    expect(box.readOnly).toBe(false);
  });

  /**
   * The assertion the two regex rounds could not make: the value the scene
   * receives has to follow the control.
   */
  it.each(VIEWS)('%s hands the scene the value the checkbox shows', (_name, View, sceneId) => {
    render(<View />);
    const box = screen.getByRole('checkbox', { name: /rotate/i }) as HTMLInputElement;
    const scene = () => screen.getByTestId(sceneId).getAttribute('data-auto-rotate');

    expect(scene()).toBe(String(box.checked));
    const before = box.checked;

    fireEvent.click(box);
    expect(box.checked).toBe(!before);
    expect(scene()).toBe(String(!before));

    fireEvent.click(box);
    expect(box.checked).toBe(before);
    expect(scene()).toBe(String(before));
  });

  it.each(VIEWS)('%s starts with the cell turning when motion is allowed', (_name, View, sceneId) => {
    render(<View />);
    // The default jsdom matchMedia stub below reports no reduced-motion
    // preference, so auto-rotate should start on.
    expect(screen.getByTestId(sceneId).getAttribute('data-auto-rotate')).toBe('true');
  });

  /**
   * `prefers-reduced-motion` is read once at mount, so this replaces
   * `matchMedia` before rendering rather than after.
   */
  it.each(VIEWS)('%s starts still when the reader asks for reduced motion', (_name, View, sceneId) => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })) as unknown as typeof window.matchMedia;
    try {
      render(<View />);
      expect(screen.getByTestId(sceneId).getAttribute('data-auto-rotate')).toBe('false');
      // and it is still the reader's to turn on
      const box = screen.getByRole('checkbox', { name: /rotate/i }) as HTMLInputElement;
      expect(box.disabled).toBe(false);
      fireEvent.click(box);
      expect(screen.getByTestId(sceneId).getAttribute('data-auto-rotate')).toBe('true');
    } finally {
      window.matchMedia = original;
    }
  });

  /**
   * A control that is present, labelled and wired but hidden by CSS still
   * fails WCAG 2.2.2, and no source-level assertion can see that. This checks
   * the rendered element is not display:none / visibility:hidden and that its
   * label is not either.
   */
  it.each(VIEWS)('%s does not hide the control', (_name, View) => {
    render(<View />);
    const box = screen.getByRole('checkbox', { name: /rotate/i });
    for (const el of [box, box.closest('label')!]) {
      const style = window.getComputedStyle(el);
      expect(style.display).not.toBe('none');
      expect(style.visibility).not.toBe('hidden');
    }
    // and the label carries visible text, not only an attribute
    expect(within(box.closest('label')!).getByText(/rotate/i)).toBeDefined();
  });
});
