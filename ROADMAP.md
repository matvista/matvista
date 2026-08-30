# MatVista roadmap

Modules in build order. Each entry records what it teaches, what data it needs,
what it reuses, and whether it holds under static hosting.

Entries stay here after they ship, rewritten to say what was actually built and
where it departed from the plan — the departures are the useful part, and they
are usually where the physics forced a different shape. The [README](README.md)
lists what exists from a reader's point of view; this file is the build record.

## Order of work

| # | Module | Value | Effort | Static-safe |
|---|---|---|---|---|
| ~~1~~ | ~~**Miller indices & slip systems**~~ — shipped | high | low | ✅ |
| ~~2~~ | ~~**TTT / CCT diagrams & heat treatment**~~ — shipped | very high | medium | ✅ |
| ~~3~~ | ~~**Fatigue, creep & fracture**~~ — shipped | high | medium | ✅ |
| ~~4~~ | ~~**Semiconductors & band structure**~~ — shipped | high | medium | ✅ |
| ~~5~~ | ~~**Corrosion & the galvanic series**~~ — shipped | medium | low | ✅ |
| 0 | **The module index at seventeen** — prerequisite, not a module | — | medium | ✅ |
| 6 | **Composites** — rule of mixtures, and a point on the Ashby chart | high | low | ✅ |
| 7 | **Polymers** — molecular weight, crystallinity, modulus against T | high | medium | ✅ |
| 8 | **Thermal properties** — expansion, conductivity, thermal stress | medium | low | ✅ |
| 9 | **Free energy & the common tangent** — shape not settled | high | medium | ✅ |
| 10 | **Magnetic properties** — conditional on a data gate | medium | medium | ✅ |
| — | Materials Project integration | high | high | ⚠️ see below |

Ranked by value per unit of effort. **The first five shipped**, and this file
said the roadmap was complete. It is not any more: five further modules are
planned below, with the reasoning for the order and for the two that are not
unconditional. What stays out is the Materials Project integration, which does
not hold under static hosting. Product-level work is tracked in
[docs/GAUNTLET.md](docs/GAUNTLET.md).

Entry 0 is a prerequisite rather than a module. The landing page's figure index
is a 4×3 grid with hard-coded counts and a byte budget that has room for two
more panels; five more modules break it, and it is cheaper to fix once than five
times. Nothing after it should be built first.

Between the two groups one further pass shipped that is not a module — three
correctness fixes and twelve features across the modules that already existed —
and then the landing page pass. Both are recorded below in the same form, because
two of the fixes changed what the app teaches and several of the departures are
worth not rediscovering.

---

## 1. Miller indices & slip systems — shipped

Built in `crystal/miller.ts`, `components/MillerScene.tsx` and
`components/MillerIndices.tsx`; costs 5.55 kB gzipped, plus a 4.17 kB `diffraction` chunk
shared with the XRD module. (It was a 2.3 kB `miller` chunk until `be91ef6` put the
allowed-reflection readout on this page; `xrd/diffraction.ts` then had two importers,
rollup lifted it, and `crystal/miller.ts` went into this module instead.) Enter a plane `(1̄11)` or direction `[110]` and watch it cut the unit cell in 3D,
with intercepts drawn and the reciprocal arithmetic shown step by step. Adds the
12 FCC / 48 BCC slip systems, Schmid factor for a chosen loading axis, and
resolved shear stress.

Plane and direction indexing is the thing students most reliably fail to
visualise from a textbook page. It also closes a loop in the app: d-spacing
derived from (hkl) feeds the peak positions that `xrd/diffraction.ts` already
computes.

- **Data:** none beyond what exists — slip systems are ~60 hard-coded triplets.
- **Reuses:** `crystal/geometry.ts` (`buildAtoms`, `buildCellEdges`) and
  `crystal/structures.ts`. `MillerScene.tsx` is a separate scene rather than an
  extension of `CrystalScene.tsx`; the `<Canvas>` shell and the cylinder-
  orientation helper are duplicated between the two and could be lifted into a
  shared scene component.
- **New:** plane-vs-cell intersection polygon, Schmid factor maths.

## 2. TTT / CCT diagrams & heat treatment — shipped

Built in `heattreat/steels.ts`, `heattreat/model.ts` and
`components/HeatTreatment.tsx`. Departures from the plan below, both
deliberate: the TTT curves are generated from a two-term nucleation/diffusion
model anchored on a digitised nose rather than from digitised full curves,
which keeps every member of the family physical when the nose moves; and the
cooling path is read against them by Scheil's additivity rule rather than by a
single crossing, which is what makes the pearlite/martensite split come out
right. `phase/systems.ts` stops at equilibrium, which is where real steel processing
begins. Overlay a draggable cooling curve on a TTT plot and report the resulting
microstructure — pearlite, bainite, martensite — with predicted hardness. Adds a
Jominy end-quench bar showing hardness against distance from the quenched end.

This converts the phase module from "read a diagram" into "choose a process and
get a material", which is the actual engineering skill.

- **Data:** as built — nose position and a finish-curve time factor per steel,
  plus nominal compositions and 13-point Jominy curves for 1080, 5140 and 4340.
  Mˢ is computed from composition by Andrews' equation rather than stored.
- **Reuses:** the SVG plotting and click-to-inspect patterns in
  `components/PhaseDiagrams.tsx`; the existing Fe–Fe₃C system for context.
