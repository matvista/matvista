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
| ~~0~~ | ~~**The module index at seventeen**~~ — grid shipped; budget waits for a real panel | — | medium | ✅ |
| ~~6~~ | ~~**Composites**~~ — shipped; the strength ceiling was not in the plan | high | low | ✅ |
| ~~7~~ | ~~**Polymers**~~ — shipped; chain dimensions in place of the modulus curve | high | medium | ✅ |
| ~~8~~ | ~~**Thermal properties**~~ — shipped; the data checks itself three ways | medium | low | ✅ |
| 9 | **Free energy & the common tangent** — shape not settled | high | medium | ✅ |
| 10 | **Magnetic properties** — conditional on a data gate | medium | medium | ✅ |
| — | Materials Project integration | high | high | ⚠️ see below |

Ranked by value per unit of effort. **The first five shipped**, and this file
said the roadmap was complete. It is not any more: five further modules are
planned below, with the reasoning for the order and for the two that are not
unconditional. What stays out is the Materials Project integration, which does
not hold under static hosting. Product-level work is tracked in
[docs/GAUNTLET.md](docs/GAUNTLET.md).

Entry 0 was a prerequisite rather than a module, and its grid half has shipped:
the plate's shape is derived from `NAV_GROUPS` now, so uneven columns draw
correctly. Its byte budget is deliberately *not* raised — that number has to be
measured against a real seventeenth panel, not estimated — so it moves with
module 13.

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

## 0. Prerequisite: the module index at seventeen — grid shipped, budget pending

Not a module. The landing page's figure index was a **4 columns × 3 rows** grid,
one column per course group, with both the grid and its budget asserted. Five
more modules broke four things, and fixing them once was cheaper than fixing
them five times:

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

One thing that did *not* break: `nav.ts` groups modules precisely so "the
header stays four items wide however many modules exist". A group of six is a
longer menu, and the header itself holds.

### What shipped

The plate's **shape is now derived from `NAV_GROUPS`** rather than written down
beside it. The columns are the groups, a panel's row is its place within its
group, and the box is as deep as the deepest column: `IDX_W` and `IDX_H` are
computed, `IDX_PANELS` no longer carries a `col`/`row` per entry, and
`panelBox`/`panelHead` take a module id and look the cell up. That removed a
duplicate nobody was checking — the cell was written twice, once in `IDX_PANELS`
and once in the `panelBox(2, 1)` call inside each panel renderer, and the test
reads back the rendered *x*, so a wrong **row** would have rendered a panel into
the wrong cell and passed.

`gridRules` replaces the `r < 3` loop. A seam is only as deep as the deeper of
the two columns it separates, and a rule under row *r* is emitted once per
contiguous run of columns that have a row below it — so a short column between
two deep ones breaks the rule into two segments instead of drawing it through
an empty cell.

**The generator's output is byte-identical**: 18,824 bytes before and after,
which is what a pure re-derivation should be and what `figures.test.ts`'s
byte-for-byte comparison already checks. `npm run build` is unchanged to the
byte as well — index 282.83 kB / 83.55 kB gzipped, `ModuleIndexPlate` 3.90 kB
gzipped — because the generator does not ship; only the plate it writes does.

The ragged path is therefore code that `NAV_GROUPS` cannot exercise while every
column holds three, so it is tested directly against 4/4/6/3 rather than left
for module 13 to run first: the seam depths, the row rule that stops at the
third column, and a `[3, 1, 3]` case for the run-splitting. Five assertions,
and the 4×3 grid is asserted to reproduce the old hand-written path string
exactly.

`docs.test.ts` no longer carries its own word list. It imports `NUMBER_WORDS`
from the generator, which spells the plate's own prose — so "Twelve panels" and
the ROADMAP's "twelve per-module chunks" are now the same list, extended to
twenty. A test about counts drifting out of prose failing at sixteen for want of
a *word* would have been the joke telling itself.

### What did not, and why

