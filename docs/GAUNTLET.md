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
  come from an actual `npm run build`, quoted with the number, not estimated. Three rules
  that this repo has now got wrong six times between them, so they are written down:
  - **First paint is the index chunk *plus* the stylesheet.** `dist/index.html` loads the
    stylesheet render-blocking, so a claim about "first paint" that quotes the JS alone is
    understated by the whole stylesheet. If you mean the JS, say "first-paint chunk".
  - **Quote against the commit's own parent**, never against the branch base and never
    against HEAD. A chunk that grew twice reads as unchanged if you compare the wrong pair.
  - **Quote every chunk the route now fetches**, not only the ones you edited. A module
    that gains a shared dependency has grown by it, even though nothing in its own chunk
    moved. `__vite__mapDeps` in the index chunk is the list.

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

Last shipped lens: **product gap** (iteration 17). Next lens: **performance**.

**The roadmap is complete.** All five planned modules have shipped; only the deferred
Materials Project integration remains, and it cannot hold under static hosting. Future
iterations come from the product/debt backlog below, not from `ROADMAP.md`.

**Performance was skipped at iteration 11 on purpose.** First paint was 67.9 kB gzip
then, modules were 3.5–8.6 kB each and three.js was already deferred; the only candidate
left was AshbyChart's dead memos, which recompute 54 points in microseconds. That is
tidying, not performance, and the lens rules say to say so rather than invent work to
fill it. (Re-measured since: first paint is **92.95 kB gzip** — index 85.17 plus a
render-blocking 7.78 kB stylesheet — and the twelve module chunks run 1.95–11.51 kB. The
reasoning stands; the figures were four modules out of date.)

**Verification workflow (supersedes the throwaway `src/__check.ts` recipe):** write
assertions as `*.test.ts` beside the module and run `npm test`. Physics still gets verified
against published values *before* any UI is written — that has not changed; what has
changed is that the assertions now survive the iteration instead of being deleted with it.
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
| 8 | Roadmap module | **Failure analysis** — fracture toughness, S–N fatigue, Paris crack growth, Larson–Miller creep. Verified against two published worked examples |
| 9 | Correctness | Fe–C was missing its single-phase α field: pure iron at 800 °C read as a two-phase α+γ mixture. Found by a sweep of ~3 000 phase points |
| 10 | Product gap | **Test runner + CI**: 281 permanent assertions (vitest) replacing the throwaway `src/__check.ts` workflow, plus a GitHub Actions check |
| 11 | Roadmap module | **Corrosion** — galvanic couples with the area-ratio effect, EMF series with live Nernst shifts, Pourbaix diagrams for Fe/Al/Zn |
| 12 | Accessibility | Phase diagram was mouse-only (WCAG 2.1.1 Level A); plus every text colour measured and brought to AA — the amber state colour was at 2.11:1 |
| 13 | Mobile/responsive | Touch targets: 60+ controls were under the 24×24 minimum on every route. All now pass except the periodic table, which is an Essential exception |
| 14 | Docs-and-claims truth | Bundle table and test count re-measured; ROADMAP's description of itself corrected; a cross-module URL param leak found while verifying the README's own examples |
| 15 | Correctness | Audited `crystal/structures` and `crystal/geometry`, the last unaudited physics. **No defects found** — 45 guards added, including a direct check of the "CN = 12" label |
| 16 | Roadmap module | **Semiconductors** — band gaps, doping and conductivity, the p–n junction. The last roadmap module; ROADMAP is now complete |
| 17 | Product gap | Light/dark/auto theme toggle, and a landing stat that read as a metric rather than a feature |

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
| Print stylesheet | 2 | 2 | 1.0 | |

### Technical debt

