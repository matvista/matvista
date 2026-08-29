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