**The byte budget still says 22,000.** It cannot be re-argued against a plate
that does not exist: five more panels at the 1,569-byte average is an estimate,
and the number that belongs in an assertion is a measured one. It moves when the
first new panel does. The two hard counts in `figures.test.ts` — 4 groups, 12
items — also stay, and are now commented as what they are: deliberate-change
gates, not derivations. Everything around them reads the plate against
`NAV_GROUPS` and would keep passing while the app quietly grew a thirteenth
module.

**Still to decide, at module 13:** whether the plate stays one asset at 17
panels or splits per column. Splitting is four lazy chunks where there is one,
on a page whose whole performance story is that four plates are deferred behind
a reveal gate — so the default is one plate with a raised, measured budget, and
the split only if the ragged grid cannot be made to read at that depth.

## 6. Composites — shipped

Built in `composite/model.ts`, `composite/materials.ts` and
`components/Composites.tsx`; costs 5.86 kB gzipped. Three panels: the two
bounds against volume fraction with the load split and an Ashby hand-off, the
strength rule of mixtures against the composites Appendix B actually measured,
and the critical fibre length with both discontinuous regimes.

**Three departures, and the second one reshaped the module.**

**1. There is no new dataset.** The plan called for ~8 fibres and ~5 matrices
from Callister & Rethwisch ch. 16. What shipped resolves three fibres and five
matrices out of `selection/materials.ts` — Appendix B, the same 54 materials the
Ashby chart plots — by name, with `composite/materials.test.ts` walking every
one so a rename fails the suite rather than emptying a selector. That made the
loop into Ashby run both ways: the constituents come *from* the chart and the
composite goes back *onto* it, ranked among the 54 by `indexValue`, with no
second source to disagree with the first. Three fibres rather than eight is the
cost, and it is the right cost: a fourth fibre would have to arrive with a
density, a modulus and a strength from somewhere else.

**2. The strength rule of mixtures overshoots by close to a factor of two, and
that became a panel.** Appendix B carries the three bare fibres *and* three
measured composites made from them at Vf = 0.60. Those are independent rows; the
model links them. Modulus lands within 5% on all three (−1.2%, −4.2%, +4.7%) and
density within 3%. Strength overshoots every one, in the same direction, by
1.59× to 2.05×.

That is not a defect in the expression. The `σ*_f` the rule of mixtures wants is
the fibre strength *in the composite*; Appendix B's is a pristine single filament
tested in isolation, and a fibre in a laminate carries handling damage, a flaw
distribution over its whole length, and a stress concentration beside every
neighbouring break. Modulus needs no such correction because it is not
flaw-controlled — which is exactly why the modulus column agrees and this one
does not.

The plan would have had the module print `σ*_cl` as an answer. It shows the gap
instead, against all three measured composites, and says why. The ratio is
**asserted in both directions** — greater than 1.5 and less than 2.2 — because a
one-sided check keeps passing while the gap grows, and a model that started
*under*predicting would mean the caveat on screen had gone wrong the other way.

**3. `σ′_m` is not the matrix tensile strength, and for these pairs the matrix
does not survive the fibre.** The strength expression wants the stress the matrix
carries at the fibre's failure strain, `E_m·ε*_f`. E-glass fails at 4.76% strain,
where epoxy would be carrying 115 MPa against its own 59 — it has cracked long
before. `matrixStressAtFibreFailure` caps at the matrix strength and returns a
flag saying so, and the panel prints the sentence rather than quietly using a
number the material cannot reach.

- **Data:** as built — no new dataset. Three fibres and five matrices resolved
  from Appendix B, plus a nominal filament diameter per fibre (5–15 µm, asserted
  in range) and an `isotropic` flag that decides whether the transverse bound is
  presented as an estimate or as a floor. **τ_c is not data at all**: interfacial
  shear strength belongs to a fibre–matrix *pair*, its sizing and its cure, so it
  is a control the reader supplies — the same call entry 3 made about Paris
  constants.
- **Reuses:** `selection/materials.ts` for every constituent and for
  `indexValue`; the tab, slider and detail-panel patterns from
  `components/Corrosion.tsx`.
