/**
 * FatigueFigure — generated, do not edit by hand.
 *
 * Estimated S–N curves for three of the alloys in `FATIGUE_BEHAVIOUR`, built by
 * `fitSn`/`fatigueStrength` from `src/failure/model.ts` on the tensile strengths in
 * `src/mechanical/materials.ts`. Titanium and steel flatten at an endurance limit;
 * nickel has none and keeps descending, ending below the steel it started above.
 *
 * Regenerate with:
 *   node --experimental-strip-types scripts/gen-module-figures.ts
 */
export function FatigueFigure() {
  return (
    <svg viewBox="0 0 640 420" aria-hidden="true" style={{ display: 'block', width: '100%', height: 'auto' }}>
      {/* axes and gridlines */}
      <line x1="58" y1="370" x2="490" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="50" y="373.8" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">0</text>
      <line x1="58" y1="301.6" x2="490" y2="301.6" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="50" y="305.4" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">100</text>
      <line x1="58" y1="233.2" x2="490" y2="233.2" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="50" y="237" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">200</text>
      <line x1="58" y1="164.8" x2="490" y2="164.8" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="50" y="168.6" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">300</text>
      <line x1="58" y1="96.4" x2="490" y2="96.4" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="50" y="100.2" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">400</text>
      <line x1="58" y1="28" x2="490" y2="28" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="50" y="31.8" textAnchor="end" fontSize="11" fill="var(--fig-label, #52514e)">500</text>
      <line x1="58" y1="28" x2="58" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="58" y1="370" x2="58" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="58" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">10³</text>
      <line x1="130" y1="28" x2="130" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="130" y1="370" x2="130" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="130" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">10⁴</text>
      <line x1="202" y1="28" x2="202" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="202" y1="370" x2="202" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="202" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">10⁵</text>
      <line x1="274" y1="28" x2="274" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="274" y1="370" x2="274" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="274" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">10⁶</text>
      <line x1="346" y1="28" x2="346" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="346" y1="370" x2="346" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="346" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">10⁷</text>
      <line x1="418" y1="28" x2="418" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="418" y1="370" x2="418" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="418" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">10⁸</text>
      <line x1="490" y1="28" x2="490" y2="370" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <line x1="490" y1="370" x2="490" y2="374" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1" />
      <text x="490" y="387" textAnchor="middle" fontSize="11" fill="var(--fig-label, #52514e)">10⁹</text>
      <line x1="58" y1="28" x2="58" y2="370" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1.2" />
      <line x1="58" y1="370" x2="490" y2="370" stroke="var(--fig-ink, #2f2e2b)" strokeWidth="1.2" />
      <text x="274" y="408" textAnchor="middle" fontSize="12" fill="var(--fig-label, #52514e)">Cycles to failure, N (log scale)</text>
      <text x="15" y="199" textAnchor="middle" fontSize="12" fill="var(--fig-label, #52514e)" transform="rotate(-90 15 199)">Stress amplitude, S (MPa)</text>
      {/* Titanium: fitSn(UTS 520 MPa, ratio 0.5) */}
      <path d="M58,49.9 L61.6,53 L65.2,56.1 L68.8,59.2 L72.4,62.2 L76,65.2 L79.6,68.2 L83.2,71.1 L86.8,74 L90.4,76.9 L94,79.8 L97.6,82.6 L101.2,85.4 L104.8,88.2 L108.4,90.9 L112,93.6 L115.6,96.3 L119.2,99 L122.8,101.6 L126.4,104.3 L130,106.8 L133.6,109.4 L137.2,112 L140.8,114.5 L144.4,117 L148,119.4 L151.6,121.9 L155.2,124.3 L158.8,126.7 L162.4,129.1 L166,131.4 L169.6,133.7 L173.2,136 L176.8,138.3 L180.4,140.6 L184,142.8 L187.6,145 L191.2,147.2 L194.8,149.4 L198.4,151.5 L202,153.7 L205.6,155.8 L209.2,157.9 L212.8,159.9 L216.4,162 L220,164 L223.6,166 L227.2,168 L230.8,170 L234.4,171.9 L238,173.9 L241.6,175.8 L245.2,177.7 L248.8,179.5 L252.4,181.4 L256,183.2 L259.6,185.1 L263.2,186.9 L266.8,188.6 L270.4,190.4 L274,192.2 L274,192.2 L277.6,192.2 L281.2,192.2 L284.8,192.2 L288.4,192.2 L292,192.2 L295.6,192.2 L299.2,192.2 L302.8,192.2 L306.4,192.2 L310,192.2 L313.6,192.2 L317.2,192.2 L320.8,192.2 L324.4,192.2 L328,192.2 L331.6,192.2 L335.2,192.2 L338.8,192.2 L342.4,192.2 L346,192.2 L349.6,192.2 L353.2,192.2 L356.8,192.2 L360.4,192.2 L364,192.2 L367.6,192.2 L371.2,192.2 L374.8,192.2 L378.4,192.2 L382,192.2 L385.6,192.2 L389.2,192.2 L392.8,192.2 L396.4,192.2 L400,192.2 L403.6,192.2 L407.2,192.2 L410.8,192.2 L414.4,192.2 L418,192.2 L421.6,192.2 L425.2,192.2 L428.8,192.2 L432.4,192.2 L436,192.2 L439.6,192.2 L443.2,192.2 L446.8,192.2 L450.4,192.2 L454,192.2 L457.6,192.2 L461.2,192.2 L464.8,192.2 L468.4,192.2 L472,192.2 L475.6,192.2 L479.2,192.2 L482.8,192.2 L486.4,192.2 L490,192.2" fill="none" stroke="var(--fig-b, #a8511f)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="274" cy="192.2" r="3.4" fill="var(--fig-b, #a8511f)" />
      {/* Nickel: fitSn(UTS 480 MPa, ratio 0.4) */}
      <path d="M58,74.5 L61.6,76.9 L65.2,79.3 L68.8,81.6 L72.4,83.9 L76,86.3 L79.6,88.5 L83.2,90.8 L86.8,93.1 L90.4,95.3 L94,97.5 L97.6,99.7 L101.2,101.9 L104.8,104.1 L108.4,106.2 L112,108.4 L115.6,110.5 L119.2,112.6 L122.8,114.6 L126.4,116.7 L130,118.8 L133.6,120.8 L137.2,122.8 L140.8,124.8 L144.4,126.8 L148,128.7 L151.6,130.7 L155.2,132.6 L158.8,134.5 L162.4,136.4 L166,138.3 L169.6,140.2 L173.2,142 L176.8,143.9 L180.4,145.7 L184,147.5 L187.6,149.3 L191.2,151.1 L194.8,152.9 L198.4,154.6 L202,156.4 L205.6,158.1 L209.2,159.8 L212.8,161.5 L216.4,163.2 L220,164.9 L223.6,166.5 L227.2,168.2 L230.8,169.8 L234.4,171.4 L238,173 L241.6,174.6 L245.2,176.2 L248.8,177.7 L252.4,179.3 L256,180.8 L259.6,182.4 L263.2,183.9 L266.8,185.4 L270.4,186.9 L274,188.4 L277.6,189.8 L281.2,191.3 L284.8,192.7 L288.4,194.1 L292,195.6 L295.6,197 L299.2,198.4 L302.8,199.8 L306.4,201.1 L310,202.5 L313.6,203.9 L317.2,205.2 L320.8,206.5 L324.4,207.8 L328,209.2 L331.6,210.5 L335.2,211.7 L338.8,213 L342.4,214.3 L346,215.5 L349.6,216.8 L353.2,218 L356.8,219.3 L360.4,220.5 L364,221.7 L367.6,222.9 L371.2,224.1 L374.8,225.2 L378.4,226.4 L382,227.6 L385.6,228.7 L389.2,229.9 L392.8,231 L396.4,232.1 L400,233.2 L403.6,234.3 L407.2,235.4 L410.8,236.5 L414.4,237.6 L418,238.7 L418,238.7 L421.6,239.7 L425.2,240.8 L428.8,241.8 L432.4,242.9 L436,243.9 L439.6,244.9 L443.2,245.9 L446.8,246.9 L450.4,247.9 L454,248.9 L457.6,249.9 L461.2,250.8 L464.8,251.8 L468.4,252.8 L472,253.7 L475.6,254.7 L479.2,255.6 L482.8,256.5 L486.4,257.4 L490,258.3" fill="none" stroke="var(--fig-d, #8a6d1f)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Steel (1020): fitSn(UTS 380 MPa, ratio 0.5) */}
      <path d="M58,136.1 L61.6,138.4 L65.2,140.6 L68.8,142.8 L72.4,145.1 L76,147.3 L79.6,149.4 L83.2,151.6 L86.8,153.7 L90.4,155.8 L94,157.9 L97.6,160 L101.2,162 L104.8,164 L108.4,166.1 L112,168 L115.6,170 L119.2,172 L122.8,173.9 L126.4,175.8 L130,177.7 L133.6,179.6 L137.2,181.4 L140.8,183.3 L144.4,185.1 L148,186.9 L151.6,188.7 L155.2,190.4 L158.8,192.2 L162.4,193.9 L166,195.6 L169.6,197.3 L173.2,199 L176.8,200.7 L180.4,202.3 L184,204 L187.6,205.6 L191.2,207.2 L194.8,208.8 L198.4,210.4 L202,211.9 L205.6,213.5 L209.2,215 L212.8,216.5 L216.4,218 L220,219.5 L223.6,220.9 L227.2,222.4 L230.8,223.8 L234.4,225.3 L238,226.7 L241.6,228.1 L245.2,229.4 L248.8,230.8 L252.4,232.2 L256,233.5 L259.6,234.8 L263.2,236.2 L266.8,237.5 L270.4,238.8 L274,240 L274,240 L277.6,240 L281.2,240 L284.8,240 L288.4,240 L292,240 L295.6,240 L299.2,240 L302.8,240 L306.4,240 L310,240 L313.6,240 L317.2,240 L320.8,240 L324.4,240 L328,240 L331.6,240 L335.2,240 L338.8,240 L342.4,240 L346,240 L349.6,240 L353.2,240 L356.8,240 L360.4,240 L364,240 L367.6,240 L371.2,240 L374.8,240 L378.4,240 L382,240 L385.6,240 L389.2,240 L392.8,240 L396.4,240 L400,240 L403.6,240 L407.2,240 L410.8,240 L414.4,240 L418,240 L421.6,240 L425.2,240 L428.8,240 L432.4,240 L436,240 L439.6,240 L443.2,240 L446.8,240 L450.4,240 L454,240 L457.6,240 L461.2,240 L464.8,240 L468.4,240 L472,240 L475.6,240 L479.2,240 L482.8,240 L486.4,240 L490,240" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="274" cy="240" r="3.4" fill="var(--fig-a, #256bbd)" />
      {/* series labels at the right-hand end of each curve */}
      <text x="500" y="196.2" textAnchor="start" fontSize="11" fill="var(--fig-b, #a8511f)">Titanium</text>
      <text x="500" y="208.2" textAnchor="start" fontSize="9.5" fill="var(--fig-label, #52514e)">fatigue limit</text>
      <text x="500" y="244" textAnchor="start" fontSize="11" fill="var(--fig-a, #256bbd)">Steel (1020)</text>
      <text x="500" y="256" textAnchor="start" fontSize="9.5" fill="var(--fig-label, #52514e)">fatigue limit</text>
      <text x="500" y="270" textAnchor="start" fontSize="11" fill="var(--fig-d, #8a6d1f)">Nickel</text>
      <text x="500" y="282" textAnchor="start" fontSize="9.5" fill="var(--fig-label, #52514e)">no fatigue limit</text>
      {/* endurance-limit annotation */}
      <line x1="271" y1="244" x2="258" y2="260" stroke="var(--fig-accent, #b0184a)" strokeWidth="1" />
      <text x="254" y="264" textAnchor="end" fontSize="11" fill="var(--fig-accent, #b0184a)">endurance limit 190 MPa</text>
      <text x="254" y="277" textAnchor="end" fontSize="10" fill="var(--fig-label, #52514e)">the curve flattens and stays flat</text>
    </svg>
  );
}
