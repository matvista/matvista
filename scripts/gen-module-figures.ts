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

/**
 * The one static import of app code in this file, and it is deliberate.
 *
 * Everything else is imported dynamically inside `buildFigures`, because the
 * app's own imports are extensionless and need the resolver hook `main`
 * registers. `nav.ts` imports nothing, and this specifier carries its
 * extension, so it resolves under plain Node without the hook — which is what
 * lets the plate's *shape* be a module-scope constant derived from the app's
 * navigation rather than a second copy of it.
 */
import { NAV_GROUPS, capitalisedWord, numberWord } from '../src/nav.ts';
import {
  PLATE_CELL_H, PLATE_CELL_W, PLATE_HEADER, PLATE_MARGIN, plateHeight, plateWidth,
} from '../src/landing/indexPlateBox.ts';

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

function figureFile(
  component: string,
  docLines: string[],
  body: string[],
  /** The figure index is drawn on a wider box than the four single plates. */
  view: [number, number] = [VIEW_W, VIEW_H],
): string {
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
    `    <svg viewBox="0 0 ${view[0]} ${view[1]}" aria-hidden="true" ` +
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
  familyLabel(h: number, k: number, l: number): string;
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
    const text = `(${mod.familyLabel(p.h, p.k, p.l)})`;
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

/* ===================================================== 5. figure index === */

/**
 * The figure index: twelve panels, one per module, each drawn from that
 * module's own model code.
 *
 * This is the plate the landing page opens its modules chapter with, and it is
 * the answer to a question the page could not previously answer with a picture:
 * *what does this thing actually draw?* The twelve signature marks it replaces
 * were hand-drawn abstractions — a squiggle that suggested a stress–strain
 * curve rather than one. Every panel below is the real output: the periodic
 * table is 118 elements coloured by their tabulated melting points, the TTT
 * nose is `tttCurve` for 1080, the Ashby cloud is all 54 materials, the
 * diffraction sticks are `computePattern` on α-iron.
 *
 * Laid out as one column per course group, in `NAV_GROUPS` order, with the
 * group's name over it. The plate is the navigation diagram as well as the
 * gallery, so its shape is *derived* from `NAV_GROUPS` rather than written
 * down beside it: the columns are the groups, a panel's row is its place in
 * its group, and the box is as deep as the deepest column.
 *
 * It was four columns of three, hard-coded, until the roadmap reopened. The
 * five planned modules land 4/4/6/3, so the columns stop being equal and a
 * grid drawn as `r < 3` stops being right. Nothing below assumes they are
 * equal; at 4×3 it still emits exactly what the hand-written version did,
 * which is what `figures.test.ts`'s byte-for-byte comparison checks.
 *
 * Held to a byte budget asserted in `figures.test.ts`. It is the largest single
 * asset the landing page can reach, and it is lazily imported for that reason —
 * a plate below the fold has no business in the first paint — but a lazy chunk
 * that grows without anything noticing is still a regression. The budget is
 * for twelve panels and cannot be re-argued for seventeen against a plate that
 * does not exist yet; it moves when the first new panel does, with a measured
 * number rather than an estimated one.
 *
 * Panels carry no tick labels. At 300 units wide inside a 1224-unit box an
 * axis label would render at about four effective pixels, which is the mistake
 * `landing.css` records making with the three-across showcase gallery. What
 * each panel gets instead is a title and one line saying what is plotted; the
 * numbers live in the module the panel links to.
 */

const IDX_MARGIN = PLATE_MARGIN;
const IDX_HEADER = PLATE_HEADER;
const CELL_W = PLATE_CELL_W;
const CELL_H = PLATE_CELL_H;

/** Column headings, one per course group, left to right. */
const IDX_GROUPS = NAV_GROUPS.map((g) => g.label);

/** Panels in each column. Not necessarily equal — see the note above. */
export const IDX_ROWS = NAV_GROUPS.map((g) => g.items.length);

export const IDX_W = plateWidth(IDX_GROUPS.length);
export const IDX_H = plateHeight(IDX_ROWS);

/**
 * Where a module's panel sits: its group is the column, its place within that
 * group is the row. Deriving both from `NAV_GROUPS` is the point — the cell
 * used to be written twice, once in `IDX_PANELS` and once in the `panelBox`
 * call inside each panel renderer, and nothing checked that the two agreed.
 * The column is checked by reading the rendered x back in `figures.test.ts`;
 * the row never was.
 */
function idxCell(id: string): { col: number; row: number } {
  for (let col = 0; col < NAV_GROUPS.length; col++) {
    const row = NAV_GROUPS[col].items.findIndex((item) => item.id === id);
    if (row !== -1) return { col, row };
  }
  throw new Error(`no nav entry for panel '${id}': every panel is a module`);
}

/** Plot area inset inside a cell, under the title and its caption. */
function panelBox(id: string): Box {
  const { col, row } = idxCell(id);
  const x0 = IDX_MARGIN + col * CELL_W;
  const y0 = IDX_HEADER + row * CELL_H;
  return { left: x0 + 18, right: x0 + 284, top: y0 + 46, bottom: y0 + 202 };
}

/** Integer-precision polyline. Panels are 266 units wide; a decimal is noise. */
function idxPath(points: [number, number][], sx: Scale, sy: Scale): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${f(sx(x), 0)},${f(sy(y), 0)}`).join('');
}

/** Every nth point of a sampled curve, always keeping the last. */
function thin<T>(xs: T[], keep: number): T[] {
  if (xs.length <= keep) return xs;
  const step = (xs.length - 1) / (keep - 1);
  const out: T[] = [];
  for (let i = 0; i < keep; i++) out.push(xs[Math.round(i * step)]);
  return out;
}

function idxCurve(d: string, colour: string, width = 1.6, opacity?: number): string {
  return node('path', {
    d,
    fill: 'none',
    stroke: colour,
    strokeWidth: width,
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
    opacity,
  });
}

/** A cell's heading: the module's name, and one line saying what is plotted. */
function panelHead(id: string, title: string, caption: string): string[] {
  const { col, row } = idxCell(id);
  const x = IDX_MARGIN + col * CELL_W + 18;
  const y = IDX_HEADER + row * CELL_H;
  return [
    textNode(title, { x, y: y + 21, fontSize: 13, fontWeight: 600, fill: INK }),
    textNode(caption, { x, y: y + 36, fontSize: 10.5, fill: LABEL }),
  ];
}

/* ------------------------------------------------- panel 1: the table --- */

interface ElementRow {
  xpos: number;
  ypos: number;
  melt: number | null;
}

/**
 * 118 elements in the real table layout, shaded by melting point.
 *
 * Six opacity bands rather than a continuous ramp, and one `<path>` per band
 * rather than 118 `<rect>` elements: as separate rects this panel alone was
 * 9.6 kB, which is more than the other eleven together. The banding is a
 * rendering decision, not a claim — the module itself interpolates a continuous
 * scale, and this panel's caption says "shaded by", not "the module's scale".
 *
 * Elements with no tabulated melting point are drawn in the grid colour, the
 * same way `PeriodicTrends` draws a missing value as missing rather than as
 * zero.
 */
function renderTablePanel(elements: ElementRow[]): string[] {
  const box = panelBox('trends');
  const cw = (box.right - box.left) / 18;
  const ch = (box.bottom - box.top) / 10;
  const w = Math.max(1, Math.round(cw) - 1);
  const h = Math.max(1, Math.round(ch) - 1);

  const melts = elements.map((e) => e.melt).filter((m): m is number => m != null);
  const lo = Math.min(...melts);
  const hi = Math.max(...melts);
  const BANDS = 6;

  const bands: string[][] = Array.from({ length: BANDS }, () => []);
  const missing: string[] = [];

  for (const e of elements) {
    const x = Math.round(box.left + (e.xpos - 1) * cw);
    const y = Math.round(box.top + (e.ypos - 1) * ch);
    const rect = `M${x},${y}h${w}v${h}h-${w}z`;
    if (e.melt == null) {
      missing.push(rect);
      continue;
    }
    // Square-rooted, because melting points cluster hard at the low end and a
    // linear ramp left four fifths of the table in the palest band.
    const t = Math.sqrt((e.melt - lo) / (hi - lo));
    bands[Math.min(BANDS - 1, Math.floor(t * BANDS))].push(rect);
  }

  const out: string[] = [comment('118 elements at their real table positions, by melting point where measured')];
  if (missing.length) {
    out.push(node('path', { d: missing.join(''), fill: GRID }));
  }
  bands.forEach((rects, i) => {
    if (!rects.length) return;
    out.push(
      node('path', {
        d: rects.join(''),
        fill: SERIES_A,
        opacity: f(0.22 + (i / (BANDS - 1)) * 0.78, 2),
      }),
    );
  });
  return out;
}

/* ------------------------------------- panels 2 and 3: the cubic cell --- */

/**
 * One orthographic projection, shared by the crystal and Miller panels so the
 * two cells are seen from the same angle — they are the same cube, and drawing
 * them from different viewpoints would say otherwise.
 */
const IDX_YAW = (34 * Math.PI) / 180;
const IDX_PITCH = (24 * Math.PI) / 180;

function idxProject(p: [number, number, number]): { u: number; v: number; depth: number } {
  const [x, y, z] = p;
  const cy = Math.cos(IDX_YAW);
  const sy = Math.sin(IDX_YAW);
  const rx = x * cy + z * sy;
  const rz = -x * sy + z * cy;
  const cp = Math.cos(IDX_PITCH);
  const sp = Math.sin(IDX_PITCH);
  return { u: rx, v: -(y * cp - rz * sp), depth: y * sp + rz * cp };
}

/** Projected cell corners and the twelve edges between them, in panel units. */
function cellFrame(box: Box, scale: number): { at: (p: [number, number, number]) => [number, number]; edges: string } {
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const at = (p: [number, number, number]): [number, number] => {
    const q = idxProject(p);
    return [cx + q.u * scale, cy + q.v * scale];
  };
  const c: [number, number, number][] = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
  ];
  const pairs: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const edges = pairs
    .map(([a, b]) => {
      const p = at(c[a]);
      const q = at(c[b]);
      return `M${f(p[0], 0)},${f(p[1], 0)}L${f(q[0], 0)},${f(q[1], 0)}`;
    })
    .join('');
  return { at, edges };
}

interface CrystalModule {
  STRUCTURES: { id: string; basis: { pos: [number, number, number]; species: string }[] }[];
  buildAtoms(s: unknown): { pos: [number, number, number]; species: string; image: boolean }[];
}

/** The FCC cell the crystal module opens on, drawn from `buildAtoms`. */
function renderCrystalPanel(mod: CrystalModule): string[] {
  const box = panelBox('crystals');
  const structure = mod.STRUCTURES.find((s) => s.id === 'fcc')!;
  const { at, edges } = cellFrame(box, 118);

  const atoms = mod
    .buildAtoms(structure)
    .map((a) => ({ ...a, ...idxProject(a.pos) }))
    // Painter's algorithm: far atoms first, so near ones overlap them.
    .sort((p, q) => p.depth - q.depth);

  const out: string[] = [comment('the FCC cell, from buildAtoms() — corner and face-centre sites')];
  out.push(node('path', { d: edges, fill: 'none', stroke: GRID, strokeWidth: 1.2 }));
  for (const a of atoms) {
    const [x, y] = at(a.pos);
    /*
     * One colour, two sizes.
     *
     * Corner sites are the eight at ±0.5 in every axis and the rest are the six
     * face centres, and drawing them identically would hide what makes the cell
     * FCC — but the earlier draft separated them by *colour*, on a plate whose
     * caption says every panel is the app's own output. FCC copper is
     * monatomic and the crystal module draws it that way. Radius carries the
     * distinction now, and the depth shading does the rest.
     */
    const corner = a.pos.every((v) => Math.abs(Math.abs(v) - 0.5) < 1e-9);
    out.push(
      node('circle', {
        cx: f(x, 0),
        cy: f(y, 0),
        r: corner ? 12 : 7.5,
        fill: SERIES_A,
        opacity: f(0.55 + 0.4 * ((a.depth + 0.9) / 1.8), 2),
      }),
    );
  }
  return out;
}

interface MillerModule {
  planePolygon(hkl: [number, number, number]): { vertices: [number, number, number][] } | null;
}

/** The (111) plane cutting the same cube, from `planePolygon`. */
function renderMillerPanel(mod: MillerModule): string[] {
  const box = panelBox('miller');
  const { at, edges } = cellFrame(box, 118);
  const poly = mod.planePolygon([1, 1, 1]);
  if (!poly) throw new Error('(111) does not cut the cell — planePolygon changed');

  const d =
    poly.vertices
      .map((v, i) => {
        const [x, y] = at(v);
        return `${i === 0 ? 'M' : 'L'}${f(x, 0)},${f(y, 0)}`;
      })
      .join('') + 'Z';

  return [
    comment('(111) cutting the cell, from planePolygon([1,1,1])'),
    node('path', { d: edges, fill: 'none', stroke: GRID, strokeWidth: 1.2 }),
    node('path', { d, fill: ACCENT, opacity: 0.16 }),
    node('path', { d, fill: 'none', stroke: ACCENT, strokeWidth: 1.8, strokeLinejoin: 'round' }),
  ];
}

/* ---------------------------------------------- panel 4: diffusion --- */

interface DiffusionModule {
  DIFFUSION_SYSTEMS: { id: string; D0: number; Qd: number }[];
  diffusionCoefficient(sys: unknown, T_K: number): number;
  concentrationAt(x: number, t: number, D: number, C0: number, Cs: number): number;
}

/** Carburising at 927 °C: the same Fick's-second-law profile at 1, 4 and 9 hours. */
const CARBURISE = { T_K: 1200, C0: 0.2, Cs: 1.0, depth_m: 2.2e-3 };
const CARBURISE_HOURS = [1, 4, 9];

function renderDiffusionPanel(mod: DiffusionModule): string[] {
  const box = panelBox('defects');
  const sys = mod.DIFFUSION_SYSTEMS.find((s) => s.id === 'c-fe-fcc')!;
  const D = mod.diffusionCoefficient(sys, CARBURISE.T_K);
  const sx = linearScale(0, CARBURISE.depth_m, box.left, box.right);
  const sy = linearScale(CARBURISE.C0, CARBURISE.Cs, box.bottom, box.top);

  const out: string[] = [comment('Fick’s second law at 927 °C, from concentrationAt() — 1, 4 and 9 hours')];
  const colours = [SERIES_C, SERIES_A, SERIES_B];
  CARBURISE_HOURS.forEach((hours, i) => {
    const pts: [number, number][] = [];
    for (let j = 0; j <= 34; j++) {
      const x = (CARBURISE.depth_m * j) / 34;
      pts.push([x, mod.concentrationAt(x, hours * 3600, D, CARBURISE.C0, CARBURISE.Cs)]);
    }
    out.push(idxCurve(idxPath(pts, sx, sy), colours[i]));
  });
  // The surface concentration the profiles all start from.
  out.push(
    node('line', {
      x1: f(box.left, 0),
      y1: f(box.top, 0),
      x2: f(box.right, 0),
      y2: f(box.top, 0),
      stroke: GRID,
      strokeWidth: 1,
    }),
  );
  return out;
}

/* -------------------------------------------------- panel 5: Pb–Sn --- */

interface PbSnModule {
  PB_SN: {
    boundaries: { points: [number, number][]; kind: string }[];
    xMax: number;
    tMin: number;
    tMax: number;
  };
}

/**
 * Pb–Sn rather than Fe–Fe₃C, because Fig. 2 lower down the page is already the
 * iron–carbon diagram at full size, and a plate that repeats the figure beside
 * it is a plate that says nothing new.
 */
function renderPbSnPanel(mod: PbSnModule): string[] {
  const box = panelBox('phase');
  const sys = mod.PB_SN;
  const sx = linearScale(0, sys.xMax, box.left, box.right);
  const sy = linearScale(sys.tMin, sys.tMax, box.bottom, box.top);

  const out: string[] = [comment('the Pb–Sn eutectic, straight from PB_SN.boundaries')];
  for (const b of sys.boundaries) {
    const pts = thin(b.points, b.kind === 'isotherm' ? 2 : 18);
    // `SERIES_A`, not `INK`. Fig. 2 draws its boundaries in ink and is right to
    // — it is a plate on its own. Here the panel sits in a set of twelve drawn
    // in the series palette, and in ink it was the one black figure in light
    // and the one white one in dark.
    out.push(idxCurve(idxPath(pts, sx, sy), b.kind === 'isotherm' ? ACCENT : SERIES_A, 1.4));
  }
  return out;
}

/* --------------------------------------------- panel 6: heat treatment --- */

interface HeatModule {
  STEELS: { id: string }[];
  buildTtt(steel: unknown): {
    start: { t: number; T: number }[];
    finish: { t: number; T: number }[];
    ms: number;
    a1: number;
  };
}

function renderTttPanel(mod: HeatModule): string[] {
  const box = panelBox('heattreat');
  const steel = mod.STEELS.find((s) => s.id === '1080')!;
  const ttt = mod.buildTtt(steel);
  const sx = logScale(0.1, 1e5, box.left, box.right);
  const sy = linearScale(100, ttt.a1 + 40, box.bottom, box.top);

  const clip = (pts: { t: number; T: number }[]): [number, number][] =>
    thin(
      pts.filter((p) => p.t >= 0.1 && p.t <= 1e5),
      22,
    ).map((p) => [p.t, p.T] as [number, number]);

  return [
    comment('1080 steel’s TTT nose, from buildTtt() — start, finish and Mₛ'),
    node('line', {
      x1: f(box.left, 0),
      y1: f(sy(ttt.a1), 0),
      x2: f(box.right, 0),
      y2: f(sy(ttt.a1), 0),
      stroke: GRID,
      strokeWidth: 1,
    }),
    idxCurve(idxPath(clip(ttt.start), sx, sy), SERIES_A),
    idxCurve(idxPath(clip(ttt.finish), sx, sy), SERIES_A, 1.4, 0.55),
    node('line', {
      x1: f(box.left, 0),
      y1: f(sy(ttt.ms), 0),
      x2: f(box.right, 0),
      y2: f(sy(ttt.ms), 0),
      stroke: ACCENT,
      strokeWidth: 1.4,
      strokeDasharray: '5 4',
    }),
  ];
}

/* ------------------------------------------------ panel 7: mechanical --- */

interface MechModule {
  MECH_MATERIALS: { id: string; name: string }[];
  buildCurve(m: unknown, samples?: number): {
    points: { strain: number; stress: number }[];
    utsStrain: number;
    fractureStrain: number;
  };
}

/** Three of the seven, chosen to span the range of ductility on one axis pair. */
const MECH_SERIES = [
  { id: 'steel1020', colour: SERIES_A },
  { id: 'al', colour: SERIES_B },
  { id: 'cu', colour: SERIES_C },
];

function renderStressPanel(mod: MechModule): string[] {
  const curves = MECH_SERIES.map((s) => {
    const material = mod.MECH_MATERIALS.find((m) => m.id === s.id);
    if (!material) throw new Error(`MECH_MATERIALS has no ${s.id}`);
    return { colour: s.colour, curve: mod.buildCurve(material, 120) };
  });

  const box = panelBox('mechanical');
  const maxStrain = Math.max(...curves.map((c) => c.curve.fractureStrain));
  const maxStress = Math.max(...curves.flatMap((c) => c.curve.points.map((p) => p.stress)));
  const sx = linearScale(0, maxStrain, box.left, box.right);
  const sy = linearScale(0, maxStress * 1.05, box.bottom, box.top);

  const out: string[] = [comment('engineering curves from buildCurve(), through yield, UTS and fracture')];
  for (const c of curves) {
    const pts = thin(c.curve.points, 40).map((p) => [p.strain, p.stress] as [number, number]);
    out.push(idxCurve(idxPath(pts, sx, sy), c.colour));
  }
  return out;
}

/* --------------------------------------------------- panel 8: failure --- */

interface FailureModule {
  FRACTURE_ALLOYS: { id: string; name: string; kic: number; yieldStrength: number }[];
  criticalCrackSize(kic: number, sigma: number, Y: number): number;
}

/** Three of the five, spanning the toughness range from 2024 aluminium up. */
const FRACTURE_SERIES = ['7075', 'ti-6al-4v', '4340-425'];

/**
 * Critical crack size against applied stress, log-y — the curve the failure
 * module exists to put a number on. Each alloy's line is cut off at its own
 * yield strength, because past that the linear-elastic assumption behind
 * `criticalCrackSize` is no longer the one being made.
 */
function renderFracturePanel(mod: FailureModule): string[] {
  const box = panelBox('failure');
  const sx = linearScale(100, 1400, box.left, box.right);
  const sy = logScale(0.1, 400, box.bottom, box.top);
  const colours = [SERIES_B, SERIES_C, SERIES_A];

  const out: string[] = [comment('critical crack size against stress, from criticalCrackSize(), log axis')];
  FRACTURE_SERIES.forEach((id, i) => {
    const alloy = mod.FRACTURE_ALLOYS.find((a) => a.id === id);
    if (!alloy) throw new Error(`FRACTURE_ALLOYS has no ${id}`);
    const top = Math.min(1400, alloy.yieldStrength);
    const pts: [number, number][] = [];
    for (let j = 0; j <= 20; j++) {
      const sigma = 100 + ((top - 100) * j) / 20;
      const a = mod.criticalCrackSize(alloy.kic, sigma, 1) * 1000; // m → mm
      if (a >= 0.1 && a <= 400) pts.push([sigma, a]);
    }
    if (pts.length > 1) out.push(idxCurve(idxPath(pts, sx, sy), colours[i]));
  });
  return out;
}

/* --------------------------------------------------- panel 3b: polymers --- */

interface PolymerModule {
  stepGrowth: (p: number) => { dp: number; x: number }[];
  histogram: (
    dist: { dp: number; x: number }[],
    bars: number,
    upTo?: number,
  ) => { dp: number; x: number; w: number }[];
  displayRange: (dist: { dp: number; x: number }[], frac?: number) => number;
}

/**
 * One sample counted two ways, which is the module's argument in one shape:
 * the number histogram decays from the shortest chain, the weight histogram
 * peaks at the number-average, and they are the same polymer.
 *
 * Flory's most-probable distribution at p = 0.95 because it is the one with a
 * closed form the tests pin — the plate cannot drift from the model without
 * `figures.test.ts` noticing, and the model cannot drift from `Đ = 1 + p`.
 */
function renderPolymerPanel(mod: PolymerModule): string[] {
  const box = panelBox('polymers');
  const dist = mod.stepGrowth(0.95);
  // Drawn to where the weight runs out rather than to where the summation
  // does — the same call the module's own panel makes, for the same reason:
  // the full range is four times as wide and adds nothing but blank.
  const bars = mod.histogram(dist, 28, mod.displayRange(dist));
  const maxDp = bars[bars.length - 1].dp;
  const peak = Math.max(...bars.flatMap((b) => [b.x, b.w]));
  const sx = linearScale(0, maxDp, box.left, box.right);
  const sy = linearScale(0, peak, box.bottom, box.top);
  const w = Math.max(1, Math.round(((box.right - box.left) / bars.length) * 0.42));
  const base = Math.round(sy(0));

  // One path per series, not one per bar. Fifty-six `<path>` elements with
  // their own `fill` cost 4.1 kB here — twice the budget for a panel — where
  // two paths of subpaths cost a tenth of that. It is the same rewrite the
  // periodic-table panel took to get from 118 elements down to six paths, and
  // the per-panel budget in `figures.test.ts` is what caught it.
  const series = (value: (b: { x: number; w: number }) => number, offset: number): string =>
    bars
      .map((b) => {
        const h = base - Math.round(sy(value(b)));
        if (h <= 0) return '';
        return `M${Math.round(sx(b.dp)) + offset},${base}v${-h}h${w}v${h}z`;
      })
      .join('');

  return [
    comment('one sample counted by number and by weight, from polymer/model.ts at p = 0.95'),
    node('path', { d: series((b) => b.x, -w), fill: SERIES_B }),
    node('path', { d: series((b) => b.w, 0), fill: SERIES_A }),
  ];
}

/* ------------------------------------------------ panel 8b: composites --- */

interface CompositeConstituent {
  id: string;
  name: string;
  modulus: number;
  density: number;
  strength: number;
}

interface CompositeModule {
  FIBRES: CompositeConstituent[];
  MATRICES: CompositeConstituent[];
  longitudinalModulus: (f: CompositeConstituent, m: CompositeConstituent, vf: number) => number;
  transverseModulus: (f: CompositeConstituent, m: CompositeConstituent, vf: number) => number;
}

/**
 * The two bounds, which is the module's whole argument in one shape: the same
 * two materials, the same volume fraction, and an order of magnitude between
 * them depending only on which way the load goes.
 *
 * Carbon in epoxy because it has the widest spread of the three fibres, so the
 * gap survives being drawn 266 units wide.
 */
function renderCompositePanel(mod: CompositeModule): string[] {
  const box = panelBox('composites');
  const f = mod.FIBRES.find((x) => x.id === 'carbon');
  const m = mod.MATRICES.find((x) => x.id === 'epoxy');
  if (!f || !m) throw new Error('composite panel wants carbon and epoxy');

  const sx = linearScale(0, 1, box.left, box.right);
  const sy = linearScale(0, f.modulus, box.bottom, box.top);

  const sample = (fn: (vf: number) => number): [number, number][] =>
    Array.from({ length: 41 }, (_, i) => [i / 40, fn(i / 40)] as [number, number]);

  return [
    comment('the isostrain and isostress bounds from composite/model.ts, carbon in epoxy'),
    idxCurve(idxPath(sample((vf) => mod.longitudinalModulus(f, m, vf)), sx, sy), SERIES_A),
    idxCurve(idxPath(sample((vf) => mod.transverseModulus(f, m, vf)), sx, sy), SERIES_B),
  ];
}

/* -------------------------------------------- panel 9: semiconductors --- */

interface SemiModule {
  SEMICONDUCTORS: { id: string; Eg: number; gapKind: 'direct' | 'indirect' }[];
}

/** The visible band in electronvolts: 1239.8/700 to 1239.8/400. */
const VISIBLE_EV: [number, number] = [1.771, 3.0995];

/**
 * The axis stops just past the widest gap in the set rather than at a round
 * 3.6 eV. At 3.6 the largest bar reached two thirds of the panel and the
 * visible band sat almost entirely to the right of every one of them — the
 * comparison the panel exists to make, drawn in the empty quarter.
 */
const BANDGAP_MAX_EV = 2.6;

function renderBandGapPanel(mod: SemiModule): string[] {
  const box = panelBox('semiconductors');
  const gaps = [...mod.SEMICONDUCTORS].sort((a, b) => a.Eg - b.Eg);
  const widest = Math.max(...gaps.map((g) => g.Eg));
  if (widest > BANDGAP_MAX_EV) throw new Error(`a band gap of ${widest} eV runs off the panel`);
  const sx = linearScale(0, BANDGAP_MAX_EV, box.left, box.right);
  const rowH = (box.bottom - box.top) / gaps.length;
  const barH = Math.max(4, rowH - 6);

  const out: string[] = [
    comment('band gaps from SEMICONDUCTORS, against the visible range 1.77–3.10 eV'),
    /*
     * One rule, at the red end of the visible spectrum, rather than a filled
     * band. The fill was a block behind the bars, and bars crossing into it
     * changed colour — at thumbnail size that read as a fourth material. The
     * band's other edge is at 3.10 eV, off this axis, so drawing it clamped to
     * the panel would have claimed the visible range ends at 2.6; the caption
     * says what the one rule is instead.
     */
    node('path', {
      d: `M${f(sx(VISIBLE_EV[0]), 0)},${f(box.top, 0)}V${f(box.bottom, 0)}`,
      fill: 'none',
      stroke: ACCENT,
      strokeWidth: 1.2,
      strokeDasharray: '4 3',
    }),
  ];
  gaps.forEach((s, i) => {
    out.push(
      node('rect', {
        x: f(box.left, 0),
        y: f(box.top + i * rowH + 3, 0),
        width: f(Math.max(1, sx(s.Eg) - box.left), 0),
        height: f(barH, 0),
        // Direct and indirect are the distinction the module is built around,
        // and the same two colours it uses on screen.
        fill: s.gapKind === 'direct' ? SERIES_A : SERIES_D,
        opacity: s.gapKind === 'direct' ? 0.95 : 0.6,
      }),
    );
  });
  return out;
}

/* ------------------------------------------------------- panel 10: XRD --- */

interface XrdPanelModule {
  XRD_SAMPLES: { id: string; lattice: string; a: number }[];
  XRD_SOURCES: { id: string; lambda: number }[];
  computePattern(
    lattice: string,
    a: number,
    lambda: number,
    maxTwoTheta?: number,
  ): { twoTheta: number; intensity: number }[];
}

/**
 * α-iron rather than copper. Fig. 5 further down the page is the copper
 * pattern at full size; showing BCC here means the two plates together carry
 * the comparison the module is for — BCC opens on 110, FCC on 111.
 */
function renderXrdPanel(mod: XrdPanelModule): string[] {
  const box = panelBox('xrd');
  const sample = mod.XRD_SAMPLES.find((s) => s.id === 'fe')!;
  const source = mod.XRD_SOURCES.find((s) => s.id === 'cu')!;
  const peaks = mod.computePattern(sample.lattice, sample.a, source.lambda, 140);
  const sx = linearScale(20, 140, box.left, box.right);
  const sy = linearScale(0, 100, box.bottom, box.top);

  const sticks = peaks
    .map((p) => {
      const x = f(sx(p.twoTheta), 0);
      return `M${x},${f(box.bottom, 0)}L${x},${f(sy(p.intensity), 0)}`;
    })
    .join('');

  return [
    comment('α-iron on Cu Kα, from computePattern() — every allowed BCC line'),
    node('line', {
      x1: f(box.left, 0),
      y1: f(box.bottom, 0),
      x2: f(box.right, 0),
      y2: f(box.bottom, 0),
      stroke: GRID,
      strokeWidth: 1,
    }),
    node('path', { d: sticks, fill: 'none', stroke: SERIES_A, strokeWidth: 2 }),
  ];
}

/* ------------------------------------------------- panel 11: selection --- */

interface SelectionPanelModule {
  SELECTION_MATERIALS: { cls: string; density: number; modulus: number }[];
}

const IDX_CLASS_COLOUR: Record<string, string> = {
  metal: 'a',
  ceramic: 'b',
  composite: 'c',
  polymer: 'd',
  elastomer: 'accent',
};

const IDX_TOKEN: Record<string, string> = {
  a: SERIES_A,
  b: SERIES_B,
  c: SERIES_C,
  d: SERIES_D,
  accent: ACCENT,
};

/**
 * All 54 materials on log–log stiffness against density, one path per class.
 *
 * Markers are 3-unit squares written as path subpaths rather than `<circle>`
 * elements: fifty-four circles cost about 2.4 kB and five paths cost 900 bytes,
 * and at this size the difference between a square and a disc is a rounding
 * error in the rasteriser.
 */
function renderSelectionPanel(mod: SelectionPanelModule): string[] {
  const box = panelBox('selection');
  const sx = logScale(0.3, 30, box.left, box.right);
  const sy = logScale(1e-3, 1e3, box.bottom, box.top);

  const byClass = new Map<string, string[]>();
  for (const m of mod.SELECTION_MATERIALS) {
    const key = IDX_CLASS_COLOUR[m.cls] ?? 'a';
    const x = Math.round(sx(m.density));
    const y = Math.round(sy(m.modulus));
    const marks = byClass.get(key) ?? [];
    marks.push(`M${x - 2},${y - 2}h4v4h-4z`);
    byClass.set(key, marks);
  }

  const out: string[] = [comment('all 54 materials, E against ρ on log axes — SELECTION_MATERIALS')];
  for (const key of ['a', 'b', 'c', 'd', 'accent']) {
    const marks = byClass.get(key);
    if (!marks) continue;
    out.push(node('path', { d: marks.join(''), fill: IDX_TOKEN[key], opacity: 0.85 }));
  }
  return out;
}

/* ------------------------------------------------- panel 12: corrosion --- */

interface CorrosionPanelModule {
  POURBAIX: {
    id: string;
    regions: { kind: string; points: [number, number][] }[];
  }[];
}

/**
 * Aluminium's Pourbaix diagram, from `POURBAIX`.
 *
 * The galvanic series was drawn here first, as twenty-five ruled potentials.
 * It is the module's headline, and at panel scale it came out as a barcode:
 * twenty-five identical horizontal lines, meaningless without the alloy names
 * there is no room for. The Pourbaix map is the module's other half and it
 * survives the reduction, because its meaning is in the *shape* — aluminium is
 * amphoteric, so it corrodes at both ends of the pH scale and passivates only
 * in the middle, and that is legible as three blocks with no labels at all.
 *
 * The blocks are tinted rather than solid so their labels stay on `--fig-label`,
 * which the plates already hold to the 4.5:1 text floor. Measured on the tints
 * actually used — immunity at 30%, the rest at 22% — the labels come out at
 * 5.18 / 5.80 / 5.39:1 in light and 6.19 / 6.99 / 7.25:1 in dark.
 */
const POURBAIX_FILL: Record<string, string> = {
  immunity: SERIES_A,
  passivation: SERIES_C,
  corrosion: ACCENT,
};

/** Field labels short enough to sit inside their own block at this width. */
const POURBAIX_LABEL: Record<string, string> = {
  immunity: 'immune',
  passivation: 'passive',
  corrosion: 'corrodes',
};

const POURBAIX_PH: [number, number] = [0, 14];
/**
 * Wider than aluminium's own data, on purpose. Set to the metal's exact extent
 * the four fields filled the plot box edge to edge, which made this the only
 * panel on the plate with no air in it and by a distance the heaviest thing on
 * a sheet of thin-line figures.
 */
const POURBAIX_E: [number, number] = [-2.9, 1.7];

function renderPourbaixPanel(mod: CorrosionPanelModule): string[] {
  const box = panelBox('corrosion');
  const metal = mod.POURBAIX.find((m) => m.id === 'al');
  if (!metal) throw new Error('POURBAIX has no aluminium');
  const sx = linearScale(POURBAIX_PH[0], POURBAIX_PH[1], box.left, box.right);
  const sy = linearScale(POURBAIX_E[0], POURBAIX_E[1], box.bottom, box.top);

  const out: string[] = [comment('aluminium’s Pourbaix map from POURBAIX — corrodes at both ends of the pH scale')];
  for (const r of metal.regions) {
    const xs = r.points.map((q) => q[0]);
    const ys = r.points.map((q) => q[1]);
    const x = sx(Math.min(...xs));
    const y = sy(Math.max(...ys));
    const w = sx(Math.max(...xs)) - x;
    const h = sy(Math.min(...ys)) - y;
    out.push(
      node('rect', {
        x: f(x, 0),
        y: f(y, 0),
        width: f(w, 0),
        height: f(h, 0),
        fill: POURBAIX_FILL[r.kind] ?? GRID,
        // Lighter than they were. `--fig-accent` is reserved for the one thing
        // a figure points at, and two large blocks of it were the loudest
        // marks on the plate; at this weight the fields read as fields and the
        // rule around them carries the boundary.
        opacity: r.kind === 'immunity' ? 0.22 : 0.16,
      }),
      node('rect', {
        x: f(x, 0),
        y: f(y, 0),
        width: f(w, 0),
        height: f(h, 0),
        fill: 'none',
        stroke: POURBAIX_FILL[r.kind] ?? GRID,
        strokeWidth: 1,
      }),
    );
    // Only where the block is wide enough to hold the word. A label that spills
    // into the neighbouring field would say the opposite of what it means.
    const label = POURBAIX_LABEL[r.kind];
    // 17, not 22: aluminium's immunity field is 0.6 V of a 4.6 V axis, which is
    // 20 units tall, and suppressing its label left a three-field diagram
    // telling a two-field story.
    if (label && w > label.length * 6.2 && h > 17) {
      out.push(
        textNode(label, {
          x: f(x + w / 2, 0),
          y: f(y + h / 2 + 4, 0),
          textAnchor: 'middle',
          fontSize: 10.5,
          fill: LABEL,
        }),
      );
    }
  }
  return out;
}

/* ------------------------------------------------------- the whole plate --- */

interface IndexPlateModules {
  elements: ElementRow[];
  crystal: CrystalModule;
  miller: MillerModule;
  polymer: PolymerModule;
  diffusion: DiffusionModule;
  pbsn: PbSnModule;
  heat: HeatModule;
  mech: MechModule;
  failure: FailureModule;
  composite: CompositeModule;
  semi: SemiModule;
  xrd: XrdPanelModule;
  selection: SelectionPanelModule;
  corrosion: CorrosionPanelModule;
}

/**
 * Panel headings, in the same order the module index below the plate lists
 * them. `figures.test.ts` checks this against `NAV_GROUPS` rather than trusting
 * it: a module added to the app without a panel here would otherwise leave the
 * plate quietly claiming to be all twelve.
 *
 * The title is written out rather than read from `NAV_GROUPS` on purpose. The
 * placement test matches each title against the column its group's heading
 * sits in; deriving the title from the same source as the placement would make
 * that check agree with itself. The cell is derived, the name is not.
 */
const IDX_PANELS: { id: string; title: string; caption: string }[] = [
  { id: 'trends', title: 'Periodic trends', caption: '118 elements, by melting point where measured' },
  { id: 'crystals', title: 'Crystal structures', caption: 'the face-centred cubic cell' },
  { id: 'miller', title: 'Miller indices', caption: '(111) cutting the cell' },
  { id: 'polymers', title: 'Polymers', caption: 'one sample, counted and weighed' },
  { id: 'defects', title: 'Defects & diffusion', caption: 'carburising at 1, 4 and 9 hours' },
  { id: 'phase', title: 'Phase diagrams', caption: 'the Pb–Sn eutectic' },
  { id: 'heattreat', title: 'Heat treatment', caption: '1080 steel, TTT nose and Mₛ' },
  { id: 'mechanical', title: 'Mechanical properties', caption: 'three metals, to fracture' },
  { id: 'composites', title: 'Composites', caption: 'the two bounds, carbon in epoxy' },
  { id: 'failure', title: 'Failure analysis', caption: 'critical crack size vs stress' },
  { id: 'semiconductors', title: 'Semiconductors', caption: 'band gaps; visible light begins at the rule' },
  { id: 'xrd', title: 'XRD simulator', caption: 'α-iron on a copper anode' },
  { id: 'selection', title: 'Material selection', caption: '54 materials, E against ρ' },
  { id: 'corrosion', title: 'Corrosion', caption: 'aluminium: immune, passive, dissolving' },
];

/** Left and right edges of a column, in plate units. */
function columnEdges(col: number): [number, number] {
  return [IDX_MARGIN + col * CELL_W, IDX_MARGIN + (col + 1) * CELL_W];
}

/**
 * The rules the panels sit in: one under the headings, one down each seam
 * between columns, and one across under each row.
 *
 * With equal columns this is the obvious full-width grid. With uneven ones
 * neither the verticals nor the horizontals run the whole way: a seam is only
 * as deep as the deeper of the two columns it separates, and a rule under row
 * *r* exists only over the columns that actually have a row below it — drawn
 * as one segment per contiguous run of them, so two separated columns do not
 * get a rule through the empty cell between them.
 */
export function gridRules(rows: number[] = IDX_ROWS): string[] {
  const right = IDX_MARGIN + rows.length * CELL_W;
  const lines: string[] = [`M${IDX_MARGIN},${IDX_HEADER}H${right}`];

  for (let c = 1; c < rows.length; c++) {
    const depth = IDX_HEADER + Math.max(rows[c - 1], rows[c]) * CELL_H;
    lines.push(`M${IDX_MARGIN + c * CELL_W},${IDX_HEADER}V${depth}`);
  }

  for (let r = 1; r < Math.max(...rows); r++) {
    const y = IDX_HEADER + r * CELL_H;
    let run: number | null = null;
    for (let c = 0; c <= rows.length; c++) {
      const spans = c < rows.length && rows[c] > r;
      if (spans && run === null) run = c;
      if (!spans && run !== null) {
        lines.push(`M${columnEdges(run)[0]},${y}H${columnEdges(c - 1)[1]}`);
        run = null;
      }
    }
  }

  return lines;
}

/** "three modules in each" while the columns are equal; the counts once they are not. */
function columnShape(): string {
  const columns = `${numberWord(IDX_ROWS.length)} columns, one per course group`;
  if (IDX_ROWS.every((n) => n === IDX_ROWS[0])) {
    return `${columns}; ${numberWord(IDX_ROWS[0])} modules in each`;
  }
  const counts = IDX_ROWS.join(', ').replace(/, (\d+)$/, ' and $1');
  return `${columns}; ${counts} modules in them`;
}

function renderIndexPlate(mods: IndexPlateModules): string {
  const body: string[] = [comment(columnShape())];

  // Column headings.
  IDX_GROUPS.forEach((label, c) => {
    body.push(
      textNode(label.toUpperCase(), {
        x: f(IDX_MARGIN + c * CELL_W + 18, 0),
        y: 30,
        fontSize: 11,
        letterSpacing: '0.14em',
        fill: LABEL,
      }),
    );
  });

  // A rule separates; a box around each panel would be twelve cards.
  body.push(node('path', { d: gridRules().join(''), fill: 'none', stroke: GRID, strokeWidth: 1 }));

  for (const p of IDX_PANELS) body.push(...panelHead(p.id, p.title, p.caption));

  body.push(
    ...renderTablePanel(mods.elements),
    ...renderCrystalPanel(mods.crystal),
    ...renderMillerPanel(mods.miller),
    ...renderPolymerPanel(mods.polymer),
    ...renderDiffusionPanel(mods.diffusion),
    ...renderPbSnPanel(mods.pbsn),
    ...renderTttPanel(mods.heat),
    ...renderStressPanel(mods.mech),
    ...renderFracturePanel(mods.failure),
    ...renderCompositePanel(mods.composite),
    ...renderBandGapPanel(mods.semi),
    ...renderXrdPanel(mods.xrd),
    ...renderSelectionPanel(mods.selection),
    ...renderPourbaixPanel(mods.corrosion),
  );

  return figureFile(
    'ModuleIndexPlate',
    [
      `${capitalisedWord(IDX_PANELS.length)} panels, one per module, each plotted from that module’s own model`,
      'code — the periodic table from `data/elements.json`, the TTT nose from',
      '`heattreat/model.ts`, the Ashby cloud from `selection/materials.ts`, the',
      `diffraction sticks from \`xrd/diffraction.ts\`, and so on for all ${numberWord(IDX_PANELS.length)}.`,
      '',
      `${capitalisedWord(IDX_GROUPS.length)} columns, one per course group, in \`NAV_GROUPS\` order.`,
      '',
      'Larger than the four single plates, and lazily imported by the landing',
      'page for that reason: it heads the modules chapter, far below the fold,',
      'so it has no business in the first paint.',
    ],
    body,
    [IDX_W, IDX_H],
  );
}

