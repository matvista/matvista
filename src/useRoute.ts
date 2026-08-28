/**
 * React bindings for the hash route.
 *
 * The in-memory route is the source of truth and updates synchronously, so the
 * UI never waits on the address bar. Writing to `history` is debounced behind
 * it, for one blunt reason: dragging a slider produces a value per frame, and
 * Safari throws a SecurityError at roughly 100 history writes per 30 seconds.
 * A *trailing* debounce (the timer resets on every change, rather than firing
 * every N ms) means a continuous drag writes nothing until the reader pauses,
 * and then writes once. The write is also wrapped, so if a browser does throttle
 * us the address bar falls behind for a moment — it never breaks the app.
 *
 * Back/forward is handled by adopting the route from the event and cancelling
 * any pending write, so a queued write cannot overwrite where the reader just
 * navigated to.
 */
import { useCallback, useSyncExternalStore } from 'react';
import {
  buildHash,
  formatNumber,
  parseHash,
  parseNumber,
  type Route,
  type RouteId,
} from './router';

/** Trailing debounce for history writes, ms. */
const WRITE_DELAY = 200;

const listeners = new Set<() => void>();

/**
 * Cached so `getSnapshot` returns a stable reference; a fresh object per call
 * would spin `useSyncExternalStore` forever.
 */
let current: Route = parseHash(typeof location === 'undefined' ? '' : location.hash);
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * The hash we believe is in the address bar.
 *
 * While a write is pending, `current` is deliberately ahead of the URL, so
 * "the URL differs from `current`" does NOT mean the reader navigated — it is
 * the normal state mid-debounce. Comparing against what we last *wrote*
 * separates the two. Without this, any hashchange landing inside the debounce
 * window reverts the change the reader just made.
 */
let urlHash = canonical(typeof location === 'undefined' ? '' : location.hash);

/** Normalised for comparison, so encoding differences do not read as changes. */
function canonical(hash: string): string {
  const r = parseHash(hash);
  return buildHash(r.tab, r.params);
}

function emit() {
  for (const l of listeners) l();
}

function cancelPending() {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
}

function write(hash: string, mode: 'push' | 'replace') {
  try {
    if (mode === 'push') history.pushState(null, '', hash);
    else history.replaceState(null, '', hash);
    urlHash = canonical(hash);
  } catch {
    // Throttled by the browser. The route in memory is still correct, so the
    // app carries on; only the address bar is momentarily stale, and `urlHash`
    // still records what the address bar actually holds.
  }
}

/**
 * Adopt a route the reader navigated to (back/forward, or editing the URL).
 *
 * Compared against the last hash we wrote rather than against `current`: an
 * event carrying the hash we already know about is our own stale URL seen
 * mid-debounce, not a navigation, and adopting it would throw away a pending
 * change.
 */
function adopt() {
  const raw = location.hash;
  if (canonical(raw) === urlHash) return;
  cancelPending();
  urlHash = canonical(raw);
  current = parseHash(raw);
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', adopt);
  window.addEventListener('hashchange', adopt);
}