- **New:** `src/heattreat/` for curve data and microstructure/hardness lookup.

## 3. Fatigue, creep & fracture — shipped

Built in `failure/model.ts`, `failure/materials.ts` and
`components/FailureAnalysis.tsx`; costs 12.06 kB gzipped. Four panels: critical
crack size from K_IC, estimated S–N curves, Paris-law crack growth, and
Larson–Miller creep rupture.

One departure from the plan below, and it matters. The plan was to extend the
seven entries in `mechanical/materials.ts` with `K_IC` and Paris constants. That
would have been wrong: plane-strain fracture toughness is a property of a
specific alloy in a specific heat treatment, not of "aluminium", and Paris
constants are published per *class* of steel and are not transferable to other
metals. Bolting either onto the annealed pure metals would have produced
confident numbers with no basis. So the module carries three separate datasets
with separate domains — `FRACTURE_ALLOYS` (Callister table 8.1, K_IC paired with
the yield strength it was measured against), `GROWTH_CLASSES` (Barsom & Rolfe,
steels only), and `BRITTLE_SOLIDS` (for Griffith) — and only the S–N panel reuses
`MECH_MATERIALS`, where tensile strength genuinely is the right input.

- **Data:** as built — five alloys with K_IC and yield strength, three brittle
  solids with E and surface energy, three Barsom crack-growth classes, per-alloy
  fatigue behaviour keyed to `MECH_MATERIALS`, and a digitised S-590
  Larson–Miller master curve.
- **Reuses:** `MECH_MATERIALS` for the S–N panel; the SVG axis and detail-panel
  patterns from `components/HeatTreatment.tsx`.
- **Verified:** Griffith reproduces Callister's 8.2 µm flaw in soda-lime glass at
  40 MPa; Larson–Miller reproduces his S-590 worked example (800 °C, 140 MPa →
  231 h against a published ~233 h); the closed-form Paris integration matches a
  400 000-step numerical integration to better than 0.05%.

## 4. Semiconductors & band structure — shipped

Built in `electronic/model.ts`, `electronic/materials.ts` and
`components/Semiconductors.tsx`; costs 8.32 kB gzipped. Three panels: band gaps
against the visible spectrum, doping and conductivity across the extrinsic and
intrinsic regimes, and p–n junction band bending.

Two departures from the plan below. First, n_i is anchored on published 300 K
values and scaled with temperature, rather than computed from effective masses:
DOS effective masses are quoted inconsistently across sources, and the resulting
n_i moves by a factor of two depending on which set you pick. Second, only four
of the seven materials carry carrier data. Band gap and mobility are tabulated
for all seven, a dependable n_i is not, and inventing one for the wide-gap
compounds so that every panel could offer every material would have put a
confident number where there is no source — so those three appear in the
band-gap comparison and nowhere else.

- **Data:** as built — seven materials with band gap, mobilities and gap kind
  from Callister table 18.3; n_i and relative permittivity for Si, Ge, GaAs and
  InSb only.
- **Verified:** kT = 0.0259 eV at 300 K; V_bi = 0.83 V and W = 0.15 µm for
  silicon doped 10¹⁷/10¹⁷; the mass-action law and charge neutrality hold across
  the whole doping range; the Arrhenius slope of n_i carries both the −Eg/2k term
  and the T^{3/2} prefactor.

## 4b. Original plan

Band gap explorer across Si, Ge, GaAs and the compound semiconductors: Fermi
level as a function of doping and temperature, carrier concentration,
conductivity against 1/T with the intrinsic and extrinsic regimes visible, and a
p–n junction band-bending diagram.

The biggest audience expansion available — it brings in electrical engineering
and physics students, not only materials ones. No overlap with any existing
module.

- **Data:** ~20 semiconductors with band gap, electron and hole mobilities,
  effective masses, and intrinsic carrier concentration.
- **Reuses:** element data for the elemental semiconductors; existing chart
  scaffolding.
- **New:** `src/electronic/` for the dataset and carrier-statistics maths.

## 5. Corrosion & the galvanic series — shipped

Built in `corrosion/model.ts`, `corrosion/data.ts` and `components/Corrosion.tsx`;
costs 9.96 kB gzipped. Three panels: galvanic couple with the area-ratio effect,
the EMF series with live Nernst shifts, and Pourbaix diagrams for Fe, Al and Zn.

Departure from the plan below: the galvanic series and the EMF series are kept as
**two separate datasets**, not merged into one ordered list. They disagree — passive
316 stainless sits above copper in seawater while chromium and iron are both far
below copper in the EMF series — because passivity is an oxide film and not a
standard potential. Blending them would have produced a single authoritative-looking
ranking that is wrong for whichever question you were asking.

- **Data:** as built — 25 alloys with typical seawater potentials (the *ordering*
  is the established part and the UI says so), the 20-entry EMF series from
  Callister table 17.1, and three simplified Pourbaix region maps.
- **Verified:** the Daniell cell at 1.103 V; the Nernst slope at 0.0592 V/decade;
  the water stability lines at −0.414 V and 0.815 V at pH 7; zinc anodic to steel
  and steel anodic to copper; aluminium and zinc corroding at both pH extremes
  while iron passivates in alkali.

## 5b. Original plan

