/**
 * Offline generator for the landing hero's static lattice plate.
 *
 *   node --experimental-strip-types scripts/gen-lattice-plate.ts
 *
 * Writes `src/assets/figures/LatticePlate.tsx`, which is committed. The image is
 * a still, so there is no reason to pay for it at runtime: every sphere, bond
 * and gradient below is resolved here, once, and the app ships plain markup.
 *
 * The geometry is imported from `src/landing/lattice.ts` rather than restated —
 * that module is DOM-free arithmetic, so it loads into Node unchanged, and
 * sharing it means the plate and the app's own crystal maths can never disagree
 * about where an FCC face centre sits.
 *
 * Output is a pure function of this file: no randomness, no clock, no
 * environment. Re-running it is byte-identical, so a regeneration that shows up
 * in `git diff` means someone changed the source, which is the point.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { depthSort, fccLattice, project, rotate } from '../src/landing/lattice.ts';
import type { Atom, Vec3 } from '../src/landing/lattice.ts';

/* ------------------------------------------------------------------ camera */

/** 2×2×2: 63 atoms and 240 bonds, the same block the hero canvas drew. */
const CELLS = 2;

/**
 * Yaw 36°, pitch 35°.
 *
 * Chosen by scoring the whole (yaw 10–80°, pitch 8–45°) grid at half-degree
 * steps on two things that fight each other: how far apart the three cube axes
 * land in screen angle (symmetry has to read) and how much the 63 spheres
 * overlap once projected, with a heavy penalty for one sphere's centre being
 * swallowed by another. This pose is the grid optimum — the lowest overlap
 * found, and the closest pair of cube-axis screen directions is still 52°
 * apart, so all three cell directions stay separately legible.
 *
 * Re-run after the radii below were enlarged, since fatter spheres occlude more
 * and could have moved the answer: it does not move. The optimum drifts by at
 * most half a degree across the radius range tried, and this pose stays inside
 * 0.5% of the best score at every one of them, so it is kept exactly.
 *
 * Deliberately *not* the isometric 45°/35.26°: that pose looks tidy on a cube
 * but is the worst case for FCC, because the view direction runs down a body
 * diagonal and whole columns of atoms stack into single dots (its eclipse score
 * is the highest on the grid). Backing yaw off to 36° breaks those alignments
 * and, as a bonus, makes the block read asymmetrically as a solid rather than
 * as an ambiguous isometric diagram that can flip inside-out as you look at it.
 */
const YAW = (36 * Math.PI) / 180;
const PITCH = (35 * Math.PI) / 180;

/** A long lens: enough perspective that near atoms grow, little enough that the
 * cell edges stay visibly straight. Matches the hero canvas's camera. */
const FOV = 1;
const DIST = 3.6;

/**
 * Display radii as a fraction of the lattice parameter, following the
 * ball-and-stick convention in `crystal/structures` — but nearer the top of its
 * range than the 0.13 used for a rotating thumbnail. This is a still plate at
 * reading size, and at 0.13 the spheres read as beads threaded on rods.
 *
 * FCC nearest neighbours sit √2/2 ≈ 0.707 apart, so `fillRadius` — spheres
 * actually touching — is √2/4 ≈ 0.354 each. A corner/face-centre pair here sums
 * to 0.37, just over half of that: the balls carry the picture and close most of
 * the gap along the close-packed direction, while enough of it survives that
 * neighbours stay separate discs. Tried larger; past roughly 0.25 the projected
 * interior fuses into one mass and the unit cell stops being findable inside it,
 * which costs more than the extra heft is worth.
 *
 * Corners are the large species, face centres the small one, and the 0.66 ratio
 * between them is wide enough to tell apart at a glance.
 */
const RADIUS: [number, number] = [0.222, 0.148];

/* --------------------------------------------------------------- the plate */

/**
 * The frame is derived, not declared.
 *
 * The block is very nearly square on screen at this pose, so a fixed landscape
 * viewBox could only be filled by leaving dead space down both sides — which is
 * exactly how the first cut of this plate read. Instead the block is fitted to a
 * target height and the plate is then cut around it with an even margin, so the
 * figure hugs its subject at any size.
 *
 * The bottom margin is the one deliberate asymmetry: the contact shadow sits
 * below the block and needs somewhere to fade out, and a subject sitting a
 * little above centre in its frame is the ordinary composition for a plate.
 */
