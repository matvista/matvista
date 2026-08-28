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

Last shipped lens: **correctness** (iteration 1). Next lens: **product gap**.
If the current lens has nothing worth doing, say so explicitly and take the next lens —
do not invent busywork to fill it.

## Shipped

| # | Lens | Change |
|---|------|--------|
| 1 | Correctness | Hardenability readout: critical cooling rate now derived from the module's own Scheil model, transformed-fraction discontinuity removed, backwards UI sentence corrected |

## Backlog

Scored value (1–5) × effort (1–5, lower is cheaper). Value-per-effort drives the pick,
subject to the lens rotation.

### Product gaps

| Item | Value | Effort | V/E | Notes |
|------|-------|--------|-----|-------|
| URL routing (hash-based) | 5 | 2 | 2.5 | Tab state is `useState`; nothing is linkable or shareable. An instructor cannot send a link to a specific plane/steel/cooling rate. Biggest single product gap. Hash routing stays static-safe on Cloudflare Pages. |
| Landing / onboarding | 4 | 2 | 2.0 | App opens onto the periodic table with no statement of what MatVista is. |
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
| Accessibility of pre-Miller modules | 4 | 3 | 1.3 | Newer modules set `aria-invalid`/`aria-describedby`; older ones may signal state by colour alone. Unaudited. |
| Mobile across all nine modules | 4 | 3 | 1.3 | Canvases fixed at 460 px; wide SVGs and tables have no horizontal scroll containers. Untested. |

### Roadmap modules

`ROADMAP.md` holds fatigue/creep/fracture, semiconductors, corrosion. Backlog candidates,
not a queue — a product gap that improves all nine existing modules generally beats a tenth.

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

### Standing hazards (unverified, worth checking when touched)

- The XRD module's `dSpacing` delegates to the cubic formula in `crystal/miller.ts`. Every
  `XRD_SAMPLES` entry is cubic (fcc/bcc/sc/diamond), so the domain holds — but **any
  hexagonal sample added there would be silently wrong**. Guard before extending.
- `crystal/metals.ts` carries measured `coa` per HCP metal while `crystal/structures.ts`
  hardcodes the ideal 1.633 in `volumeOverA3`. Confirm which one the density readout uses
  before trusting HCP densities (Zn and Cd deviate ~15%).
