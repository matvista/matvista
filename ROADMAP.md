# MatVista roadmap

Planned modules, in build order. Each entry records what it teaches, what data it
needs, what it reuses, and whether it holds under static hosting.

Shipped modules are listed in the [README](README.md). This file only covers what
is next.

## Order of work

| # | Module | Value | Effort | Static-safe |
|---|---|---|---|---|
| ~~1~~ | ~~**Miller indices & slip systems**~~ — shipped | high | low | ✅ |
| 2 | **TTT / CCT diagrams & heat treatment** | very high | medium | ✅ |
| 3 | **Fatigue, creep & fracture** | high | medium | ✅ |
| 4 | **Semiconductors & band structure** | high | medium | ✅ |
| 5 | **Corrosion & the galvanic series** | medium | low | ✅ |
| — | Materials Project integration | high | high | ⚠️ see below |

Ranked by value per unit of effort. (1) shipped; (2) carries the most teaching
value but needs the most data entry, and is next up.

---

## 1. Miller indices & slip systems — shipped

Built in `crystal/miller.ts`, `components/MillerScene.tsx` and
`components/MillerIndices.tsx`; costs 5.3 kB gzipped. Enter a plane `(1̄11)` or direction `[110]` and watch it cut the unit cell in 3D,
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

## 2. TTT / CCT diagrams & heat treatment

`phase/systems.ts` stops at equilibrium, which is where real steel processing
begins. Overlay a draggable cooling curve on a TTT plot and report the resulting
microstructure — pearlite, bainite, martensite — with predicted hardness. Adds a
Jominy end-quench bar showing hardness against distance from the quenched end.

This converts the phase module from "read a diagram" into "choose a process and
get a material", which is the actual engineering skill.

- **Data:** digitised TTT/CCT curves for 1080, 4340 and 5140 steels — a few
  hundred coordinate pairs, hand-entered. Jominy hardenability curves for the
  same grades.
- **Reuses:** the SVG plotting and click-to-inspect patterns in
  `components/PhaseDiagrams.tsx`; the existing Fe–Fe₃C system for context.
- **New:** `src/heattreat/` for curve data and microstructure/hardness lookup.

## 3. Fatigue, creep & fracture

The mechanical module covers monotonic loading only, leaving out the entire
failure half of the subject. Adds S–N curves with endurance limits, Paris-law
crack growth, a Griffith / K_IC critical-crack-size calculator, and Larson–Miller
creep parameters.

Most real components fail by fatigue rather than yielding, so this is the highest
practical relevance on the list.

- **Data:** extend the seven entries in `mechanical/materials.ts` with `K_IC`,
  endurance limit, and Paris constants `C` and `m`.
- **Reuses:** `MECH_MATERIALS`, the curve-building and SVG axis code in
  `mechanical/materials.ts` and `components/StressStrain.tsx`.
- **New:** log–log S–N and da/dN plots; critical crack size solver.

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

Measured budget, from a production build:

| Chunk | Raw | Gzip |
|---|---|---|
| three.js + drei + fiber | 910 kB | 244 kB |
| React + all seven shipped modules + all data | 325 kB | 97 kB |

A module of the existing kind costs roughly 7 kB gzipped, so all five above add
about 35 kB — negligible beside the 3D library. The binding limit is not
Cloudflare's file count but the 25 MiB cap on a single asset, and Vite currently
emits one JS bundle.

**Known win, unrelated to content:** `components/CrystalStructures.tsx` and
`components/DefectsDiffusion.tsx` both import `CrystalScene` eagerly, so three.js
sits in the main chunk. Lazy-loading *both* drops first paint from 343 kB to
97 kB gzipped for the five non-3D tabs. Lazy-loading only one changes nothing.
