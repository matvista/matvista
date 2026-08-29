/**
 * Generates the landing page's figure components from the app's own models.
 *
 *   node --experimental-strip-types scripts/gen-module-figures.ts
 *
 * The landing page shows real computed output rather than decoration, so every
 * curve, peak and point below comes from the same modules the interactive
 * pages run: `phase/systems.ts`, `failure/model.ts`, `selection/materials.ts`
 * and `xrd/diffraction.ts`. Nothing here invents a number — the plotting code
 * only maps model output onto a coordinate box.
 *
 * Why generate components at all, rather than plotting at runtime? The landing
 * page must paint immediately and must not pull four model modules into its
 * bundle, so the geometry is computed once, offline, and committed. That makes
 * the committed files a *cache* of the models, which can go stale silently —
 * `src/assets/figures/figures.test.ts` re-runs `buildFigures()` in-process and
 * compares it with what is on disk, so a data change that would quietly
 * invalidate a figure fails the suite instead.
 *
 * Output is deterministic: no `Math.random`, no timestamps, fixed decimal
 * precision, and every iteration order fixed by the source data. Re-running
 * reproduces byte-identical files.
 */
/**
 * Node's own APIs are reached through `process.getBuiltinModule` rather than
 * imported, and `process` is declared here rather than typed by `@types/node`.
 *
 * That looks roundabout, and the reason is the app's tsconfig: it sets
 * `"types": ["vite/client"]`, so the Node globals are deliberately absent —
 * browser code has no business touching them. `figures.test.ts` imports this
 * file for its rendering functions, which pulls it into that program, so a
 * bare `import ... from 'node:fs'` would fail the app typecheck. Declaring the
 * sliver actually used keeps the entry point honest without widening what the
 * rest of the source can reach for.
 */
declare const process: {
  argv: string[];
  getBuiltinModule(id: string): unknown;
};

type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context: unknown) => unknown,
) => unknown;

interface NodeModuleApi {
  registerHooks(hooks: { resolve: ResolveHook }): void;
}
interface NodeFsApi {
  writeFileSync(path: URL, data: string): void;
}
interface NodeUrlApi {
  pathToFileURL(path: string): URL;
}

/* ------------------------------------------------------------------ theme */

/**
 * The theming contract with `landing.css`. These SVGs are inlined into the
 * DOM, so they inherit custom properties and follow the app's three-state
 * light/dark/system theme for free — but only if every colour is a `var()`.
 * The fallbacks are the light-theme values from `landing.css`, copied exactly,
 * so a figure rendered somewhere the tokens are undefined comes out dimmer
 * than intended rather than in a different design. They drifted once already —
 * the set below used to be an earlier palette that matched none of the
 * shipping tokens, under this same comment claiming it did — so if you change
 * a `--fig-*` value in `landing.css`, change it here and regenerate.
 *
 * These carry TEXT as well as strokes: peak indices, series names and the
 * phase-diagram annotations are all set in them, so each is measured against
 * the plate ground at the 4.5:1 text floor, not 3:1. Ratios are recorded
 * beside the tokens in `landing.css`.
 */
const INK = 'var(--fig-ink, #2f2e2b)';
const LABEL = 'var(--fig-label, #52514e)';
const GRID = 'var(--fig-grid, #e1e0d9)';
const ACCENT = 'var(--fig-accent, #b0184a)';
const SERIES_A = 'var(--fig-a, #256bbd)';
const SERIES_B = 'var(--fig-b, #a8511f)';
const SERIES_C = 'var(--fig-c, #0f766e)';
const SERIES_D = 'var(--fig-d, #8a6d1f)';

/* ------------------------------------------------------- markup utilities */

const VIEW_W = 640;
const VIEW_H = 420;
const INDENT = ' '.repeat(6);

type Attrs = Record<string, string | number | undefined>;

/** Fixed-precision number formatting — the reason output is byte-stable. */
function f(v: number, dp = 2): string {
  const r = Number(v.toFixed(dp));
  return Object.is(r, -0) ? '0' : String(r);
}

/**
 * JSX text cannot contain `<`, `>`, `{` or `}` — a label carrying one would
 * produce a file that does not compile, so it throws here at generation time
 * rather than shipping. An ampersand is legal but starts an entity, so it is
 * escaped: `CLASS_LABEL` really does contain "Ceramics & glasses".
 */
function jsxText(s: string): string {
  if (/[<>{}]/.test(s)) throw new Error(`label is not JSX-safe: ${s}`);
  return s.replace(/&/g, '&amp;');
}

function attrString(a: Attrs): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
}

function node(name: string, a: Attrs): string {
  return `${INDENT}<${name}${attrString(a)} />`;
}

function textNode(content: string, a: Attrs): string {
  return `${INDENT}<text${attrString(a)}>${jsxText(content)}</text>`;
}

function comment(s: string): string {
  return `${INDENT}{/* ${s} */}`;
}

/** A `<text>` for a tick or axis label: same size and colour everywhere. */
function tickLabel(content: string, x: number, y: number, anchor: string): string {
  return textNode(content, {
    x: f(x, 1),
    y: f(y, 1),
    textAnchor: anchor,
    fontSize: 11,
    fill: LABEL,
  });
}