- **New:** `src/composite/` for the mixtures and the constituent join.
- **Verified:** Callister & Rethwisch's glass/polyester worked example
  reproduces exactly — E_cl = 29.64 GPa, the load ratio 13.53, 11 640 N on the
  fibres against 860 N on the matrix, strain 1.69 × 10⁻³, transverse modulus
  5.486 GPa — and the critical-length example at 0.23 mm. Beyond the book: the
  two bounds bracket each other at every volume fraction for all fifteen
  constituent pairs and meet at both ends; both are monotone; the two
  discontinuous regimes meet at `l_c` (probed at two step sizes, so a step is
  told apart from a slope rather than hidden by a tolerance); and the
  discontinuous strength approaches the continuous ceiling from below without
  reaching it.

## 6b. Original plan

Rule of mixtures for a fibre-reinforced composite you specify: the isostrain
upper bound, the isostress lower bound, the load carried by the fibres, and the
longitudinal strength. Then the discontinuous case: critical fibre length, and
the length above which the continuous expression is a fair approximation.

Built first because it is the only one of the five that closes a loop. A
composite is the one material in this app the reader *specifies* rather than
selects, and `E_c` with `ρ_c` is a point that can be plotted on the Ashby chart
against the fixed 54 — two modules that must agree about a number, with a test
that fails if they stop agreeing.

- **Data:** ~8 fibres and ~5 matrices from Callister & Rethwisch ch. 16, each
  with E, tensile strength and density. Interfacial shear strength is per
  fibre–matrix *pair*, so it is a table of pairs or a stated input, never a
  fibre property.
- **Reuses:** `selection/materials.ts` and `AshbyChart.tsx`.
- **New:** `src/composite/`.
- **Verify against:** the glass-fibre/epoxy worked example and the
  critical-fibre-length example in ch. 16.
- **Static-safe:** yes.

## 7. Polymers — shipped

Built in `polymer/model.ts`, `polymer/polymers.ts` and
`components/Polymers.tsx`; costs 5.93 kB gzipped. Three panels: the chain-length
distribution counted two ways, the chain dimensions that follow from it, and
crystallinity from density.

**The third panel is not the one that was planned.** The plan's third panel was
a modulus–temperature curve through the glassy, leathery, rubbery and flow
regions. Published versions of that curve are *schematics* — no source gives
the shape as anything a model could reproduce — so drawing one and printing
numbers off it is entry 10's magnetic-hysteresis trap arriving three modules
early. It was dropped rather than drawn.

What replaced it is better anyway, because it chains: `L = N·d·sin(θ/2)` and
`r = d·√N` are pure geometry off a C–C bond length and a tetrahedral angle, and
the `N` they take is the degree of polymerisation the *first* panel computed. A
1000-mer of polyethylene is 252 nm of chain in a coil 6.9 nm across, and the
ratio grows as √N — which is why a polymer is not stiff, and why a rubber band
pulls back on entropy rather than on bond energy.

**Almost nothing here is tabulated, and that is what made it buildable.**

- A repeat unit is a *structure*, not a measurement, so molar masses are
  **computed** from `data/elements.json` — the same atomic masses the periodic
  table is coloured by. PVC's 62.50 g/mol is arithmetic, and the test checks
  the arithmetic against the published masses rather than the file storing them.
- Crystalline density is **derived** from the polyethylene cell through the same
  `n·A/(V·N_A)` `crystal/geometry.ts` uses for a metal, and it lands on
  0.998 g/cm³. The cell parameters are therefore checked by what they produce.
- Which leaves **one** standing measured number, ρ_a = 0.870, because a glass
  has no cell to derive it from. It does not stand alone either: with the
  derived ρ_c it puts Appendix B's three polyethylene grades at 46%, 58% and
  72% crystalline — each inside its published range, in the right order, and
  asserted. A ρ_a wrong by much pushes one of the three out.

