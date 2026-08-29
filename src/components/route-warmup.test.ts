import { describe, expect, it } from 'vitest';
import appSource from '../App.tsx?raw';
import warmupSource from './route-warmup.ts?raw';
import { NAV_GROUPS } from '../nav';
import { LAZY_ROUTES } from './route-warmup';

/**
 * `route-warmup` restates `App.tsx`'s dynamic imports so tests can resolve a
 * route's module before timing a render against it. Restating anything is a
 * drift hazard, and a warm-up that silently warms the wrong module would put
 * the flake back while looking fixed — the module would load late again and
 * the failure would read as a mysterious timeout, not as a stale list.
 *
 * So the list is checked against `App.tsx`'s own source rather than trusted.
 */
describe('the test route warm-up matches the app', () => {
  /** Every `import('./components/X')` App hands to `lazy()`. */
  const appImports = [...appSource.matchAll(/import\('\.\/components\/([A-Za-z]+)'\)/g)].map(
    (m) => m[1],
  );

  it('finds App’s lazy imports at all', () => {
    // The regex is load-bearing: an empty match would make every assertion
    // below vacuous.
    expect(appImports.length).toBeGreaterThan(10);
  });

  /**
   * Read from the source, not from `fn.toString()`: Vite rewrites a dynamic
   * import into its own loader, so the compiled arrow no longer contains the
   * path it imports. The source is what a reader would compare by eye.
   */
  it('warms exactly the modules App lazy-loads, and no others', () => {
    const warmed = [...warmupSource.matchAll(/import\('\.\/([A-Za-z]+)'\)/g)].map((m) => m[1]);
    expect(warmed).toHaveLength(Object.keys(LAZY_ROUTES).length);
    expect([...warmed].sort()).toEqual([...appImports].sort());
  });

  /**
   * The file's own claim that it ships in no chunk, asserted rather than
   * asserted-in-prose: it is reachable from no entry only while nothing but a
   * test imports it. The `length` check keeps this from passing vacuously on a
   * glob that matched nothing.
   */
  it('is imported only by tests, so it is reachable from no entry', () => {
    const sources = import.meta.glob('../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const importers = Object.entries(sources)
      .filter(([path]) => !path.includes('route-warmup'))
      .filter(([, src]) => /['"][^'"]*\/route-warmup['"]/.test(src))
      .map(([path]) => path);
    expect(importers.length).toBeGreaterThan(0);
    expect(importers.filter((path) => !path.includes('.test.'))).toEqual([]);
  });

  it('covers every route in the nav, so no test can ask for a missing one', () => {
    const navIds = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)).sort();
    expect(Object.keys(LAZY_ROUTES).sort()).toEqual(navIds);
  });
});
