# MatVista gauntlet

One improvement per iteration, verified to a standard defensible in review.
Lens rotation: correctness → product gap → performance → accessibility →
mobile/responsive → docs-and-claims truth → repeat.

## Operating protocol

Iterations run **unattended**. Do not stop between them to ask whether to continue, and do
not end a turn by offering the next iteration for approval — pick the next item and build
it. The report at the end of each iteration is a record, not a request.

What does *not* change when running unattended:

- **Never push, never open a PR.** Publishing stays the user's call. Work accumulates as
  one commit per iteration on the `gauntlet` branch and is reported as ready.
- **Every gate still blocks.** Build clean, no new lint warnings, physics verified against
  published values by assertion before any UI, browser-verified in the state changed,
  adversarial self-review before committing. A gate that cannot be cleared means the work
  is reverted or reduced — never shipped with the gate waived and a note.
- **One concern per iteration.** Autonomy is not licence to widen scope.

### Deployment: Cloudflare Pages

Every change is judged against this. It is not a footnote — it constrains what can be
built at all.

- **Pure static assets.** No Workers, no Pages Functions, no server, no runtime network
  calls. Anything needing a backend is out of scope, not a later iteration. This is why
  routing is hash-based: there is no server to rewrite unknown paths onto `index.html`.
- **Per-file limit 25 MiB**, and the whole site is served from CDN edge cache.
- **Optimise for it, every time.** Concretely, that means:
  - Keep the *initial* payload small. Assets are hashed and immutably cached, so
    code-splitting is close to free on repeat visits and pure win on first paint. Anything
    a reader does not need before their first interaction should be a dynamic `import()`.
  - Do the work at build time, never at request time. Precompute, inline, and ship data
    as part of the bundle rather than fetching it.
  - Embed or self-host assets. No third-party CDN, font host, or analytics call — each is
    a runtime network dependency the deployment model does not want, and a privacy and
    latency cost on every visit.
  - Prefer SVG and CSS over raster images; when a raster is unavoidable, size it for its
    largest real display size and keep it well under the file limit.
- **Record the measurement.** Any claim about bundle size, first paint or payload must
  come from an actual `npm run build`, quoted with the number, not estimated.

### Deciding without asking

Where a choice is genuinely the user's, the default is the reversible option, recorded as
an explicit assumption in this file rather than raised as a question. Prefer the choice
that is cheapest to undo and that keeps existing behaviour working.

**Stop and ask** only for these — they are not reversible by a later iteration:

- Adding a runtime dependency, or changing build/deploy config in a way that affects the
  Cloudflare Pages static-asset constraint (no Workers, no Functions, no runtime network
  calls, 25 MiB per file).
- Deleting or rewriting a module wholesale, or removing published behaviour someone may
  be linking to.
- Anything that changes what the deployed site says to its readers about being wrong —
  i.e. discovering that a shipped number has been teaching something false and the fix
  implies more than a code change.
- A product-direction question where two readings lead to materially different products
  and neither is clearly better.

### Stopping the loop

Halt and say so plainly when the backlog holds nothing worth more than the cost of doing
it. Padding with low-value work is the failure mode this loop exists to avoid; a short
honest "nothing left worth doing" is a valid final report. Also halt on a gate that
resists three genuine attempts — report the blockage rather than lowering the bar.

### Lens rotation state

correctness → **product gap** → performance → accessibility → mobile/responsive →
docs-and-claims truth → repeat.

Last shipped lens: **docs-and-claims truth** (iteration 7) — one full rotation complete.
Next lens: **correctness**, and the next build is the fatigue/creep/fracture module.
If the current lens has nothing worth doing, say so explicitly and take the next lens —
do not invent busywork to fill it.

## Shipped