| Item | Value | Effort | V/E | Notes |
|------|-------|--------|-----|-------|
| ~~Lazy-load three.js~~ — **shipped at iteration 3** | 4 | 2 | 2.0 | The estimate here (910 kB raw / 244 kB gzip, first paint down to ~97 kB) was never re-measured after it shipped, and the row read as outstanding work. Re-measured: the 3D chunk is **904.45 kB raw / 241.51 kB gzip**, it is reached only from `crystals`, `miller` and `defects`, and first paint is **92.95 kB gzip** with none of it inside. `CrystalStructures.tsx` and `DefectsDiffusion.tsx` both go through the lazy `CrystalScene`, which was the point — lazy-loading only one would have changed nothing. |
| `AshbyChart.tsx` exhaustive-deps ×4 | 2 | 1 | 2.0 | The only lint warnings in the repo (baseline 4). **Investigated in iteration 9: it cannot go stale.** `yProp` is in the deps, and `visible` is rebuilt every render so the memos recompute every render regardless — they are dead memos, not a correctness risk. Downgraded from a correctness item to tidying: memoise `visible`, lift the accessor out of the closure, and the baseline drops to 0. |
| Shared `<Canvas>` shell | 2 | 2 | 1.0 | `MillerScene.tsx` duplicates `CrystalScene.tsx`'s camera/dpr/lights/OrbitControls bounds and re-derives the cylinder-orientation helper. |

### Audits (unscoped until sampled)

| Item | Value | Effort | V/E | Notes |
|------|-------|--------|-----|-------|
| Consistent custom focus ring | 2 | 1 | 2.0 | Nothing suppresses outlines, so browser default rings are intact and focus **is** visible — polish, not a defect. |
| Chart stroke/fill contrast sweep | 3 | 2 | 1.5 | Iteration 12 fixed every colour carrying **text** and the phase-fraction swatches, and stopped there. Roughly 20 hard-coded hexes remain in `index.css` and in `AshbyChart`/`PhaseDiagrams`/`CrystalScene` as chart strokes and 3D materials. Measured: `#1baf7a` is 2.67:1 on the light page and `#4a3aa7` is 2.27:1 on the dark page, both under the 3:1 that WCAG 1.4.11 asks of graphical objects. All of them are accompanied by text labels, so colour is not the sole carrier — which is why this is a follow-up and not a defect. Dual-theme-safe replacements are already computed in the iteration-12 notes. |

### Roadmap modules — in scope, to be built

`ROADMAP.md`'s remaining modules are **committed deliverables**, not optional candidates:

| Module | Value | Effort | V/E | Notes |
|------|-------|--------|-----|-------|

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
- three.js lands in one chunk with the rest of the 3D stack (904 kB / 241 kB gzip). Its
  *name* is whichever of the modules in that graph rollup happens to pick, so it does not
  say "three" — do not assume it is dead weight.
  **Updated: the name moved on its own, and the warning that used to stand here had the
  causality backwards.** It read "do not rename the file expecting the chunk to follow",
  on the premise that the name tracked `crystal/geometry.ts`. It does not. No file has
  been renamed and the chunk is now `OrbitControls-*.js`: the rename lands at `2218d7b`,
  where deriving APF and CN moved another cross-chunk binding out of `crystal/geometry.ts`.
  Measured — `geometry-DlAICOkR.js` at `6818158`, 904,271 B raw, 14 exports;
  `OrbitControls-0BwuMUTe.js` at `2218d7b`, 904,457 B raw, 15 exports. **Not a pure
  rename either**: +186 B raw, +30 B by `gzip -9` (241.45 → 241.51 kB by the build's own
  gzip figure). Never match this chunk by name in a script or a doc — find it by size.
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

### From iteration 8 (failure module)

- **The roadmap's own data plan was wrong, and following it would have fabricated numbers.**
  It said to extend the seven entries in `mechanical/materials.ts` with `K_IC` and Paris
  constants. But K_IC belongs to an alloy *in a specific heat treatment* — 4340 tempered at
  260 °C and at 425 °C differ by a factor of 1.75 — and Barsom's Paris constants are
  published per class of steel and are not transferable to aluminium. The module therefore
  carries three datasets with three domains, and only the S–N panel reuses `MECH_MATERIALS`.
  **Check a roadmap entry's data plan against the physics before following it.**
