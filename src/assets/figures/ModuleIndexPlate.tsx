/**
 * ModuleIndexPlate — generated, do not edit by hand.
 *
 * Fourteen panels, one per module, each plotted from that module’s own model
 * code — the periodic table from `data/elements.json`, the TTT nose from
 * `heattreat/model.ts`, the Ashby cloud from `selection/materials.ts`, the
 * diffraction sticks from `xrd/diffraction.ts`, and so on for all fourteen.
 *
 * Four columns, one per course group, in `NAV_GROUPS` order.
 *
 * Larger than the four single plates, and lazily imported by the landing
 * page for that reason: it heads the modules chapter, far below the fold,
 * so it has no business in the first paint.
 *
 * Regenerate with:
 *   node --experimental-strip-types scripts/gen-module-figures.ts
 */
export function ModuleIndexPlate() {
  return (
    <svg viewBox="0 0 1224 946" aria-hidden="true" style={{ display: 'block', width: '100%', height: 'auto' }}>
      {/* four columns, one per course group; 4, 3, 4 and 3 modules in them */}
      <text x="30" y="30" fontSize="11" letterSpacing="0.14em" fill="var(--fig-label, #52514e)">STRUCTURE</text>
      <text x="330" y="30" fontSize="11" letterSpacing="0.14em" fill="var(--fig-label, #52514e)">MICROSTRUCTURE</text>
      <text x="630" y="30" fontSize="11" letterSpacing="0.14em" fill="var(--fig-label, #52514e)">PROPERTIES</text>
      <text x="930" y="30" fontSize="11" letterSpacing="0.14em" fill="var(--fig-label, #52514e)">ANALYSIS</text>
      <path d="M12,46H1212M312,46V934M612,46V934M912,46V934M12,268H1212M12,490H1212M12,712H312M612,712H912" fill="none" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <text x="30" y="67" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Periodic trends</text>
      <text x="30" y="82" fontSize="10.5" fill="var(--fig-label, #52514e)">118 elements, by melting point where measured</text>
      <text x="30" y="289" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Crystal structures</text>
      <text x="30" y="304" fontSize="10.5" fill="var(--fig-label, #52514e)">the face-centred cubic cell</text>
      <text x="30" y="511" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Miller indices</text>
      <text x="30" y="526" fontSize="10.5" fill="var(--fig-label, #52514e)">(111) cutting the cell</text>
      <text x="30" y="733" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Polymers</text>
      <text x="30" y="748" fontSize="10.5" fill="var(--fig-label, #52514e)">one sample, counted and weighed</text>
      <text x="330" y="67" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Defects &amp; diffusion</text>
      <text x="330" y="82" fontSize="10.5" fill="var(--fig-label, #52514e)">carburising at 1, 4 and 9 hours</text>
      <text x="330" y="289" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Phase diagrams</text>
      <text x="330" y="304" fontSize="10.5" fill="var(--fig-label, #52514e)">the Pb–Sn eutectic</text>
      <text x="330" y="511" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Heat treatment</text>
      <text x="330" y="526" fontSize="10.5" fill="var(--fig-label, #52514e)">1080 steel, TTT nose and Mₛ</text>
      <text x="630" y="67" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Mechanical properties</text>
      <text x="630" y="82" fontSize="10.5" fill="var(--fig-label, #52514e)">three metals, to fracture</text>
      <text x="630" y="511" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Composites</text>
      <text x="630" y="526" fontSize="10.5" fill="var(--fig-label, #52514e)">the two bounds, carbon in epoxy</text>
      <text x="630" y="289" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Failure analysis</text>
      <text x="630" y="304" fontSize="10.5" fill="var(--fig-label, #52514e)">critical crack size vs stress</text>
      <text x="630" y="733" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Semiconductors</text>
      <text x="630" y="748" fontSize="10.5" fill="var(--fig-label, #52514e)">band gaps; visible light begins at the rule</text>
      <text x="930" y="67" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">XRD simulator</text>
      <text x="930" y="82" fontSize="10.5" fill="var(--fig-label, #52514e)">α-iron on a copper anode</text>
      <text x="930" y="289" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Material selection</text>
      <text x="930" y="304" fontSize="10.5" fill="var(--fig-label, #52514e)">54 materials, E against ρ</text>
      <text x="930" y="511" fontSize="13" fontWeight="600" fill="var(--fig-ink, #2f2e2b)">Corrosion</text>
      <text x="930" y="526" fontSize="10.5" fill="var(--fig-label, #52514e)">aluminium: immune, passive, dissolving</text>
      {/* 118 elements at their real table positions, by melting point where measured */}
      <path d="M222,108h14v15h-14zM237,123h14v15h-14zM237,139h14v15h-14zM89,186h14v15h-14zM104,186h14v15h-14zM119,186h14v15h-14zM148,186h14v15h-14zM163,186h14v15h-14zM178,186h14v15h-14zM193,186h14v15h-14zM281,186h14v15h-14z" fill="var(--fig-grid, #e1e0d9)" />
      <path d="M30,92h14v15h-14zM281,92h14v15h-14zM237,108h14v15h-14zM252,108h14v15h-14zM266,108h14v15h-14zM281,108h14v15h-14zM281,123h14v15h-14z" fill="var(--fig-a, #256bbd)" opacity="0.22" />
      <path d="M30,123h14v15h-14zM252,123h14v15h-14zM266,123h14v15h-14zM30,139h14v15h-14zM207,139h14v15h-14zM266,139h14v15h-14zM281,139h14v15h-14zM30,154h14v15h-14zM266,154h14v15h-14zM281,154h14v15h-14zM30,170h14v15h-14zM193,170h14v15h-14zM281,170h14v15h-14zM30,186h14v15h-14zM133,186h14v15h-14zM222,186h14v15h-14z" fill="var(--fig-a, #256bbd)" opacity="0.38" />
      <path d="M30,108h14v15h-14zM45,123h14v15h-14zM193,139h14v15h-14zM252,139h14v15h-14zM193,154h14v15h-14zM207,154h14v15h-14zM222,154h14v15h-14zM237,154h14v15h-14zM252,154h14v15h-14zM207,170h14v15h-14zM222,170h14v15h-14zM237,170h14v15h-14zM252,170h14v15h-14zM266,170h14v15h-14zM119,232h14v15h-14zM133,232h14v15h-14zM207,186h14v15h-14zM237,186h14v15h-14zM252,186h14v15h-14zM266,186h14v15h-14z" fill="var(--fig-a, #256bbd)" opacity="0.53" />
      <path d="M45,108h14v15h-14zM207,123h14v15h-14zM45,139h14v15h-14zM119,139h14v15h-14zM178,139h14v15h-14zM222,139h14v15h-14zM45,154h14v15h-14zM178,154h14v15h-14zM45,170h14v15h-14zM60,217h14v15h-14zM74,217h14v15h-14zM89,217h14v15h-14zM104,217h14v15h-14zM119,217h14v15h-14zM133,217h14v15h-14zM148,217h14v15h-14zM163,217h14v15h-14zM178,217h14v15h-14zM252,217h14v15h-14zM178,170h14v15h-14zM45,186h14v15h-14zM60,232h14v15h-14zM104,232h14v15h-14zM148,232h14v15h-14zM163,232h14v15h-14zM178,232h14v15h-14zM193,232h14v15h-14zM207,232h14v15h-14zM237,232h14v15h-14zM252,232h14v15h-14z" fill="var(--fig-a, #256bbd)" opacity="0.69" />
      <path d="M207,108h14v15h-14zM222,123h14v15h-14zM60,139h14v15h-14zM74,139h14v15h-14zM89,139h14v15h-14zM104,139h14v15h-14zM133,139h14v15h-14zM148,139h14v15h-14zM163,139h14v15h-14zM60,154h14v15h-14zM74,154h14v15h-14zM119,154h14v15h-14zM148,154h14v15h-14zM163,154h14v15h-14zM193,217h14v15h-14zM207,217h14v15h-14zM222,217h14v15h-14zM237,217h14v15h-14zM266,217h14v15h-14zM74,170h14v15h-14zM163,170h14v15h-14zM74,232h14v15h-14zM89,232h14v15h-14zM222,232h14v15h-14zM266,232h14v15h-14zM74,186h14v15h-14z" fill="var(--fig-a, #256bbd)" opacity="0.84" />
      <path d="M89,154h14v15h-14zM104,154h14v15h-14zM133,154h14v15h-14zM89,170h14v15h-14zM104,170h14v15h-14zM119,170h14v15h-14zM133,170h14v15h-14zM148,170h14v15h-14z" fill="var(--fig-a, #256bbd)" opacity="1" />
      {/* the FCC cell, from buildAtoms() — corner and face-centre sites */}
      <path d="M81,439L179,413M179,413L179,305M179,305L81,332M81,332L81,439M147,479L245,452M245,452L245,345M245,345L147,371M147,371L147,479M81,439L147,479M179,413L245,452M179,305L245,345M81,332L147,371" fill="none" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1.2" />
      <circle cx="179" cy="413" r="12" fill="var(--fig-a, #256bbd)" opacity="0.56" />
      <circle cx="179" cy="305" r="12" fill="var(--fig-a, #256bbd)" opacity="0.65" />
      <circle cx="130" cy="372" r="7.5" fill="var(--fig-a, #256bbd)" opacity="0.67" />
      <circle cx="81" cy="439" r="12" fill="var(--fig-a, #256bbd)" opacity="0.68" />
      <circle cx="212" cy="379" r="7.5" fill="var(--fig-a, #256bbd)" opacity="0.69" />
      <circle cx="163" cy="446" r="7.5" fill="var(--fig-a, #256bbd)" opacity="0.7" />
      <circle cx="245" cy="452" r="12" fill="var(--fig-a, #256bbd)" opacity="0.73" />
      <circle cx="81" cy="332" r="12" fill="var(--fig-a, #256bbd)" opacity="0.77" />
      <circle cx="163" cy="338" r="7.5" fill="var(--fig-a, #256bbd)" opacity="0.8" />
      <circle cx="114" cy="405" r="7.5" fill="var(--fig-a, #256bbd)" opacity="0.81" />
      <circle cx="245" cy="345" r="12" fill="var(--fig-a, #256bbd)" opacity="0.82" />
      <circle cx="196" cy="412" r="7.5" fill="var(--fig-a, #256bbd)" opacity="0.83" />
      <circle cx="147" cy="479" r="12" fill="var(--fig-a, #256bbd)" opacity="0.85" />
      <circle cx="147" cy="371" r="12" fill="var(--fig-a, #256bbd)" opacity="0.94" />
      {/* (111) cutting the cell, from planePolygon([1,1,1]) */}
      <path d="M81,661L179,635M179,635L179,527M179,527L81,554M81,554L81,661M147,701L245,674M245,674L245,567M245,567L147,593M147,593L147,701M81,661L147,701M179,635L245,674M179,527L245,567M81,554L147,593" fill="none" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1.2" />
      <path d="M179,635L81,554L147,701Z" fill="var(--fig-accent, #b0184a)" opacity="0.16" />
      <path d="M179,635L81,554L147,701Z" fill="none" stroke="var(--fig-accent, #b0184a)" strokeWidth="1.8" strokeLinejoin="round" />
      {/* one sample counted by number and by weight, from polymer/model.ts at p = 0.95 */}
      <path d="M32,914v-156h4v156zM42,914v-96h4v96zM52,914v-80h4v80zM61,914v-49h4v49zM71,914v-41h4v41zM80,914v-25h4v25zM90,914v-19h4v19zM100,914v-16h4v16zM109,914v-10h4v10zM119,914v-8h4v8zM128,914v-5h4v5zM138,914v-4h4v4zM148,914v-3h4v3zM157,914v-2h4v2zM167,914v-2h4v2zM177,914v-1h4v1zM186,914v-1h4v1z" fill="var(--fig-b, #a8511f)" />
      <path d="M36,914v-30h4v30zM46,914v-50h4v50zM56,914v-67h4v67zM65,914v-57h4v57zM75,914v-61h4v61zM84,914v-46h4v46zM94,914v-39h4v39zM104,914v-38h4v38zM113,914v-26h4v26zM123,914v-25h4v25zM132,914v-17h4v17zM142,914v-15h4v15zM152,914v-10h4v10zM161,914v-8h4v8zM171,914v-7h4v7zM181,914v-5h4v5zM190,914v-4h4v4zM200,914v-3h4v3zM209,914v-2h4v2zM219,914v-2h4v2zM229,914v-1h4v1zM238,914v-1h4v1zM248,914v-1h4v1zM258,914v-1h4v1zM296,914v-1h4v1z" fill="var(--fig-a, #256bbd)" />
      {/* Fick’s second law at 927 °C, from concentrationAt() — 1, 4 and 9 hours */}
      <path d="M330,92L338,125L346,155L353,182L361,203L369,219L377,231L385,238L393,243L400,245L408,247L416,247L424,248L432,248L440,248L447,248L455,248L463,248L471,248L479,248L486,248L494,248L502,248L510,248L518,248L526,248L533,248L541,248L549,248L557,248L565,248L573,248L580,248L588,248L596,248" fill="none" stroke="var(--fig-c, #0f766e)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M330,92L338,108L346,125L353,140L361,155L369,169L377,182L385,193L393,203L400,212L408,219L416,226L424,231L432,235L440,238L447,241L455,243L463,244L471,245L479,246L486,247L494,247L502,247L510,248L518,248L526,248L533,248L541,248L549,248L557,248L565,248L573,248L580,248L588,248L596,248" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M330,92L338,103L346,114L353,125L361,135L369,145L377,155L385,164L393,173L400,182L408,189L416,196L424,203L432,209L440,214L447,219L455,224L463,227L471,231L479,234L486,236L494,238L502,240L510,241L518,243L526,244L533,245L541,245L549,246L557,246L565,247L573,247L580,247L588,247L596,248" fill="none" stroke="var(--fig-b, #a8511f)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="330" y1="92" x2="596" y2="92" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      {/* the Pb–Sn eutectic, straight from PB_SN.boundaries */}
      <path d="M330,325L495,393L596,370" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M330,325L379,393" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M596,370L590,393" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M379,393L335,470" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M590,393L595,470" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M379,393L590,393" fill="none" stroke="var(--fig-accent, #b0184a)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      {/* 1080 steel’s TTT nose, from buildTtt() — start, finish and Mₛ */}
      <line x1="330" y1="545" x2="596" y2="545" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <path d="M579,546L434,551L410,556L395,561L386,567L381,572L377,577L375,583L374,588L375,593L376,599L378,604L381,609L384,615L388,620L394,625L400,631L406,635L414,641L423,647L431,651L442,657" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M555,546L473,552L452,557L438,562L430,567L424,573L421,578L419,583L419,589L419,594L420,599L422,604L425,609L429,615L433,620L438,625L444,631L451,636L458,641L467,647L476,651L487,657" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />
      <line x1="330" y1="673" x2="596" y2="673" stroke="var(--fig-accent, #b0184a)" strokeWidth="1.4" strokeDasharray="5 4" />
      {/* engineering curves from buildCurve(), through yield, UTS and fracture */}
      <path d="M630,248L634,171L637,162L641,156L645,150L648,146L652,141L657,136L661,132L664,129L668,126L672,123L676,120L679,117L683,114L687,111L690,109L694,106L698,104L701,101L706,99L710,100L714,100L717,100L721,101L725,102L729,102L732,103L736,104L740,106L743,107L747,108L751,110L756,112L759,114L763,117L767,119L770,121L774,124L778,126" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M630,248L636,232L642,230L648,228L654,226L660,225L665,224L673,223L679,222L685,221L691,220L697,219L703,218L709,217L715,217L721,216L727,215L732,215L738,214L744,213L752,213L758,213L764,213L770,213L776,213L782,213L788,214L794,214L799,214L805,214L811,215L817,215L823,215L831,216L837,216L843,217L849,217L855,218L861,219L866,219" fill="none" stroke="var(--fig-b, #a8511f)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M630,248L637,215L643,210L650,206L657,203L663,200L670,197L679,194L685,191L692,189L699,187L705,185L712,183L719,181L725,179L732,177L739,176L745,174L752,172L759,171L767,170L774,170L781,170L787,170L794,171L801,171L807,171L814,172L821,172L827,173L834,174L841,175L847,175L856,177L863,178L869,179L876,180L883,181L889,183L896,184" fill="none" stroke="var(--fig-c, #0f766e)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {/* critical crack size against stress, from criticalCrackSize(), log axis */}
      <path d="M630,372L634,379L638,385L642,389L646,394L650,398L654,401L658,405L662,408L666,410L670,413L674,415L678,418L683,420L687,422L691,424L695,426L699,427L703,429L707,431L711,432" fill="none" stroke="var(--fig-b, #a8511f)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M630,341L638,354L647,363L655,371L663,377L671,382L680,387L688,391L696,395L705,399L713,402L721,405L729,407L738,410L746,412L754,414L763,416L771,418L779,420L787,422L796,424" fill="none" stroke="var(--fig-c, #0f766e)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M630,323L643,342L657,355L670,364L683,372L697,378L710,383L723,388L736,392L750,396L763,399L776,402L790,405L803,408L816,410L830,413L843,415L856,417L869,419L883,421L896,423" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {/* the isostrain and isostress bounds from composite/model.ts, carbon in epoxy */}
      <path d="M630,690L637,687L643,683L650,679L657,675L663,671L670,667L677,663L683,659L690,656L697,652L703,648L710,644L716,640L723,636L730,632L736,629L743,625L750,621L756,617L763,613L770,609L776,605L783,602L790,598L796,594L803,590L810,586L816,582L823,578L830,575L836,571L843,567L849,563L856,559L863,555L869,551L876,548L883,544L889,540L896,536" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M630,690L637,690L643,690L650,690L657,690L663,690L670,690L677,690L683,690L690,690L697,690L703,690L710,690L716,690L723,689L730,689L736,689L743,689L750,689L756,689L763,689L770,689L776,688L783,688L790,688L796,688L803,687L810,687L816,687L823,686L830,686L836,685L843,684L849,683L856,682L863,680L869,677L876,673L883,665L889,646L896,536" fill="none" stroke="var(--fig-b, #a8511f)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {/* band gaps from SEMICONDUCTORS, against the visible range 1.77–3.10 eV */}
      <path d="M811,758V914" fill="none" stroke="var(--fig-accent, #b0184a)" strokeWidth="1.2" strokeDasharray="4 3" />
      <rect x="630" y="761" width="17" height="16" fill="var(--fig-a, #256bbd)" opacity="0.95" />
      <rect x="630" y="783" width="69" height="16" fill="var(--fig-d, #8a6d1f)" opacity="0.6" />
      <rect x="630" y="806" width="114" height="16" fill="var(--fig-d, #8a6d1f)" opacity="0.6" />
      <rect x="630" y="828" width="145" height="16" fill="var(--fig-a, #256bbd)" opacity="0.95" />
      <rect x="630" y="850" width="230" height="16" fill="var(--fig-d, #8a6d1f)" opacity="0.6" />
      <rect x="630" y="872" width="231" height="16" fill="var(--fig-a, #256bbd)" opacity="0.95" />
      <rect x="630" y="895" width="246" height="16" fill="var(--fig-a, #256bbd)" opacity="0.95" />
      {/* α-iron on Cu Kα, from computePattern() — every allowed BCC line */}
      <line x1="930" y1="248" x2="1196" y2="248" stroke="var(--fig-grid, #e1e0d9)" strokeWidth="1" />
      <path d="M985,248L985,92M1030,248L1030,226M1068,248L1068,209M1105,248L1105,237M1144,248L1144,230M1190,248L1190,242" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="2" />
      {/* all 54 materials, E against ρ on log axes — SELECTION_MATERIALS */}
      <path d="M1117,330h4v4h-4zM1117,330h4v4h-4zM1118,331h4v4h-4zM1112,338h4v4h-4zM1055,342h4v4h-4zM1056,342h4v4h-4zM1055,342h4v4h-4zM1057,342h4v4h-4zM1124,336h4v4h-4zM1121,337h4v4h-4zM1031,347h4v4h-4zM1084,337h4v4h-4zM1124,330h4v4h-4zM1132,325h4v4h-4zM1160,331h4v4h-4zM1169,322h4v4h-4zM1169,341h4v4h-4zM1175,332h4v4h-4zM1133,341h4v4h-4z" fill="var(--fig-a, #256bbd)" opacity="0.85" />
      <path d="M1077,323h4v4h-4zM1073,325h4v4h-4zM1067,324h4v4h-4zM1067,325h4v4h-4zM1101,330h4v4h-4zM1050,342h4v4h-4zM1044,342h4v4h-4zM1053,336h4v4h-4zM1043,342h4v4h-4zM1046,335h4v4h-4zM1070,313h4v4h-4zM1029,363h4v4h-4zM1048,351h4v4h-4z" fill="var(--fig-b, #a8511f)" opacity="0.85" />
      <path d="M1025,334h4v4h-4zM1017,341h4v4h-4zM1040,347h4v4h-4zM1031,329h4v4h-4zM1019,335h4v4h-4zM1052,342h4v4h-4zM955,361h4v4h-4z" fill="var(--fig-c, #0f766e)" opacity="0.85" />
      <path d="M1010,380h4v4h-4zM1005,379h4v4h-4zM1012,375h4v4h-4zM1008,380h4v4h-4zM1010,377h4v4h-4zM1013,389h4v4h-4zM1015,376h4v4h-4zM1008,379h4v4h-4zM992,387h4v4h-4zM995,389h4v4h-4zM993,407h4v4h-4zM994,394h4v4h-4zM1014,380h4v4h-4z" fill="var(--fig-d, #8a6d1f)" opacity="0.85" />
      <path d="M996,454h4v4h-4zM994,448h4v4h-4z" fill="var(--fig-accent, #b0184a)" opacity="0.85" />
      {/* aluminium’s Pourbaix map from POURBAIX — corrodes at both ends of the pH scale */}
      <rect x="930" y="655" width="266" height="20" fill="var(--fig-a, #256bbd)" opacity="0.22" />
      <rect x="930" y="655" width="266" height="20" fill="none" stroke="var(--fig-a, #256bbd)" strokeWidth="1" />
      <text x="1063" y="669" textAnchor="middle" fontSize="10.5" fill="var(--fig-label, #52514e)">immune</text>
      <rect x="930" y="553" width="76" height="102" fill="var(--fig-accent, #b0184a)" opacity="0.16" />
      <rect x="930" y="553" width="76" height="102" fill="none" stroke="var(--fig-accent, #b0184a)" strokeWidth="1" />
      <text x="968" y="608" textAnchor="middle" fontSize="10.5" fill="var(--fig-label, #52514e)">corrodes</text>
      <rect x="1006" y="553" width="86" height="102" fill="var(--fig-c, #0f766e)" opacity="0.16" />
      <rect x="1006" y="553" width="86" height="102" fill="none" stroke="var(--fig-c, #0f766e)" strokeWidth="1" />
      <text x="1049" y="608" textAnchor="middle" fontSize="10.5" fill="var(--fig-label, #52514e)">passive</text>
      <rect x="1092" y="553" width="105" height="102" fill="var(--fig-accent, #b0184a)" opacity="0.16" />
      <rect x="1092" y="553" width="105" height="102" fill="none" stroke="var(--fig-accent, #b0184a)" strokeWidth="1" />
      <text x="1144" y="608" textAnchor="middle" fontSize="10.5" fill="var(--fig-label, #52514e)">corrodes</text>
    </svg>
  );
}