| # | Lens | Change |
|---|------|--------|
| 1 | Correctness | Hardenability readout: critical cooling rate now derived from the module's own Scheil model, transformed-fraction discontinuity removed, backwards UI sentence corrected |
| 2 | Product gap | Hash routing: every module and its result-affecting state is linkable and shareable, with back/forward, clamped values and graceful fallback |
| 3 | Performance | Route-level code splitting: first paint 355.68 → **84.18 kB gzip** (−76%); three.js no longer ships to readers who never open a 3D module |
| 4 | Product gap | Landing page: promotional entry point with hero, stats, nine illustrated module cards, provenance and audience sections — all inline SVG, and first paint down again to **67.45 kB gzip** |
| 5 | Accessibility | Every route now has exactly one `<h1>`, no unlabelled controls, `aria-pressed` on all five state toggles, and reduced-motion honoured |
| 6 | Mobile/responsive | No horizontal overflow on any of the ten routes at 320, 375, 768 or 1280 px — was overflowing on 10/10 routes at 320 px and on Miller at 375 px |
| 7 | Docs-and-claims truth | ROADMAP's bundle section rewritten against a real build; all 20 documented counts asserted against the data |

## Backlog

Scored value (1–5) × effort (1–5, lower is cheaper). Value-per-effort drives the pick,
subject to the lens rotation.

### Product gaps

| Item | Value | Effort | V/E | Notes |
|------|-------|--------|-----|-------|
| Landing page: screenshots / live previews | 3 | 3 | 1.0 | The cards use abstract SVG signatures. Real module thumbnails would sell harder, but a raster per card conflicts with the payload budget — an option is a tiny live-rendered SVG per card reusing each module's own drawing code. |
| Open-graph / social preview card | 3 | 2 | 1.5 | Now that there is a landing page worth linking to, a static OG image and meta tags would make shared links render. Must be a build-time asset, not a runtime service. |
| Deep-link the remaining view state | 2 | 2 | 1.0 | Iteration 2 deliberately kept view chrome (bond display, auto-rotate, elastic zoom, Jominy panel, Ashby class filter and selected material) out of the URL. Revisit only if readers actually ask to share those. |
| Copy-link button per module | 3 | 1 | 3.0 | Routing now makes this trivial and it is how most readers would discover that links are shareable — they will not think to copy the address bar. Strong follow-on from iteration 2. |
| Export (SVG/PNG charts, CSV tables) | 4 | 3 | 1.3 | Wanted for reports and slides. Downloads work in a normal web app. |
| Dark-theme toggle | 2 | 2 | 1.0 | Currently `prefers-color-scheme` only. |
| Print stylesheet | 2 | 2 | 1.0 | |
| Test runner + CI | 3 | 3 | 1.0 | No test framework installed; verification currently goes through a throwaway `src/__check.ts`. Would supersede that workflow. |

### Technical debt

| Item | Value | Effort | V/E | Notes |
|------|-------|--------|-----|-------|
| Lazy-load three.js | 4 | 2 | 2.0 | three.js is ~73% of the bundle (910 kB raw / 244 kB gzip of ~354 kB). `CrystalStructures.tsx` **and** `DefectsDiffusion.tsx` both import `CrystalScene` eagerly — lazy-loading only one changes nothing. Both together cut first paint to ~97 kB gzip for the seven non-3D modules. **Unmeasured since ship 1; re-measure before quoting.** |
| `AshbyChart.tsx` exhaustive-deps ×4 | 3 | 1 | 3.0 | Lines 65/73/79/81 — the only lint warnings in the repo (baseline: 4). A memo keyed on `yProp` reads `yOf`; check whether it can go stale. Correctness risk, not just tidiness. |
| Shared `<Canvas>` shell | 2 | 2 | 1.0 | `MillerScene.tsx` duplicates `CrystalScene.tsx`'s camera/dpr/lights/OrbitControls bounds and re-derives the cylinder-orientation helper. |

### Audits (unscoped until sampled)

| Item | Value | Effort | V/E | Notes |
|------|-------|--------|-----|-------|
| Consistent custom focus ring | 2 | 1 | 2.0 | Nothing suppresses outlines, so browser default rings are intact and focus **is** visible — this is polish, not a defect. Landing elements have bespoke `:focus-visible`; module controls do not. |

