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
| — | Materials Project integration | high | high | ⚠️ see below |

Ranked by value per unit of effort. **All five have shipped.** What remains is
the deferred Materials Project integration below, which does not hold under
static hosting. Product-level work is tracked in
[docs/GAUNTLET.md](docs/GAUNTLET.md).

---

## 1. Miller indices & slip systems — shipped

Built in `crystal/miller.ts`, `components/MillerScene.tsx` and
`components/MillerIndices.tsx`; costs 5.5 kB gzipped, plus a 4.2 kB `diffraction` chunk
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
`components/FailureAnalysis.tsx`; costs 8.6 kB gzipped. Four panels: critical
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
`components/Semiconductors.tsx`; costs 6.8 kB gzipped. Three panels: band gaps
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
costs 6.6 kB gzipped. Three panels: galvanic couple with the area-ratio effect,
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
| `index` — React, shell, landing page | 301.1 kB | 85.2 kB | always |
| stylesheet | 37.3 kB | 7.8 kB | always |
| `OrbitControls` — three.js + drei + fiber | 904.5 kB | 241.5 kB | only on a 3D module |
| `elements` — the element dataset | 76.3 kB | 18.2 kB | periodic trends, crystal structures |
| twelve per-module chunks | — | 72.5 kB total | one per module opened |
| shared helpers (`diffraction`, `systems`, `CrystalScene`, `materials`, `metals`, `color`) | — | 11.9 kB total | with whichever module needs them |

The 3D chunk is the one to find by size rather than by name: it was `geometry-*.js` until
`2218d7b` and is `OrbitControls-*.js` now, without any file being renamed.

The app is code-split by route, so first paint is the `index` chunk plus the
stylesheet — the stylesheet is render-blocking, so both count — **92.95 kB gzipped**,
measured at **93.6 kB over the wire** with the document and its headers. three.js is
reachable from only three modules and is no part of first paint.

A module of the existing kind costs **1.95–12.04 kB gzipped** (twelve of them total
72.5 kB) — negligible beside the 3D library, and none of it in first paint since each
arrives in its own chunk.

The binding limit is the 25 MiB cap on a single asset. The largest asset is the
three.js chunk at 904 kB raw, so there is a wide margin.

These figures come from `npm run build` and from `performance.getEntriesByType`
against `npm run preview`. The dev server does not chunk the same way, so never
quote sizes from it.