Pick two metals and get the galvanic couple prediction: which one corrodes, the
driving voltage, and the area-ratio effect that makes a small anode
catastrophic. Adds Nernst-equation calculation and simplified Pourbaix diagrams
for Fe, Al and Zn showing immunity, passivation and corrosion zones.

Concrete and design-relevant — it answers "why did this bolt dissolve".

- **Data:** galvanic series as a single ordered list of ~30 alloys with
  seawater potentials; standard electrode potentials; three Pourbaix region sets.
- **Reuses:** `data/elements.json`, existing table and chart patterns.
- **New:** `src/corrosion/`.

---

## Correctness pass and twelve module features — shipped

Not a new module: three correctness fixes and twelve features spread across ten
of the twelve existing modules, with the accessibility and documentation work
that came with them. Periodic Trends and Mechanical Properties were untouched.

### The three correctness fixes

Each of these had the app print a number that teaches something false, which is
the one class `docs/GAUNTLET.md` says to stop for.

- **The TTT model could not form proeutectoid ferrite.** A slow-cooled 5140 or
  4340 came out as 100% pearlite where the lever rule gives roughly half
  ferrite, with the hardness inflated to match. This one fix took three of the
  five review rounds, because the fault was correctly identified in round 1 and
  then looked for in `splitProeutectoid` for three more rounds while it sat in
  `productAt`.
- **The XRD reflection sweep was capped at index 8.** Silicon on a molybdenum
  anode silently dropped 41 of its 79 peaks. The sweep is bounded by Bragg now —
  no plane spaced closer than λ/2 can diffract at any angle — which is the same
  limit the extinction panel was then able to show the reader, so the fix and
  the feature are the same physics.
- **3D auto-rotate could not be stopped**, a WCAG 2.2.2 failure on `#/crystals`
  and `#/defects`. Both views own a checkbox for it now, off by default under
  `prefers-reduced-motion`.

### The twelve features

The README says what each does for a reader. In plan order:

| | Module | Shipped as |
|---|---|---|
| S7 | Crystal structures | packing factor and coordination number derived from the cell, not tabulated |
| S12 | Miller indices | is this (hkl) allowed, and at what 2θ — with the link into XRD |
| M2 | Defects & diffusion | the equal-`Dt` locus: every treatment giving the same profile |
| M7 | Phase diagrams | the Gibbs phase rule read off the point being dragged |
| M8 | Phase diagrams | microconstituents for Pb–Sn, not Fe–C alone |
| M12 | Heat treatment | austenitising temperature, read against Fe–Fe₃C |
| P8 | Failure analysis | named crack geometries, and leak before break |
| P10 | Semiconductors | a band gap is a wavelength, and sometimes a colour |
| A2 | XRD | why the anode choice deletes peaks — the λ ≤ 2d limit |
| A8 | Ashby selection | where the index comes from, not just what it is |
| A10 | Corrosion | from a measured current density to millimetres per year |
| A12 | Corrosion | concentration cells — one metal, no couple, still corroding |

### Three departures worth writing down

**1. M12's austenitising temperature does not move the prediction, and saying so
was the work.** The plan assumed a start-temperature slider would change the
answer. `predict` is independent of it: every C-curve in this model is anchored
at A₁ and nothing above A₁ transforms, so the products and the hardness are
identical whether you austenitise at 730 °C or at 1050 °C. Only the tangent
construction — where the cooling path first touches a curve — moves with it.

Manufacturing a dependence to justify the control would have been the worst
available option. Instead the invariance is *asserted*, per steel, in
`components/heattreat-austt.behaviour.test.tsx`, and the one place it is not
benign is flagged in the headline: below A₃ the section never fully became
austenite, so part of it cannot transform and stays soft whatever the quench,
and the model hardens it anyway.

**2. The ferrite work needed two boundaries, not one.** The plan treated the
proeutectoid-ferrite fix as a single boundary. Moving the *pearlite* floor to
the TTT nose appeared to fix it — but only because the proeutectoid split fires
on pearlitic labels, so one boundary was doing two jobs, and the cost was larger
than first admitted. It moved the ferrite→bainite flip from a trace to a tenth
of the sample: across two adjacent real slider detents, one step changed the
product name, the bar colour, the headline hardness and three diagram lines. It
also made `fine pearlite` unreachable for both hypoeutectoid grades, with a test
asserting the deletion as intended behaviour.

They are independent boundaries and are separate now. `pearliteFloor` takes a
measured bainite start — 510 °C for 5140 and 478 °C for 4340, each the midpoint
of a published band; 1080 has none and needs none, forming no proeutectoid phase
— and the ferrite floor is its own guard at the nose.

The second half of this departure is that **three invariants committed to
earlier are narrower than they were stated**, and they are now stated in their
narrowed form at the code that claims them:

- *Total pearlite is not monotone in cooling rate.* The floor relabels the
  product, so pearlite steps **up** as cooling gets faster. The monotonicity
  claim now rests on ferrite and on the diffusional total, which do hold.
- *The austenite is not always enriched.* Below the floor the model reports
  pearlite with no proeutectoid ferrite, and eutectoid pearlite drawn from a
  leaner bulk leaves the remainder leaner still. Global carbon conservation
  holds everywhere without exception; only the direction is scoped.
- *"Pearlite only after ferrite saturates"* holds above the floor, which is the
  only place ferrite leads at all.

The floor is a real discontinuity and is bounded by assertion rather than by
description: under 2.6 HRC, measured at 1.7572 for 5140 and 1.467 for 4340.