/* --------------------------------------------------------------- geometry */

type Scale = (v: number) => number;

function linearScale(d0: number, d1: number, r0: number, r1: number): Scale {
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

function logScale(d0: number, d1: number, r0: number, r1: number): Scale {
  const a = Math.log10(d0);
  const b = Math.log10(d1);
  return (v) => r0 + ((Math.log10(v) - a) / (b - a)) * (r1 - r0);
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Tick {
  v: number;
  label?: string;
}

interface AxisSpec {
  scale: Scale;
  ticks: Tick[];
  title: string;
}

function linearTicks(from: number, to: number, step: number, dp = 0): Tick[] {
  const out: Tick[] = [];
  // Integer stepping rather than accumulation, so floating-point drift cannot
  // put a tick at 599.9999999.
  const n = Math.round((to - from) / step);
  for (let i = 0; i <= n; i++) {
    const v = from + i * step;
    out.push({ v, label: v.toFixed(dp) });
  }
  return out;
}

const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

/** `1000` → `10³`, the readable form for a decade axis. */
function powerOfTenLabel(exponent: number): string {
  const digits = Math.abs(exponent)
    .toString()
    .split('')
    .map((d) => SUPERSCRIPT[Number(d)])
    .join('');
  return `10${exponent < 0 ? '⁻' : ''}${digits}`;
}

function decadeTicks(fromExp: number, toExp: number): Tick[] {
  const out: Tick[] = [];
  for (let e = fromExp; e <= toExp; e++) out.push({ v: 10 ** e, label: powerOfTenLabel(e) });
  return out;
}

/**
 * Gridlines, tick marks, tick labels, the two axis lines and the axis titles.
 * Shared by all four figures so they read as one set of plates.
 */
function plotFrame(box: Box, x: AxisSpec, y: AxisSpec): string[] {
  const out: string[] = [comment('axes and gridlines')];

  for (const t of y.ticks) {
    const py = y.scale(t.v);
    out.push(
      node('line', {
        x1: f(box.left, 1),
        y1: f(py, 1),
        x2: f(box.right, 1),
        y2: f(py, 1),
        stroke: GRID,
        strokeWidth: 1,
      }),
    );
    if (t.label !== undefined) out.push(tickLabel(t.label, box.left - 8, py + 3.8, 'end'));
  }

  for (const t of x.ticks) {
    const px = x.scale(t.v);
    out.push(
      node('line', {
        x1: f(px, 1),
        y1: f(box.top, 1),
        x2: f(px, 1),
        y2: f(box.bottom, 1),
        stroke: GRID,
        strokeWidth: 1,
      }),
    );
    out.push(
      node('line', {
        x1: f(px, 1),
        y1: f(box.bottom, 1),
        x2: f(px, 1),
        y2: f(box.bottom + 4, 1),
        stroke: INK,
        strokeWidth: 1,
      }),
    );
    if (t.label !== undefined) out.push(tickLabel(t.label, px, box.bottom + 17, 'middle'));
  }

  out.push(
    node('line', {
      x1: f(box.left, 1),
      y1: f(box.top, 1),
      x2: f(box.left, 1),
      y2: f(box.bottom, 1),
      stroke: INK,
      strokeWidth: 1.2,
    }),
    node('line', {
      x1: f(box.left, 1),
      y1: f(box.bottom, 1),
      x2: f(box.right, 1),
      y2: f(box.bottom, 1),
      stroke: INK,
      strokeWidth: 1.2,
    }),
    textNode(x.title, {
      x: f((box.left + box.right) / 2, 1),
      y: f(box.bottom + 38, 1),
      textAnchor: 'middle',
      fontSize: 12,
      fill: LABEL,
    }),
    textNode(y.title, {
      x: 15,
      y: f((box.top + box.bottom) / 2, 1),
      textAnchor: 'middle',
      fontSize: 12,
      fill: LABEL,
      transform: `rotate(-90 15 ${f((box.top + box.bottom) / 2, 1)})`,
    }),
  );
  return out;
}

function polylinePath(points: [number, number][], sx: Scale, sy: Scale): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${f(sx(x), 1)},${f(sy(y), 1)}`).join(' ');
}

/* ------------------------------------------------------- label collisions */

interface LabelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Rough text extent. 0.55 em per character is a deliberate over-estimate for
 * the system sans stack, so the collision test errs towards dropping a label
 * rather than shipping two on top of each other.
 */
function labelBox(text: string, x: number, baseline: number, size: number, anchor: string): LabelBox {
  const w = text.length * size * 0.55;
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return { x0, y0: baseline - size * 0.8, x1: x0 + w, y1: baseline + size * 0.25 };
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Inside the viewBox, with a hair of margin — a clipped label is a wrong one. */
function withinView(b: LabelBox): boolean {
  return b.x0 >= 2 && b.x1 <= VIEW_W - 3 && b.y0 >= 2 && b.y1 <= VIEW_H - 2;
}

/** Placement register: a label is drawn only if it clears everything already placed. */
class LabelSpace {
  private placed: LabelBox[] = [];

  reserve(box: LabelBox): void {
    this.placed.push(box);
  }

  tryPlace(box: LabelBox): boolean {
    if (this.placed.some((p) => overlaps(p, box))) return false;
    this.placed.push(box);
    return true;
  }
}

/* ------------------------------------------------------------ file layout */

function figureFile(component: string, docLines: string[], body: string[]): string {
  return [
    '/**',
    ` * ${component} — generated, do not edit by hand.`,
    ' *',
    ...docLines.map((l) => (l ? ` * ${l}` : ' *')),
    ' *',
    ' * Regenerate with:',
    ' *   node --experimental-strip-types scripts/gen-module-figures.ts',
    ' */',
    `export function ${component}() {`,
    '  return (',
    `    <svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" aria-hidden="true" ` +
      "style={{ display: 'block', width: '100%', height: 'auto' }}>",
    ...body,
    '    </svg>',
    '  );',
    '}',
    '',
  ].join('\n');
}

/* ============================================================ 1. phase === */

interface PhaseModule {
  FE_C: {
    boundaries: { label: string; points: [number, number][]; kind: string }[];
    invariants: { label: string; x: number; T: number; reaction: string; type: string }[];
    regionLabels: { text: string; x: number; T: number }[];
    xMax: number;
    tMin: number;
    tMax: number;
    evaluate(x: number, T: number): {
      region: string;
      phases: { name: string; composition: number; fraction: number }[];
      tieLine: { x1: number; x2: number } | null;
    };
  };
}

/** Composition and temperature of the landing link `#/phase?T=650&sys=fe-c&x=0.4`. */
const TIE_X = 0.4;
const TIE_T = 650;

function renderPhaseFigure(mod: PhaseModule): string {
  const sys = mod.FE_C;
  const box: Box = { left: 56, right: 622, top: 28, bottom: 370 };
  const sx = linearScale(0, sys.xMax, box.left, box.right);
  const sy = linearScale(sys.tMin, sys.tMax, box.bottom, box.top);

  const body: string[] = [
    ...plotFrame(
      box,
      {
        scale: sx,
        ticks: [...linearTicks(0, 6, 1), { v: sys.xMax, label: sys.xMax.toFixed(1) }],
        title: 'Composition (wt% C)',
      },
      { scale: sy, ticks: linearTicks(sys.tMin, sys.tMax, 200), title: 'Temperature (°C)' },
    ),
    comment('phase boundaries, straight from FE_C.boundaries'),
  ];

  for (const b of sys.boundaries) {
    body.push(
      node('path', {
        d: polylinePath(b.points, sx, sy),
        fill: 'none',
        stroke: INK,
        strokeWidth: b.kind === 'isotherm' ? 1.1 : 1.4,
        strokeLinejoin: 'round',
      }),
    );
  }

  // The tie line is drawn before the field labels so the labels can be moved
  // out of its way rather than the other way round.
  const point = sys.evaluate(TIE_X, TIE_T);
  const tie = point.tieLine!;
  const tieY = sy(TIE_T);

  const space = new LabelSpace();
  body.push(comment('phase field labels, from FE_C.regionLabels'));
  for (const r of sys.regionLabels) {
    // Field labels sitting within a couple of text-heights of the tie line
    // annotation are pushed 100 °C clear of it; the label belongs to a field,
    // not to a temperature, so moving it changes nothing it asserts.
    const T = Math.abs(sy(r.T) - tieY) < 26 ? r.T - 100 : r.T;
    const bx = labelBox(r.text, sx(r.x), sy(T) + 4, 12, 'middle');
    space.reserve(bx);
    body.push(
      textNode(r.text, {
        x: f(sx(r.x), 1),
        y: f(sy(T) + 4, 1),
        textAnchor: 'middle',
        fontSize: 12,
        fill: INK,
      }),
    );
  }

  body.push(comment('invariant points, from FE_C.invariants'));
  const midY = (box.top + box.bottom) / 2;
  for (const inv of sys.invariants) {
    const px = sx(inv.x);
    const py = sy(inv.T);
    const text = `${inv.label} — ${inv.x.toFixed(2)} wt% C, ${inv.T} °C`;
    body.push(
      node('circle', { cx: f(px, 1), cy: f(py, 1), r: 3.6, fill: ACCENT }),
      node('circle', { cx: f(px, 1), cy: f(py, 1), r: 7, fill: 'none', stroke: ACCENT, strokeWidth: 1 }),
    );
    // Above the point where the space above is open (the eutectoid, low in the
    // diagram) and below it where the liquidus would otherwise be written
    // through (the eutectic, high and to the right).
    const above = py > midY;
    const tx = above ? px + 11 : px;
    const ty = above ? py - 9 : py + 21;
    const anchor = above ? 'start' : 'middle';
    if (space.tryPlace(labelBox(text, tx, ty, 11, anchor))) {
      body.push(
        textNode(text, { x: f(tx, 1), y: f(ty, 1), textAnchor: anchor, fontSize: 11, fill: ACCENT }),
      );
    }
  }

  const alpha = point.phases[0];
  const carbide = point.phases[1];
  body.push(
    comment(`tie line from FE_C.evaluate(${TIE_X}, ${TIE_T}) — the lever rule at the linked state`),
    node('line', {
      x1: f(sx(tie.x1), 1),
      y1: f(tieY, 1),
      x2: f(sx(tie.x2), 1),
      y2: f(tieY, 1),
      stroke: ACCENT,
      strokeWidth: 1.4,
    }),
  );
  for (const end of [tie.x1, tie.x2]) {
    body.push(
      node('line', {
        x1: f(sx(end), 1),
        y1: f(tieY - 5, 1),
        x2: f(sx(end), 1),
        y2: f(tieY + 5, 1),
        stroke: ACCENT,
        strokeWidth: 1.4,
      }),
    );
  }
  body.push(
    node('circle', { cx: f(sx(TIE_X), 1), cy: f(tieY, 1), r: 4.2, fill: ACCENT }),
    textNode(`${TIE_X} wt% C, ${TIE_T} °C`, {
      x: f(sx(TIE_X) + 9, 1),
      y: f(tieY - 8, 1),
      textAnchor: 'start',
      fontSize: 11,
      fill: ACCENT,
    }),
    textNode(
      `${point.region}:  ${alpha.name} ${(alpha.fraction * 100).toFixed(1)} wt%  +  ` +
        `${carbide.name} ${(carbide.fraction * 100).toFixed(1)} wt%`,
      {
        x: f(sx(1.35), 1),
        y: f(tieY + 16, 1),
        textAnchor: 'start',
        fontSize: 11,
        fill: ACCENT,
      },
    ),
  );

  return figureFile(
    'PhaseFigure',
    [
      'The iron–iron carbide diagram, plotted from `FE_C` in `src/phase/systems.ts`:',
      'boundaries, invariant points and field labels are the module’s own data, and',
      `the tie line is \`FE_C.evaluate(${TIE_X}, ${TIE_T})\` — the same call the phase module makes`,
      'for the deep link `#/phase?T=650&sys=fe-c&x=0.4`, lever-rule fractions included.',
    ],
    body,
  );
}

/* ========================================================== 2. fatigue === */

interface FatigueModule {
  MECH_MATERIALS: { id: string; name: string; uts: number }[];
  getFatigueBehaviour(id: string): { hasEnduranceLimit: boolean; ratio: number; kneeCycles: number };
  fitSn(uts: number, ratio: number, kneeCycles: number, hasEnduranceLimit: boolean): SnFitLike;
  fatigueStrength(fit: SnFitLike, N: number): number;
}

interface SnFitLike {
  a: number;
  b: number;
  kneeStress: number;
  kneeCycles: number;
  hasEnduranceLimit: boolean;
}

/**
 * Three of the seven alloys in `FATIGUE_BEHAVIOUR`, chosen for the contrast
 * the plate exists to make: two ferrous/titanium curves that flatten at an
 * endurance limit, and one that never does. Nickel is the useful third curve
 * because it *starts above* the steel and still ends below its limit.
 */
const FATIGUE_SERIES = [
  { id: 'ti', colour: SERIES_B },
  { id: 'ni', colour: SERIES_D },
  { id: 'steel1020', colour: SERIES_A },
];

const N_MIN_EXP = 3;
const N_MAX_EXP = 9;

function renderFatigueFigure(mod: FatigueModule): string {
  const box: Box = { left: 58, right: 490, top: 28, bottom: 370 };
  const sx = logScale(10 ** N_MIN_EXP, 10 ** N_MAX_EXP, box.left, box.right);
  const sy = linearScale(0, 500, box.bottom, box.top);

  const body: string[] = [
    ...plotFrame(
      box,
      { scale: sx, ticks: decadeTicks(N_MIN_EXP, N_MAX_EXP), title: 'Cycles to failure, N (log scale)' },
      { scale: sy, ticks: linearTicks(0, 500, 100), title: 'Stress amplitude, S (MPa)' },
    ),
  ];

  const space = new LabelSpace();
  const drawn: { name: string; colour: string; y: number; limit: boolean }[] = [];

  for (const series of FATIGUE_SERIES) {
    const metal = mod.MECH_MATERIALS.find((m) => m.id === series.id)!;
    const behaviour = mod.getFatigueBehaviour(series.id);
    const fit = mod.fitSn(metal.uts, behaviour.ratio, behaviour.kneeCycles, behaviour.hasEnduranceLimit);

    // 20 samples per decade: enough that the knee reads as a corner rather than
    // a chamfer, and the Basquin line between samples is straight in log N.
    const pts: [number, number][] = [];
    const steps = (N_MAX_EXP - N_MIN_EXP) * 20;
    for (let i = 0; i <= steps; i++) {
      const N = 10 ** (N_MIN_EXP + ((N_MAX_EXP - N_MIN_EXP) * i) / steps);
      pts.push([N, mod.fatigueStrength(fit, N)]);
    }
    // The knee is inserted exactly, so the corner lands on the model's own
    // cycle count rather than on the nearest sample.
    if (fit.kneeCycles < 10 ** N_MAX_EXP) {
      pts.push([fit.kneeCycles, mod.fatigueStrength(fit, fit.kneeCycles)]);
      pts.sort((p, q) => p[0] - q[0]);
    }

    body.push(
      comment(`${metal.name}: fitSn(UTS ${metal.uts} MPa, ratio ${behaviour.ratio})`),
      node('path', {
        d: polylinePath(pts, sx, sy),
        fill: 'none',
        stroke: series.colour,
        strokeWidth: 2,
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
      }),
    );
    if (behaviour.hasEnduranceLimit) {
      body.push(
        node('circle', {
          cx: f(sx(fit.kneeCycles), 1),
          cy: f(sy(fit.kneeStress), 1),
          r: 3.4,
          fill: series.colour,
        }),
      );
    }
    drawn.push({
      name: metal.name,
      colour: series.colour,
      y: sy(pts[pts.length - 1][1]),
      limit: behaviour.hasEnduranceLimit,
    });
  }

  // End-of-curve labels in the right margin, nudged apart where two curves
  // finish within a text-height of one another.
  body.push(comment('series labels at the right-hand end of each curve'));
  const sorted = [...drawn].sort((a, b) => a.y - b.y);
  let lastY = -Infinity;
  for (const d of sorted) {
    // 26 px between one series name and the next: enough that each name reads
    // with the small line beneath it as one block.
    const y = Math.max(d.y + 4, lastY + 14);
    lastY = y;
    body.push(
      textNode(d.name, {
        x: f(box.right + 10, 1),
        y: f(y, 1),
        textAnchor: 'start',
        fontSize: 11,
        fill: d.colour,
      }),
      textNode(d.limit ? 'fatigue limit' : 'no fatigue limit', {
        x: f(box.right + 10, 1),
        y: f(y + 12, 1),
        textAnchor: 'start',
        fontSize: 9.5,
        fill: LABEL,
      }),
    );
    space.reserve(labelBox(d.name, box.right + 10, y, 11, 'start'));
    lastY = y + 12;
  }

  // The teaching point, annotated once: past the knee the ferrous curve holds
  // and the non-ferrous one keeps descending through it.
  const steel = mod.MECH_MATERIALS.find((m) => m.id === 'steel1020')!;
  const steelBehaviour = mod.getFatigueBehaviour('steel1020');
  const steelFit = mod.fitSn(steel.uts, steelBehaviour.ratio, steelBehaviour.kneeCycles, true);
  const kx = sx(steelFit.kneeCycles);
  const ky = sy(steelFit.kneeStress);
  // Written below and to the left of the knee: that corner is empty, whereas
  // anything to the right runs into the series labels in the margin.
  body.push(
    comment('endurance-limit annotation'),
    node('line', {
      x1: f(kx - 3, 1),
      y1: f(ky + 4, 1),
      x2: f(kx - 16, 1),
      y2: f(ky + 20, 1),
      stroke: ACCENT,
      strokeWidth: 1,
    }),
    textNode(`endurance limit ${steelFit.kneeStress.toFixed(0)} MPa`, {
      x: f(kx - 20, 1),
      y: f(ky + 24, 1),
      textAnchor: 'end',
      fontSize: 11,
      fill: ACCENT,
    }),
    textNode('the curve flattens and stays flat', {
      x: f(kx - 20, 1),
      y: f(ky + 37, 1),
      textAnchor: 'end',
      fontSize: 10,
      fill: LABEL,
    }),
  );

  return figureFile(
    'FatigueFigure',
    [
      'Estimated S–N curves for three of the alloys in `FATIGUE_BEHAVIOUR`, built by',
      '`fitSn`/`fatigueStrength` from `src/failure/model.ts` on the tensile strengths in',
      '`src/mechanical/materials.ts`. Titanium and steel flatten at an endurance limit;',
      'nickel has none and keeps descending, ending below the steel it started above.',
    ],
    body,
  );
}

/* ============================================================ 3. Ashby === */

interface SelectionMaterialLike {
  name: string;
  cls: string;
  density: number;
  modulus: number;
}

interface SelectionModule {
  SELECTION_MATERIALS: SelectionMaterialLike[];
  CLASS_LABEL: Record<string, string>;
  INDICES: { id: string; label: string; property: string; exponent: number; slope: number }[];
  indexValue(m: SelectionMaterialLike, idx: SelectionModule['INDICES'][number]): number;
}

/**
 * Four categorical tokens against five families, so elastomers share the
 * polymer hue and are told apart by an open diamond marker instead. Inventing
 * a fifth colour token would break the contract with `landing.css`.
 */
const FAMILY_STYLE: Record<string, { colour: string; shape: 'circle' | 'square' | 'triangle' | 'diamond' }> = {
  metal: { colour: SERIES_A, shape: 'circle' },
  ceramic: { colour: SERIES_B, shape: 'square' },
  composite: { colour: SERIES_C, shape: 'triangle' },
  polymer: { colour: SERIES_D, shape: 'circle' },
  elastomer: { colour: SERIES_D, shape: 'diamond' },
};
const FAMILY_ORDER = ['metal', 'ceramic', 'composite', 'polymer', 'elastomer'];

/** A handful of anchors, enough to orient a reader without crowding the cloud. */
const ASHBY_CALLOUTS: Record<string, string> = {
  'Diamond (natural)': 'Diamond',
  Tungsten: 'Tungsten',
  'Steel 1020 (annealed)': 'Steel',
  'Alumina 99.9%': 'Alumina',
  'Carbon–epoxy (longitudinal)': 'CFRP',
  'Wood, Douglas fir (along grain)': 'Wood',
  'Nitrile rubber': 'Rubber',
};

function marker(shape: string, cx: number, cy: number, colour: string): string {
  switch (shape) {
    case 'square':
      return node('rect', {
        x: f(cx - 3.1, 1),
        y: f(cy - 3.1, 1),
        width: 6.2,
        height: 6.2,
        fill: colour,
      });
    case 'triangle':
      return node('path', {
        d: `M${f(cx, 1)},${f(cy - 4, 1)} L${f(cx + 3.6, 1)},${f(cy + 2.6, 1)} L${f(cx - 3.6, 1)},${f(cy + 2.6, 1)} Z`,
        fill: colour,
      });
    case 'diamond':
      return node('path', {
        d: `M${f(cx, 1)},${f(cy - 4.4, 1)} L${f(cx + 4.4, 1)},${f(cy, 1)} L${f(cx, 1)},${f(cy + 4.4, 1)} L${f(cx - 4.4, 1)},${f(cy, 1)} Z`,
        fill: 'none',
        stroke: colour,
        strokeWidth: 1.4,
      });
    default:
      return node('circle', { cx: f(cx, 1), cy: f(cy, 1), r: 3.4, fill: colour });
  }
}

function renderAshbyFigure(mod: SelectionModule): string {
  const box: Box = { left: 62, right: 624, top: 40, bottom: 370 };
  const sx = logScale(0.3, 30, box.left, box.right);
  const sy = logScale(1e-3, 1e3, box.bottom, box.top);

  const body: string[] = [
    ...plotFrame(
      box,
      {
        scale: sx,
        ticks: [0.3, 0.5, 1, 2, 5, 10, 20, 30].map((v) => ({ v, label: String(v) })),
        title: 'Density, ρ (Mg/m³ = g/cm³) — log scale',
      },
      { scale: sy, ticks: decadeTicks(-3, 3), title: "Young's modulus, E (GPa) — log scale" },
    ),
  ];

  // Legend along the top, outside the plot: every corner of an E–ρ chart is
  // occupied by real materials, so there is nowhere inside it to put one.
  body.push(comment('family legend, labels from CLASS_LABEL'));
  let lx = box.left + 4;
  for (const cls of FAMILY_ORDER) {
    const style = FAMILY_STYLE[cls];
    const text = mod.CLASS_LABEL[cls];
    body.push(
      marker(style.shape, lx, 18, style.colour),
      textNode(text, {
        x: f(lx + 9, 1),
        y: 22,
        textAnchor: 'start',
        fontSize: 10.5,
        fill: LABEL,
      }),
    );
    lx += 18 + text.length * 5.8;
  }

  const space = new LabelSpace();

  // Guide line for E^½/ρ. Anchored on the material with the largest index
  // value, so it is the frontier: nothing in the dataset lies above it.
  const idx = mod.INDICES.find((i) => i.id === 'e12-rho')!;
  const best = mod.SELECTION_MATERIALS.reduce((a, b) =>
    mod.indexValue(b, idx) > mod.indexValue(a, idx) ? b : a,
  );
  const M = mod.indexValue(best, idx);
  // E = (M·ρ)^(1/exponent) — for the square-root index a line of slope 2.
  const guideE = (rho: number) => (M * rho) ** (1 / idx.exponent);
  // The line leaves the top of the box at the density where E reaches 1000 GPa.
  const topRho = 1e3 ** idx.exponent / M;
  body.push(
    comment(`${idx.label} guide line, slope ${idx.slope}, anchored on ${best.name}`),
    node('path', {
      d: `M${f(sx(0.3), 1)},${f(sy(guideE(0.3)), 1)} L${f(sx(topRho), 1)},${f(sy(1e3), 1)}`,
      fill: 'none',
      stroke: ACCENT,
      strokeWidth: 1.6,
      strokeDasharray: '7 4',
    }),
  );
  // High enough on the box that the label sits in the wedge above the line
  // rather than across it.
  const guideLabelY = sy(700);
  const guideLabel = `${idx.label} = ${M.toFixed(1)}`;
  const guideSub = `slope ${idx.slope} — nothing lies above it`;
  body.push(
    textNode(guideLabel, {
      x: f(box.left + 6, 1),
      y: f(guideLabelY, 1),
      textAnchor: 'start',
      fontSize: 12,
      fill: ACCENT,
    }),
    textNode(guideSub, {
      x: f(box.left + 6, 1),
      y: f(guideLabelY + 13, 1),
      textAnchor: 'start',
      fontSize: 10.5,
      fill: ACCENT,
    }),
  );
  space.reserve(labelBox(guideLabel, box.left + 6, guideLabelY, 12, 'start'));
  space.reserve(labelBox(guideSub, box.left + 6, guideLabelY + 13, 10.5, 'start'));

  // Points, drawn family by family so the plotting order is fixed by
  // FAMILY_ORDER rather than by however the dataset happens to be sorted.
  for (const cls of FAMILY_ORDER) {
    const style = FAMILY_STYLE[cls];
    body.push(comment(`${mod.CLASS_LABEL[cls]} — from SELECTION_MATERIALS`));
    for (const m of mod.SELECTION_MATERIALS.filter((x) => x.cls === cls)) {
      body.push(marker(style.shape, sx(m.density), sy(m.modulus), style.colour));
    }
  }

  // Every marker is an obstacle as well as every label, so a callout is only
  // written where it lands on empty chart. Four offsets are tried in turn and
  // the callout is dropped if none of them is clear — a missing name is much
  // cheaper than a name written across the cloud it is trying to identify.
  for (const m of mod.SELECTION_MATERIALS) {
    const px = sx(m.density);
    const py = sy(m.modulus);
    space.reserve({ x0: px - 5, y0: py - 5, x1: px + 5, y1: py + 5 });
  }
  body.push(comment('anchor callouts, dropped where they would collide'));
  for (const cls of FAMILY_ORDER) {
    for (const m of mod.SELECTION_MATERIALS.filter((x) => x.cls === cls)) {
      const text = ASHBY_CALLOUTS[m.name];
      if (!text) continue;
      const px = sx(m.density);
      const py = sy(m.modulus);
      const candidates: { x: number; y: number; anchor: string }[] = [
        { x: px + 8, y: py + 3.5, anchor: 'start' },
        { x: px - 8, y: py + 3.5, anchor: 'end' },
        { x: px, y: py - 10, anchor: 'middle' },
        { x: px, y: py + 16, anchor: 'middle' },
      ];
      const spot = candidates.find((c) => {
        const bx = labelBox(text, c.x, c.y, 11, c.anchor);
        return withinView(bx) && space.tryPlace(bx);
      });
      if (!spot) continue;
      body.push(
        textNode(text, {
          x: f(spot.x, 1),
          y: f(spot.y, 1),
          textAnchor: spot.anchor,
          fontSize: 11,
          fill: INK,
        }),
      );
    }
  }

  return figureFile(
    'AshbyFigure',
    [
      "Young's modulus against density for all 54 materials in `SELECTION_MATERIALS`",
      '(`src/selection/materials.ts`), on log–log axes with the families coloured by',
      '`CLASS_LABEL`. The dashed line is the `e12-rho` entry of `INDICES`, drawn at the',
      '`indexValue` of the best material in the set, so it bounds the whole population.',
    ],
    body,
  );
}

/* ============================================================== 4. XRD === */

interface PeakLike {
  h: number;
  k: number;
  l: number;
  twoTheta: number;
  intensity: number;
}

interface XrdModule {
  XRD_SAMPLES: { id: string; name: string; lattice: string; a: number }[];
  XRD_SOURCES: { id: string; label: string; lambda: number }[];
  computePattern(lattice: string, a: number, lambda: number, maxTwoTheta?: number): PeakLike[];
}

const XRD_SAMPLE_ID = 'cu';
const XRD_SOURCE_ID = 'cu';
const TWO_THETA_MIN = 35;
const TWO_THETA_MAX = 140;
/** Instrumental broadening, degrees FWHM — the only value here that is a drawing choice. */
const PEAK_FWHM = 0.9;

function renderXrdFigure(mod: XrdModule): string {
  const sample = mod.XRD_SAMPLES.find((s) => s.id === XRD_SAMPLE_ID)!;
  const source = mod.XRD_SOURCES.find((s) => s.id === XRD_SOURCE_ID)!;
  const peaks = mod.computePattern(sample.lattice, sample.a, source.lambda, TWO_THETA_MAX);

  const box: Box = { left: 58, right: 624, top: 28, bottom: 370 };
  const sx = linearScale(TWO_THETA_MIN, TWO_THETA_MAX, box.left, box.right);
  const sy = linearScale(0, 105, box.bottom, box.top);

  const body: string[] = [
    ...plotFrame(
      box,
      { scale: sx, ticks: linearTicks(40, 140, 20), title: 'Diffraction angle, 2θ (degrees)' },
      { scale: sy, ticks: linearTicks(0, 100, 20), title: 'Relative intensity (%)' },
    ),
  ];

  // Gaussian profile: intensity is linear, so the pattern is drawn as a real
  // diffractogram rather than as sticks. The sample grid is coarse across the
  // flat background and fine across each peak, which keeps the path short
  // without under-sampling a 0.6° line.
  const sigma = PEAK_FWHM / (2 * Math.sqrt(2 * Math.LN2));
  const grid = new Set<number>();
  for (let t = TWO_THETA_MIN; t <= TWO_THETA_MAX + 1e-9; t += 0.5) grid.add(Number(t.toFixed(2)));
  for (const p of peaks) {
    for (let d = -2; d <= 2 + 1e-9; d += 0.1) {
      const t = p.twoTheta + d;
      if (t >= TWO_THETA_MIN && t <= TWO_THETA_MAX) grid.add(Number(t.toFixed(2)));
    }
  }
  const xs = [...grid].sort((a, b) => a - b);
  const profile: [number, number][] = xs.map((t) => [
    t,
    peaks.reduce((sum, p) => sum + p.intensity * Math.exp(-((t - p.twoTheta) ** 2) / (2 * sigma * sigma)), 0),
  ]);

  body.push(
    comment(`computePattern('${sample.lattice}', a = ${sample.a.toFixed(4)} nm, λ = ${source.lambda} nm)`),
    node('path', {
      d: polylinePath(profile, sx, sy),
      fill: 'none',
      stroke: INK,
      strokeWidth: 1.5,
      strokeLinejoin: 'round',
    }),
  );

  const space = new LabelSpace();
  const caption = `${sample.name}, a = ${sample.a.toFixed(4)} nm — ${source.label}`;
  body.push(
    textNode(caption, {
      x: f(box.right - 4, 1),
      y: f(box.top + 14, 1),
      textAnchor: 'end',
      fontSize: 11,
      fill: LABEL,
    }),
  );
  space.reserve(labelBox(caption, box.right - 4, box.top + 14, 11, 'end'));

  // Index the peaks, strongest first, so that where two labels collide it is
  // the weaker line that loses its label.
  body.push(comment('(hkl) indices, strongest peaks first'));
  for (const p of [...peaks].sort((a, b) => b.intensity - a.intensity)) {
    if (p.intensity < 1) continue;
    const text = `(${p.h}${p.k}${p.l})`;
    const px = sx(p.twoTheta);
    const py = sy(p.intensity) - 9;
    if (!space.tryPlace(labelBox(text, px, py, 11, 'middle'))) continue;
    body.push(
      textNode(text, {
        x: f(px, 1),
        y: f(py, 1),
        textAnchor: 'middle',
        fontSize: 11,
        fill: ACCENT,
      }),
    );
  }

  return figureFile(
    'XrdFigure',
    [
      `The powder pattern of ${sample.name.toLowerCase()} under ${source.label}, from`,
      '`computePattern` in `src/xrd/diffraction.ts` — Bragg positions and the module’s',
      'own multiplicity, structure-factor and Lorentz–polarisation intensities. Peaks are',
      `drawn as ${PEAK_FWHM}° FWHM Gaussians; only the broadening is a drawing choice.`,
    ],
    body,
  );
}

/* ============================================================== driver === */

export interface GeneratedFigure {
  /** Path relative to the repository root. */
  path: string;
  source: string;
}

/**
 * Builds all four figures. Exported so `figures.test.ts` can re-run exactly
 * this and compare it with what is committed — the test must never re-implement
 * the rendering, or it would only be testing its own copy.
 *
 * The app modules are imported dynamically rather than statically because the
 * plain-Node entry point needs its resolver hook registered first; see `main`.
 */
export async function buildFigures(): Promise<GeneratedFigure[]> {
  const phase = (await import('../src/phase/systems.ts')) as unknown as PhaseModule;
  const mech = await import('../src/mechanical/materials.ts');
  const failureData = await import('../src/failure/materials.ts');
  const failureModel = await import('../src/failure/model.ts');
  const selection = (await import('../src/selection/materials.ts')) as unknown as SelectionModule;
  const xrd = (await import('../src/xrd/diffraction.ts')) as unknown as XrdModule;

  const fatigue: FatigueModule = {
    MECH_MATERIALS: mech.MECH_MATERIALS,
    getFatigueBehaviour: failureData.getFatigueBehaviour,
    fitSn: failureModel.fitSn,
    fatigueStrength: failureModel.fatigueStrength,
  };

  return [
    { path: 'src/assets/figures/PhaseFigure.tsx', source: renderPhaseFigure(phase) },
    { path: 'src/assets/figures/FatigueFigure.tsx', source: renderFatigueFigure(fatigue) },
    { path: 'src/assets/figures/AshbyFigure.tsx', source: renderAshbyFigure(selection) },
    { path: 'src/assets/figures/XrdFigure.tsx', source: renderXrdFigure(xrd) },
  ];
}

/**
 * Writes the figures. Only the plain-Node entry point calls this; the test
 * imports `buildFigures` and never touches the filesystem.
 *
 * Node's type stripping resolves ESM specifiers literally, and the app's own
 * imports are extensionless (`../crystal/miller`), so a resolver hook supplies
 * the `.ts` extension when the default resolution fails. Vite and Vitest do
 * that themselves, which is why the hook is registered here rather than at
 * module scope.
 */
export async function main(): Promise<void> {
  const { registerHooks } = process.getBuiltinModule('node:module') as NodeModuleApi;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      try {
        return nextResolve(specifier, context);
      } catch (err) {
        if (specifier.startsWith('.')) return nextResolve(`${specifier}.ts`, context);
        throw err;
      }
    },
  });

  const { writeFileSync } = process.getBuiltinModule('node:fs') as NodeFsApi;
  const encoder = new TextEncoder();
  for (const figure of await buildFigures()) {
    writeFileSync(new URL(`../${figure.path}`, import.meta.url), figure.source);
    console.log(`${figure.path}  ${encoder.encode(figure.source).length} bytes`);
  }
}

// `import.meta.main`-style guard: write files only when run as the entry point.
// Vitest imports this module for `buildFigures`, and must not have it write.
if (typeof process !== 'undefined' && process.argv[1]) {
  const { pathToFileURL } = process.getBuiltinModule('node:url') as NodeUrlApi;
  if (pathToFileURL(process.argv[1]).href === import.meta.url) await main();
}
