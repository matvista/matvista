import { useMemo } from 'react';
import { useRouteEnum, useRouteNumber, useRouteString } from '../useRoute';
import { getStructure } from '../crystal/structures';
import { DEFECTS, getDefect, type DefectKind } from '../crystal/defects';

/** The kinds a URL may name, derived from the data so the two cannot drift. */
const DEFECT_KINDS: DefectKind[] = DEFECTS.map((d) => d.kind);
import {
  DIFFUSION_SYSTEMS,
  concentrationAt,
  depthForConcentration,
  diffusionCoefficient,
  siteDensity,
  vacancyFraction,
} from '../diffusion/model';
import { CrystalScene } from './CrystalScene';

const K = 273.15;

export function DefectsDiffusion() {
  const [structureId, setStructureId] = useRouteString('s', 'fcc');
  const [defect, setDefect] = useRouteEnum<DefectKind>('d', 'vacancy', DEFECT_KINDS);
  const [vacancyT, setVacancyT] = useRouteNumber('vacT', 1000, 20, 1080);
  const [Qv, setQv] = useRouteNumber('Qv', 0.9, 0.5, 2);

  const structure = getStructure(structureId);
  const defectDef = getDefect(defect);

  // Copper at 1000 °C — the worked example in Callister (N = 8.0 × 10²⁸ /m³).
  const N = siteDensity(8.4, 63.5);
  const fraction = vacancyFraction(Qv, vacancyT + K);
  const Nv = N * fraction;
  const oneIn = fraction > 0 ? 1 / fraction : Infinity;

  return (
    <div className="dd-layout">
      <section className="dd-block">
        <h2 className="dd-title">Point defects</h2>
        <div className="crystal-controls">
          <select
            value={structureId}
            onChange={(e) => setStructureId(e.target.value)}
            aria-label="Crystal structure"
          >
            <option value="fcc">Face-centred cubic</option>
            <option value="bcc">Body-centred cubic</option>
            <option value="sc">Simple cubic</option>
          </select>
          <select
            value={defect}
            onChange={(e) => setDefect(e.target.value as DefectKind)}
            aria-label="Defect type"
          >
            {DEFECTS.map((d) => (
              <option key={d.kind} value={d.kind}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <CrystalScene
          structure={structure}
          mode="ball"
          showCell
          showBonds={false}
          showCoordination={false}
          defect={defect}
        />

        <p className="dd-defect-cat">{defectDef.category}</p>
        <p className="trend-note">{defectDef.note}</p>
      </section>

      <section className="dd-block">
        <h2 className="dd-title">How many vacancies?</h2>
        <p className="density-eq">
          N<sub>v</sub> = N · exp(−Q<sub>v</sub> / kT)
        </p>

        <label className="dd-slider">
          <span>
            Temperature <strong>{vacancyT} °C</strong>
          </span>
          <input
            type="range"
            min={20}
            max={1080}
            step={10}
            value={vacancyT}
            onChange={(e) => setVacancyT(+e.target.value)}
          />
        </label>

        <label className="dd-slider">
          <span>
            Q<sub>v</sub> <strong>{Qv.toFixed(2)} eV/atom</strong>
          </span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={Qv}
            onChange={(e) => setQv(+e.target.value)}
          />
        </label>

        <table className="detail-props">
          <tbody>
            <tr>
              <th scope="row">Sites N (copper)</th>
              <td>{N.toExponential(1)} /m³</td>
            </tr>
            <tr>
              <th scope="row">Vacancy fraction</th>
              <td>{fraction.toExponential(2)}</td>
            </tr>
            <tr>
              <th scope="row">
                Vacancies N<sub>v</sub>
              </th>
              <td>{Nv.toExponential(2)} /m³</td>
            </tr>
            <tr>
              <th scope="row">That is 1 site in</th>
              <td>{oneIn > 1e12 ? oneIn.toExponential(1) : Math.round(oneIn).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        <p className="density-note">
          Drag the temperature. At room temperature vacancies are vanishingly rare; near copper’s
          melting point the fraction reaches order 10⁻⁴ — about 1 site in 10 000. That exponential
          is the reason nearly every rate process in materials science accelerates so sharply with
          temperature. Defaults are Callister’s worked example: copper, Q<sub>v</sub> = 0.9 eV/atom.
        </p>
      </section>

      <DiffusionPanel />
    </div>
  );
}

function DiffusionPanel() {
  // Distinct keys from the vacancy panel above: both live in this one module,
  // so they share a query string.
  const [sysId, setSysId] = useRouteString('sys', 'c-fe-fcc');
  const [tempC, setTempC] = useRouteNumber('difT', 950, 400, 1200);
  const [hours, setHours] = useRouteNumber('h', 5, 0.5, 40);
  const [Cs, setCs] = useRouteNumber('Cs', 1.2, 0.4, 1.6);
  const [C0, setC0] = useRouteNumber('C0', 0.2, 0, 0.4);

  const sys = DIFFUSION_SYSTEMS.find((s) => s.id === sysId) ?? DIFFUSION_SYSTEMS[1];
  const T = tempC + K;
  const D = diffusionCoefficient(sys, T);
  const t = hours * 3600;

  const MAX_DEPTH = 2e-3; // 2 mm
  const points = useMemo(() => {
    const out: { x: number; c: number }[] = [];
    for (let i = 0; i <= 120; i++) {
      const x = (MAX_DEPTH * i) / 120;
      out.push({ x, c: concentrationAt(x, t, D, C0, Cs) });
    }
    return out;
  }, [t, D, C0, Cs]);

  // Case depth: the classic engineering answer — where carbon reaches 0.5 wt%.
  const caseTarget = 0.5;
  const caseDepth = depthForConcentration(caseTarget, t, D, C0, Cs);

  const W = 560;
  const H = 220;
  const PAD = { l: 46, r: 16, t: 12, b: 34 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const yMax = Math.max(Cs, C0) * 1.08;
  const sx = (x: number) => PAD.l + (x / MAX_DEPTH) * plotW;
  const sy = (c: number) => PAD.t + plotH - (c / yMax) * plotH;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x)},${sy(p.c)}`).join(' ');
  const area = `${path} L${sx(MAX_DEPTH)},${sy(0)} L${sx(0)},${sy(0)} Z`;

  return (
    <section className="dd-block dd-wide">
      <h2 className="dd-title">Diffusion — case hardening a steel</h2>
      <p className="density-eq">
        C(x,t) = C₀ + (C<sub>s</sub> − C₀)·[1 − erf( x / 2√(Dt) )] · · · D = D₀·exp(−Q<sub>d</sub> / RT)
      </p>

      <div className="crystal-controls">
        <select value={sysId} onChange={(e) => setSysId(e.target.value)} aria-label="Diffusion system">
          {DIFFUSION_SYSTEMS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <span className={`badge-mech badge-${sys.mechanism}`}>{sys.mechanism} mechanism</span>
      </div>

      <div className="dd-controls-grid">
        <label className="dd-slider">
          <span>
            Temperature <strong>{tempC} °C</strong>
          </span>
          <input
            type="range"
            min={400}
            max={1200}
            step={10}
            value={tempC}
            onChange={(e) => setTempC(+e.target.value)}
          />
        </label>
        <label className="dd-slider">
          <span>
            Time <strong>{hours} h</strong>
          </span>
          <input
            type="range"
            min={0.5}
            max={40}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(+e.target.value)}
          />
        </label>
        <label className="dd-slider">
          <span>
            Surface C<sub>s</sub> <strong>{Cs.toFixed(2)} wt%</strong>
          </span>
          <input
            type="range"
            min={0.4}
            max={1.6}
            step={0.05}
            value={Cs}
            onChange={(e) => setCs(+e.target.value)}
          />
        </label>
        <label className="dd-slider">
          <span>
            Initial C₀ <strong>{C0.toFixed(2)} wt%</strong>
          </span>
          <input
            type="range"
            min={0}
            max={0.4}
            step={0.01}
            value={C0}
            onChange={(e) => setC0(+e.target.value)}
          />
        </label>
      </div>

      <svg className="dd-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Concentration versus depth">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={PAD.l}
            x2={W - PAD.r}
            y1={PAD.t + plotH * f}
            y2={PAD.t + plotH * f}
            className="dd-grid"
          />
        ))}
        <path d={area} className="dd-area" />
        <path d={path} className="dd-line" />

        {caseDepth && caseDepth < MAX_DEPTH && (
          <g>
            <line
              x1={sx(caseDepth)}
              x2={sx(caseDepth)}
              y1={PAD.t}
              y2={PAD.t + plotH}
              className="dd-marker"
            />
            <text x={sx(caseDepth) + 6} y={PAD.t + 14} className="dd-marker-label">
              case depth {(caseDepth * 1000).toFixed(2)} mm
            </text>
          </g>
        )}

        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
        <text x={PAD.l} y={H - 8} className="dd-tick">0</text>
        <text x={W - PAD.r} y={H - 8} className="dd-tick" textAnchor="end">
          2 mm depth
        </text>
        <text x={PAD.l - 8} y={PAD.t + 10} className="dd-tick" textAnchor="end">
          {yMax.toFixed(1)}
        </text>
        <text x={PAD.l - 8} y={PAD.t + plotH} className="dd-tick" textAnchor="end">
          0
        </text>
        <text x={12} y={PAD.t + plotH / 2} className="dd-tick" transform={`rotate(-90 12 ${PAD.t + plotH / 2})`} textAnchor="middle">
          wt% C
        </text>
      </svg>

      <table className="detail-props dd-results">
        <tbody>
          <tr>
            <th scope="row">D at {tempC} °C</th>
            <td>{D.toExponential(2)} m²/s</td>
          </tr>
          <tr>
            <th scope="row">√(Dt)</th>
            <td>{(Math.sqrt(D * t) * 1e6).toFixed(1)} µm</td>
          </tr>
          <tr>
            <th scope="row">Depth reaching {caseTarget} wt%</th>
            <td>{caseDepth ? `${(caseDepth * 1000).toFixed(3)} mm` : 'not reached'}</td>
          </tr>
          <tr>
            <th scope="row">Activation energy Q<sub>d</sub></th>
            <td>{(sys.Qd / 1000).toFixed(0)} kJ/mol</td>
          </tr>
        </tbody>
      </table>

      <p className="trend-note">{sys.note}</p>
      <p className="density-note">
        Two things to try. Drop the temperature by 100 °C and watch how much longer the same case
        depth takes — diffusion depends on temperature exponentially but on time only as √t, so
        heating is a far more powerful lever than waiting. Then switch from carbon in γ-iron to iron
        self-diffusion at the same temperature: the profile collapses to nothing, because the
        vacancy mechanism has roughly double the activation energy of the interstitial one.
      </p>
    </section>
  );
}
