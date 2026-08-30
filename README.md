# MatVista

**Interactive visual toolkit for materials science — periodic trends, crystal structures, phase diagrams.**

MatVista gives students and material scientists visual, interactive views onto materials data. It grows module by module, and each module stands alone as a tool you can teach with, study from, or use for quick reference.

## Modules

| Module | Status |
|---|---|
| **Periodic Trends Explorer** — heatmap periodic table; color 118 elements by electronegativity, ionization energy, electron affinity, melting/boiling point, density, or atomic mass | ✅ available |
| **Crystal Structure Viewer** — 3D unit cells for 8 structures (SC, FCC, BCC, HCP, diamond cubic, rock salt, CsCl, perovskite); ball-and-stick or space-filling, coordination-shell highlighting, a live theoretical-density calculator, and a packing factor and coordination number *derived* from the cell — the sphere count, the a↔R relation and the neighbour list worked through line by line rather than recited | ✅ available |
| **Miller Indices & Slip Systems** — type any (hkl) or [uvw] and see the plane cut the cell in 3D, with the reciprocal construction, d-spacing, family members, and a Schmid-factor ranking over all 12 FCC / 48 BCC slip systems; the structure-factor rule then says whether that (hkl) is allowed or extinct for the selected metal, applied to the plane **as entered** — so (100) is extinct in FCC where (200) is the second peak — and where it is allowed, the d-spacing already on screen gives the 2θ it appears at, with a link through to the XRD pattern that peak sits in | ✅ available |
| **Defects & diffusion** — point-defect visualiser, equilibrium-vacancy calculator, a case-hardening simulator solving Fick's second law, and an equal-`Dt` curve giving every other time-and-temperature pair that produces the same profile — the answer to "can I run this hotter for less time?" | ✅ available |
| **Polymers** — run a polymerisation and watch the distribution it makes: two histograms of one sample, counted by number and weighed, with the two averages they disagree about and the dispersity each route is pinned to (1 + p for step growth, approaching 1 for living chains). The degree of polymerisation then becomes a chain — 252 nm of polyethylene in a coil 6.9 nm across — and a density becomes a per cent crystallinity, with LDPE, UHMWPE and HDPE marked where they fall. Repeat-unit masses are computed from the app's own element data and crystalline density is derived from the unit cell, so one measured number stands in the whole module | ✅ available |
| **Mechanical properties** — engineering stress–strain curves for 7 metals with the 0.002 offset construction, resilience, true-stress overlay, and a Hall–Petch grain-size panel | ✅ available |
| **Composites** — specify a laminate from any of three fibres and five matrices at any volume fraction, and get the isostrain and isostress bounds on its modulus, the share of the load the fibres actually carry, an exact rule-of-mixtures density, and a specific stiffness ranked against the 54 materials on the Ashby chart by that module's own index. The strength panel is the honest half: the rule of mixtures overshoots Appendix B's *own* measured composites by 1.6× to 2.1×, every one, and the module draws the gap and says why rather than printing the number as an answer | ✅ available |
| **Phase Diagram Explorer** — interactive Cu–Ni, Pb–Sn and Fe–Fe₃C diagrams; click any point for phases, tie line and lever-rule fractions, with the Gibbs phase rule P + F = C + N read off the point you are dragging, and the microconstituent split (primary phase against the eutectic or eutectoid mixture) for Pb–Sn as well as for steel | ✅ available |
| **Heat treatment** — TTT diagrams for 1080/5140/4340 steels with a cooling-rate slider read by Scheil additivity, predicted phase fractions and hardness, a Jominy end-quench comparison, and an austenitising-temperature control shown against a Fe–Fe₃C strip, which marks when the chosen temperature sits below A₃ and part of the section never became austenite at all | ✅ available |
| **Failure analysis** — plane-strain fracture toughness and critical crack size for five alloys, across five named crack geometries with their closed-form Y (centre crack, edge notch, semicircular surface flaw, Feddersen finite-width secant, thin-walled vessel) plus a free-Y fallback, a leak-before-break wall thickness for the pressure-vessel case, estimated S–N curves that flatten only for alloys with a real fatigue limit, Paris-law crack growth for three steel classes, and Larson–Miller creep rupture | ✅ available |
| **Material Selection (Ashby)** — log–log property chart of 54 materials with movable performance-index guide lines (E/ρ, E^½/ρ, E^⅓/ρ, σ/ρ, σ^⅔/ρ) and live ranking, each index shown with the derivation behind it: the objective, the constraint, the free variable eliminated, and the exponent that falls out | ✅ available |
| **Semiconductors** — band gaps for seven materials against the visible spectrum, each with the wavelength λ = 1239.8/E_g it corresponds to and the emission colour where the gap is direct (and a stated reason there is none where it is indirect), carrier concentrations and conductivity from doping and temperature across the extrinsic and intrinsic regimes, and p–n junction band bending with built-in potential and depletion width | ✅ available |
| **Corrosion** — galvanic couples across 25 alloys in seawater with the area-ratio effect, the 20-entry EMF series with live Nernst shifts, simplified Pourbaix diagrams for iron, aluminium and zinc, a penetration rate in mm/yr converted from a corrosion current density you supply as a measurement, and concentration cells — metal-ion and differential-aeration — where one metal corrodes with no couple anywhere | ✅ available |
| **XRD Simulator** — powder diffraction patterns for SC/BCC/FCC/diamond-cubic samples across four X-ray sources, with indexed peak table, structure overlay, and an extinction panel whose chips separate the two ways an index can be missing: forbidden by the structure factor, or simply out of this anode's reach because sin θ = λ/2d cannot exceed 1. The panel says how many families clear that floor, and every reachable chip links into the Miller module, which draws the plane and agrees on the angle | ✅ available |