const BLOCK_HEIGHT = 596;
const MARGIN = 34;
const MARGIN_BOTTOM = 92;

/** Depth buckets. Every atom in a bucket shares one gradient, which is what
 * keeps the file small; seven steps is fine enough that the fade reads as
 * continuous rather than as banding. */
const ATOM_BUCKETS = 7;
const BOND_BUCKETS = 8;

/**
 * The themeable palette.
 *
 * Every colour the SVG emits goes through one of these, as `var(--name, #hex)`.
 *
 * The fallbacks are the landing stylesheet's *light* values, not a dark set.
 * That is the case they have to cover: the plate is inline, so it paints in the
 * first frame, and if the stylesheet has not arrived the page is still on the
 * browser's default light ground — a dark fallback palette would render the
 * figure white-on-white for exactly as long as it took the CSS to land.
 */
const TOKENS = {
  bg: 'var(--plate-bg, #ffffff)',
  atomA: 'var(--plate-atom-a, #4a6f96)',
  atomAHi: 'var(--plate-atom-a-hi, #a8c3dc)',
  atomB: 'var(--plate-atom-b, #a86a3c)',
  atomBHi: 'var(--plate-atom-b-hi, #dcb28a)',
  bond: 'var(--plate-bond, #918f86)',  // 3.24:1 on the plate; #9a988f measured 2.89
  cell: 'var(--plate-cell, #2a78d6)',
  shadow: 'var(--plate-shadow, rgba(11, 11, 11, 0.14))',
};

/* ------------------------------------------------------------------ helpers */

/** Fixed-precision, trailing zeros trimmed. Keeps the markup short and, more
 * importantly, keeps it stable: no 0.30000000000000004 in a committed file. */
