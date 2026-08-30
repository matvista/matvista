/**
 * The element join, kept out of `thermal/materials.ts` on purpose.
 *
 * `materials.ts` is imported by `scripts/gen-module-figures.ts`, which runs
 * under plain Node with a resolver hook for extensionless specifiers — and
 * plain Node refuses a JSON import without a `with { type: 'json' }`
 * attribute, which app code cannot carry because Vite and vitest resolve it
 * differently. So the dataset stays free of the JSON import and the lookup
 * lives here, where only the app and the tests reach it.
 *
 * The alternative was a load hook in the generator. This is the smaller
 * change, and it happens to be the better separation: the entries are data,
 * the element join is a lookup over somebody else's data.
 */
import elementsRaw from '../data/elements.json';

interface ElementRow {
  symbol: string;
  atomic_mass: number;
  melt: number | null;
}

const ELEMENTS = elementsRaw as unknown as ElementRow[];

export function element(symbol: string): ElementRow {
  const e = ELEMENTS.find((x) => x.symbol === symbol);
  if (!e) throw new Error(`no element '${symbol}' in the dataset`);
  return e;
}