**The anticipated departure happened, and somewhere else.** The plan expected
ρ_a and ρ_c to be published for only some polymers, restricting the
crystallinity panel the way `DOPABLE` restricts the doping panel. What actually
restricts it is the derivation: one unit cell is carried, so the panel is
polyethylene. The `DOPABLE` shape turned up in the *other* join — three of the
nine polymers have no Appendix B row at all and carry a formula and nothing
else.

### Two defects the verification found, both in the second moment

**1. The tail needed for `X̄w` is far longer than the one needed for `X̄n`.**
The distribution was first summed to six number-averages, which is ample for
the mean and not for the second moment: at p = 0.95 the chains past 120 units
are 0.2% of the molecules and several per cent of the mass. Đ read **1.88
against a true 1.95** — a plausible number, inside [1, 2], monotone in p, and
wrong. The bound is on uncounted *weight* now, not on a multiple of the mean.

**2. Binning before averaging biases `X̄w` low, so the two are now separate
functions.** Collapsing a histogram bar to its mean discards the variance
inside it. Over twelve bars of the same distribution Đ read **1.81**. The fix
is that `histogram` is display-only and the averages never see it — and the
bias is *asserted*, including that it shrinks as the bars narrow, so that the
next person cannot quietly re-derive the averages from the bars.

Both were caught by checking against closed forms rather than against a
remembered table, which is the plan's **Verify against** bullet doing the job
it was added for.

- **Data:** as built — nine repeat-unit formulas, a backbone-bond count each,
  the polyethylene unit cell, and ρ_a. Everything else is computed or joined.
- **Reuses:** `data/elements.json` for atomic masses; `selection/materials.ts`
  for the densities of the six polymers Appendix B carries; the tab, slider and
  detail-panel patterns from `components/Corrosion.tsx`.
- **New:** `src/polymer/`.
- **Verified:** Flory's most-probable distribution — `X̄n = 1/(1−p)`,
  `X̄w = (1+p)/(1−p)`, `Đ = 1 + p` — and the Poisson living-growth result
  `X̄n = ν + 1`, `Đ = 1 + ν/(1+ν)²`, both reproduced by the general averaging
  code across four conversions and three chain lengths. Plus: `X̄w ≥ X̄n` for
  every distribution with equality only when monodisperse; the averages
  unchanged by scaling the counts; both histogram series summing to one,
  narrowed range included; crystallinity in [0, 100] and monotone across the
  whole density range, exact at both ends, and *above* the straight line
  between them.

## 7b. Original plan

Three panels: a distribution over molecular-weight ranges giving `M̄n`, `M̄w`,
the polydispersity and the degree of polymerisation, with both averages drawn
on the same histogram; per cent crystallinity from a measured density; and a
modulus–temperature curve through the glassy, leathery, rubbery and flow
regions with T_g and T_m marked.

The largest missing audience: nothing in the app knew what a molecular weight
distribution was.

- **Data:** repeat-unit molar masses for ~10 polymers, T_g and T_m from
  Callister & Rethwisch ch. 15, and fully-amorphous and fully-crystalline
  densities for the crystallinity panel.
- **Anticipated departure:** ρ_a and ρ_c are published together for only some
  polymers, so the crystallinity panel offers only those — the `DOPABLE` shape.
- **Reuses:** the histogram and axis patterns in `components/XrdSimulator.tsx`.
- **New:** `src/polymer/`.
- **Verify against:** Callister & Rethwisch ch. 14's worked example computing
  `M̄n`, `M̄w` and DP from a tabulated distribution, and its per-cent-
  crystallinity example. Plus `M̄w ≥ M̄n` for every distribution, and
  crystallinity in [0, 100].
- **Static-safe:** yes.

## 8. Thermal properties — shipped

Built in `thermal/model.ts`, `thermal/materials.ts`, `thermal/elements.ts` and
`components/ThermalProperties.tsx`; costs 5.57 kB gzipped. Three panels: heat
capacity against atomic mass, thermal stress with a hand-off into the failure
module, and conduction with thermal shock.

