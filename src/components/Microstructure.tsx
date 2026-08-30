/**
 * A microstructure cartoon — deliberately a cartoon, and labelled as one.
 *
 * The phase panel says *what* is present and in what amount. This says what it
 * would look like, because those are different questions with the same answer
 * to the first one: a 40 wt% Sn alloy and a 61.9 wt% Sn alloy are both α + β,
 * and they look nothing alike.
 *
 * Everything here is generated from a seed and the phase fractions, so the
 * same state always draws the same grains — a URL that produces a different
 * picture each time it is opened is not a diagram, it is decoration.
 */
import type { PhasePoint } from '../phase/systems';

/**
 * A small deterministic generator. `Math.random` would make the drawing
 * change on every render, which for a link people paste into a worksheet is
 * worse than useless.
 */
function rng(seed: number): () => number {
  let s = (seed | 0) || 1;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** An irregular closed blob around a centre — a grain, roughly. */
function grain(cx: number, cy: number, r: number, next: () => number): string {
  const n = 7 + Math.floor(next() * 3);
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    const rr = r * (0.72 + next() * 0.5);
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

const SIZE = 200;

export interface MicrostructureProps {
  point: PhasePoint;
  /** Same state, same picture. */
  seed: number;
  /** Which phase, if any, forms as a lamellar eutectic/eutectoid mixture. */
  lamellar?: boolean;
  label: string;
}

/**
 * Colours are per *constituent*, not per phase: the whole point is that the
 * lamellar mixture is one thing a microscope sees, even though it is two
 * phases.
 */
const LIQUID = '#cfe3fb';
const PRIMARY = '#3987e5';
const SECOND = '#eb6834';
const MATRIX = '#f3d9a4';

export function Microstructure({ point, seed, lamellar = false, label }: MicrostructureProps) {
  const next = rng(seed);
  const solid = point.phases.filter((p) => p.name !== 'L');
  const liquidFraction = point.phases.find((p) => p.name === 'L')?.fraction ?? 0;
  const primary = solid[0];

  // Grain centres on a jittered grid, so they neither overlap badly nor line up.
  const cells: { x: number; y: number }[] = [];
  const N = 4;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      cells.push({
        x: ((i + 0.5) / N) * SIZE + (next() - 0.5) * (SIZE / N) * 0.55,
        y: ((j + 0.5) / N) * SIZE + (next() - 0.5) * (SIZE / N) * 0.55,
      });
    }
  }
  // How many of those cells are the primary constituent.
  const solidFraction = 1 - liquidFraction;
  const grains = Math.round(cells.length * solidFraction);

  return (
    <figure className="ms-fig">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="ms-svg"
        role="img"
        aria-label={`Schematic microstructure: ${label}`}
      >
        <defs>
          {/* The lamellar mixture, drawn once and reused per colony. */}
          <pattern id={`lam-${seed}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill={MATRIX} />
            <path d="M0,0 L0,8" stroke={SECOND} strokeWidth="3" />
          </pattern>
        </defs>

        <rect width={SIZE} height={SIZE} fill={liquidFraction > 0 ? LIQUID : MATRIX} />

        {lamellar &&
          liquidFraction === 0 &&
          cells.map((c, i) => (
            <polygon
              key={`lam${i}`}
              points={grain(c.x, c.y, SIZE / N / 1.3, next)}
              fill={`url(#lam-${seed})`}
              stroke="#6b7280"
              strokeWidth={0.7}
              transform={`rotate(${Math.floor(next() * 180)} ${c.x} ${c.y})`}
            />
          ))}

        {cells.slice(0, grains).map((c, i) => (
          <polygon
            key={i}
            points={grain(c.x, c.y, SIZE / N / (lamellar && liquidFraction === 0 ? 2.6 : 1.35), next)}
            fill={PRIMARY}
            fillOpacity={0.9}
            stroke="#1f4e8c"
            strokeWidth={0.8}
          />
        ))}

        <rect width={SIZE} height={SIZE} fill="none" stroke="#6b7280" strokeWidth={1.5} />
      </svg>
      <figcaption className="ms-caption">
        {label}
        {primary && solid.length > 1 && (
          <> · {(primary.fraction * 100).toFixed(0)}% {primary.name}</>
        )}
      </figcaption>
    </figure>
  );
}