**3. Callister's K = 534 wants square inches — a factor of 6.096, not 39.37.**
CPR = KW/(ρAt) is given with K = 87.6 for mm/yr and K = 534 for mils/yr, and the
pair reads like one equation with the units constant swapped. It is not: K = 87.6
takes the area in cm² and **K = 534 takes it in square inches**. Handing K = 534
an area in cm² gives an answer 6.096 times too large — and 6.096 is 534/87.6, not
the 39.37 mils/mm a reader reaching for a length conversion would reach for. The
two are related, which is what makes the trap convincing — but only through the
*exact* constants, not the published ones. The exact pair is 534.934 and 87.66,
whose ratio 6.1024 times 6.4516 cm²/in² is 39.3701, the mils in a millimetre.
The rounded pair that actually appears in the book gives 6.096 × 6.4516 =
**39.328**, which is close enough to 39.37 to look like a confirmation and is
not one. `corrosion/model.test.ts` asserts both products separately for exactly
that reason.

Both this plan and a comment already in `corrosion/model.ts` had it wrong; the
comment said only that K = 534 "gives mils per year" and named no area unit.
Nothing in the app passes K = 534. The constant is exported so the trap can be
asserted in `corrosion/model.test.ts` rather than only described — including the
exact 534.934 that the published rounded pair stands in for.

The separate ASTM G102 constants the shipped penetration rate actually uses,
3.27 × 10⁻³ for mm/yr and 1.288 × 10⁻¹ for mils/yr, do both take cm², so those
two really do differ by nothing but 1 mm = 39.37 mils — asserted to a tenth of a
percent, which is what the rounding in the published pair leaves.

### Descoped, deliberately

Tier 2 (interstitial site geometry, cold work, Ashby screening, the Goodman
diagram, austempering, the Hall effect and the rest) and the shared UI
primitives — one `Slider`, a typeable number box beside every slider,
generalised worked-substitution tables, presets and a copy-link button — are
**not** in this pass. The shipped unit is the correctness fixes plus the twelve
features.

Descoping the primitives means the twelve panels ship with per-module controls.
They were written to migrate without rework: `Corrosion.tsx`'s `Slider` already
carries `display` and `aria-valuetext`, and three worked-substitution blocks
already share `.mi-deriv-table`, so they can be lifted together later.

---

## Landing page: a live figure, a figure index, and two more claims — shipped

Not a module. The front page was elegant and static: five committed plates, six
sections in identical form, and an opening sentence promising "something you
drive rather than read" over six thousand pixels of nothing to drive. Four
changes, in order of how much they matter.

**The worked example is live.** `phase/eutectoid.ts` is new: the four Fe–C fixed
points, the lever rule, and `eutectoidSplit(C0)` — pure arithmetic, no imports.
`phase/systems.ts` now takes those constants *from* it and re-exports them, so
all twelve existing import sites are unchanged and there is one 0.76 in the
repository. The landing page imports the small file and gets a composition
control for a few hundred bytes instead of the 3.15 kB gzipped `systems` chunk.

The departure worth recording: review argued for `await import('../phase/systems')`
on first drag instead, citing this file's own rule that anything past first
interaction should be a dynamic import. It was not taken, and the reason is that
the rule is about payload and the dynamic import is the *larger* payload — 3.15 kB
fetched on the first drag against a few hundred inlined — while also putting a
loading state on the one control whose whole job is to feel immediate. What the
extraction costs is a second implementation of ten lines of lever arithmetic;
`phase/eutectoid.test.ts` walks every 0.01 wt% across the domain holding it to
`steelMicrostructure` at twelve decimal places, which is the same guard
`figures.test.ts` gives the committed plates and which this repo already treats
as sufficient.

**A twelve-panel figure index.** The idea was already sitting in this file's
backlog — "a tiny live-rendered SVG per card reusing each module's own drawing
code" — and it turned out to be the answer to a different question: the twelve
signature marks on the module index are hand-drawn abstractions, and the fix for
"they read as smudges" is not to draw them bigger. `gen-module-figures.ts` now
emits a fifth plate, 1224 × 724, four columns of three, one column per course
group. Every panel is real output: 118 elements at their true table positions
shaded by melting point where one is tabulated, `buildAtoms` on the FCC cell, `planePolygon`
for (111), `concentrationAt` at 1, 4 and 9 hours, `PB_SN.boundaries`,
`buildTtt('1080')`, `buildCurve` for three metals, `criticalCrackSize` for three
alloys, `SEMICONDUCTORS` against the visible range, `computePattern` on α-iron,
all 54 Ashby materials, and aluminium's Pourbaix map.

Two departures. The corrosion panel was the galvanic series first, which is the
module's headline and which reduces, at 266 units wide, to twenty-five identical
horizontal rules — a barcode. The Pourbaix map survives the reduction because its
meaning is in the shape: aluminium corrodes at *both* ends of the pH scale, and
that is legible as three blocks. And the periodic-table panel was 9.6 kB as 118
`<rect>` elements, more than the other eleven together; it is seven `<path>`s
now — six melting-point bands and one for the eleven elements that have no
tabulated melting point at all — at 2.65 kB, measured rather than estimated.
The whole plate is 17.8 kB raw / 3.90 kB gzipped, held to a budget asserted in
`figures.test.ts`, and imported only when the reader is approaching it. `lazy()`
alone was not enough for that: React starts the import when the component
renders, and the section is in the first render tree, so the chunk was going out
on page load — off the critical path, but fetched by every visitor whether they
scrolled or not. It mounts on its own `useReveal` now, and so do the three
showcase plates that were there before it.