**The module needed two measured numbers per material, and the design is about
what checks them.** Expansion coefficient and thermal conductivity are
tabulated values, and a tabulated value entered from a source that is not to
hand is the exposure this file spends most of its length on. So the entries do
not stand alone:

- **Wiedemann–Franz checks conductivity against resistivity.** Each metal
  carries both, and `k/(σT)` has to land in the band real metals occupy — the
  nine here run 2.08–3.13 × 10⁻⁸ against Sommerfeld's 2.44. A conductivity
  wrong by a factor of two leaves the band, and *that* is asserted too, so the
  band cannot quietly be widened until nothing can fail it.
- **α·T_melt checks every expansion coefficient**, against melting points taken
  from `data/elements.json`. The product sits between 0.012 and 0.030 for all
  nine while α itself ranges five-fold, because both quantities read the same
  thing: how deep the interatomic potential well is. A misplaced decimal cannot
  survive it, which is also asserted.
- **The heat-capacity panel is not tabulated at all.** Dulong–Petit fixes molar
  heat capacity at 3R, so a specific heat is `3R/A` over the atomic masses the
  periodic table already carries. Nine measured values are held beside it as a
  check on the rule, never as an input to it.

**The failure of that rule is the panel's subject.** Carbon, beryllium and
silicon are light atoms held by stiff bonds, so their Debye temperatures are
above 300 K, their vibrational modes are not all excited, and 3R overshoots —
by 26% for silicon, 52% for beryllium, threefold for diamond. Every other
element lands within 7%. The panel draws the miss as a stem between the rule
and the measurement rather than describing it.

**The ceramics are the least-checked entries and the module says so.** A
ceramic has no free electrons, so Wiedemann–Franz is silent about it, and it is
a compound with no element row to take a melting point from. What the five
carry is an *ordering* — fused silica above borosilicate above soda-lime, by
wide margins — and that ordering is asserted. It is weaker than what the metals
have, and both the code comment and the panel itself say which entries rest on
which.

### Two departures worth recording

**1. The thermal-shock ranking is not the one the caption first implied.** With
the σ_f·k/(E·α) figure of merit, **alumina beats fused silica** — its
conductivity is twenty times a glass's and wins on the k in the numerator
despite an α seven times larger. That is the formula talking, not an error:
drop the k, which is the form that applies to a quench too severe for
conduction to keep up, and fused silica leads by an order of magnitude. Two
figures of merit, two orderings, and which applies is a question about the
transient rather than the material. The panel says this rather than presenting
one ranking as the answer.

**2. `thermal/elements.ts` exists because the generator cannot import JSON.**
`scripts/gen-module-figures.ts` statically imports `thermal/materials.ts` to lay
out the figure panel, and it runs under plain Node — which refuses a JSON import
without a `with { type: 'json' }` attribute that app code cannot carry. So the
element join moved to its own module, out of the dataset's import graph. The
alternative was a load hook in the generator; this is smaller, and it is the
better separation anyway.

- **Data:** as built — nine metals and five ceramics, each with α and k, plus
  electrical resistivity for the metals because it is what checks k. Modulus,
  strength and density are joined from Appendix B; atomic mass and melting point
  from `data/elements.json`.
- **Reuses:** `selection/materials.ts`, `data/elements.json`, and
  `failure/model.ts` for the critical crack size — which is what gave that
  module a second importer, so rollup lifted it into a shared chunk. See the
  bundle section: `FailureAnalysis` looks 3.09 kB smaller and has not shrunk.
- **New:** `src/thermal/`.
- **Verified:** 3R = 24.94 J/mol·K, and `c·A = 3R` exactly for every element;
  Dulong–Petit within 7% of the measured specific heat for all nine metals and
  more than 2.5× out for diamond; the Lorenz number in band for all nine and
  its mean within 15% of Sommerfeld's value; α·T_melt in [0.012, 0.030] for all
  nine; `thermalStress` inverting exactly, and a quadrupled stress dividing the
  critical crack size by sixteen through `failure/model.ts`'s own function;
  the three glasses ranked with margins.

