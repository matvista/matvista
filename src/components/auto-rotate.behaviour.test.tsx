// @vitest-environment jsdom
/**
 * Behavioural gate for the 3D auto-rotate control — WCAG 2.2.2.
 *
 * **Why this file replaced a source-level one.** Three rounds of regex over
 * source each claimed to close this mutation class and each was defeated,
 * because a whole-file substring match is satisfied by any decoy occurrence,
 * including one inside a comment. That is a category limit, not a bug to patch
 * again. This file renders the views and asserts what a reader experiences.
 *
 * **What is stubbed, and why it is the minimum.** An earlier version stubbed
 * `CrystalScene` and `MillerScene` whole, which left everything inside them
 * unguarded — the same mutation simply moved below the stub. Only
 * `@react-three/fiber`'s `<Canvas>` and drei's `<OrbitControls>` are stubbed
 * now: `<Canvas>` because jsdom has no WebGL, and `OrbitControls` because it
 * is the thing whose props are the subject. The **real** `CrystalScene` and
 * `MillerScene` render, so the prop is traced end to end from the checkbox to
 * the control that consumes it.
 *
 * **What this environment cannot check.** jsdom has no layout engine, no
 * `Element.checkVisibility` and no `matchMedia` (the last is stubbed
 * explicitly below rather than assumed). So a control hidden by zero size, by
 * `opacity`, or by a media query is invisible here. That gap is closed in the
 * browser instead, at mobile width, and the result is recorded in the commit
 * message — it is not claimed here.
 *
 * jsdom and @testing-library are devDependencies and do not reach the bundle;
 * measured against `npm run build`, first paint 301.10 kB raw / 85.16 kB gzip,
 * unchanged. (An earlier version of this comment said 85.17; the measurement
 * at that commit was 85.16.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
// The real stylesheet, so anything the shipped CSS hides is hidden here too.
// `test.css` is enabled in vite.config.ts for this.
import '../index.css';

/** Records the props `<OrbitControls>` is actually handed. */
const orbitProps: Record<string, unknown>[] = [];

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-canvas>{children}</div>,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: (props: Record<string, unknown>) => {
    orbitProps.push(props);
    return <div data-testid="orbit-controls" data-auto-rotate={String(props.autoRotate)} />;
  },
}));

const { CrystalStructures } = await import('./CrystalStructures');
const { DefectsDiffusion } = await import('./DefectsDiffusion');
const { MillerIndices } = await import('./MillerIndices');

const VIEWS: [string, () => React.ReactElement][] = [
  ['CrystalStructures', () => <CrystalStructures />],
  ['DefectsDiffusion', () => <DefectsDiffusion />],
  ['MillerIndices', () => <MillerIndices />],
];

/**
 * jsdom ships no `matchMedia`, so `prefersReducedMotion` would fall through
 * its own guard and the reduced-motion assertions would prove nothing about
 * the query. Every test installs one explicitly.
 */
function stubMatchMedia(reduced: boolean): string[] {
  const asked: string[] = [];
  window.matchMedia = ((query: string) => {
    asked.push(query);
    return {
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  }) as unknown as typeof window.matchMedia;
  return asked;
}

let asked: string[] = [];

beforeEach(() => {
  orbitProps.length = 0;
  asked = stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
  delete (window as { matchMedia?: unknown }).matchMedia;
});

/** The value the real scene handed to the real control's stub. */
const received = () => screen.getByTestId('orbit-controls').getAttribute('data-auto-rotate');

/**
 * The control, resolved the way assistive technology resolves it.
 *
 * `getByRole` filters by the accessibility tree, so anything `display: none`,
 * `visibility: hidden`, `hidden` or `aria-hidden` removes from it fails here —
 * which is what makes the visibility assertions positive rather than an
 * enumeration of hiding mechanisms. `getByLabelText` does *not* filter that
 * way; it is used once below, for the property it does have, which is not
 * caring whether the label wraps the input or associates by id/htmlFor.
 */
const control = () => screen.getByRole('checkbox', { name: /rotate/i }) as HTMLInputElement;

describe('the Rotate control actually works', () => {
  it.each(VIEWS)('%s exposes a checkbox reachable by its label', (_name, View) => {
    render(<View />);
    // `getByLabelText` resolves through the accessibility tree, so it fails on
    // an unlabelled control and on one hidden from assistive technology —
    // and it does not care whether the label wraps the input or uses
    // id/htmlFor, which `closest('label')` did.
    // Both resolutions must find it: by role-and-accessible-name, and by
    // label text regardless of how the label is associated.
    expect(screen.getByLabelText(/^rotate$/i)).toBe(control());
    const box = control();
    expect(box.type).toBe('checkbox');
    expect(box.disabled).toBe(false);
    expect(box.readOnly).toBe(false);
  });

  /**
   * The assertion the source-level file could never make: the value reaching
   * `<OrbitControls>`, through the real scene component, follows the control.
   */
  it.each(VIEWS)('%s hands OrbitControls the value the checkbox shows', (_name, View) => {
    render(<View />);
    const box = control();
    expect(received()).toBe(String(box.checked));
    const before = box.checked;

    fireEvent.click(box);
    expect(box.checked).toBe(!before);
    expect(received()).toBe(String(!before));

    fireEvent.click(box);
    expect(box.checked).toBe(before);
    expect(received()).toBe(String(before));
  });

  it.each(VIEWS)('%s spins by default when motion is allowed', (_name, View) => {
    render(<View />);
    expect(asked.some((q) => q.includes('prefers-reduced-motion'))).toBe(true);
    expect(received()).toBe('true');
  });

  it.each(VIEWS)('%s starts still under prefers-reduced-motion', (_name, View) => {
    asked = stubMatchMedia(true);
    render(<View />);
    expect(asked.some((q) => q.includes('prefers-reduced-motion'))).toBe(true);
    expect(received()).toBe('false');
    // and it is still the reader's to turn on
    const box = control();
    expect(box.disabled).toBe(false);
    fireEvent.click(box);
    expect(received()).toBe('true');
  });

  /**
   * Positive visibility, as far as this environment allows. Testing Library's
   * queries exclude anything `display: none`, `visibility: hidden`, `hidden`
   * or `aria-hidden` removes from the accessibility tree, so reaching the
   * control at all is the assertion; `checkVisibility` is used on top where
   * the environment provides it, which jsdom does not.
   */
  it.each(VIEWS)('%s leaves the control visible', (_name, View) => {
    render(<View />);
    const box = control();
    const check = (box as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility;
    if (typeof check === 'function') {
      expect(
        check.call(box, {
          opacityProperty: true,
          visibilityProperty: true,
          contentVisibilityAuto: true,
        }),
      ).toBe(true);
    }
    expect(screen.getAllByRole('checkbox', { name: /rotate/i })).toHaveLength(1);
  });

  it.each(VIEWS)('%s passes autoRotate to OrbitControls as a boolean, with a speed', (_name, View) => {
    render(<View />);
    expect(orbitProps.length).toBeGreaterThan(0);
    const props = orbitProps[orbitProps.length - 1];
    expect(typeof props.autoRotate).toBe('boolean');
    expect(props.autoRotateSpeed).toBeGreaterThan(0);
  });
});
