/**
 * Hash routing.
 *
 * The app is deployed to Cloudflare Pages as pure static assets, so there is no
 * server to rewrite unknown paths onto index.html. Hash routing is what keeps a
 * deep link working without one: everything after `#` is never sent to the
 * server, so `/#/heattreat?steel=4340` is still a request for `/`.
 *
 * Shape: `#/<tab>?<params>`. The tab segment says which module, the query says
 * what that module is showing. Params are per-module and are cleared on a tab
 * change, so two modules may reuse a key name without colliding.
 *
 * Which state belongs here: anything that changes the *result* — the steel, the
 * plane, the cooling rate, the temperature. View chrome that only changes how
 * the same result is drawn (bond display, auto-rotate, elastic zoom) stays
 * component-local, so a shared URL stays short and says something.
 */
import { NAV_GROUPS, type Tab } from './nav';

export const DEFAULT_TAB: Tab = 'trends';

const TABS = new Set<string>(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)));

export function isTab(value: string): value is Tab {
  return TABS.has(value);
}

export interface Route {
  tab: Tab;
  params: Record<string, string>;
}

/**
 * Read a location hash into a route.
 *
 * Anything unrecognisable degrades to the default tab rather than throwing — a
 * hand-edited or truncated URL should land the reader on the app, not on a
 * blank page.
 */
export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [pathPart = '', queryPart = ''] = splitOnce(raw, '?');
  const tab = pathPart.replace(/^\/+|\/+$/g, '');

  const params: Record<string, string> = {};
  if (queryPart) {
    for (const [k, v] of new URLSearchParams(queryPart)) params[k] = v;
  }

  return { tab: isTab(tab) ? tab : DEFAULT_TAB, params };
}

/**
 * Build a hash from a route.
 *
 * Keys are sorted, not written in insertion order: params are set as the reader
 * touches each control, so insertion order would make the same visible state
 * produce different URLs depending on which knob was turned first. These links
 * get pasted into worksheets and compared by eye, so one state means one URL.
 */
export function buildHash(tab: Tab, params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const k of Object.keys(params).sort()) {
    if (params[k] !== '') search.set(k, params[k]);
  }
  const query = search.toString();
  return query ? `#/${tab}?${query}` : `#/${tab}`;
}

/** `split(s, sep)` limited to the first separator, keeping the rest intact. */
function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}

/**
 * Numbers in a URL should be readable, so they are trimmed to six significant
 * figures. A logarithmic slider hands over values like 229.08665231…, and the
 * full float is both ugly and meaningless at the precision the model warrants.
 */
export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return '';
  return String(Number(v.toPrecision(6)));
}

/** Read a numeric param, falling back when it is absent or not a number. */
export function parseNumber(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
