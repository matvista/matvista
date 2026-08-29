import { useMemo, useRef, useState } from 'react';
import { useRouteNumber, useRouteString } from '../useRoute';
import {
  EUTECTOID_X,
  FERRITE_MAX,
  GAMMA_MAX,
  PHASE_SYSTEMS,
  gibbsPhaseRule,
  microconstituents,
  type MicroconstituentResult,
  type PhaseRuleResult,
  type PhaseSystem,
} from '../phase/systems';

const W = 720;
const H = 460;
const PAD = { l: 64, r: 24, t: 20, b: 52 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

const PHASE_COLOR: Record<string, string> = {
  L: '#eda100',
  α: '#2a78d6',
  β: '#1baf7a',
  γ: '#4a3aa7',
  'Fe₃C': '#e34948',
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function PhaseDiagrams() {
  const [systemId, setSystemId] = useRouteString('sys', 'fe-c');
  const system = PHASE_SYSTEMS.find((s) => s.id === systemId) ?? PHASE_SYSTEMS[2];

  // Point of interest, in diagram units. Defaults to a hypoeutectoid steel.
  // Carried as two params rather than one, so a shared link reads as
  // `?x=0.4&T=650` — the composition and temperature a reader would quote.
  const [pointX, setPointX] = useRouteNumber('x', 0.4);
  const [pointT, setPointT] = useRouteNumber('T', 650);
  const point = { x: pointX, T: pointT };
  // The store updates synchronously, so the second write sees the first.
  const setPoint = (p: { x: number; T: number }) => {
    setPointX(p.x);
    setPointT(p.T);
  };
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const sx = (x: number) =>
    PAD.l + ((x - system.xMin) / (system.xMax - system.xMin)) * plotW;
  const sy = (T: number) =>
    PAD.t + plotH - ((T - system.tMin) / (system.tMax - system.tMin)) * plotH;

  const clamped = {
    x: Math.min(system.xMax, Math.max(system.xMin, point.x)),
    T: Math.min(system.tMax, Math.max(system.tMin, point.T)),
  };
  const result = useMemo(
    () => system.evaluate(clamped.x, clamped.T),
    [system, clamped.x, clamped.T],
  );

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // The SVG scales to its container, so map through the viewBox.
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    const x =
      system.xMin + ((px - PAD.l) / plotW) * (system.xMax - system.xMin);
    const T =
      system.tMin + ((PAD.t + plotH - py) / plotH) * (system.tMax - system.tMin);
    setPoint({
      x: Math.min(system.xMax, Math.max(system.xMin, x)),
      T: Math.min(system.tMax, Math.max(system.tMin, T)),
    });
  }

  /**
   * Arrow keys nudge the point of interest. One press is 1% of the axis range,
   * shift is 5% — enough to cross a field quickly without losing the ability to
   * land on a boundary.
   */
  function onPlotKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const stepFrac = e.shiftKey ? 0.05 : 0.01;
    const dx = (system.xMax - system.xMin) * stepFrac;
    const dT = (system.tMax - system.tMin) * stepFrac;
    if (e.key === 'ArrowLeft') setPointX(clamp(clamped.x - dx, system.xMin, system.xMax));
    if (e.key === 'ArrowRight') setPointX(clamp(clamped.x + dx, system.xMin, system.xMax));
    if (e.key === 'ArrowDown') setPointT(clamp(clamped.T - dT, system.tMin, system.tMax));
    if (e.key === 'ArrowUp') setPointT(clamp(clamped.T + dT, system.tMin, system.tMax));
  }

  const rule = useMemo(
    () => gibbsPhaseRule(system, clamped.x, clamped.T),
    [system, clamped.x, clamped.T],
  );

  /**
   * The microconstituent split, now for any system whose invariant leaves two
   * solid phases behind — Pb–Sn as well as Fe–C.
   *
   * The Fe–C gate stays: past 2.14 wt% C the primary constituent comes from
   * the 1147 °C eutectic rather than the eutectoid, and the alloy is a cast
   * iron with a microstructure this panel does not describe.
   */
  const micro = useMemo(() => {
    if (system.id === 'fe-c' && (clamped.x < FERRITE_MAX || clamped.x > GAMMA_MAX)) return null;
    return microconstituents(system, clamped.x);
  }, [system, clamped.x]);

  const xTicks = tickValues(system.xMin, system.xMax);
  const tTicks = tickValues(system.tMin, system.tMax);

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select
            value={systemId}
            onChange={(e) => {
              const next = PHASE_SYSTEMS.find((s) => s.id === e.target.value)!;
              setSystemId(next.id);
              setPoint({
                x: next.xMin + (next.xMax - next.xMin) * 0.35,
                T: next.tMin + (next.tMax - next.tMin) * 0.45,
              });
            }}
            aria-label="Phase system"
          >
            {PHASE_SYSTEMS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="pd-field">
            <span>{system.xLabel}</span>
            <input
              type="number"
              value={Number(clamped.x.toFixed(2))}
              min={system.xMin}
              max={system.xMax}
              step={0.01}
              onChange={(e) => setPointX(Number(e.target.value))}
            />
          </label>
          <label className="pd-field">
            <span>°C</span>
            <input
              type="number"
              value={Math.round(clamped.T)}
              min={system.tMin}
              max={system.tMax}
              step={1}
              onChange={(e) => setPointT(Number(e.target.value))}
            />
          </label>
          <span className="drag-hint">Drag the diagram, or use the boxes and arrow keys</span>
        </div>

        <svg
          ref={svgRef}
          className="ss-plot pd-plot"
          viewBox={`0 0 ${W} ${H}`}
          /* Not role="img": this is the module's primary control, and an image
             role tells assistive technology it is a static picture. It is
             focusable and arrow-driven so it can be operated without a mouse,
             and the number boxes above give the same state a standard widget. */
          role="application"
          tabIndex={0}
          aria-label={`${system.name} phase diagram. Arrow keys move the point of interest; hold shift for larger steps.`}
          onKeyDown={onPlotKeyDown}
          onPointerDown={(e) => {
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
            handlePointer(e);
          }}
          onPointerMove={(e) => dragging && handlePointer(e)}
          onPointerUp={(e) => {
            setDragging(false);
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
        >
          {tTicks.map((t) => (
            <line key={t} x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} className="dd-grid" />
          ))}

          {system.boundaries.map((b) => (
            <polyline
              key={b.label}
              points={b.points.map(([x, t]) => `${sx(x)},${sy(t)}`).join(' ')}
              className={`pd-boundary pd-${b.kind}`}
            />
          ))}

          {system.regionLabels.map((r) => (
            <text key={r.text} x={sx(r.x)} y={sy(r.T)} className="pd-region" textAnchor="middle">
              {r.text}
            </text>
          ))}

          {system.invariants.map((inv) => (
            <g key={inv.label}>
              <circle cx={sx(inv.x)} cy={sy(inv.T)} r={5} className="pd-invariant" />
              <text x={sx(inv.x)} y={sy(inv.T) - 10} className="pd-invariant-label" textAnchor="middle">
                {inv.label}
              </text>
            </g>
          ))}

          {/* Tie line across the two-phase region at this temperature. */}
          {result.tieLine && (
            <g>
              <line
                x1={sx(result.tieLine.x1)}
                x2={sx(result.tieLine.x2)}
                y1={sy(clamped.T)}
                y2={sy(clamped.T)}
                className="pd-tie"
              />
              <circle cx={sx(result.tieLine.x1)} cy={sy(clamped.T)} r={3.5} className="pd-tie-end" />
              <circle cx={sx(result.tieLine.x2)} cy={sy(clamped.T)} r={3.5} className="pd-tie-end" />
            </g>
          )}

          {/* M8 — the three lever rules, drawn at the invariant isotherm so it
              is visible that they are taken over different segments of one tie
              line. Offset above and below the isotherm, and given different
              strokes, because they overlap along their whole shared length. */}
          {micro && (
            <g>
              <LeverSegment
                from={micro.left.composition}
                to={micro.right.composition}
                y={sy(micro.invariant.T) - 8}
                sx={sx}
                className="pd-lever-total"
              />
              <LeverSegment
                from={micro.primary === micro.right.name ? micro.invariant.x : micro.left.composition}
                to={micro.primary === micro.right.name ? micro.right.composition : micro.invariant.x}
                y={sy(micro.invariant.T) + 8}
                sx={sx}
                className="pd-lever-micro"
              />
              <line
                x1={sx(clamped.x)}
                x2={sx(clamped.x)}
                y1={sy(micro.invariant.T) - 13}
                y2={sy(micro.invariant.T) + 13}
                className="pd-lever-mark"
              />
            </g>
          )}

          {/* The point of interest. */}
          <line x1={sx(clamped.x)} x2={sx(clamped.x)} y1={PAD.t} y2={PAD.t + plotH} className="pd-cross" />
          <circle cx={sx(clamped.x)} cy={sy(clamped.T)} r={6} className="pd-point" />

          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />

          {xTicks.map((v) => (
            <text key={v} x={sx(v)} y={H - 30} className="dd-tick" textAnchor="middle">
              {v}
            </text>
          ))}
          <text x={W / 2} y={H - 10} className="dd-tick" textAnchor="middle">
            {system.xLabel}
          </text>
          {tTicks.map((v) => (
            <text key={v} x={PAD.l - 8} y={sy(v) + 4} className="dd-tick" textAnchor="end">
              {v}
            </text>
          ))}
          <text
            x={16}
            y={PAD.t + plotH / 2}
            className="dd-tick"
            transform={`rotate(-90 16 ${PAD.t + plotH / 2})`}
            textAnchor="middle"
          >
            temperature (°C)
          </text>
        </svg>

        <p className="trend-note">{renderNote(system)}</p>
        <p className="density-note">
          Invariant points, solubility limits and melting temperatures are exact values from
          Callister ch. 9. The boundary lines joining them are fitted or linearised — for Cu–Ni the
          lens is a two-point fit to his worked tie line (31.5 and 42.5 wt% Ni at 1250 °C). The
          δ-ferrite and peritectic region of the Fe–C diagram is omitted, being, in Callister’s own
          words, “of no technological importance”.
        </p>
      </section>

      <aside className="detail" aria-live="polite">
        <h2 className="crystal-title">{result.region}</h2>
        <p className="detail-meta">
          {clamped.x.toFixed(2)} {system.xLabel} · {clamped.T.toFixed(0)} °C
        </p>

        <table className="detail-props">
          <tbody>
            {result.phases.map((p) => (
              <tr key={p.name}>
                <th scope="row">
                  <span className="pd-swatch" style={{ background: PHASE_COLOR[p.name] ?? '#898781' }} />
                  {p.name}
                </th>
                <td>
                  {(p.fraction * 100).toFixed(1)}% · C = {p.composition.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {result.phases.length > 1 && (
          <>
            <div className="pd-bar" role="img" aria-label="Phase mass fractions">
              {result.phases.map((p) => (
                <div
                  key={p.name}
                  className="pd-bar-seg"
                  style={{
                    width: `${p.fraction * 100}%`,
                    background: PHASE_COLOR[p.name] ?? '#898781',
                  }}
                />
              ))}
            </div>
            <p className="density-note">
              Mass fractions from the <strong>lever rule</strong>: the fraction of a phase is the
              tie-line length on the <em>opposite</em> side of the overall composition, over the
              whole tie line. That inversion is the part everyone gets backwards — being closer to
              a boundary means <em>more</em> of that phase.
            </p>
          </>
        )}

        <PhaseRuleBox rule={rule} />

        {system.invariants.length > 0 && (
          <div className="density-box">
            <h3>Invariant reactions</h3>
            {system.invariants.map((inv) => (
              <p key={inv.label} className="pd-reaction">
                <strong>{inv.label}</strong> · {inv.x} , {inv.T} °C
                <br />
                <code>{inv.reaction}</code>
              </p>
            ))}
          </div>
        )}

        {micro && <MicroPanel micro={micro} x={clamped.x} unit={system.xLabel} />}

      </aside>
    </div>
  );
}

/**
 * The phase rule, attached to the point the reader is already dragging.
 *
 * The rule is memorised and not understood: students recite P + F = C + N and
 * cannot say why a eutectic is a point. Reading F off the field you are
 * standing in makes it a consequence of where you are. The tie line the chart
 * already draws *is* the degree of freedom that two-phase costs you.
 */
function PhaseRuleBox({ rule }: { rule: PhaseRuleResult }) {
  const noun = rule.P === 1 ? 'phase' : 'phases';
  return (
    <div className="density-box">
      <h3>Gibbs phase rule</h3>
      <p className="density-eq">
        P + F = C + N &nbsp;→&nbsp; {rule.P} + <strong>{rule.F}</strong> = {rule.C} + {rule.N}
      </p>
      <table className="detail-props">
        <tbody>
          <tr>
            <th scope="row">Phases P</th>
            <td>
              {rule.P} {noun}
              {rule.invariant ? ` (on the ${rule.invariant.label.toLowerCase()})` : ''}
            </td>
          </tr>
          <tr>
            <th scope="row">Components C</th>
            <td>{rule.C} — a binary</td>
          </tr>
          <tr>
            <th scope="row">Non-compositional N</th>
            <td>{rule.N} — temperature; pressure is fixed</td>
          </tr>
          <tr>
            <th scope="row">Degrees of freedom F</th>
            <td>{rule.F}</td>
          </tr>
        </tbody>
      </table>
      <p className="density-note">
        {rule.F === 2 && (
          <>
            Two degrees of freedom. Temperature and composition move
            independently and you are still in the same single-phase field —
            which is why single-phase regions are areas.
          </>
        )}
        {rule.F === 1 && (
          <>
            One degree of freedom. Choose the temperature and the composition of{' '}
            <em>both</em> phases is already decided — you cannot pick them, you
            can only read them off the tie line drawn above. Only the
            proportions still vary, and the lever rule fixes those from the
            overall composition. That lost freedom is the tie line.
          </>
        )}
        {rule.F === 0 && (
          <>
            No degrees of freedom. Three phases coexist, so the temperature and
            all three compositions are fixed by the system itself — nothing is
            left to choose. That is why{' '}
            {rule.invariant ? <code>{rule.invariant.reaction}</code> : 'an invariant reaction'}{' '}
            happens at a single point rather than over a range, and why the
            temperature holds steady on a cooling curve until the reaction
            finishes. The panel above still names the field whose boundary this
            point sits on — an invariant is a point, so it lies on the edge of
            every field that meets there.
          </>
        )}
      </p>
    </div>
  );
}

/** One lever-rule segment with end caps, drawn along the invariant isotherm. */
function LeverSegment({
  from, to, y, sx, className,
}: {
  from: number; to: number; y: number; sx: (v: number) => number; className: string;
}) {
  return (
    <g className={className}>
      <line x1={sx(from)} x2={sx(to)} y1={y} y2={y} />
      <line x1={sx(from)} x2={sx(from)} y1={y - 4} y2={y + 4} />
      <line x1={sx(to)} x2={sx(to)} y1={y - 4} y2={y + 4} />
    </g>
  );
}

/**
 * Microconstituent vs phase, for any eutectic or eutectoid system.
 *
 * This panel used to exist for Fe–C alone. The distinction it draws — what you
 * see down a microscope against what the alloy is made of — is the single most
 * reliable exam trap in eutectic systems, and students who have understood
 * pearlite-versus-ferrite routinely fail to transfer it to Pb–Sn because the
 * two are taught with different vocabulary. Showing the same construction on
 * both diagrams is what makes the transfer happen.
 */
function MicroPanel({
  micro, x, unit,
}: {
  micro: MicroconstituentResult;
  x: number;
  unit: string;
}) {
  const inv = micro.invariant;
  const mixture = inv.microconstituent ?? `${inv.type === 'eutectoid' ? 'Eutectoid' : 'Eutectic'} constituent`;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="density-box">
      <h3>Microstructure just below {inv.T} °C</h3>
      <table className="detail-props">
        <tbody>
          <tr>
            <th scope="row">Classification</th>
            <td>{micro.kind}</td>
          </tr>
          {micro.primary && (
            <tr>
              <th scope="row">Primary phase</th>
              <td>
                {micro.primary} at {micro.primaryComposition} {unit}
              </td>
            </tr>
          )}
          <tr>
            <th scope="row">{mixture}</th>
            <td>{pct(micro.eutecticFraction)}</td>
          </tr>
          {micro.primary && (
            <tr>
              <th scope="row">Primary {micro.primary}</th>
              <td>{pct(micro.primaryFraction)}</td>
            </tr>
          )}
          <tr>
            <th scope="row">Total {micro.left.name}</th>
            <td>{pct(micro.left.fraction)}</td>
          </tr>
          <tr>
            <th scope="row">Total {micro.right.name}</th>
            <td>{pct(micro.right.fraction)}</td>
          </tr>
        </tbody>
      </table>

      <ul className="pd-lever-key">
        <li>
          <svg viewBox="0 0 24 6" aria-hidden="true" className="pd-lever-total">
            <line x1="1" x2="23" y1="3" y2="3" />
          </svg>
          <span>
            <strong>Phases</strong> — {micro.left.composition} to {micro.right.composition} {unit}
          </span>
        </li>
        <li>
          <svg viewBox="0 0 24 6" aria-hidden="true" className="pd-lever-micro">
            <line x1="1" x2="23" y1="3" y2="3" />
          </svg>
          <span>
            <strong>Constituents</strong> —{' '}
            {micro.primary === micro.right.name
              ? `${inv.x} to ${micro.right.composition}`
              : `${micro.left.composition} to ${inv.x}`}{' '}
            {unit}
          </span>
        </li>
      </ul>

      <p className="density-note">
        Both splits are lever rules, taken over <em>different segments of the same tie line</em> —
        drawn on the isotherm above. The phase split runs the whole way,{' '}
        {micro.left.composition} to {micro.right.composition} {unit}; the constituent split stops at
        the invariant composition, {inv.x} {unit}. At {x.toFixed(2)} {unit} they give{' '}
        {micro.primary
          ? `${pct(micro.primaryFraction)} primary ${micro.primary} against ${pct(micro.left.name === micro.primary ? micro.left.fraction : micro.right.fraction)} total ${micro.primary}`
          : 'no primary phase at all'}
        .
      </p>
      <p className="density-note">
        <strong>Microconstituent</strong> fractions describe what you see under a microscope;{' '}
        <strong>phase</strong> fractions describe what the alloy is made of. The {mixture.toLowerCase()} is
        not a phase — it is a two-phase lamellar mixture, so its {micro.left.name} counts toward the
        total as well.
      </p>
    </div>
  );
}

function renderNote(system: PhaseSystem) {
  // The notes carry **bold** spans; render them without a markdown dependency.
  return system.note.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

function tickValues(min: number, max: number): number[] {
  const span = max - min;
  const raw = span / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
    out.push(Math.round(v * 1000) / 1000);
  }
  return out;
}

export { EUTECTOID_X };
