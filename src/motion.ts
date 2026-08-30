/**
 * Shared motion primitives.
 *
 * Lives at the top level rather than under `landing/` because
 * `prefersReducedMotion` is not a landing-page concern: the three 3D views use
 * it too, to decide whether their cell starts spinning. One definition, so a
 * fix to the guard cannot reach some call sites and miss others — which is
 * exactly how `#/crystals` and `#/defects` came to spin forever after the
 * same defect was fixed in `#/miller`.
 *
 * One rule: motion is decoration, and decoration must never be load-bearing.
 * A reveal that fails to fire leaves a whole section blank. So the resting
 * state is the *finished* state, and the animation is only the path taken to
 * reach it when the browser and the reader both allow it. Under
 * `prefers-reduced-motion`, in a browser without `IntersectionObserver`, or on
 * the server, the page is simply already there.
 *
 * This file is deliberately smaller than it was. It also held a count-up for
 * the statistics and a cursor-tracking spotlight for the module cards; the
 * redesign dropped both, and dead exported API with tests attached is worse
 * than none. What is left is what the page uses.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * A one-shot read of the reader's motion preference.
 *
 * Guarded rather than assumed: this module is imported by tests running under
 * Node, where there is no `window` at all, and by any future server render.
 * The fallback is `false` — "animate" — because the hooks below treat reduced
 * motion as the branch that *skips* work, and defaulting to true off-screen
 * would be indistinguishable from an unstyled page.
 *
 * Prefer `useReducedMotion` inside components; this exists for the call sites
 * that only need the value once — the three 3D views, which read it to set the
 * initial state of their own Rotate checkbox and then leave the reader in
 * charge.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCE_QUERY).matches;
}

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** The server snapshot: rendered HTML carries no animation, so it is never "reduced". */
function serverSnapshot(): boolean {
  return false;
}

/**
 * The motion preference, live.
 *
 * The OS setting is not fixed for the life of a page — macOS and Windows both
 * flip it from a settings pane the reader can reach without leaving the tab,
 * and assistive software toggles it programmatically. Subscribing costs one
 * listener and means turning motion off takes effect on the page already open,
 * rather than on the next reload.
 *
 * `useSyncExternalStore` is used over an effect-and-state pair because the
 * media query is exactly an external store: it has a current value readable
 * synchronously at render, so the first paint is already correct instead of
 * animating for one frame and then correcting itself.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, serverSnapshot);
}

export interface RevealOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

/**
 * Scroll-triggered reveal.
 *
 * Returns a ref to hang on the element and a flag the caller turns into a class
 * or a style. The flag, not the hook, owns the animation — that keeps the CSS
 * in the stylesheet where it can be themed, and keeps this file free of JSX.
 *
 * The important guarantee is the failure mode. A reveal is normally written as
 * "start hidden, become visible", which means any path where the observer never
 * fires leaves content permanently invisible — a blank page for anyone without
 * `IntersectionObserver`, and a page that animates against the reader's stated
 * wishes for everyone else. So `shown` starts *true* whenever we cannot observe
 * or should not animate, and only starts false when we are certain we will get
 * a callback to flip it.
 *
 * `once` defaults to true: re-hiding content the reader has already read, purely
 * because they scrolled back past it, is motion for its own sake. The negative
 * bottom `rootMargin` holds the reveal until the element is properly on screen
 * rather than firing on the single pixel that crosses the fold.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: RevealOptions = {},
): { ref: RefObject<T | null>; shown: boolean } {
  const { threshold = 0.15, rootMargin = '0px 0px -8% 0px', once = true } = options;
  const reduced = useReducedMotion();
  const ref = useRef<T>(null);
  // Resolved before the first render, so the initial state is already final in
  // the cases where no observer will ever run.
  const immediate = reduced || typeof IntersectionObserver === 'undefined';
  const [shown, setShown] = useState(immediate);

  useEffect(() => {
    // Covers the reader flipping "reduce motion" on while a section is still
    // waiting below the fold: it resolves immediately rather than staying dark.
    if (immediate) {
      setShown(true);
      return;
    }
    const element = ref.current;
    if (!element) return;

    // The threshold is a fraction of the *element*, and an element taller than
    // the viewport caps its own intersection ratio at viewport/element — on a
    // phone, the modules chapter runs seven screens tall, its ratio tops out
    // near 0.13, and a 0.15 threshold means the observer never fires and the
    // chapter rests invisible. So for tall elements the bar becomes a fraction
    // of the viewport instead: "a third of a screen of it is showing" is
    // reachable at any height, and 0.3 leaves room for the -8% rootMargin and
    // for a rotation to landscape between measure and reveal.
    const viewportHeight = window.innerHeight || 0;
    const elementHeight = element.getBoundingClientRect().height;
    const effectiveThreshold =
      viewportHeight > 0 && elementHeight > 0
        ? Math.min(threshold, (viewportHeight * 0.3) / elementHeight)
        : threshold;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            // Disconnecting here rather than in cleanup stops a pinned element
            // from delivering a callback per scroll frame for the rest of the
            // session once it has served its purpose.
            if (once) observer.disconnect();
          } else if (!once) {
            setShown(false);
          }
        }
      },
      { threshold: effectiveThreshold, rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [immediate, threshold, rootMargin, once]);

  return { ref, shown };
}