function setRoute(next: Route, mode: 'push' | 'replace') {
  const hash = buildHash(next.tab, next.params);
  if (hash === buildHash(current.tab, current.params)) return;
  current = next;
  emit();

  if (mode === 'push') {
    // A module change is a real navigation: write it immediately so Back works.
    cancelPending();
    write(hash, 'push');
    return;
  }
  cancelPending();
  timer = setTimeout(() => {
    timer = null;
    write(buildHash(current.tab, current.params), 'replace');
  }, WRITE_DELAY);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): Route {
  return current;
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * The active module. Changing it clears the query, because params are
 * module-scoped — otherwise `#/miller?steel=4340` would be reachable.
 */
export function useTab(): [RouteId, (tab: RouteId) => void] {
  const route = useRoute();
  const setTab = useCallback((tab: RouteId) => setRoute({ tab, params: {} }, 'push'), []);
  return [route.tab, setTab];
}

/**
 * These accept the functional-updater form as well as a bare value, so they are
 * drop-in replacements for `useState` — several modules already keep derived
 * state in step with an effect that reads the previous value.
 */
export type Setter<T> = (value: T | ((prev: T) => T)) => void;

function resolve<T>(value: T | ((prev: T) => T), prev: T): T {
  return typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
}

/** A string param, absent from the URL whenever it equals the fallback. */
export function useRouteString(
  key: string,
  fallback: string,
): [string, Setter<string>] {
  const route = useRoute();
  const tab = route.tab;
  const set = useCallback<Setter<string>>(
    (value) => {
      // A component belonging to the module we have just left can still fire an
      // effect after the route has moved on — the modules that keep derived
      // state in step (the slip mode, the density metal) do exactly that. The
      // setter resolves `current.tab` at call time, so such a write would land
      // in the *new* module's query string and leak a foreign param into a
      // shared link. Writes from a module that is no longer current are dropped.
      if (current.tab !== tab) return;
      const params = { ...current.params };
      const next = resolve(value, current.params[key] ?? fallback);
      if (next === fallback) delete params[key];
      else params[key] = next;
      setRoute({ tab: current.tab, params }, 'replace');
    },
    [key, fallback, tab],
  );
  return [route.params[key] ?? fallback, set];
}

/**
 * A numeric param, trimmed to a readable precision on the way out and clamped
 * to `[min, max]` on the way in.
 *
 * The clamp is not cosmetic. A range input silently pins its *displayed* thumb
 * to its own min/max, so `?vacT=1200` against a slider that stops at 1080 would
 * show 1080 while the model computed with 1200 — the readout contradicting the
 * control right beside it. Clamping on read means the URL can never drive a
 * control outside the domain its label claims.
 */
export function useRouteNumber(
  key: string,
  fallback: number,
  min = -Infinity,
  max = Infinity,
): [number, Setter<number>] {
  const route = useRoute();
  const tab = route.tab;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const set = useCallback<Setter<number>>(
    (value) => {
      if (current.tab !== tab) return; // see the note in useRouteString
      const params = { ...current.params };
      const raw = resolve(value, parseNumber(current.params[key], fallback));
      const next = Math.min(max, Math.max(min, raw));
      // Compared as text, so a value that formats identically to the fallback
      // drops out of the URL rather than lingering as `?rate=50`.
      const text = formatNumber(next);
      if (text === formatNumber(fallback) || text === '') delete params[key];
      else params[key] = text;
      setRoute({ tab: current.tab, params }, 'replace');
    },
    [key, fallback, min, max, tab],
  );
  return [clamp(parseNumber(route.params[key], fallback)), set];
}

/**
 * A param constrained to a known set.
 *
 * URLs get hand-edited and mis-typed, and a union-typed value read straight out
 * of a query string is a lie the type system cannot catch — `?y=bogus` would be
 * typed `YProp` while matching nothing. Anything not in `allowed` falls back,
 * so a bad link lands on a working module instead of an empty chart.
 */
export function useRouteEnum<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, Setter<T>] {
  const [raw, setRaw] = useRouteString(key, fallback);
  const value = (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  // The updater is handed a validated T, never the raw query string, so an
  // out-of-set URL value cannot leak into a component's own state logic.
  const set = useCallback<Setter<T>>(
    (next) =>
      setRaw((prev) =>
        resolve(next, (allowed as readonly string[]).includes(prev) ? (prev as T) : fallback),
      ),
    [setRaw, allowed, fallback],
  );
  return [value, set];
}

/** A boolean param, present only when it differs from the fallback. */
export function useRouteFlag(
  key: string,
  fallback: boolean,
): [boolean, Setter<boolean>] {
  const [raw, setRaw] = useRouteString(key, fallback ? '1' : '0');
  const set = useCallback<Setter<boolean>>(
    (value) => setRaw((prev) => (resolve(value, prev === '1') ? '1' : '0')),
    [setRaw],
  );
  return [raw === '1', set];
}