### Roadmap modules — in scope, to be built

`ROADMAP.md`'s remaining modules are **committed deliverables**, not optional candidates:

| Module | Value | Effort | V/E | Notes |
|------|-------|--------|-----|-------|
| Fatigue, creep & fracture | 5 | 3 | 1.7 | The mechanical module covers monotonic loading only, leaving out the entire failure half of the subject. Most real components fail by fatigue rather than yielding. S–N curves, Paris-law crack growth, Griffith/K_IC critical crack size, Larson–Miller creep. |
| Semiconductors & band structure | 4 | 3 | 1.3 | The biggest audience expansion available — brings in electrical engineering and physics, not only materials. No overlap with any existing module. |
| Corrosion & the galvanic series | 4 | 2 | 2.0 | Cheapest of the three and concrete: which metal corrodes, the driving voltage, the area-ratio effect, simplified Pourbaix diagrams. |

Materials Project integration stays **deferred** — it cannot hold under static hosting
without a key-bearing proxy, which the deployment model rules out. See `ROADMAP.md`.

Sequencing note: a product gap that improves all nine existing modules can still take
precedence over a tenth module in any given iteration, but the three above are to be built,
not merely considered. Each must clear the same gates — physics verified against published
values by assertion **before** any UI, and every option in a selector checked to be inside
its formula's domain.

## Rejected

*(nothing yet)*

## Findings carried forward

### From iteration 1 (heat treatment)

- **`predict` is monotone in cooling rate** and the martensite fraction is now continuous
  through the critical rate. Verified by a 0.01-decade scan over 10⁻²…10⁴ °C/s for all
  three steels. Any future bisection against `predict` can rely on this.
- `criticalCoolingRate` now costs **0.08 ms** per call including `buildTtt` (52 `predict`
  bisections). Memoised on `[steel, ttt]`. Not a render concern.
- The cooling-rate slider steps in 0.01 decades ≈ **2.3% granularity**, so it cannot
  express a rate nearer than ~2% to the critical rate. This looks like a model
  inconsistency when driving the UI from a script — it is not. Confirmed by reading the
  snapped slider value back.
- `TRACE_FRACTION` (0.005) is shared between `predict`'s prose and the component's bar and
  list filters *on purpose*. If one is changed without the other, a zero-width segment
  captioned "0%" reappears beside prose claiming that product formed.
- Prose that hardcodes a computed number goes stale silently. The tangent-vs-additivity
  comparison is now derived per steel via `tangentCoolingRate`, not written into the copy.

### From iteration 2 (routing)

- **A debounced URL write and a `hashchange` listener will fight each other.** While a
  write is pending, the in-memory route is deliberately *ahead* of the address bar, so
  "URL differs from state" does not mean the reader navigated. Comparing against the last
  hash actually written (`urlHash`) is what separates the two. Before that guard, any
  hashchange inside the 200 ms window silently reverted the reader's last change — caught
  by instrumenting `setRoute`/`adopt`, not by reading the code.
- **A range input pins its displayed thumb to its own min/max but the state behind it is
  whatever you set.** `?vacT=1200` against a slider capped at 1080 showed 1080 while the
  model computed with 1200. `useRouteNumber` now takes `min`/`max` and clamps on read.
  **Any new numeric param must pass its bounds** or the same contradiction returns.
- 50 slider ticks produce **1** `history.replaceState` call and **0** new history entries.
  The trailing debounce (200 ms) exists because Safari throws at roughly 100 history
  writes per 30 s; a throttle rather than a debounce would have fired ~7/s and breached it.
- URL keys are **sorted**, not insertion-ordered, so one visible state is always one URL
  regardless of which control the reader touched first.
- Out-of-range values are clamped in state but **left as-is in the URL** — the address bar
  can read `?vacT=1200` while everything on screen and in the model uses 1080. Every
  viewer of that link sees the same clamped state, so it is consistent; it simply does not
  round-trip to itself.
- Effects that sync derived state (`CrystalStructures` metal, `MillerIndices` slip mode)
  now write to the URL on mount. Their setters must stay in the dependency arrays or lint
  regresses past the 4-warning baseline.