## 8b. Original plan

Heat capacity against temperature, linear expansion, thermal conductivity, and
the two results that make this a module rather than a table: thermal stress
`σ = E·α·ΔT` in a fully constrained member, and thermal shock resistance
`TSR = σ_f·k/(E·α)`.

Two loops close here, both into modules that already exist: a thermal stress is
an input to `failure/model.ts`'s critical crack size, and Wiedemann–Franz ties
thermal conductivity to the electrical conductivity `corrosion/` and
`electronic/` already carry.

- **Data:** ~12 materials with specific heat, linear expansion coefficient,
  thermal conductivity and modulus, from Callister & Rethwisch ch. 19.
- **Reuses:** `MECH_MATERIALS` for E; `failure/model.ts` for the hand-off.
- **New:** `src/thermal/`.
- **Verify against:** Dulong–Petit converging on 3R ≈ 24.9 J/mol·K; the Lorenz
  number from tabulated k and σ agreeing with 2.44 × 10⁻⁸; a worked example on
  the temperature drop that brings a constrained bar to yield.
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
| `index` — React, shell, landing page | 287.1 kB | 84.86 kB | always |
| stylesheet | 44.8 kB | 9.08 kB | always |
| the landing page's four deferred plates (`ModuleIndexPlate`, `XrdFigure`, `FatigueFigure`, `AshbyFigure`) | 51.3 kB | 11.4 kB total | as the reader approaches each |
| `OrbitControls` — three.js + drei + fiber | 904.5 kB | 241.5 kB | only on a 3D module |
| `elements` — the element dataset | 76.3 kB | 18.2 kB | periodic trends, crystal structures |
| fifteen per-module chunks | — | 101.36 kB total | one per module opened |
| nine shared helpers (`diffraction`, `systems`, `CrystalScene`, two `materials`, two `model`, `metals`, `color`) | — | 20.91 kB total | with whichever module needs them |

The 3D chunk is the one to find by size rather than by name: it was `geometry-*.js` until
`2218d7b` and is `OrbitControls-*.js` now, without any file being renamed.

**A module's chunk is not what its route costs, and the shared row is where the difference
goes.** Entry 8 gave `failure/model.ts` a second importer, so rollup lifted it out of
`FailureAnalysis` into a shared `model-*.js` chunk: that route's own chunk fell from
14.88 to 11.79 kB gzipped and it now fetches the 3.82 kB helper alongside, for no change
in what a reader downloads. The shared row grew from 11.9 kB across six chunks to 20.91
across nine for the same reason, which is why it is quoted with a count now. This is the
second time it has happened — the first was `xrd/diffraction.ts` at entry 1 — and both
times the module that *looked* smaller had not shrunk.

The app is code-split by route, so first paint is the `index` chunk plus the
stylesheet — the stylesheet is render-blocking, so both count — **93.94 kB gzipped**
(84.86 + 9.08). It was 92.25 kB at twelve modules; the three added since cost 1.69 kB
between them, which is three landing cards, three signature marks and three nav entries,
and none of their model code. The landing page's four plates below the fold are
deliberately *not* in that number: each is a lazy chunk fetched when the reader
approaches it. three.js is reachable from only three modules and is no part of first
paint.

The over-the-wire figure quoted here for years — 92.93 kB — was measured against
`npm run preview` at twelve modules and is **not** re-measured at every module, so it is
not restated. The build figure above is.

A module of the existing kind costs **1.95–12.06 kB gzipped** (fifteen of them total
101.36 kB — this row said 72.5 kB for twelve and did not survive re-measurement; the
sum is off `npm run build` at this commit, added up rather than carried forward) — negligible beside the 3D library, and none of it in first paint since each
arrives in its own chunk.

The binding limit is the 25 MiB cap on a single asset. The largest asset is the
three.js chunk at 904 kB raw, so there is a wide margin.

These figures come from `npm run build` and from `performance.getEntriesByType`
against `npm run preview`. The dev server does not chunk the same way, so never
quote sizes from it.
