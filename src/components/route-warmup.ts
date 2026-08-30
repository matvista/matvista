/**
 * Resolve a route's lazily-imported module *before* a test starts timing it.
 *
 * Not shipped: nothing under `src` outside the test files imports this, so it
 * is reachable from no entry and lands in no chunk.
 *
 * **The defect it fixes.** `App` code-splits every module behind `React.lazy`,
 * so the first render of a route inside a test file pays a cold dynamic import
 * — and those tests wait for the module to appear with `waitFor`/`findBy*`,
 * whose default budget is 1000 ms. The import is not a render, and it does not
 * belong inside a window meant to measure one.
 *
 * Measured on `auto-rotate.behaviour.test.tsx`, that file alone, idle machine,
 * `vitest run --pool=forks --maxWorkers=2 --reporter=verbose`:
 *
 *   without this warm-up   387 / 329 / 340 ms   first render of each route
 *                           11 –  44 ms         every later test, same routes
 *   with it                101 /  46 /  60 ms   first render of each route
 *
 * The gap between the two columns is the import, and it is charged entirely to
 * whichever test renders the route first. That left about 2.6x of headroom
 * against the 1000 ms budget on an idle machine — and under a full parallel
 * suite, not enough: the first of those three tests failed roughly one full
 * run in four, at ~1140 ms, which is the budget plus its own overhead.
 *
 * Raising the timeout would have hidden that rather than fixed it. Warming the
 * module first takes it out of the window: the second call to the same
 * `import()` resolves from the module registry, so what the test then waits
 * for is one commit.
 *
 * Warm only the routes a file actually visits. `crystals`, `miller` and
 * `defects` pull `three` in, which is both slow and, unstubbed, useless in
 * jsdom — a file that does not stub `@react-three/fiber` must not warm them.
 */

/**
 * The same imports `App.tsx` makes, keyed by route id. Duplicated on purpose —
 * `App` needs them inside `lazy()` — and `route-warmup.test.ts` fails if the
 * two lists ever stop agreeing, which is the only way this file can go stale.
 */
export const LAZY_ROUTES = {
  trends: () => import('./PeriodicTrends'),
  crystals: () => import('./CrystalStructures'),
  miller: () => import('./MillerIndices'),
  defects: () => import('./DefectsDiffusion'),
  mechanical: () => import('./StressStrain'),
  composites: () => import('./Composites'),
  polymers: () => import('./Polymers'),
  thermal: () => import('./ThermalProperties'),
  failure: () => import('./FailureAnalysis'),
  phase: () => import('./PhaseDiagrams'),
  heattreat: () => import('./HeatTreatment'),
  selection: () => import('./AshbyChart'),
  semiconductors: () => import('./Semiconductors'),
  corrosion: () => import('./Corrosion'),
  xrd: () => import('./XrdSimulator'),
} as const;

export type RouteId = keyof typeof LAZY_ROUTES;

/** Await this at the top of a test file, before any test can be timed. */
export function warmRoutes(...ids: RouteId[]): Promise<unknown> {
  return Promise.all(ids.map((id) => LAZY_ROUTES[id]()));
}
