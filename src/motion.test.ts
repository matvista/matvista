/**
 * The suite runs under Vitest's default Node environment: there is no `jsdom`
 * in this project's dependencies, and adding one is out of scope for a landing
 * page. So the hooks themselves — which need a document and an element to
 * observe — are not exercised here. What is covered is the one piece of them
 * that is pure: the media-query guard every reduced-motion decision hangs off,
 * including the case where there is no `window` to ask.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion } from './motion';

/** The Node environment has no `window`; these install and remove a stand-in. */
const global = globalThis as unknown as { window?: unknown };

function setWindow(value: unknown): void {
  global.window = value;
}

afterEach(() => {
  delete global.window;
});

describe('prefersReducedMotion', () => {
  it('is false when there is no window at all', () => {
    expect('window' in global).toBe(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('is false when the window has no matchMedia', () => {
    setWindow({});
    expect(prefersReducedMotion()).toBe(false);
  });

  it('reports the media query as matching', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    setWindow({ matchMedia });
    expect(prefersReducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('reports the media query as not matching', () => {
    setWindow({ matchMedia: () => ({ matches: false }) });
    expect(prefersReducedMotion()).toBe(false);
  });
});

/**
 * One definition, repo-wide.
 *
 * `motion.ts`'s own doc says this file exists so a fix to the guard "cannot
 * reach some call sites and miss others". Nothing checked that. The scan that
 * did live in `scene-motion.test.ts` went with it when that file was deleted,
 * and it only ever looked at five hardcoded files anyway — planting a
 * definition in `useRoute.ts` passed the whole suite — and its pattern was
 * `/function prefersReducedMotion/`, which cannot see the arrow-const form it
 * was named for.
 */
describe('prefersReducedMotion is defined exactly once', () => {
  it('is declared in motion.ts and nowhere else under src', () => {
    const modules = import.meta.glob('./**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const paths = Object.keys(modules).filter((p) => !/\.test\.tsx?$/.test(p));
    // The glob is load-bearing: an empty match would pass vacuously.
    expect(paths.length).toBeGreaterThan(30);

    // Both declaration forms — `function f()` and `const f = () =>` — since a
    // pattern naming only the first is how the arrow-const mutation survived.
    const declares = /(?:function|const|let|var)\s+prefersReducedMotion\b/;
    expect(paths.filter((p) => declares.test(modules[p]))).toEqual(['./motion.ts']);
  });
});