**Two sections the README had and the page did not.** The Miller ↔ XRD agreement,
with copper's (111) at d = 0.2087 nm and 2θ = 43.32°, and (100) — which is not
missing for want of an angle: it has a d-spacing and Bragg solves for it at
24.61°, and it is absent because the structure factor vanishes. Review caught
both numbers wrong in the plan: 43.30 is the *literature* value the README
quotes, and the first draft said (100) had no angle at all. Both are now asserted
in `docs.test.ts` against `dSpacing`, `braggTwoTheta` and `isAllowed`, reading
the lattice parameter and wavelength out of the data rather than restating them.
And the six shareable links, with a test that checks every *parameter* against
the data that defines it — `sys=fe-c` against `PHASE_SYSTEMS`, `geom=vessel`
against `CRACK_GEOMETRIES` — because route names are stable and parameters are
what rot.

**A colophon, and three rule weights.** The colophon renders from `App.tsx`
*outside* `<main>`: a `<footer>` nested inside main is a generic element rather
than the `contentinfo` landmark, which is the whole point of having one. It is
prose rather than four columns of links — the module index above is already the
canonical list, and the page was on its way to carrying forty-eight links to
twelve destinations. And every rule on the page used to be the same hairline;
chapters now open on a 2px `--chrome-edge`, the one token already measured as a
boundary, and two of the seven are set to a 44 rem reading measure between the
full-width ones so the plates read as large. Not an alternation — the other five
carry column grids or a plate that wants the room — and the comment in
`landing.css` says so rather than claiming the tidier thing.

Dropped along the way, and worth not rediscovering: a specimen strip of the
twelve marks under the hero (a fourth copy of the same links), enlarging the
marks (the wrong fix), § numerals on all seven sections (the hero and the facts
band are not chapters), and re-tuning the showcase grid (it was already right).

**Cost, and the thing that turned it around.** The pass first came out at
+4.78 kB gzipped on first paint, over a target this file's own rule says must
not be waived. Looking for the fat found something better than fat: the three
showcase plates further down the page are 34 kB of committed SVG markup, sitting
in the one chunk every visitor parses before anything paints, for figures three
screens below the fold. They are `lazy()` now, on the same reveal gate as the
figure index — which is exactly what the deployment section already said to do
and which nobody had applied to the plates that were there before.

From `npm run build` against this branch's parent `43b5fd8`:

| | before | after |
|---|---|---|
| index chunk | 301.23 kB / 85.22 kB gz | **282.83 kB / 83.55 kB gz** |
| stylesheet | 37.93 kB / 7.91 kB gz | **42.72 kB / 8.70 kB gz** |
| **first paint** | **93.13 kB gz** | **92.25 kB gz** |

So the page gained a live instrument, twelve generated figures, two sections and
a colophon, and first paint went **down by 0.88 kB gzipped**. Measured over the
wire against `npm run preview` with the cache disabled: 92.93 kB for the
document, the chunk and the stylesheet, first contentful paint at 108 ms, and
nothing else requested at all until the reader scrolls.

Four chunks are deferred behind the reveal gate — `ModuleIndexPlate` 3.90 kB
gzipped, `XrdFigure` 2.94, `FatigueFigure` 2.64, `AshbyFigure` 1.89 — and each
lands in a box that already holds its viewBox's aspect ratio, so cumulative
layout shift over a full scroll of the page measures **0**.

---

## Planned: five more modules

The roadmap's first five shipped and the file said so. These five reopen it.
They are written in the pre-ship form the `b. Original plan` sections above
preserve — what it teaches, what data it needs, what it reuses, what is new —
with one bullet those entries did not have. **Verify against** names the
published example the physics must reproduce *before* any UI is written, because
that gate is where three of the five shipped modules changed shape, and naming
the example in the plan is cheaper than discovering it in review.

No number from those examples is quoted here. Entry 3's departure was that
`K_IC` is a property of an alloy in a heat treatment and not of "aluminium";
entry 4's was that `n_i` from effective masses moves by a factor of two
depending on the source. A plan that restates a worked answer from memory is the
same failure one step earlier, so these say *which* example and leave the value
to the assertion that will check it.

Where the gap is: twelve modules cover metals from structure through to
selection. Polymers, composites, thermal and magnetic properties are the four
Callister chapters with nothing at all in the app, and the thermodynamics *under*
the phase diagrams is drawn nowhere. Two candidates were considered and are not
here: Weibull strength statistics belongs as a panel in Mechanical rather than a
module, and optical properties are half-covered already by Semiconductors'
λ = 1239.8/E_g.

Order of work: the index prerequisite first, then 6, 7 and 8, which are
committed. 9 is to be scoped against a cheaper shape before it is built. 10 is
conditional on a data gate stated in its own entry, and reduces rather than
ships past it.

## 0. Prerequisite: the module index does not hold at seventeen

Not a module. The landing page's figure index is a **4 columns × 3 rows** grid,
one column per course group, and both the grid and its budget are asserted. Five
more modules break four things, and they should be fixed before module 13 rather
than five times over:

- **The counts are hard-coded on purpose.** `figures.test.ts` asserts
  `NAV_GROUPS` holds 4 groups and 12 items, and that the plate titles one panel
  per module in the column its group heads. That guard exists so a module cannot
  ship into the navigation without a panel; it is not incidental and must move
  deliberately, not be relaxed.
- **The byte budget has room for two panels, not five.**
  `ModuleIndexPlate.tsx` is 18,824 bytes against the 22,000 asserted at
  `figures.test.ts`. Twelve panels average 1,569 bytes, so the headroom is 2.02
  panels. Five would land near 26.7 kB — **over budget**, before counting the
  extra grid rules a taller plate needs. The budget's own comment records the
  periodic-table panel being rewritten from 118 elements into six paths to make
  room once already.
- **The grid is not parameterised.** `scripts/gen-module-figures.ts` hard-codes
  `IDX_H = 724`, `CELL_H = 222`, `for (r = 1; r < 3)` and a literal `col`/`row`
  on every entry of `IDX_PANELS`. That is fine for 4×3 and wrong for what these
  five produce: Structure 4, Microstructure 4, Properties 6, Analysis 3. The
  columns go **uneven**, so the fix is a ragged grid, not a fourth row.
- **`docs.test.ts`'s number-word guard fires at sixteen.** Its `WORDS` array
  stops at `fifteen` and the test asserts `WORDS[n]` is defined before checking
  the ROADMAP bundle table says "twelve per-module chunks". At seventeen modules
  that guard fails — which is the guard working. The table below has to move with
  the count.

One thing that does *not* break: `nav.ts` groups modules precisely so "the
header stays four items wide however many modules exist". A group of six is a
longer menu, and the header itself holds.

- **Effort:** medium. It is a generator change plus a re-argued budget, not a
  redesign.
- **Decide when doing it:** whether the plate stays one asset at 17 panels or
  splits per column. Splitting is four lazy chunks where there is one, on a page
  whose whole performance story is that four plates are deferred behind a reveal
  gate — so the default is one plate with a raised, re-argued budget, and the
  split only if the ragged grid cannot be made to read.

## 6. Composites — planned

Rule of mixtures for a fibre-reinforced composite you specify: pick a fibre, a
matrix and a volume fraction, and get the isostrain upper bound
`E_cl = E_f V_f + E_m V_m`, the isostress lower bound
`E_ct = E_f E_m / (V_m E_f + V_f E_m)`, the load carried by the fibres
`F_f/F_m = E_f V_f / E_m V_m`, and the longitudinal strength. Then the
discontinuous case: critical fibre length `l_c = σ*_f d / 2τ_c`, and the length
above which the continuous expression is a fair approximation.

**Built first, and the reason is the loop.** A composite is the one material in
this app the reader *specifies* rather than selects, and `E_c` with `ρ_c` is a
point that can be plotted on the Ashby chart against the fixed 54 — with its
`E^½/ρ` index ranked among them by `selection/materials.ts`'s own `indexValue`.
That is the Miller↔XRD trick again: two modules that must agree about a number,
with a test that fails if they stop agreeing. It is also why composites beat
polymers to the front of the queue despite polymers being the larger gap.

- **Data:** ~8 fibres (E-glass, carbon at high-modulus and high-strength grades,
  aramid, boron, SiC) and ~5 matrices (epoxy, polyester, nylon 6,6, aluminium,
  titanium), each with E, tensile strength and density, from Callister &
  Rethwisch ch. 16. Interfacial shear strength τ_c for the discontinuous panel is
  per fibre–matrix *pair*, not per fibre — the same trap as entry 3's Paris
  constants, so it is a table of pairs or it is a stated input, never a fibre
  property.
- **Reuses:** `selection/materials.ts` and `AshbyChart.tsx` for the plotted
  point and the index ranking; the two-bar and detail-panel patterns from
  `components/PhaseDiagrams.tsx`.
- **New:** `src/composite/` for the datasets and the mixture maths.
- **Verify against:** Callister & Rethwisch ch. 16's worked example on a
  glass-fibre/epoxy composite — the longitudinal and transverse moduli at a given
  V_f and the fibre/matrix load ratio that follows — and its critical-fibre-length
  example. Also that the two bounds bracket every intermediate model at every V_f,
  and meet at V_f = 0 and V_f = 1.
- **Static-safe:** yes. Closed form, no 3D, no network.

## 7. Polymers — planned

The largest missing audience: nothing in the app knows what a molecular weight
distribution is. Three panels. A distribution over molecular-weight ranges giving
the number-average `M̄_n = Σ x_i M_i`, the weight-average `M̄_w = Σ w_i M_i`, the
polydispersity `M̄_w/M̄_n` and the degree of polymerisation `DP = M̄_n / m` — with
both averages drawn on the same histogram, which is the point: they are different
numbers from one sample and a table cannot show why. Then per cent crystallinity
from a measured density. Then a modulus–temperature curve through the glassy,
leathery, rubbery and flow regions, with T_g and T_m marked, for an amorphous, a
semicrystalline and a crosslinked polymer.

- **Data:** repeat-unit molar masses for ~10 polymers (PE, PVC, PP, PS, PTFE,
  PMMA, nylon 6,6, PC, PET, phenol-formaldehyde) — computable from the repeat
  unit rather than tabulated, so the arithmetic can be shown; T_g and T_m from
  Callister & Rethwisch ch. 15; fully-amorphous and fully-crystalline densities
  for the crystallinity panel.