- Verified before any UI existed: Griffith reproduces Callister's **8.2 µm** flaw in
  soda-lime glass at 40 MPa; Larson–Miller reproduces his S-590 example at 800 °C and
  140 MPa as **231 h** against a published ~233 h; the closed-form Paris integration matches
  a 400 000-step numerical integration to better than 0.05%; and m = 3 gives exactly the
  8× life for a halved stress range.
- **The domain trap this module exists to teach was nearly shipped as a bug.** Aluminium at
  a low amplitude reported "6757.0B cycles" — a Basquin extrapolation four decades past the
  fit's last anchor. Lives beyond 10⁹ now read "> 10⁹" and say plainly that further is
  extrapolation. Non-ferrous alloys correctly draw **no** endurance line and never report
  infinite life; ferrous and titanium do.
- Two new `exhaustive-deps` warnings appeared from memos closing over a scale function
  built from a changing `yMax` — the same defect the pre-existing AshbyChart warnings
  describe. Fixed by computing the scale *inside* the memo. **Do not close over a scale
  function from a memo keyed on the value that scale depends on.**
- The module is 8.6 kB gzipped in its own chunk, so it costs nothing until opened.

### From iteration 9 (correctness sweep)

Swept every module not yet verified, against published worked examples where they exist
and against internal invariants everywhere else — ~3 000 phase-diagram points, all seven
stress–strain curves at 200 000 samples each, all five Ashby indices, all sixteen metals'
densities, and the diffusion solution.

- **Real bug found and fixed: the Fe–C diagram had no single-phase α field.** Between the
  eutectoid (727 °C) and pure iron's A₃ (912 °C), everything left of the A₃ line was
  reported as two-phase α + γ — so **pure iron at 800 °C read as a mixture** when α is the
  only phase present up to 912 °C. The α end of the tie line was also pinned at 0.022 wt%,
  the solubility at the eutectoid, instead of tracking temperature. Caught by an invariant
  ("the overall composition must lie between the tie-line ends"), not by inspection: the
  lever-rule fractions were clamped to [0, 1], so the readout looked entirely plausible.
  **Clamping a fraction hides the evidence that it was computed outside its domain.**
- Three of the four "failures" in the first run were **my test's bugs, not the code's**:
  sampling the elastic modulus at a point already past the proportional limit, and reading
  the 0.2%-offset stress off a curve sampled too coarsely. Worth the reminder that a
  failing assertion is a hypothesis, not a verdict.
- Titanium's predicted density is 6.3% high and that is **not** a defect: Callister's
  R = 0.1445 nm gives a = 2R = 0.289 nm against a real 0.2951 nm, and density goes as a⁻³.
  The module already shows the error rather than hiding it. It is the worst of the sixteen.
- Verified against published answers: Callister's 0.35 wt% C steel (44% pearlite, 56%
  proeutectoid ferrite), the Cu–Ni tie line at 35 wt% Ni and 1250 °C (0.68 / 0.32), and the
  carburising example (0.80 wt% C at 0.5 mm after 7 h).
- The Ashby guide line provably selects exactly the top-N by index value, for all five
  indices — the log-space test and the ranking agree because slope = 1/exponent.

### From iteration 10 (tests)

- **281 assertions across 11 files, 0.45 s.** vitest is a devDependency only: nothing
  reaches the bundle, no test chunk is emitted, and the deployed payload is unchanged. This
  did not trip the "ask before adding a dependency" rule, which is about *runtime*
  dependencies and the Cloudflare Pages constraint.
- `npm run build` runs `tsc -b` over `src`, so the tests are **type-checked by the build**.
  A test that stops compiling breaks the build, which is the behaviour worth having.
- Every published worked example previously verified and then thrown away is now permanent:
  Griffith's 8.2 µm, S-590 at 231 h, 0.35 wt% C at 44% pearlite, carburising at 7 h, the
  Cu–Ni tie line, copper's four diffraction lines, silicon's (111) at 28.44°.
