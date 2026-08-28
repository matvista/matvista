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
  | 'selection'
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
