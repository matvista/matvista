# MatVista roadmap

Planned modules, in build order. Each entry records what it teaches, what data it
needs, what it reuses, and whether it holds under static hosting.

Shipped modules are listed in the [README](README.md). This file only covers what
is next.

## Order of work

| # | Module | Value | Effort | Static-safe |
|---|---|---|---|---|
| ~~1~~ | ~~**Miller indices & slip systems**~~ — shipped | high | low | ✅ |
| ~~2~~ | ~~**TTT / CCT diagrams & heat treatment**~~ — shipped | very high | medium | ✅ |
| ~~3~~ | ~~**Fatigue, creep & fracture**~~ — shipped | high | medium | ✅ |
| 4 | **Semiconductors & band structure** | high | medium | ✅ |
| 5 | **Corrosion & the galvanic series** | medium | low | ✅ |
| — | Materials Project integration | high | high | ⚠️ see below |

Ranked by value per unit of effort. (1), (2) and (3) shipped; (4) and (5) are
committed work, tracked alongside the product-level backlog in
[docs/GAUNTLET.md](docs/GAUNTLET.md).

---

## 1. Miller indices & slip systems — shipped

Built in `crystal/miller.ts`, `components/MillerScene.tsx` and
`components/MillerIndices.tsx`; costs 5.0 kB gzipped, plus a 2.3 kB chunk of index
arithmetic shared with the XRD module. Enter a plane `(1̄11)` or direction `[110]` and watch it cut the unit cell in 3D,
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

## 4. Semiconductors & band structure

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

## 5. Corrosion & the galvanic series

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
| `index` — React, shell, landing page | 213 kB | 67.5 kB | always |
| stylesheet | 22.7 kB | 4.9 kB | always |
| `geometry` — three.js + drei + fiber | 904 kB | 241.5 kB | only on a 3D module |
| `elements` — the element dataset | 76.3 kB | 18.2 kB | periodic trends, crystal structures |
| nine per-module chunks | — | 35.5 kB total | one per module opened |

The app is code-split by route, so first paint is the `index` chunk plus the
stylesheet — about 72 kB gzipped, measured at 70 kB over the wire. three.js is
reachable from only three modules and is no longer part of first paint.

A module of the existing kind costs **3.5–5.6 kB gzipped** (nine of them total
35.5 kB), so the three remaining modules add roughly 12–15 kB — negligible beside
the 3D library, and none of it in first paint since each arrives in its own chunk.

The binding limit is the 25 MiB cap on a single asset. The largest asset is the
three.js chunk at 904 kB raw, so there is a wide margin.