- The regression guards that matter are the domain ones — only real fatigue limits flatten,
  every XRD sample is cubic, every two-phase point brackets its own composition, and the
  transformed-fraction discontinuity at the critical cooling rate stays below 0.01 pp.
- Two test failures during the port were **the tests' fault, not the code's** (an α reading
  taken at a temperature where the phase does not exist, and an erf tolerance tighter than
  the approximation's own documented 1.5 × 10⁻⁷ bound). That is now the third iteration
  running where a red assertion was my error — treat a failure as a hypothesis.
- `docs.test.ts` asserts the counts written into the README, ROADMAP and landing page.
  **Run `npm test` after any dataset change**; it is what stops the docs quietly lying.

### From iteration 11 (corrosion module)

- **The galvanic series and the EMF series are two datasets, not one.** They genuinely
  disagree: passive 316 stainless sits *above* copper in seawater, while chromium and iron
  are both far below copper in the EMF series, because passivity is an oxide film and not a
  standard potential. Merging them into one ranking — the obvious simplification — would
  have produced an authoritative-looking list that is wrong for whichever question was
  being asked. Both are shipped, kept apart, with the UI saying which to use when.
- Stainless appears **twice** in the galvanic series, passive and active, ~0.5 V apart.
  That is not a duplicate to be cleaned up: it is the reason crevice corrosion is dangerous
  in an otherwise noble alloy.
- Verified before any UI: the Daniell cell at **1.103 V**; the Nernst slope at
  **0.0592 V/decade** at 25 °C; the water stability lines at **−0.414 V** and **0.815 V**
  at pH 7 and exactly 1.229 V apart at every pH; zinc anodic to steel and steel anodic to
  copper; aluminium and zinc corroding at *both* pH extremes while iron passivates in
  alkali.
- The `docs.test.ts` guard **earned itself** here: adding the module turned "ten modules"
  false and the suite failed immediately, before the README could ship a wrong number.
- Third time now that a memo closing over a scale function has produced a new lint warning
  (AshbyChart, FailureAnalysis, Corrosion). The fix is always the same — compute the scale
  inside the memo, or hoist fixed bounds to module scope. **Worth remembering when writing
  the next chart.**

### From iteration 12 (accessibility, second pass)

Iteration 5 covered labels, headings and toggle state. Two things it never checked were
colour contrast and whether the drag-driven charts work without a mouse. Both had defects.

- **The phase diagram was mouse-only — WCAG 2.1.1, Level A.** It was `role="img"` with
  nothing but `onPointerDown`, so the module's primary interaction was unreachable from a
  keyboard, and `role="img"` additionally told assistive technology it was a static
  picture. It is now `role="application"` with `tabIndex=0` and arrow-key control (1% of
  the axis per press, 5% with shift), the readout is an `aria-live` region so the movement
  is announced, and two number inputs give the same state through standard widgets — which
  is also just useful, since you can now type 0.76 exactly instead of hunting for it.
- **Contrast was never measured, and several values failed.** In light mode: the amber
  `.err-off` state colour at **2.11:1**, the green `.err-ok` at 3.27:1, `--muted` (every
  axis tick label) at 3.41:1, accent-as-text at 4.19:1, and white on the primary button at
  4.42:1. All now clear 4.5:1 against `--page`, which is the harder of the two grounds.
- `--accent` was split into `--accent` (fills, borders), `--accent-ink` (text) and
  `--accent-strong` (fills that carry white text). One blue cannot satisfy all three: as
  a label it wants to be darker, and under white text darker still.
- **A replacement over-matched and had to be undone.** `color: var(--accent);` is a
  substring of `border-color: var(--accent);`, so a naive replace recoloured six borders.
  Caught by grepping for the result rather than trusting the count.
- Phase-fraction swatches now clear 3:1 on **both** themes, because they are hard-coded
  rather than themed and so have to work on either ground.
- **Deliberately left:** ~20 further hard-coded chart hexes. Backlogged with measurements
  rather than swept, because the sweep changes the app's visual identity and deserves its
  own decision. None of them is the sole carrier of meaning.

### From iteration 13 (touch targets)

Iteration 6 fixed horizontal overflow. What it never checked was whether anything is big
enough to tap. Measured at 375 px against WCAG 2.5.8's 24×24 minimum, most of the app
failed:

| Control | Was | Where |
|---|---|---|
| `button.nav-item` ×4 | 68×**20** | every route |
| `button.mi-chip` ×16 | 49×**22** | Miller presets, heat treatment |
| `label.ss-check` ×4 | 99×**19** | mechanical toggles |
| `button.ab-rank-item` ×10 | 272×**16** | Ashby ranking rows |
| `button.mi-link` ×24 | 35×**16** | Miller family members |
| `input[type=range]` | ×**16** | every slider |

- **Measure the *effective* target, not the element.** The first pass flagged bare
  checkboxes as failures; they sit inside `<label>`s, so the label is the tap area and they
  were fine. Re-measuring through the label removed the false positives and left a much
  smaller, real list.
- Fixed with `min-height: 24px` plus `align-items: center` — padding only, so type size and
  desktop rhythm are unchanged and nothing reflows. Re-verified: **every route passes at
  375 px** and no route regained horizontal overflow at 320 px.
- **The periodic table's 118 cells stay at 16 px wide, deliberately.** Widening them to 24
  would push 18 columns past the viewport and force horizontal scrolling, and a periodic
  table read one column at a time is no longer a periodic table — the spatial arrangement
  *is* the information. That is exactly the "Essential" exception 2.5.8 provides for, and
  the table is legible at 375 px. **Do not "fix" this later without re-reading that
  exception.**

### From iteration 14 (docs truth, second pass)

- **The stale number was one I wrote myself.** The README said "281 assertions" — true when
  iteration 10 shipped, false two modules later at 319. Rephrased to "over 300", which can
  only become more true as the suite grows. **Do not write an exact count into prose that
  nothing asserts.** Counts that matter belong in `docs.test.ts`.
- ROADMAP's bundle table had drifted with two modules added: index 213 → 215 kB raw
  (67.5 → 68.2 gzip), stylesheet 22.7 → 24.5 kB, "nine per-module chunks totalling 35.5 kB"
  → eleven totalling 49.8 kB, and a per-module range of 3.5–5.6 kB → **1.8–8.6 kB**. First
  paint was 73.4 kB gzip then, 72 kB over the wire. A new shared-helpers row was added.
  (Those figures were correct at iteration 14 and are not now: two modules and twelve
  Tier-1 commits later, first paint is **92.95 kB gzip** — index 85.17 + stylesheet 7.78 —
  and **93.6 kB over the wire**, document and headers included, from
  `performance.getEntriesByType('resource')` against `npm run preview`. ROADMAP's table
  carries the current set; this line records what iteration 14 measured.)
- ROADMAP claimed "this file only covers what is next" while containing four shipped
  write-ups. Reframed as the build record, which is what it had become.
- **Verifying the README's four example links found a real bug.** After visiting Miller and
  then jumping to the phase module, the URL came back as
  `#/phase?T=200&slip=bcc&sys=pb-sn&x=40` — a Miller param leaking into another module's
  link. It did **not** reproduce on the two follow-up attempts, so it is timing-dependent;
  the pane was `hidden` at the time, which throttles timers and widens the debounce window.
- Rather than chase an unreproducible symptom, the *class* was closed: the setters resolve
  `current.tab` at call time, so a stale effect from a module just left would write into
  the new module's query. They now drop writes from a module that is no longer current.
  Hammered at nine delays from 0–400 ms across the module boundary: **no leak at any**, and
  derived state, sliders and selects still write normally within a module.

### From iteration 15 (crystal geometry audit)

`crystal/structures.ts` and `crystal/geometry.ts` were the last physics never audited.
**The audit found no defects.** That is the finding, and it is worth recording as one:

- APF is not independent data — it follows from N, the a↔R relation and the cell volume.
  Every stated value matches the geometry it is derived from, to two decimals.
- `coordinationShell()` returns exactly `CN` neighbours for every structure, so the
  checkbox labelled "Coordination shell (CN = 12)" shows twelve atoms. **That label is now
  asserted**, not assumed.
- `fillRadius` is exactly half the nearest approach for every elemental structure, which is
  what makes the space-filling view touch rather than overlap or gap.
- Every `bondCutoff` sits between the first and second neighbour shell.
- HCP is built as the conventional prism: 12 shared corners, 2 basal centres, 3 interior,
  giving 12/6 + 2/2 + 3 = 6, with the midplane atoms at exactly a/√3 from the axis.
- **The one red assertion was my test's bug again — the fourth time.** `buildBonds` takes
  `(atoms, cutoff)`; I passed it the structure, so `atoms.length` was `undefined` and every
  count came back zero, which read exactly like "the Bonds toggle does nothing". `tsc`
  would have caught it, but I ran the test before the build. **Run `npm run build` before
  believing a new test's failure** — the tests are type-checked and the compiler is faster
  at spotting this than I am.
- Both 3D toggles were confirmed in the browser for the first time: bonds render as
  cylinders and the coordination shell highlights. Needed the tab fronted — hidden panes
  do not run `requestAnimationFrame`, so the canvas screenshots blank.

### From iteration 16 (semiconductors)

The tests found **two real bugs in my own model** before any UI existed, and the browser
found three more in the UI. Worth recording because none was visible by reading the code.

- **Catastrophic cancellation in the minority carrier.** `carriers()` solved the quadratic
  as `p = (root − net)/2`. When doping dwarfs n_i, `root ≈ net`, so that subtraction throws
  away almost every significant digit — the mass-action check failed in the fourth decimal
  and worse beyond. Now the majority carrier comes from the addition (which never cancels)
  and the minority from `n_i²/n`. A comment claiming the form avoided cancellation was
  sitting directly above the form that caused it.
- **A fixed degeneracy threshold is silicon's number and travels badly.** `isDegenerate`
  compared doping against 10¹⁹ cm⁻³. Indium antimonide has a 0.17 eV gap, so its entire
  non-degenerate window at 300 K is about 7 meV wide: it is degenerate at 10¹⁸, where the
  flat rule called it fine and the built-in potential came out *larger than the band gap* —
  impossible, since the Fermi levels cannot separate by more than the gap. Now tested
  physically, as |E_F − E_i| ≥ Eg/2 − 3kT, which is material- and temperature-aware.
- **A caveat that could never fire.** The freeze-out warning triggers below 100 K and the
  temperature slider's floor *was* 100 K. Dead branch. The slider now reaches 50 K.
- `fmtExp` printed 10⁴ as "10.0×10³": the mantissa came back as 9.999999, which is
  legitimately below ten until `toFixed(1)` rounds it up. **Test the overflow after
  rounding, not before.**
- The depletion-region shading ran off the left edge of the axes for a strongly asymmetric
  junction, because each side was scaled against a half-width that the 91/9 split exceeded.
  Scaling the *total* drawn width to half the plot keeps it framed. Found by looking at a
  screenshot, not by any assertion.
- Verified against published values: kT = 0.0259 eV at 300 K; V_bi = **0.833 V** and
  W = **147 nm** for silicon doped 10¹⁷/10¹⁷; the depletion region 10× wider on the lightly
  doped side; mass action and charge neutrality across the whole doping range.
- **Fourth occurrence** of the memo-closing-over-a-scale lint warning. Fixed the same way:
  hoist fixed bounds to module scope. The pattern is now noted in the file itself.

### From iteration 17 (theme toggle)

Both items came from the user, and both were fair.

- **A theme toggle needs the dark tokens declared twice**, or it only works in one
  direction. The media query has to be guarded (`:root:not([data-theme="light"])`) so an
  explicit light choice survives a dark OS, and a separate `:root[data-theme="dark"]` block
  is what lets an explicit dark choice win on a light OS. Shipping only the first is the
  usual half-broken version. **Both directions were tested**, by emulating each OS
  preference and picking the opposite.
- **Three states, not two.** "Auto" has to exist, or the control cannot express "follow my
  system" — and that is the default most readers want. It is a `radiogroup` with roving
  tabindex rather than three `aria-pressed` buttons, because exactly one is always in
  effect, which is what radio semantics mean.
- The preference lives in `localStorage`, **not the URL**: a link shared with a class
  should open in the reader's own theme, not the sender's. Every storage access is guarded —
  it throws outright in private mode and where site data is blocked.
- A small inline script in `index.html` applies the stored value **before first paint**,
  otherwise a reader who chose light gets a flash of dark while the bundle loads. It
  duplicates a few lines of `theme.ts` on purpose; a separate file would arrive too late.
- **"0 sign-ups or downloads" was the wrong shape for a stat.** In a strip of counts of
  things the product *has*, a zero reads as a metric rather than a feature — and it
  duplicated the line immediately below it ("Free and open source · runs entirely in your
  browser · nothing to install"), which already makes the point in the right voice.
  Replaced with "8 crystal structures in 3D", and all four strip values are now asserted in
  `docs.test.ts`.

### Corrections to size claims already committed

Recorded here rather than by rewriting the commits. Each was re-measured with one
`npm run build` per commit, at the named commit and at its own parent.

| Commit | Claimed | Measured |
|---|---|---|
| `be91ef6` | XRD "11.10 + 5.25 = 16.35 → 7.63 + 9.53, **+0.32 kB** gzip" | The route also fetches `metals-QYkHP7hv.js` from this commit on: `__vite__mapDeps` went `[XrdSimulator, miller]` at `8bd636a` to `[XrdSimulator, metals, diffraction]`. Really 16.35 → **18.17 kB raw** and 6.79 → **7.53 kB gzip**, i.e. **+0.74**, not +0.32. The two chunks it did list are quoted correctly; the third is missing. |
| `a834086` | "First-paint chunk unchanged at 301.10 kB raw / **85.16 kB gzip**" | At its parent `2218d7b` the index chunk is **85.17 kB** gzip, so it fell by 0.01 rather than being unchanged. The raw length really is unchanged at 301,106 B, though the content is not — md5 `3016a627…` → `bb296c13…`. |
| `948a81d` | Corrosion "20.60 → 25.04 kB raw, **6.59** → 8.01 gzip" | At its parent `a834086` the Corrosion chunk is **6.60 kB** gzip. Raw and the after-figure are right. |
| `d294681` | Corrosion "25.04 → 32.83 kB raw, **8.01** → 9.99 gzip" | At its parent `4f6b14a` it is **8.00 kB** gzip. Raw and the after-figure are right. |

And two in the branch's own summary report, which is not a commit and cannot be corrected
in place:

- "**no new first-paint cost**" is false. Under the rule above, first paint at `6818158`
  is 85.16 + 7.22 = **92.38 kB gzip** and at HEAD 85.17 + 7.78 = **92.95** — the
  stylesheet grew 34.39 → 37.32 kB raw. The twelve Tier-1 commit bodies each report their
  own stylesheet delta and are honest; only the summary over them was wrong, which is why
  they are left alone.
- "**index chunk untouched**" is false: 301,101 → 301,121 B, md5 `488cd9a6…` →
  `6bc92d56…` at the time of writing.

### Standing hazards (unverified, worth checking when touched)

- The XRD module's `dSpacing` delegates to the cubic formula in `crystal/miller.ts`. Every
  `XRD_SAMPLES` entry is cubic (fcc/bcc/sc/diamond), so the domain holds — but **any
  hexagonal sample added there would be silently wrong**. Guard before extending.
- `crystal/metals.ts` carries measured `coa` per HCP metal while `crystal/structures.ts`
  hardcodes the ideal 1.633 in `volumeOverA3`. Confirm which one the density readout uses
  before trusting HCP densities (Zn and Cd deviate ~15%).
