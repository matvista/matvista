/**
 * Polymer molecular weight, chain dimensions and crystallinity.
 *
 * Equations follow Callister & Rethwisch ch. 14 ("Polymer structures") and
 * ch. 15. Three results, and they chain into one another: a distribution gives
 * a degree of polymerisation, the degree of polymerisation gives a chain
 * length and a coil size, and a density gives the fraction of those chains
 * that managed to crystallise.
 *
 * ## What this module does not tabulate
 *
 * Almost nothing. A repeat unit's molar mass is *computed* from the app's own
 * `data/elements.json`, so PVC's 62.50 g/mol is arithmetic over the same
 * atomic masses the periodic table is coloured by rather than a number typed
 * in beside it. Crystalline density is *derived* from the unit cell by the
 * same `nA/V·N_A` the crystal-structures module uses. What is left is one
 * amorphous density, and `polymer/polymers.test.ts` corroborates even that
 * against three real polyethylene grades whose densities come from Appendix B.
 *
 * ## Distributions
 *
 * The two the module offers are the two that have closed-form dispersity, and
 * that is why they are the two: the general weighted-average code below can be
 * checked against an exact answer rather than against a table.
 *
 *  - **Step growth** at extent of reaction `p` gives Flory's most-probable
 *    distribution, `Xn = 1/(1−p)`, `Xw = (1+p)/(1−p)`, so `Đ = 1 + p` — which
 *    is why condensation polymers come out at a dispersity near 2 however
 *    carefully they are run.
 *  - **Living chain growth** adding a mean of `ν` monomers gives a Poisson
 *    distribution, `Xn = ν + 1` and `Đ = 1 + ν/(1+ν)²` — approaching 1, which
 *    is the whole point of the technique.
 */

/** One bin of a discrete molecular-weight distribution. */
export interface Bin {
  /** Degree of polymerisation at the centre of the bin. */
  dp: number;
  /** Number fraction of chains in it. Need not be normalised. */
  x: number;
}

/**
 * Number-average degree of polymerisation, `X̄n = Σ x_i·n_i`.
 *
 * Counts chains: every molecule votes once, however big it is. This is the
 * average an osmometer measures, because osmotic pressure counts particles.
 */
export function numberAverageDp(bins: Bin[]): number {
  const total = bins.reduce((s, b) => s + b.x, 0);
  if (total === 0) return 0;
  return bins.reduce((s, b) => s + b.x * b.dp, 0) / total;
}

/**
 * Weight-average degree of polymerisation, `X̄w = Σ w_i·n_i` with the weight
 * fractions `w_i ∝ x_i·n_i`.
 *
 * Weighs chains: a molecule twice the size counts twice. This is what light
 * scattering measures, and it is always the larger of the two — a big chain
 * contributes to `X̄w` in proportion to its size and to `X̄n` not at all.
 */
export function weightAverageDp(bins: Bin[]): number {
  const mass = bins.reduce((s, b) => s + b.x * b.dp, 0);
  if (mass === 0) return 0;
  return bins.reduce((s, b) => s + b.x * b.dp * b.dp, 0) / mass;
}

/**
 * Dispersity `Đ = X̄w/X̄n`, and it is ≥ 1 for every distribution — the
 * Cauchy–Schwarz inequality wearing a lab coat. Equality only when every chain
 * is the same length, which no real synthesis achieves.
 */
export function dispersity(bins: Bin[]): number {
  const n = numberAverageDp(bins);
  return n === 0 ? 1 : weightAverageDp(bins) / n;
}

/** Weight fractions for the same bins — the histogram that is *not* the number one. */
export function weightFractions(bins: Bin[]): number[] {
  const mass = bins.reduce((s, b) => s + b.x * b.dp, 0);
  return bins.map((b) => (mass === 0 ? 0 : (b.x * b.dp) / mass));
}

/**
 * Flory's most-probable distribution: step-growth polymerisation stopped at
 * extent of reaction `p`.
 *
 * `x_n = (1 − p)·p^(n−1)`. The single most consequential fact in step-growth
 * chemistry falls out of it: reaching `X̄n = 100` needs `p = 0.99`, so a
 * condensation polymer is a purity problem before it is a chemistry problem.
 */