- **Anticipated departure, recorded now:** ρ_a and ρ_c are published together for
  only some of those polymers. **The crystallinity panel offers only the ones
  that have both**, exactly as `DOPABLE` restricts the doping panel to four of
  the seven semiconductors, and it says why on screen. Inventing a ρ_c so every
  polymer could appear in every panel is entry 4's mistake with a different
  symbol.
- **Reuses:** the histogram and axis patterns in `components/XrdSimulator.tsx`;
  `MECH_MATERIALS`' stress–strain drawing for the modulus–temperature plot.
- **New:** `src/polymer/`.
- **Verify against:** Callister & Rethwisch ch. 14's worked example computing
  M̄_n, M̄_w and DP from a tabulated distribution, and its per-cent-crystallinity
  example. Plus two invariants: M̄_w ≥ M̄_n for every distribution, with equality
  only when the sample is monodisperse; and crystallinity landing in [0, 100] for
  every density between ρ_a and ρ_c.
- **Static-safe:** yes.

## 8. Thermal properties — planned

Heat capacity against temperature (Dulong–Petit at high T, the Debye T³ region
below), linear expansion, thermal conductivity, and the two results that make
this a module rather than a table: **thermal stress** `σ = E α ΔT` in a fully
constrained member, and **thermal shock resistance** `TSR = σ_f k / (E α)`.

Two loops close here, and both are into modules that already exist:

- A thermal stress is a stress. `σ = E α ΔT` for a chosen ΔT is an input to
  `failure/model.ts`'s critical crack size, so "how cold can I quench this before
  a flaw of size *a* runs" is answerable across two modules that share the
  formula, not a new one.
- Wiedemann–Franz `L = k / σT` ties thermal conductivity to the electrical
  conductivity `corrosion/` and `electronic/` already carry for metals, and the
  Lorenz number is near-constant across them — which is a real result, checkable,
  and the reason both conductivities are the same electrons.

- **Data:** ~12 materials with specific heat, linear expansion coefficient,
  thermal conductivity and modulus, from Callister & Rethwisch ch. 19, whose
  thermal-properties table carries all four columns for metals, ceramics and
  polymers together. That is what makes this the cheapest of the five.
- **Reuses:** `MECH_MATERIALS` for E where the metal is one of the seven;
  `failure/model.ts` for the crack-size hand-off; the Arrhenius-style log plot in
  `components/DefectsDiffusion.tsx`.
- **New:** `src/thermal/`.
- **Verify against:** Dulong–Petit converging on 3R ≈ 24.9 J/mol·K at high T;
  the Lorenz number computed from tabulated k and σ for copper, silver and
  aluminium agreeing with 2.44 × 10⁻⁸ W·Ω/K² to the tolerance the tabulated data
  supports; and Callister & Rethwisch ch. 19's worked example on the temperature
  drop that brings a constrained bar to yield.
- **Static-safe:** yes.

## 9. Free energy and the common tangent — planned, shape not settled

The deepest teaching win in this list, and the one to scope before building. The
phase module *asserts* a boundary: `phase/systems.ts` carries fixed points and
interpolates between them. This derives one. Two Gibbs free energy curves against
composition at a chosen temperature, from the regular-solution model
`G = x_A G_A + x_B G_B + Ω x_A x_B + RT(x_A ln x_A + x_B ln x_B)`; the common
tangent between them; and its two touching points, which **are** the ends of the
tie line `LeverRule.tsx` already draws. Sweep T and the boundary is traced out —
the phase diagram built rather than displayed.

Same discipline as Miller↔XRD: the two modules must agree, and a test fails if
they stop. That is the argument for building it, and it is stronger than the
argument for any of the other four.

- **The shape question, to settle first.** This may be better as a fourth panel
  inside Phase Diagrams than as module 16. It has one dataset (none), it shares
  an axis with a module that exists, and the whole point is that the two agree —
  which is easier to *show* on one screen than across a link. Decide after 6, 7
  and 8, when the index prerequisite has been done and the real cost of a
  seventeenth panel is measured rather than estimated.
- **Anticipated departure, recorded now:** a regular solution fits an
  **isomorphous** system. Cu–Ni is in reach; Pb–Sn and Fe–C are not — intermediate
  compounds, allotropy, and a eutectic that needs three curves and a different
  construction. So the domain is Cu–Ni plus a synthetic eutectic with stated
  parameters, and the UI must say so, or it will read as able to regenerate
  Fe–Fe₃C and quietly cannot.
- **Data:** none new. Ω and the pure-component free energies are fitted to the
  Cu–Ni fixed points already in `phase/systems.ts`, so the fit is checkable
  against the thing it must reproduce.
- **Reuses:** `phase/systems.ts` for the fixed points and the target boundary;
  `components/PhaseDiagrams.tsx` and `LeverRule.tsx` for the plot and the tie line.
- **New:** `src/phase/freeEnergy.ts`, or a `solution` module if it goes
  standalone.
- **Verify against:** the common tangent at a given T reproducing Cu–Ni's
  liquidus and solidus compositions from `phase/systems.ts` to a stated
  tolerance — this is the assertion the whole module exists for, and if the fit
  cannot meet a tolerance worth stating, that is the signal to reduce it to a
  qualitative panel and say so. Plus: the miscibility gap appearing exactly when
  Ω > 2RT, and the tangent construction agreeing with the lever rule on both
  fractions at every point tested.