- Several range inputs in `DefectsDiffusion` report `aria-label` as null. Not touched here
  — **material for the accessibility lens**.

### From iteration 3 (code splitting)

Measured from `npm run build` and from `performance.getEntriesByType('resource')` against
the **production** build served by `npm run preview` (launch config `matvista-preview`) —
the dev server does not chunk the same way, so never quote sizes from it.

- First paint: **355.68 → 84.18 kB gzip**, one chunk, 82 kB over the wire.
- three.js lands in a chunk named `geometry-*.js` (904 kB / 241 kB gzip) because
  `crystal/geometry.ts` anchors that chunk's graph. **The name does not say "three" — do
  not assume it is dead weight and do not rename the file expecting the chunk to follow.**
- Browsing all five non-3D modules costs **108 kB** cumulative. Opening `crystals` adds
  three.js and jumps to 349 kB; `miller` and `defects` then add only 5 and 4 kB, so the
  cost is paid once.
- The periodic table stays eager on purpose: it is the default view, and lazy-loading it
  would put a round trip in front of first paint. **When the landing page becomes the
  entry point, revisit this** — the table should probably become lazy too.
- The `chunkSizeWarningLimit` warning from Vite now refers to the three.js chunk alone,
  which is expected and deliberate. It is not a regression signal any more.
- Suspense fallback is `.mod-loading`, which reserves 60vh so the header does not jump.

### From iteration 4 (landing page)

- The landing page is the **only** eager view. Anything imported into `Landing.tsx` lands
  in first paint — check the build output before adding an import there.
- Making the landing page the entry point forced the periodic table out of `App` into
  `PeriodicTrends.tsx`, which took the 76 kB `elements.json` with it (now its own 18.22 kB
  gzip chunk, shared with `CrystalStructures`). First paint fell 84.18 → **67.45 kB gzip**;
  the landing page renders in **70 kB total over the wire**, CSS included.
- `#modules` is an in-page anchor on a hash-routed app. It works only because
  `parseHash('#modules')` falls back to the default route and `adopt()` then sees no
  change, so the browser scrolls without a re-render. **Any in-page anchor must not
  collide with a module id.**
- The header brand is a `<button>` back to home, not an `<h1>`. The landing page carries
  the page's only `<h1>`; module views currently have none — **material for the
  accessibility lens.**
- Card links are real `<a href="#/...">`, not buttons, so middle-click and "open in new
  tab" work. Keep them anchors.
- Copy audited against the data before shipping: "118 elements, fully tabulated" was
  false (18 elements have no electronegativity, 11 no melting point) and the density
  claim needed the cubic caveat, since HCP at the ideal c/a is ~15% out for Zn and Cd.
  **Any number written into landing copy must be checked against `src/data` first.**
  Verified as true: 118 elements, 54 Ashby materials, 5 performance indices, 8 structures,
  7 mechanical metals, 3 steels, 3 phase systems, 4 lattices × 4 X-ray sources, MIT licence.

### From iteration 5 (accessibility)

Audited all ten routes programmatically (accessible-name resolution over every
`input`/`select`/`textarea`, heading counts, SVG naming, buttons without text) rather than
spot-checking, and re-ran the same audit after fixing.

- **No module route had an `<h1>`** — the landing page held the only one and modules
  started at `<h2>`. The header's current-module label was a `<span>` inside `<nav>`; it is
  now the page's `<h1>`, which also removed a duplicate announcement.
- That label was `display: none` under 620px, which would have left every module page on a
  phone with no `<h1>` at all. It is now visually hidden instead of removed.
- Three selects in `DefectsDiffusion` had **no accessible name** (structure, defect type,
  diffusion system). The audit caught these; reading the file would not have, because they
  looked like every other select.
- Five `button.toggle` controls signalled state **by background colour alone** — no
  `aria-pressed` existed anywhere in the codebase. Now all five expose it. `aria-pressed`
  was chosen over a radiogroup for the two segmented pairs deliberately: radio semantics
  would need roving tabindex and arrow-key handling, and a half-built radio pattern is
  worse than a correct toggle one.
