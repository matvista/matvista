/**
 * Navigation model.
 *
 * The flat tab bar stopped scaling at eight modules, so modules are grouped by
 * where they sit in a materials course: what the material *is* (structure),
 * what is going on inside it (microstructure), how it *behaves* (properties),
 * and how you *measure or choose* it (analysis). Each group holds a handful of
 * modules, so the header stays four items wide however many modules exist.
 */

export type Tab =
  | 'trends'
  | 'crystals'
  | 'miller'
  | 'defects'
  | 'phase'
  | 'heattreat'
  | 'mechanical'
  | 'composites'
  | 'failure'
  | 'semiconductors'
  | 'selection'
  | 'corrosion'
  | 'xrd';

export interface NavItem {
  id: Tab;
  label: string;
  /** One line shown under the label in the menu. */
  blurb: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'structure',
    label: 'Structure',
    items: [
      {
        id: 'trends',
        label: 'Periodic trends',
        blurb: 'Heatmap the periodic table by any property',
      },
      {
        id: 'crystals',
        label: 'Crystal structures',
        blurb: '3D unit cells and theoretical density',
      },
      {
        id: 'miller',
        label: 'Miller indices',
        blurb: 'Planes, directions and slip systems',
      },
    ],
  },
  {
    id: 'microstructure',
    label: 'Microstructure',
    items: [
      {
        id: 'defects',
        label: 'Defects & diffusion',
        blurb: 'Point defects, vacancies, case hardening',
      },
      {
        id: 'phase',
        label: 'Phase diagrams',
        blurb: 'Tie lines, lever rule, steel microstructure',
      },
      {
        id: 'heattreat',
        label: 'Heat treatment',
        blurb: 'TTT curves, quenching, hardenability',
      },
    ],
  },
  {
    id: 'properties',
    label: 'Properties',
    items: [
      {
        id: 'mechanical',
        label: 'Mechanical properties',
        blurb: 'Stress–strain curves and Hall–Petch',
      },
      {
        id: 'failure',
        label: 'Failure analysis',
        blurb: 'Fracture, fatigue, crack growth, creep',
      },
      {
        id: 'composites',
        label: 'Composites',
        blurb: 'Rule of mixtures, bounds, short fibres',
      },
      {
        id: 'semiconductors',
        label: 'Semiconductors',
        blurb: 'Band gaps, doping, the p–n junction',
      },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    items: [
      {
        id: 'xrd',
        label: 'XRD simulator',
        blurb: 'Powder patterns and indexed peaks',
      },
      {
        id: 'selection',
        label: 'Material selection',
        blurb: 'Ashby charts and performance indices',
      },
      {
        id: 'corrosion',
        label: 'Corrosion',
        blurb: 'Galvanic couples, Nernst, Pourbaix',
      },
    ],
  },
];

const ITEMS = NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ ...item, group: g })));

export function findItem(tab: Tab): NavItem & { group: NavGroup } {
  const hit = findItemOrNull(tab);
  if (!hit) throw new Error(`No nav entry for tab "${tab}"`);
  return hit;
}

/**
 * Lookup for routes that may legitimately not be a module — the landing page is
 * a route with no nav entry, so the header must be able to ask without throwing.
 */
export function findItemOrNull(tab: string): (NavItem & { group: NavGroup }) | null {
  return ITEMS.find((i) => i.id === tab) ?? null;
}

/** How many modules there are. One source for every count that says so. */
export const MODULE_COUNT = NAV_GROUPS.flatMap((g) => g.items).length;

/**
 * Counts written into prose are spelled, not printed — "Twelve modules", not
 * "12 modules" — so the spelling has to come from the count or the two drift.
 * They have: the ROADMAP's chunk table said "eleven" with twelve modules
 * shipped, and `docs.test.ts` was written to catch exactly that.
 *
 * Lives here because three surfaces need it and none of them should own it:
 * the landing page's copy, the figure generator's plate comment, and the test
 * that checks the ROADMAP against both. Throws rather than falling back to
 * digits — a silent "17 modules" in a sentence written for a word is the same
 * drift one step quieter.
 */
export const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
];

export function numberWord(n: number): string {
  const word = NUMBER_WORDS[n];
  if (word === undefined) throw new Error(`no word for ${n}: extend NUMBER_WORDS`);
  return word;
}

/** Sentence-initial form of a spelled count. */
export function capitalisedWord(n: number): string {
  const w = numberWord(n);
  return w[0].toUpperCase() + w.slice(1);
}