/* ============================================================== driver === */

export interface GeneratedFigure {
  /** Path relative to the repository root. */
  path: string;
  source: string;
}

/**
 * Builds all five figures. Exported so `figures.test.ts` can re-run exactly
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

  const elementsModule = await import('../src/data/elements.json', { with: { type: 'json' } });
  const crystal = (await import('../src/crystal/structures.ts')) as unknown as { STRUCTURES: unknown[] };
  const geometry = await import('../src/crystal/geometry.ts');
  const miller = (await import('../src/crystal/miller.ts')) as unknown as MillerModule;
  const diffusion = (await import('../src/diffusion/model.ts')) as unknown as DiffusionModule;
  const heat = (await import('../src/heattreat/model.ts')) as unknown as { buildTtt: HeatModule['buildTtt'] };
  const steels = (await import('../src/heattreat/steels.ts')) as unknown as { STEELS: { id: string }[] };
  const failureAlloys = failureData as unknown as { FRACTURE_ALLOYS: FailureModule['FRACTURE_ALLOYS'] };
  const semi = (await import('../src/electronic/materials.ts')) as unknown as SemiModule;
  const polymerModel = await import('../src/polymer/model.ts');
  const compositeData = await import('../src/composite/materials.ts');
  const compositeModel = await import('../src/composite/model.ts');
  const corrosion = (await import('../src/corrosion/data.ts')) as unknown as CorrosionPanelModule;

  const indexPlate = renderIndexPlate({
    elements: (elementsModule.default ?? elementsModule) as unknown as ElementRow[],
    crystal: {
      STRUCTURES: crystal.STRUCTURES as CrystalModule['STRUCTURES'],
      buildAtoms: geometry.buildAtoms as unknown as CrystalModule['buildAtoms'],
    },
    miller,
    polymer: {
      stepGrowth: polymerModel.stepGrowth,
      histogram: polymerModel.histogram,
      displayRange: polymerModel.displayRange,
    },
    diffusion,
    pbsn: phase as unknown as PbSnModule,
    heat: { STEELS: steels.STEELS, buildTtt: heat.buildTtt },
    mech: {
      MECH_MATERIALS: mech.MECH_MATERIALS,
      buildCurve: mech.buildCurve as unknown as MechModule['buildCurve'],
    },
    failure: {
      FRACTURE_ALLOYS: failureAlloys.FRACTURE_ALLOYS,
      criticalCrackSize: failureModel.criticalCrackSize,
    },
    semi,
    composite: {
      FIBRES: compositeData.FIBRES,
      MATRICES: compositeData.MATRICES,
      longitudinalModulus: compositeModel.longitudinalModulus,
      transverseModulus: compositeModel.transverseModulus,
    },
    xrd: xrd as unknown as XrdPanelModule,
    selection: selection as unknown as SelectionPanelModule,
    corrosion,
  });

  return [
    { path: 'src/assets/figures/PhaseFigure.tsx', source: renderPhaseFigure(phase) },
    { path: 'src/assets/figures/FatigueFigure.tsx', source: renderFatigueFigure(fatigue) },
    { path: 'src/assets/figures/AshbyFigure.tsx', source: renderAshbyFigure(selection) },
    { path: 'src/assets/figures/XrdFigure.tsx', source: renderXrdFigure(xrd) },
    { path: 'src/assets/figures/ModuleIndexPlate.tsx', source: indexPlate },
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
