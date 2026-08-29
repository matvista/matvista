/**
 * AshbyFigure — generated, do not edit by hand.
 *
 * Young's modulus against density for all 54 materials in `SELECTION_MATERIALS`
 * (`src/selection/materials.ts`), on log–log axes with the families coloured by
 * `CLASS_LABEL`. The dashed line is the `e12-rho` entry of `INDICES`, drawn at the
 * `indexValue` of the best material in the set, so it bounds the whole population.
 *
 * Regenerate with:
 *   node --experimental-strip-types scripts/gen-module-figures.ts
 */
export function AshbyFigure() {
  return (
    <svg viewBox="0 0 640 420" aria-hidden="true" style={{ display: 'block', width: '100%', height: 'auto' }}>
      {/* axes and gridlines */}
      <line x1="62" y1="370" x2="624" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="54" y="373.8" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">10⁻³</text>
      <line x1="62" y1="315" x2="624" y2="315" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="54" y="318.8" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">10⁻²</text>
      <line x1="62" y1="260" x2="624" y2="260" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="54" y="263.8" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">10⁻¹</text>
      <line x1="62" y1="205" x2="624" y2="205" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="54" y="208.8" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">10⁰</text>
      <line x1="62" y1="150" x2="624" y2="150" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="54" y="153.8" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">10¹</text>
      <line x1="62" y1="95" x2="624" y2="95" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="54" y="98.8" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">10²</text>
      <line x1="62" y1="40" x2="624" y2="40" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="54" y="43.8" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">10³</text>
      <line x1="62" y1="40" x2="62" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="62" y1="370" x2="62" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="62" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">0.3</text>
      <line x1="124.3" y1="40" x2="124.3" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="124.3" y1="370" x2="124.3" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="124.3" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">0.5</text>
      <line x1="208.9" y1="40" x2="208.9" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="208.9" y1="370" x2="208.9" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="208.9" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">1</text>
      <line x1="293.5" y1="40" x2="293.5" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="293.5" y1="370" x2="293.5" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="293.5" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">2</text>
      <line x1="405.3" y1="40" x2="405.3" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="405.3" y1="370" x2="405.3" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="405.3" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">5</text>
      <line x1="489.9" y1="40" x2="489.9" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="489.9" y1="370" x2="489.9" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="489.9" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">10</text>
      <line x1="574.5" y1="40" x2="574.5" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="574.5" y1="370" x2="574.5" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="574.5" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">20</text>
      <line x1="624" y1="40" x2="624" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="624" y1="370" x2="624" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="624" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">30</text>
      <line x1="62" y1="40" x2="62" y2="370" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1.2" />
      <line x1="62" y1="370" x2="624" y2="370" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1.2" />
      <text x="343" y="408" textAnchor="middle" fontSize="12" fill="var(--fig-label, #52514e)">Density, ρ (Mg/m³ = g/cm³) — log scale</text>
      <text x="15" y="205" textAnchor="middle" fontSize="12" fill="var(--fig-label, #52514e)" transform="rotate(-90 15 205)">Young's modulus, E (GPa) — log scale</text>
      {/* family legend, labels from CLASS_LABEL */}
      <circle cx="66" cy="18" r="3.4" fill="var(--fig-a, #256bbd)" />
      <text x="75" y="22" textAnchor="start" fontSize="10.5" fill="var(--fig-label, #52514e)">Metals</text>
      <rect x="115.7" y="14.9" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <text x="127.8" y="22" textAnchor="start" fontSize="10.5" fill="var(--fig-label, #52514e)">Ceramics &amp; glasses</text>
      <path d="M241.2,14 L244.8,20.6 L237.6,20.6 Z" fill="var(--fig-c, #0f766e)" />
      <text x="250.2" y="22" textAnchor="start" fontSize="10.5" fill="var(--fig-label, #52514e)">Composites &amp; fibres</text>
      <circle cx="369.4" cy="18" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <text x="378.4" y="22" textAnchor="start" fontSize="10.5" fill="var(--fig-label, #52514e)">Polymers</text>
      <path d="M433.8,13.6 L438.2,18 L433.8,22.4 L429.4,18 Z" fill="none" stroke="var(--fig-d, #8a6d1f)" strokeWidth="1.4" />
      <text x="442.8" y="22" textAnchor="start" fontSize="10.5" fill="var(--fig-label, #52514e)">Elastomers</text>
      {/* E^½ / ρ guide line, slope 2, anchored on Diamond (natural) */}
      <path d="M62,158.7 L365.3,40" fill="none" stroke="var(--fig-accent, #b0184a)" strokeWidth="1.6" strokeDasharray="7 4" />
      <text x="68" y="48.5" textAnchor="start" fontSize="12" fill="var(--fig-accent, #b0184a)">E^½ / ρ = 8.8</text>
      <text x="68" y="61.5" textAnchor="start" fontSize="10.5" fill="var(--fig-accent, #b0184a)">slope 2 — nothing lies above it</text>
      {/* Metals — from SELECTION_MATERIALS */}
      <circle cx="460.4" cy="77.6" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="460.4" cy="77.6" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="462.7" cy="79.3" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="451.5" cy="94.8" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="330.6" cy="103.9" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="333.3" cy="102.7" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="330.1" cy="103.9" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="334.6" cy="103.2" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="475.6" cy="91.7" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="470.5" cy="92.7" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="278.6" cy="114.1" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="390.6" cy="91.9" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="475.6" cy="78" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="492.6" cy="67.2" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="551.8" cy="80.3" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="570.2" cy="61.5" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="570.3" cy="101.2" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="583.1" cy="82.2" r="3.4" fill="var(--fig-a, #256bbd)" />
      <circle cx="495.8" cy="102.2" r="3.4" fill="var(--fig-a, #256bbd)" />
      {/* Ceramics & glasses — from SELECTION_MATERIALS */}
      <rect x="374.4" y="60" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="366.2" y="65.4" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="351.5" y="62.3" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="351.5" y="65.3" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="424.5" y="74.8" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="317.7" y="100.8" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="303.7" y="100.4" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="322.4" y="87.5" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="302" y="99.4" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="309.1" y="85.8" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="359.1" y="38.1" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="271.3" y="144.6" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      <rect x="312.7" y="119.9" width="6.2" height="6.2" fill="var(--fig-b, #a8511f)" />
      {/* Composites & fibres — from SELECTION_MATERIALS */}
      <path d="M266.3,82.1 L269.9,88.7 L262.7,88.7 Z" fill="var(--fig-c, #0f766e)" />
      <path d="M250,97.6 L253.6,104.2 L246.4,104.2 Z" fill="var(--fig-c, #0f766e)" />
      <path d="M299.5,110.1 L303.1,116.7 L295.9,116.7 Z" fill="var(--fig-c, #0f766e)" />
      <path d="M279.3,71.1 L282.9,77.7 L275.7,77.7 Z" fill="var(--fig-c, #0f766e)" />
      <path d="M253.4,84.6 L257,91.2 L249.8,91.2 Z" fill="var(--fig-c, #0f766e)" />
      <path d="M324.6,98.7 L328.2,105.3 L321,105.3 Z" fill="var(--fig-c, #0f766e)" />
      <path d="M119.4,139 L123,145.6 L115.8,145.6 Z" fill="var(--fig-c, #0f766e)" />
      {/* Polymers — from SELECTION_MATERIALS */}
      <circle cx="236.2" cy="184" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="224.9" cy="181.4" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="239.1" cy="173.1" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="231.2" cy="184.3" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="236.2" cy="176.9" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="241.9" cy="202.7" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="245.6" cy="175.4" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="230.2" cy="180.9" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="196.7" cy="198" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="203.8" cy="203.2" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="199.4" cy="240.4" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="201.4" cy="213.9" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      <circle cx="244.6" cy="183.4" r="3.4" fill="var(--fig-d, #8a6d1f)" />
      {/* Elastomers — from SELECTION_MATERIALS */}
      <path d="M206.5,336.4 L210.9,340.8 L206.5,345.2 L202.1,340.8 Z" fill="none" stroke="var(--fig-d, #8a6d1f)" strokeWidth="1.4" />
      <path d="M201.4,322.8 L205.8,327.2 L201.4,331.6 L197,327.2 Z" fill="none" stroke="var(--fig-d, #8a6d1f)" strokeWidth="1.4" />
      {/* anchor callouts, dropped where they would collide */}
      <text x="460.4" y="67.6" textAnchor="middle" fontSize="11" fill="var(--fig-ink, #2f2e2b)">Steel</text>
      <text x="578.2" y="65" textAnchor="start" fontSize="11" fill="var(--fig-ink, #2f2e2b)">Tungsten</text>
      <text x="385.5" y="66.6" textAnchor="start" fontSize="11" fill="var(--fig-ink, #2f2e2b)">Alumina</text>
      <text x="370.2" y="44.7" textAnchor="start" fontSize="11" fill="var(--fig-ink, #2f2e2b)">Diamond</text>
      <text x="274.3" y="89.6" textAnchor="start" fontSize="11" fill="var(--fig-ink, #2f2e2b)">CFRP</text>
      <text x="127.4" y="146.5" textAnchor="start" fontSize="11" fill="var(--fig-ink, #2f2e2b)">Wood</text>
      <text x="214.5" y="344.3" textAnchor="start" fontSize="11" fill="var(--fig-ink, #2f2e2b)">Rubber</text>
    </svg>
  );
}