Modules are grouped in the header by where they sit in a materials course — Structure, Microstructure, Properties, Analysis.

Two of them are now wired to each other rather than only claiming to be. The Miller module
computes a d-spacing; the XRD module turns d-spacings into peak positions. So an allowed
index in XRD's extinction panel is a link into Miller, which draws that plane and reports
the same 2θ, and Miller's reflection readout links back to the pattern the peak sits in.
A test walks every one of those links and fails if the two pages disagree about whether a
reflection is allowed or about the angle it appears at.

The app opens on a landing page introducing the fourteen modules, indexed by the same four
course groups the header uses; each entry links straight into one. `#/trends` is the
periodic table.

Every figure on that page — the lattice plate, the Fe–Fe₃C diagram, the S–N curves, the
Ashby chart, the diffraction pattern — is generated by the scripts in `scripts/` from the
same model code the modules run, and committed. So is the **figure index** that opens the
modules chapter: fourteen panels, one per module, each plotted from that module's own model —
the periodic table shaded by melting point, 1080's TTT nose, all 54
Ashby materials, α-iron's diffraction lines, aluminium's Pourbaix map. Regenerate them all
with:

```bash
npm run figures
```

`src/assets/figures/figures.test.ts` fails if a committed figure has drifted from the data
behind it, so a change to a model cannot quietly leave a stale diagram on the front page.
It also fails if a module is added to the navigation without a panel in the index, and if
the index outgrows either of its byte budgets — one per panel, which scales with the module
count, and one for the whole plate, which is a ratchet moved by hand against a real build.

The index's *shape* is derived from the navigation rather than written down beside it, so
the columns are the course groups and a panel's row is its place within its group. They are
no longer equal: Structure and Properties run four deep where the others run three, and the
grid draws a seam only as far as the deeper of the two columns it separates and a row rule
only across the columns that have a row there.

