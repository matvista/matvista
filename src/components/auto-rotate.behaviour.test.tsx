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
 * **What this environment cannot check**, stated in full beside the
 * visibility test below: jsdom 29.1.1 has no layout engine, no
 * `Element.checkVisibility`, no `matchMedia` (stubbed explicitly here rather
 * than assumed), and it drops width-feature media blocks unconditionally — so
 * a control hidden by zero size, by `opacity`, or by any `@media (min-width:
 * …)` rule passes this file. Those are checked in a browser, and a browser
 * check recorded in a commit message is a record rather than a gate.
 *
 * jsdom and @testing-library are devDependencies and do not reach the bundle;
 * measured against `npm run build`, the first-paint **chunk** 301.10 kB raw /
 * 85.16 kB gzip, unchanged. (An earlier version of this comment said 85.17;
 * the measurement at that commit was 85.16. It also called that figure "first
 * paint", which under this repo's own convention it is not — the stylesheet
 * loads render-blocking and counts too, and was 34.39 kB / 7.22 kB gzip at
 * that commit, for 92.38 kB of first paint.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import { warmRoutes } from './route-warmup';

const { default: App } = await import('../App');
// Resolve the lazy route modules before anything is timed. Without this the
// first render in the file pays a cold dynamic import inside a `waitFor`
// budget meant for a render — see route-warmup.ts.
await warmRoutes('crystals', 'defects', 'miller');

/**
 * The whole app at a route, not the view component on its own.
 *
 * Rendering the bare view puts it at the document root, so a CSS rule scoped
 * to the real DOM — `.app .crystal-checks label { display: none }`, and the
 * app already ships `@media (max-width: 620px)` rules touching that class —
 * would not apply and the N3 row would be testing the selector this file
 * happened to choose rather than the gate. Routing is hash-based, so setting
 * the hash before mount is the whole of it. The modules are `lazy`, hence the
 * wait.
 */
async function renderRoute(hash: string) {
  window.location.hash = hash;
  // Let the hashchange from this assignment — and from the previous test's
  // cleanup — flush before mounting. Without this the route resets to the
  // landing page one tick after render and unmounts the module again.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    render(<App />);
  });
  await waitFor(() => expect(screen.getByTestId('orbit-controls')).toBeDefined());
}

const VIEWS: [string, string][] = [
  ['CrystalStructures', '#/crystals'],
  ['DefectsDiffusion', '#/defects'],
  ['MillerIndices', '#/miller'],
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
  it.each(VIEWS)('%s exposes a checkbox reachable by its label', async (_name, hash) => {
    await renderRoute(hash);
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
  it.each(VIEWS)('%s hands OrbitControls the value the checkbox shows', async (_name, hash) => {
    await renderRoute(hash);
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

  it.each(VIEWS)('%s spins by default when motion is allowed', async (_name, hash) => {
    await renderRoute(hash);
    expect(asked.some((q) => q.includes('prefers-reduced-motion'))).toBe(true);
    expect(received()).toBe('true');
  });

  it.each(VIEWS)('%s starts still under prefers-reduced-motion', async (_name, hash) => {
    asked = stubMatchMedia(true);
    await renderRoute(hash);
    expect(asked.some((q) => q.includes('prefers-reduced-motion'))).toBe(true);
    expect(received()).toBe('false');
    // and it is still the reader's to turn on
    const box = control();
    expect(box.disabled).toBe(false);
    fireEvent.click(box);
    expect(received()).toBe('true');
  });

  /**
   * Positive visibility, as far as this environment allows — which is less
   * than it looks, and the limits are named rather than implied.
   *
   * `getByRole` resolves through the accessibility tree, so `display: none`,
   * `visibility: hidden`, `hidden` and `aria-hidden` all fail here, and the
   * app's real stylesheet is loaded so a shipped rule that hides the control
   * is caught. **Three hiding mechanisms are not, and cannot be, in jsdom:**
   *
   *  - `Element.checkVisibility` does not exist in jsdom 29.1.1, so calling
   *    it would be dead code in CI. It is not called.
   *  - There is no layout engine, so a zero-size or fully clipped control
   *    measures the same as a visible one.
   *  - Width-feature media blocks are **dropped unconditionally**, so
   *    `@media (min-width: 1px) { display: none }` — which hides the control
   *    at every real viewport — passes this file. That is the most plausible
   *    real failure, since the app already ships `@media (max-width: 620px)`
   *    rules touching `.crystal-checks`.
   *
   * Those three are checked in a browser instead, and a browser check written
   * into a commit message is a record, not a gate. Anyone changing the
   * stylesheet around this control should re-run it.
   */
  it.each(VIEWS)('%s leaves the control in the accessibility tree', async (_name, hash) => {
    await renderRoute(hash);
    expect(screen.getAllByRole('checkbox', { name: /rotate/i })).toHaveLength(1);
  });

  it.each(VIEWS)('%s passes autoRotate to OrbitControls as a boolean, with a speed', async (_name, hash) => {
    await renderRoute(hash);
    expect(orbitProps.length).toBeGreaterThan(0);
    const props = orbitProps[orbitProps.length - 1];
    expect(typeof props.autoRotate).toBe('boolean');
    expect(props.autoRotateSpeed).toBeGreaterThan(0);
    // `enabled={false}` satisfies every other assertion here and kills
    // rotation dead: drei only calls `controls.update()` while enabled, and
    // three.js only auto-rotates inside `update()`. Without this the trace
    // stops at the props object, so a sibling prop that makes the consumer
    // ignore `autoRotate` is invisible.
    expect(props.enabled).not.toBe(false);
  });
});