- **Static-safe:** yes. The tangent is a root-find over a smooth function, well
  inside a frame.

## 10. Magnetic properties — conditional on a data gate

B, H and M with `B = μ₀(H + M)`; permeability and susceptibility across dia-,
para-, ferro- and ferrimagnetic materials, which span many orders of magnitude
and so want a log axis and a reason for it; the hysteresis loop with remanence,
coercivity and saturation; soft against hard, and the energy product `(BH)_max`
that separates them. Real audience: this and Semiconductors are the two modules
an electrical engineering student comes for.

**The gate, and it decides the module's shape.** B_s, B_r, H_c, (BH)_max, initial
permeability and the Curie temperature are *tabulated per material* in Callister
& Rethwisch ch. 20. The loop's **shape** is not: published loops are schematics.
So:

- If the loop can be derived from those tabulated anchors by a stated model — the
  way `heattreat/model.ts` generates TTT curves from a digitised nose rather than
  from digitised full curves, keeping every member of the family physical when
  the anchor moves — then build the loop, label it as a construction, and assert
  that it passes through its own anchors.
- If it cannot, **reduce**: drop the loop and ship the anchors as a soft-versus-hard
  comparison across five orders of magnitude in H_c, which is the actual lesson
  and needs no invented curve.

Either way, one rule: **never print a (BH)_max integrated off a drawn loop.**
Quote the tabulated one. An energy product read from a shape that was invented to
look right is entry 3's Paris constants with a different unit — a confident
number with no basis — and it is the specific way this module goes wrong.

- **Data:** ~10 materials, soft and hard, with B_s, B_r, H_c, (BH)_max, initial
  permeability and T_C, from Callister & Rethwisch ch. 20's soft and hard
  magnetic material tables.
- **Reuses:** the log-axis and ranked-comparison patterns from
  `components/Corrosion.tsx`; the temperature sweep from `components/Semiconductors.tsx`
  for the approach to T_C.
- **New:** `src/magnetic/`.
- **Verify against:** μ₀ = 1.257 × 10⁻⁶ H/m by construction; χ_m = μ_r − 1 across
  the four classes landing in the documented ranges, with the diamagnetic values
  negative; iron's Curie temperature at 768 °C; and every drawn loop, if there is
  one, passing through the B_r and H_c it was built from.
- **Static-safe:** yes.

## Deferred: Materials Project integration

Browsing 150k+ computed materials is the one candidate that does not hold under
static hosting, so it is parked until the approach is decided:

- **As bundled data** — 150k entries at even ~200 bytes each is ~30 MB, over
  Cloudflare Pages' 25 MiB single-file limit. Workable only if sharded by
  property range and fetched at runtime; sharding per material would approach the
  20,000-file limit on the free plan.
- **As a live API** — the Materials Project API needs a key. Embedding it in
  client JavaScript publishes it. Avoiding that needs a server-side proxy, i.e. a
  Pages Function or Worker. The static-only alternative is to have each visitor
  supply their own key, held in `localStorage`.

## Constraints

Deployment target is Cloudflare Pages as pure static assets — no Workers, no
Pages Functions. Every module above respects that: hand-rolled SVG or DOM plus a
small hand-entered dataset, no network calls at runtime.

Measured budget, from a production build (`npm run build`):

| Chunk | Raw | Gzip | When it loads |
|---|---|---|---|
| `index` — React, shell, landing page | 282.8 kB | 83.6 kB | always |
| stylesheet | 42.7 kB | 8.7 kB | always |
| the landing page's four deferred plates (`ModuleIndexPlate`, `XrdFigure`, `FatigueFigure`, `AshbyFigure`) | 51.3 kB | 11.4 kB total | as the reader approaches each |
| `OrbitControls` — three.js + drei + fiber | 904.5 kB | 241.5 kB | only on a 3D module |
| `elements` — the element dataset | 76.3 kB | 18.2 kB | periodic trends, crystal structures |
| twelve per-module chunks | — | 72.5 kB total | one per module opened |
| shared helpers (`diffraction`, `systems`, `CrystalScene`, `materials`, `metals`, `color`) | — | 11.9 kB total | with whichever module needs them |

The 3D chunk is the one to find by size rather than by name: it was `geometry-*.js` until
`2218d7b` and is `OrbitControls-*.js` now, without any file being renamed.

The app is code-split by route, so first paint is the `index` chunk plus the
stylesheet — the stylesheet is render-blocking, so both count — **92.25 kB gzipped**,
measured at **92.93 kB over the wire** with the document and its headers. The landing
page's four plates below the fold are deliberately *not* in that number: each is a lazy
chunk fetched when the reader approaches it. three.js is
reachable from only three modules and is no part of first paint.

A module of the existing kind costs **1.95–12.06 kB gzipped** (twelve of them total
72.5 kB) — negligible beside the 3D library, and none of it in first paint since each
arrives in its own chunk.

The binding limit is the 25 MiB cap on a single asset. The largest asset is the
three.js chunk at 904 kB raw, so there is a wide margin.

These figures come from `npm run build` and from `performance.getEntriesByType`
against `npm run preview`. The dev server does not chunk the same way, so never
quote sizes from it.