export function stepGrowth(p: number): Bin[] {
  const maxDp = mostProbableTail(p);
  return Array.from({ length: maxDp }, (_, i) => ({ dp: i + 1, x: (1 - p) * Math.pow(p, i) }));
}

/**
 * Poisson distribution: living chain growth where every chain starts at the
 * same moment and grows for the same time, adding a mean of `nu` monomers.
 */
export function livingGrowth(nu: number): Bin[] {
  // Eight standard deviations either side of the mean, plus a floor for small
  // ν. Poisson is tightly peaked and the second moment converges well inside
  // this — but see `mostProbableTail` for why "well inside" is worth checking
  // rather than assuming.
  const spread = 8 * Math.sqrt(nu) + 8;
  const lo = Math.max(1, Math.floor(nu + 1 - spread));
  const hi = Math.ceil(nu + 1 + spread);
  return Array.from({ length: hi - lo + 1 }, (_, i) => ({
    dp: lo + i,
    x: poissonPmf(lo + i - 1, nu),
  }));
}

/**
 * Aggregate a distribution into equal-width bars, **for display only**.
 *
 * This is not a step on the way to the averages, and the separation is the
 * whole point of it being a separate function. Collapsing a bin to its mean
 * throws away the variance inside it, and `X̄w` is a second moment — so a
 * binned `X̄w` comes out systematically *low*. Over twelve bars of the
 * p = 0.95 distribution it read 1.81 against a true 1.95: a wrong number that
 * still looks like a step-growth dispersity, sits inside [1, 2], and would
 * have survived every inequality in the suite. The tests assert the bias is
 * there, so that nobody re-derives the averages from these bars.
 *
 * Returns number fraction `x` and weight fraction `w` per bar — the two
 * histograms of the same sample, which is the panel's entire argument.
 */
export function histogram(
  dist: Bin[],
  bars: number,
  upTo?: number,
): { dp: number; x: number; w: number }[] {
  const minDp = dist[0]?.dp ?? 1;
  const maxDp = upTo ?? dist[dist.length - 1]?.dp ?? 1;
  const width = (maxDp - minDp + 1) / bars;
  const total = dist.reduce((s, b) => s + b.x, 0);
  const mass = dist.reduce((s, b) => s + b.x * b.dp, 0);
  const out = Array.from({ length: bars }, (_, i) => ({
    dp: minDp + (i + 0.5) * width,
    x: 0,
    w: 0,
  }));
  for (const b of dist) {
    // Anything past the display range folds into the last bar rather than
    // being dropped, so the two series still sum to one and the plot does not
    // quietly lose the tail it is not wide enough to show.
    const i = Math.min(bars - 1, Math.max(0, Math.floor((b.dp - minDp) / width)));
    if (total > 0) out[i].x += b.x / total;
    if (mass > 0) out[i].w += (b.x * b.dp) / mass;
  }
  return out;
}

/**
 * How wide to draw, which is a different question from how far to sum.
 *
 * The moments need the tail out to a weight of 1e-9 — see `mostProbableTail` —
 * and drawing that range puts 85% of the plot in empty space past a
 * distribution that finished in the first seventh of it. So the axis stops
 * where `frac` of the *weight* has been accounted for, and the rest folds into
 * the last bar. At p = 0.95 that is about 180 rather than 463, and the weight
 * peak at X̄n = 20 is visible instead of being three pixels from the origin.
 *
 * `frac` is 0.999 rather than 0.995 because of what the fold looks like: at
 * 0.995 the last bar carries half a per cent of the weight and draws visibly
 * taller than its neighbours, which reads as chains piling up at the axis
 * limit — the opposite of what a decaying tail does. A tenth of that is
 * invisible, and costs a quarter more axis.
 */
export function displayRange(dist: Bin[], frac = 0.999): number {
  const mass = dist.reduce((s, b) => s + b.x * b.dp, 0);
  let acc = 0;
  for (const b of dist) {
    acc += (b.x * b.dp) / mass;
    if (acc >= frac) return b.dp;
  }
  return dist[dist.length - 1]?.dp ?? 1;
}