- The `err-ok`/`err-off` cells were checked and are **not** colour-only — each carries text
  ("yes — a possible slip system" / "no"), so colour is supplementary. No change needed.
- Nothing in the CSS suppresses outlines, so focus remains visible on module controls via
  browser defaults. A consistent custom ring is backlogged as polish, not a defect.
- `prefers-reduced-motion` is now honoured globally, and the 3D cell's auto-rotate defaults
  off under it. There was already a checkbox to stop it, so WCAG 2.2.2 was met before;
  this is the stronger form.

### From iteration 6 (mobile)

Measured `documentElement.scrollWidth > clientWidth` on all ten routes at 320, 375, 768 and
1280 px, and located each cause by hiding elements one at a time until the overflow
cleared — the *deepest* element that fixes it is the culprit, not the widest.

- **The backlog's stated causes were wrong.** Canvases are not "fixed at 460 px" — that was
  already responsive. The real causes were: a slip table with no scroll container, four nav
  group buttons that would not wrap, and a landing grid with a hard 300 px minimum track.
- **A scroll container alone was not enough.** Wrapping the slip table in `overflow-x: auto`
  left the page still overflowing, because `.mi-slip` is a grid item and grid items default
  to `min-width: auto` — they refuse to shrink below their content. `.mi-layout > * {
  min-width: 0 }` is what lets the scroll container do its job. **Both halves are needed;
  either alone does nothing.**
- `repeat(auto-fit|auto-fill, minmax(Npx, 1fr))` floors the track at N and pushes the page
  sideways below that width. `minmax(min(Npx, 100%), 1fr)` is the fix. Note this bit the
  landing grid but **not** `.mi-inputs`, where I guessed the same cause and was wrong —
  testing the candidate fix live before editing is what caught that.
- A `<canvas>` carries an intrinsic 300×150 until the renderer measures its container.
  `.canvas-wrap canvas { max-width: 100% }` guarantees in CSS what r3f only guarantees
  after its first measurement. **Honest caveat:** the 300 px reading that exposed this was
  the hidden-pane harness trap (`visibilityState` was `hidden`, so r3f's ResizeObserver
  never ran), so the rule is defensive — it did clear the measured overflow, but a real
  browser would very likely have sized the canvas before paint anyway.

### From iteration 7 (docs truth)

- The **README was accurate**; every stale claim was in `ROADMAP.md`, which still described
  a single-bundle app ("Vite currently emits one JS bundle") and listed lazy-loading
  three.js as a pending win three iterations after it shipped. Docs describing
  *infrastructure* went stale; docs describing *data* did not.
- All 20 documented counts are now asserted against the source data, not eyeballed — 118
  elements, 8 structures, 12 FCC / 48 BCC slip systems, 7 mechanical metals, 54 Ashby
  materials, 5 indices, 4 X-ray sources, 3 phase systems, 3 steels, 13 Jominy points, 9
  modules — plus the geometric check that every generated slip direction actually lies in
  its plane. **Re-run that script whenever a dataset changes**; it is the cheapest guard
  against a README that quietly starts lying.
- A module of the existing kind costs **3.5–5.6 kB gzipped** (nine total 35.5 kB), not the
  ~7 kB the roadmap estimated. Use the real figure when sizing the remaining three.

### Standing hazards (unverified, worth checking when touched)

- The XRD module's `dSpacing` delegates to the cubic formula in `crystal/miller.ts`. Every
  `XRD_SAMPLES` entry is cubic (fcc/bcc/sc/diamond), so the domain holds — but **any
  hexagonal sample added there would be silently wrong**. Guard before extending.
- `crystal/metals.ts` carries measured `coa` per HCP metal while `crystal/structures.ts`
  hardcodes the ideal 1.633 in `volumeOverA3`. Confirm which one the density readout uses
  before trusting HCP densities (Zn and Cd deviate ~15%).