Four of the plates are fetched only as the reader approaches them — the figure index and
the three showcase figures, 51 kB of committed SVG between them — each landing in a box
that already holds its aspect ratio, so nothing on the page moves when one arrives. First
paint is the index chunk and the stylesheet and nothing else: **93.45 kB gzipped** — index
84.53 plus a render-blocking 8.92. A module costs about 0.4 kB of that, which is its landing
card, its signature mark and its nav entry; the module itself is a 5–6 kB chunk that only a
reader who opens it ever fetches.

One thing on the page is not a plate. The worked example — Fe–C cooled to just below the
eutectoid — is **live**: a composition control from 0.05 to 2.14 wt% C, two stacked bars,
and the four fractions recomputed from `phase/eutectoid.ts`, which is where
`phase/systems.ts` gets its four Fe–C fixed points too, so the front page and the module it
links into cannot disagree. Slide past 0.76 wt% C and the proeutectoid constituent flips
from ferrite to cementite; at exactly 0.76 there is none at all. The bars are coloured by
*phase* rather than by role, so the ferrite inside pearlite is visibly part of the ferrite
in the phase bar — which is the difference between a microconstituent fraction and a phase
fraction, drawn rather than asserted.

## Sharing a view

Every module is linkable, and so is what it is showing. The URL carries the state that
changes the result, so a worked example can be handed over as a link:

| Link | Shows |
|---|---|
| `#/heattreat?rate=1200&steel=4340` | 4340 quenched at 1200 °C/s |
| `#/miller?plane=110&s=bcc&sigma=90` | (110) in a BCC cell, 90 MPa applied |
| `#/phase?T=200&sys=pb-sn&x=40` | Pb–40 wt% Sn at 200 °C |
| `#/trends?el=W&prop=melt` | the table coloured by melting point, tungsten selected |
| `#/failure?geom=vessel&p=12` | leak before break in a thin-walled vessel at 12 MPa |
| `#/xrd?sample=fe&source=cr` | iron powder on a chromium anode, where the λ ≤ 2d limit bites |

View controls that only change how the same result is drawn — bond display, auto-rotate,
elastic zoom — stay out of the URL, so a shared link stays short and says something.
Values outside a control's range are clamped to it, and an unrecognised module or value
falls back rather than failing, so an edited link still lands somewhere useful.

Planned modules and their data requirements are tracked in [ROADMAP.md](ROADMAP.md).

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Tests

```bash
npm test
```

**Over 1000 tests** over the physics, the data and the routing. `npm test` prints the exact
count, and it is deliberately not repeated here: this file said "281 assertions" until that
was false, then "over 300" until the suite had more than tripled past it. A figure nothing
asserts goes stale quietly, so the bound is stated in the form that can only get truer.

They are not smoke tests: the ones that matter check computed values against published
worked examples —
Callister's 8.2 µm Griffith flaw in soda-lime glass, his S-590 creep rupture at 800 °C and
140 MPa, the 0.35 wt% carbon steel that comes out 44% pearlite, the carburising problem
that takes seven hours, copper's first four diffraction lines at 43.3, 50.4, 74.1 and 90.0°.

The rest guard the domain boundaries, which is where this kind of app goes wrong quietly:
that only alloys with a real fatigue limit get a flat S–N curve, that every XRD sample is
cubic because the d-spacing formula is, that a two-phase point always has its composition
between the ends of its own tie line, and that the documented counts in this file still
match the data.

A few gate behaviour rather than arithmetic, and those render the routed app in jsdom
instead of asserting over source text: that the 3D auto-rotate checkbox is reachable by
its label and that the value it shows is the value the orbit control receives, that a
result which changes announces itself to a screen reader, and that a chip's selected
state is carried by something other than its colour. Source-level matching was tried for
the first of these and defeated three times; only rendering it held.

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript
- No chart library — visualizations are hand-rolled DOM/SVG for full control
- Element data derived from [Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON) (CC-BY-SA)

## Contributing

Issues and PRs welcome. Each module lives in `src/components/`; shared data in `src/data/`. Keep modules self-contained so they stand alone as teaching tools.

## License

[MIT](LICENSE)