/**
 * How far out the most-probable distribution has to be summed.
 *
 * Six number-averages was the first answer here and it was wrong by 4% in the
 * dispersity, for a reason worth keeping: `X̄w` is a *second* moment, so the
 * tail it needs is far longer than the one `X̄n` needs. At p = 0.95 the chains
 * beyond 120 units are 0.2% of the molecules and several per cent of the mass,
 * and truncating there pulled Đ from 1.95 down to 1.88 — a plausible-looking
 * number that no inequality test would have caught, since it is still between
 * 1 and 2.
 *
 * So the bound is on the *weight* left uncounted, not on a multiple of the
 * mean. For this distribution that tail has a closed form —
 * `1 − W(n) = (1 + n(1−p))·p^n` — which is walked until it falls under 1e-9.
 */
function mostProbableTail(p: number): number {
  const step = Math.max(1, Math.ceil(1 / (1 - p) / 8));
  for (let n = step; n < 1e7; n += step) {
    if ((1 + n * (1 - p)) * Math.pow(p, n) < 1e-9) return n;
  }
  return Math.ceil(60 / (1 - p));
}

/** `e^-ν ν^k / k!`, by logs — `ν^k` overflows a double well before ν = 500. */
function poissonPmf(k: number, nu: number): number {
  if (k < 0) return 0;
  if (nu === 0) return k === 0 ? 1 : 0;
  return Math.exp(-nu + k * Math.log(nu) - logFactorial(k));
}

function logFactorial(k: number): number {
  let s = 0;
  for (let i = 2; i <= k; i++) s += Math.log(i);
  return s;
}

/** Closed-form dispersity of each route, for the readout and for the tests. */
export function stepGrowthDispersity(p: number): number {
  return 1 + p;
}

export function livingDispersity(nu: number): number {
  return 1 + nu / Math.pow(1 + nu, 2);
}

/* ======================================================= chain dimensions == */

/** C–C bond length, nm. */
export const BOND_LENGTH = 0.154;
/** Tetrahedral bond angle at a backbone carbon, degrees. */
export const BOND_ANGLE = 109.5;

/**
 * The two lengths of a chain, and the gap between them is the point.
 *
 * `L = N·d·sin(θ/2)` is the chain pulled straight — the zig-zag projected onto
 * its own axis, which is why the bond angle appears at all. `r = d·√N` is the
 * root-mean-square end-to-end distance of the same chain left alone, a random
 * walk of N steps.
 *
 * One grows with N and the other with √N, so a chain long enough to matter is
 * a coil far smaller than its own contour: at 1000 repeat units of
 * polyethylene, 252 nm of chain occupies about 7 nm of space.
 */
export function chainDimensions(backboneBonds: number): { contour: number; endToEnd: number } {
  const contour = backboneBonds * BOND_LENGTH * Math.sin((BOND_ANGLE * Math.PI) / 360);
  return { contour, endToEnd: BOND_LENGTH * Math.sqrt(backboneBonds) };
}

/* ========================================================== crystallinity == */

export const AVOGADRO = 6.02214076e23;

/** Cubic nanometres in a cubic centimetre. Named because `× 1e-21` inline reads
 *  as a magic number, and oxc's `erasing-op` rule flags the literal as a
 *  suspected multiply-by-zero. */
export const NM3_PER_CM3 = 1e21;

/**
 * Theoretical density of a crystalline cell — `ρ = n·A / (V_c·N_A)`, the same
 * expression `crystal/geometry.ts` uses for a metal, with the repeat unit
 * standing in for the atom.
 *
 * @param unitsPerCell repeat units in the cell
 * @param repeatMass   molar mass of one repeat unit, g/mol
 * @param volumeNm3    cell volume, nm³
 */
export function crystalDensity(
  unitsPerCell: number,
  repeatMass: number,
  volumeNm3: number,
): number {
  return (unitsPerCell * repeatMass) / ((volumeNm3 / NM3_PER_CM3) * AVOGADRO);
}

/**
 * Per cent crystallinity from a measured specimen density.
 *
 * `%c = 100·ρ_c(ρ_s − ρ_a) / [ρ_s(ρ_c − ρ_a)]`. Note it is not a linear
 * interpolation between the two densities — the ρ_c and ρ_s outside the
 * bracket are what make it a *volume* mixture read through a *mass*
 * measurement.
 */
export function percentCrystallinity(
  specimen: number,
  amorphous: number,
  crystalline: number,
): number {
  return (100 * crystalline * (specimen - amorphous)) / (specimen * (crystalline - amorphous));
}