function n(v: number, places = 1): string {
  const s = v.toFixed(places);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Bucket a 0..1 depth onto `count` steps, returning the index and the depth at
 * that bucket's centre — the gradient is built from the centre so a bucket is
 * never systematically too near or too far. */
function bucket(t: number, count: number): { index: number; t: number } {
  const index = Math.min(count - 1, Math.max(0, Math.round(t * (count - 1))));
  return { index, t: index / (count - 1) };
}

/* ------------------------------------------------------------------- scene */

const { atoms, bonds } = fccLattice(CELLS);

/** Rotate once; everything downstream reads these. */
const rotated: Vec3[] = atoms.map((a: Atom) => rotate(a.p, YAW, PITCH));

/**
 * Fit the block, then cut the frame around it.
 *
 * Measured once at unit zoom, then solved rather than tuned. `project` is affine
 * in `zoom` and in the centre offsets — perspective happens before both — so the
 * silhouette measured here scales exactly, and one pass gives the answer.
 *
 * The bound is the true min/max including each atom's projected radius, not a
 * symmetric ±max: under perspective and a 35° tilt the block is not symmetric
 * about the origin, and centring on the symmetric bound would leave it visibly
 * high and off to one side inside its own plate. Because the viewBox is then
 * derived from that same bound, the margin is exactly `MARGIN` on three sides by
 * construction, whatever the pose.
 */
const unit = rotated.map((p) => project(p, { fov: FOV, dist: DIST, cx: 0, cy: 0, zoom: 1 }));
const bound = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
unit.forEach((q, i) => {
  const r = RADIUS[atoms[i].kind] * q.scale;
  bound.x0 = Math.min(bound.x0, q.x - r);
  bound.x1 = Math.max(bound.x1, q.x + r);
  bound.y0 = Math.min(bound.y0, q.y - r);
  bound.y1 = Math.max(bound.y1, q.y + r);
});
const ZOOM = BLOCK_HEIGHT / (bound.y1 - bound.y0);
// `unit` is already in screen orientation — `project` flips y before this — so
// both axes place their measured near corner at the margin the same way.
const CX = MARGIN - bound.x0 * ZOOM;
const CY = MARGIN - bound.y0 * ZOOM;
const W = Math.round((bound.x1 - bound.x0) * ZOOM + 2 * MARGIN);
const H = Math.round(BLOCK_HEIGHT + MARGIN + MARGIN_BOTTOM);

const proj = rotated.map((p) => project(p, { fov: FOV, dist: DIST, cx: CX, cy: CY, zoom: ZOOM }));

const zNear = Math.min(...rotated.map((p) => p.z));
const zFar = Math.max(...rotated.map((p) => p.z));
/** 0 at the nearest atom, 1 at the farthest. `+z` points away from the viewer,
 * so this is just a normalised z — every depth cue below is a function of it. */
const depth = (z: number) => (z - zNear) / (zFar - zNear);

/**
 * One CSS pixel, in viewBox units, at the size this plate actually renders.
 *
 * Line weights are the one thing in the drawing that must not scale with the
 * geometry: a stroke tied to the sphere radius looked right while the spheres
 * were small and turned into rods the moment they were not. On the landing the
 * plate occupies about 420 CSS pixels, so weights are quoted in pixels at that
 * width and converted here. Bigger renderings scale up with everything else,
 * which is what you want — the drawing keeps its proportions.
 */
const NOMINAL_WIDTH = 420;
const HAIRLINE = W / NOMINAL_WIDTH;

/* -------------------------------------------------------------- gradients */

/**
 * One sphere gradient per (species, depth bucket).
 *
 * The focal point sits up and to the left of centre, which is what turns a flat
 * disc into a lit sphere: the specular highlight lands there, the body colour
 * takes over, and the last stop leans into the shadow token to give the
 * terminator at the lower-right limb.
 *
 * The rim stop leans on `--plate-shadow`, which the stylesheet ships as an rgba
 * rather than a solid — a stop's opacity multiplies into its colour's alpha, so
 * these numbers are the ceiling of the terminator, not its strength. It lands
 * deep on the dark theme and barely-there on the light one, which is the right
 * answer for both: a printed plate on white does not have black limbs.
 *
 * Depth cueing is carried by the stop *opacities*. Far atoms let more of the
 * background through at every stop, so they sit lower in contrast as well as
 * dimmer, and their highlight nearly vanishes — near spheres keep a hard
 * specular and a deep terminator, which is what makes them feel close. Because
 * the fade is alpha over a known ground, it stays correct under any theme: the
 * colours themselves are never baked, only mixed toward `--plate-bg`.
 */
function sphereGradient(
  id: string,
  body: string,
  hi: string,
  t: number,
  species: { mid: [number, number]; hi: number; core: number },
): string {
  const highlight = lerp(0.97, 0.2, t) * species.hi;
  const core = lerp(1, 0.34, t) * species.core;
  const rim = lerp(0.88, 0.07, t);
  return [
    `      <radialGradient id="${id}" cx="0.5" cy="0.5" r="0.55" fx="0.33" fy="0.29">`,
    `        <stop offset="0" stopColor="${hi}" stopOpacity="${n(highlight, 2)}" />`,
    `        <stop offset="${species.mid[0]}" stopColor="${body}" stopOpacity="${n(core, 2)}" />`,
    `        <stop offset="${species.mid[1]}" stopColor="${body}" stopOpacity="${n(core * 0.94, 2)}" />`,
    `        <stop offset="1" stopColor="${TOKENS.shadow}" stopOpacity="${n(rim, 2)}" />`,
    `      </radialGradient>`,
  ].join('\n');
}

/**
 * Per-species shading weights.
 *
 * Not a second colour scheme — the hues come from the theme — but a quiet
 * difference in how hard each species is lit. The face-centre species is small,
 * numerous and clustered through the middle of the block, and given identical
 * treatment its warm hue shouts over the cool corner species and reads as "the
 * highlighted set" rather than as the second material. Damping its specular and
 * easing its body opacity puts the two back on level terms while leaving the
 * hue difference — which is the part that actually carries the distinction —
 * untouched. Its highlight also sits tighter, because it is a smaller ball.
 */
const SPECIES_A = { mid: [0.26, 0.72] as [number, number], hi: 1, core: 1 };
const SPECIES_B = { mid: [0.2, 0.66] as [number, number], hi: 0.68, core: 0.9 };

const defs: string[] = [];
for (let i = 0; i < ATOM_BUCKETS; i++) {
  const t = i / (ATOM_BUCKETS - 1);
  defs.push(sphereGradient(`lp-a${i}`, TOKENS.atomA, TOKENS.atomAHi, t, SPECIES_A));
}
for (let i = 0; i < ATOM_BUCKETS; i++) {
  const t = i / (ATOM_BUCKETS - 1);
  defs.push(sphereGradient(`lp-b${i}`, TOKENS.atomB, TOKENS.atomBHi, t, SPECIES_B));
}
defs.push(
  [
    // The shipped `--plate-shadow` is itself an rgba, and a stop's opacity
    // multiplies into its colour's alpha rather than replacing it — so these
    // read as the ceiling of the effect, not its strength. Set high enough that
    // the hint survives a translucent token; the falloff does the subtlety.
    '      <radialGradient id="lp-contact" cx="0.5" cy="0.5" r="0.5">',
    `        <stop offset="0" stopColor="${TOKENS.shadow}" stopOpacity="0.7" />`,
    `        <stop offset="0.5" stopColor="${TOKENS.shadow}" stopOpacity="0.3" />`,
    `        <stop offset="1" stopColor="${TOKENS.shadow}" stopOpacity="0" />`,
    '      </radialGradient>',
  ].join('\n'),
);

/* ------------------------------------------------------------------- bonds */

/**
 * Bonds go down first, as one layer behind every sphere: ball-and-stick reads
 * correctly that way because each stick ends inside a ball that is painted over
 * it. Within the layer they are still sorted far-to-near and bucketed, so width
 * and opacity fall off with distance and the block reads as a cage with depth
 * rather than as a flat web of equal lines.
 *
 * They are drawn deliberately light. Bonds are scaffold: they say which atoms
 * are neighbours and then get out of the way. Given equal weight to the spheres
 * — which is what a stroke a third of an atom wide does — the eye reads the rods
 * first and the picture turns into a Tinkertoy with beads on it. The widest
 * stroke here is under a fifth of the nearest sphere's radius, and only the
 * front bucket is drawn at any real strength; by the back of the block the
 * bonds are a suggestion.
 */
interface BondDraw {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  z: number;
}

const bondDraws: BondDraw[] = bonds.map((b) => {
  const pa = proj[b.a];
  const pb = proj[b.b];
  const ra = RADIUS[atoms[b.a].kind] * pa.scale * ZOOM;
  const rb = RADIUS[atoms[b.b].kind] * pb.scale * ZOOM;
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const len = Math.hypot(dx, dy) || 1;
  // Trim each end to just inside its sphere, so a bond is only ever drawn in the
  // gap between two balls. The stub that remains is covered by the ball painted
  // over it, which keeps bonds from showing through the translucent far atoms —
  // and with the spheres this large, the gap is most of what is left.
  const ta = Math.min(0.46, (ra * 0.86) / len);
  const tb = Math.min(0.46, (rb * 0.86) / len);
  return {
    x1: pa.x + dx * ta,
    y1: pa.y + dy * ta,
    x2: pb.x - dx * tb,
    y2: pb.y - dy * tb,
    z: (rotated[b.a].z + rotated[b.b].z) / 2,
  };
});

const bondLayers: string[][] = Array.from({ length: BOND_BUCKETS }, () => []);
for (const b of depthSort(bondDraws)) {
  // A pair whose spheres nearly meet on screen leaves no gap to draw in, and a
  // round-capped zero-length line is just a dot in the wrong place. Drop it.
  if (Math.hypot(b.x2 - b.x1, b.y2 - b.y1) < 2) continue;
  const { index } = bucket(depth(b.z), BOND_BUCKETS);
  bondLayers[index].push(
    `        <line x1="${n(b.x1)}" y1="${n(b.y1)}" x2="${n(b.x2)}" y2="${n(b.y2)}" />`,
  );
}

const bondMarkup: string[] = [];
for (let i = BOND_BUCKETS - 1; i >= 0; i--) {
  if (bondLayers[i].length === 0) continue;
  const t = i / (BOND_BUCKETS - 1);
  const width = HAIRLINE * lerp(2, 0.85, t);
  const opacity = lerp(0.58, 0.05, t);
  bondMarkup.push(
    `      <g strokeWidth="${n(width, 2)}" strokeOpacity="${n(opacity, 2)}">`,
    ...bondLayers[i],
    '      </g>',
  );
}

/* ------------------------------------------------------------------- atoms */

/**
 * Painter's algorithm, farthest first. Each atom is two circles: an opaque disc
 * of the background, then the gradient sphere over it. The backing disc is what
 * lets the spheres be translucent for the depth fade without the lattice behind
 * them showing through — occlusion stays hard, the colour still composites onto
 * a known ground.
 */
const atomOrder = depthSort(
  proj.map((q, i) => ({ i, z: q.z })),
);

const atomMarkup: string[] = [];
for (const { i } of atomOrder) {
  const q = proj[i];
  const kind = atoms[i].kind;
  const r = RADIUS[kind] * q.scale * ZOOM;
  const { index } = bucket(depth(q.z), ATOM_BUCKETS);
  const id = `lp-${kind === 0 ? 'a' : 'b'}${index}`;
  const cx = n(q.x);
  const cy = n(q.y);
  const rr = n(r, 2);
  atomMarkup.push(
    `      <circle cx="${cx}" cy="${cy}" r="${rr}" fill="${TOKENS.bg}" />`,
    `      <circle cx="${cx}" cy="${cy}" r="${rr}" fill="url(#${id})" />`,
  );
}

/* --------------------------------------------------------------- unit cell */

/**
 * The teaching payload: one cell of the eight, outlined so the repeating unit
 * is legible inside the block.
 *
 * The nearest cell is picked so the outline sits over well-lit foreground atoms
 * rather than being lost in the dim back of the block. Its twelve edges are then
 * split: edges behind the cell's own centre are drawn under the spheres and
 * faint, edges in front are drawn over them and crisp. That is the same
 * hidden-line convention a printed crystallography plate uses, and it is what
 * stops the dashes from reading as a flat wireframe pasted on top.
 */
const half = CELLS / 2;
let cellOrigin = { x: 0, y: 0, z: 0 };
let cellCentreZ = Infinity;
for (let i = 0; i < CELLS; i++) {
  for (let j = 0; j < CELLS; j++) {
    for (let k = 0; k < CELLS; k++) {
      const centre = rotate(
        { x: i + 0.5 - half, y: j + 0.5 - half, z: k + 0.5 - half },
        YAW,
        PITCH,
      );
      if (centre.z < cellCentreZ) {
        cellCentreZ = centre.z;
        cellOrigin = { x: i - half, y: j - half, z: k - half };
      }
    }
  }
}

const CORNERS: [number, number, number][] = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

const cellPoints = CORNERS.map(([dx, dy, dz]) => {
  const r = rotate(
    { x: cellOrigin.x + dx, y: cellOrigin.y + dy, z: cellOrigin.z + dz },
    YAW,
    PITCH,
  );
  return { p: project(r, { fov: FOV, dist: DIST, cx: CX, cy: CY, zoom: ZOOM }), z: r.z };
});

const cellBack: string[] = [];
const cellFront: string[] = [];
for (const [a, b] of EDGES) {
  const pa = cellPoints[a];
  const pb = cellPoints[b];
  const line = `        <line x1="${n(pa.p.x)}" y1="${n(pa.p.y)}" x2="${n(pb.p.x)}" y2="${n(pb.p.y)}" />`;
  ((pa.z + pb.z) / 2 > cellCentreZ ? cellBack : cellFront).push(line);
}

const CELL_DASH = `${n(HAIRLINE * 6.5, 1)} ${n(HAIRLINE * 5, 1)}`;
const cellLayer = (lines: string[], width: number, opacity: number) =>
  [
    `      <g strokeWidth="${n(width, 2)}" strokeOpacity="${n(opacity, 2)}">`,
    ...lines,
    '      </g>',
  ].join('\n');

/* ------------------------------------------------------------ contact shadow */

/**
 * A single soft ellipse under the block. It is not a cast shadow with a light
 * direction — there is no ground plane here — but an ambient-occlusion hint:
 * the picture sits on something, so the space directly beneath the densest part
 * of the lattice is a little darker. Wide, shallow, and low contrast on purpose;
 * you should notice it only if you go looking.
 */
let minY = Infinity;
let maxY = -Infinity;
let minX = Infinity;
let maxX = -Infinity;
proj.forEach((q, i) => {
  const r = RADIUS[atoms[i].kind] * q.scale * ZOOM;
  minY = Math.min(minY, q.y - r);
  maxY = Math.max(maxY, q.y + r);
  minX = Math.min(minX, q.x - r);
  maxX = Math.max(maxX, q.x + r);
});
const shadow =
  `    <ellipse cx="${n((minX + maxX) / 2)}" cy="${n(maxY + 26)}" ` +
  `rx="${n((maxX - minX) * 0.58)}" ry="${n(Math.max(26, (maxY - minY) * 0.085))}" fill="url(#lp-contact)" />`;

/* ------------------------------------------------------------------ emit */

const body = [
  `    <rect width="${W}" height="${H}" fill="${TOKENS.bg}" />`,
  shadow,
  `    <g stroke="${TOKENS.bond}" strokeLinecap="round" fill="none">`,
  ...bondMarkup,
  '    </g>',
  `    <g stroke="${TOKENS.cell}" strokeDasharray="${CELL_DASH}" strokeLinecap="round" fill="none">`,
  cellLayer(cellBack, HAIRLINE * 1.4, 0.4),
  '    </g>',
  ...atomMarkup,
  `    <g stroke="${TOKENS.cell}" strokeDasharray="${CELL_DASH}" strokeLinecap="round" fill="none">`,
  cellLayer(cellFront, HAIRLINE * 2.2, 0.95),
  '    </g>',
].join('\n');

const file = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Run \`node --experimental-strip-types scripts/gen-lattice-plate.ts\` to rebuild
 * it; the generator carries the reasoning behind every constant here, and its
 * output is deterministic, so an unexplained diff in this file means the source
 * geometry moved.
 *
 * A ${CELLS}×${CELLS}×${CELLS} FCC block — ${atoms.length} atoms, ${bonds.length} nearest-neighbour bonds —
 * projected at yaw 36°, pitch 35°, with one unit cell picked out in dashes.
 *
 * The SVG is inline rather than an <img> so it inherits the page's custom
 * properties and follows the light/dark theme. Every colour is a var() with a
 * dark-theme fallback:
 *
 *   --plate-bg, --plate-atom-a, --plate-atom-a-hi, --plate-atom-b,
 *   --plate-atom-b-hi, --plate-bond, --plate-cell, --plate-shadow
 *
 * Decorative: the figure's caption carries the meaning, so the svg is hidden
 * from assistive technology.
 */
export function LatticePlate() {
  // Sizing lives in the style, not in width/height attributes: those take SVG
  // lengths and "auto" is not one, so the attribute form logs
  // 'Expected length, "auto"' to the console on every load. The style does the
  // job, and the intrinsic ratio comes from the viewBox either way.
  return (
    <svg
      viewBox="0 0 ${W} ${H}"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
${defs
  .join('\n')
  .split('\n')
  .map((l) => (l.length > 0 ? '  ' + l : l))
  .join('\n')}
      </defs>
${body
  .split('\n')
  .map((l) => (l.length > 0 ? '  ' + l : l))
  .join('\n')}
    </svg>
  );
}
`;

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'src', 'assets', 'figures', 'LatticePlate.tsx');
writeFileSync(out, file, 'utf8');
console.log(
  `wrote ${out}\n  ${atoms.length} atoms, ${bonds.length} bonds, ${defs.length} gradients, ${Buffer.byteLength(file, 'utf8')} bytes`,
);
