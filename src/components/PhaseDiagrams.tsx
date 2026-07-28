import { useMemo, useRef, useState } from 'react';
import {
  EUTECTOID_X,
  FERRITE_MAX,
  GAMMA_MAX,
  PHASE_SYSTEMS,
  steelMicrostructure,
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

export function PhaseDiagrams() {
  const [systemId, setSystemId] = useState('fe-c');
  const system = PHASE_SYSTEMS.find((s) => s.id === systemId) ?? PHASE_SYSTEMS[2];

  // Point of interest, in diagram units. Defaults to a hypoeutectoid steel.
  const [point, setPoint] = useState<{ x: number; T: number }>({ x: 0.4, T: 650 });
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

  const steel =
    system.id === 'fe-c' && clamped.x >= FERRITE_MAX && clamped.x <= GAMMA_MAX
      ? steelMicrostructure(clamped.x)
      : null;

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
          <span className="drag-hint">Click or drag anywhere on the diagram</span>
        </div>

        <svg
          ref={svgRef}
          className="ss-plot pd-plot"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${system.name} phase diagram`}
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

      <aside className="detail">
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

        {steel && (
          <div className="density-box">
            <h3>Microstructure below 727 °C</h3>
            <table className="detail-props">
              <tbody>
                <tr>
                  <th scope="row">Classification</th>
                  <td>{steel.kind}</td>
                </tr>
                {steel.proeutectoid && (
                  <tr>
                    <th scope="row">Proeutectoid phase</th>
                    <td>{steel.proeutectoid}</td>
                  </tr>
                )}
                <tr>
                  <th scope="row">Pearlite</th>
                  <td>{(steel.pearlite * 100).toFixed(1)}%</td>
                </tr>
                {steel.proeutectoid && (
                  <tr>
                    <th scope="row">Proeutectoid</th>
                    <td>{(steel.proeutectoidFraction * 100).toFixed(1)}%</td>
                  </tr>
                )}
                <tr>
                  <th scope="row">Total α (ferrite)</th>
                  <td>{(steel.totalFerrite * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <th scope="row">Total Fe₃C</th>
                  <td>{(steel.totalCementite * 100).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
            <p className="density-note">
              Note the two sets of numbers differ. <strong>Microconstituent</strong> fractions
              (pearlite vs proeutectoid) describe what you see under a microscope;{' '}
              <strong>phase</strong> fractions (total ferrite vs cementite) describe what the alloy
              is made of. Pearlite is not a phase — it is a two-phase lamellar mixture, so its
              ferrite counts toward the total.
            </p>
          </div>
        )}
      </aside>
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
