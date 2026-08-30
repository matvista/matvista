import { useMemo, useState } from 'react';
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
  equalDtCurve,
  equalDtOptions,
  siteDensity,
  vacancyFraction,
  type DiffusionSystem,
} from '../diffusion/model';
import { prefersReducedMotion } from '../motion';
import { CrystalScene } from './CrystalScene';

const K = 273.15;

/** Slider bounds, hoisted so the equal-Dt panel can offer only reachable settings. */
const TEMP_MIN = 400;
const TEMP_MAX = 1200;
const HOURS_MIN = 0.5;
const HOURS_MAX = 40;
const HOURS_STEP = 0.5;

export function DefectsDiffusion() {
  const [structureId, setStructureId] = useRouteString('s', 'fcc');
  const [defect, setDefect] = useRouteEnum<DefectKind>('d', 'vacancy', DEFECT_KINDS);
  const [vacancyT, setVacancyT] = useRouteNumber('vacT', 1000, 20, 1080);
  const [Qv, setQv] = useRouteNumber('Qv', 0.9, 0.5, 2);
  // A cell that spins on its own is exactly what "reduce motion" is asking us
  // not to do. There is a checkbox either way, so this only sets the default.
  const [autoRotate, setAutoRotate] = useState(!prefersReducedMotion());

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

        {/* showVoids is false here deliberately: this view is about point
            defects, and the interstitial overlay belongs to Crystal
            Structures, where it would not collide with the defect markers. */}
        <CrystalScene
          structure={structure}
          mode="ball"
          showCell
          showBonds={false}
          showCoordination={false}
          defect={defect}
          showVoids={false}
          autoRotate={autoRotate}
        />

        <div className="crystal-checks">
          <label>
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
            />
            Rotate
          </label>
          <span className="drag-hint">Drag to rotate · scroll to zoom</span>
        </div>

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

/**
 * Decade labels for the log-time axis. The range can span seven decades — the
 * span is the lesson — so past 10³ the labels go superscript rather than
 * running off the left of the plot, which is what "1000000 h" did.
 */
const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

function hourLabel(e: number): string {
  if (e < 0) return `${(10 ** e).toFixed(-e)} h`;
  if (e <= 3) return `${10 ** e} h`;
  return `10${String(e).split('').map((d) => SUPERSCRIPT[+d]).join('')} h`;
}

/**
 * M2 — every (temperature, time) pair that produces the same profile.
 *
 * Fick's second law fixes the profile through the single group x/2√(Dt), so a
 * concentration at a depth demands a value of **Dt**, not of D and not of t.
 * The consequence — 950 °C for 5 h and 1050 °C for 1 h 40 min are the same
 * treatment — is what students almost never extract from the erf solution, and
 * it is invisible while the two sliders are only ever moved one at a time.
 *
 * (This line used to say 1.5 h and call it an identity. 1.5 h is the *snapped*
 * value the chip sets, not the equivalence: with the shipped Qd,
 * D(1050)/D(950) = 3.0055, so the equal-Dt time is 1.6636 h and 1.5 h is
 * 9.8% short in Dt — a 5.0% shallower case. The snap is disclosed to the
 * reader below; it is not what makes the two treatments equal.)
 *
 * The target is the reader's own current setting: the depth at which carbon
 * reaches the case-hardening threshold right now. So the curve passes through
 * the point on screen by construction, and moving any slider redefines it.
 *
 * **Not a drag control.** The plan asked for dragging along the curve with the
 * sliders following. The chart is a figure and the equivalent settings are
 * buttons instead: a pointer-only locus would repeat the WCAG 2.1.1 failure
 * iteration 12 fixed in the phase diagram, and buttons reach the same
 * settings from a keyboard with no new interaction model to make accessible.
 */
function EqualDtPanel({
  sys, target, depth, C0, Cs, tempC, hours, setTempC, setHours,
}: {
  sys: DiffusionSystem;
  target: number;
  depth: number | null;
  C0: number;
  Cs: number;
  tempC: number;
  hours: number;
  setTempC: (v: number) => void;
  setHours: (v: number) => void;
}) {
  const curve = useMemo(
    () => (depth == null ? null : equalDtCurve(sys, target, depth, C0, Cs, TEMP_MIN, TEMP_MAX)),
    [sys, target, depth, C0, Cs],
  );

  /**
   * Round temperatures whose required time the time slider can actually
   * express. Swept from `TEMP_MIN`, not from 500: the temperature slider starts
   * at 400, and starting the chips higher left a reader at the cold end of the
   * curve with an empty list under a sentence promising equivalents.
   */
  const options = useMemo(
    () =>
      curve
        ? equalDtOptions(sys, curve.dt, TEMP_MIN, TEMP_MAX, 50, HOURS_MIN, HOURS_MAX)
        : [],
    [curve, sys],
  );

  if (depth == null || !curve) {
    return (
      <div className="dd-equaldt">
        <h3>Equivalent treatments</h3>
        <p className="density-note">
          No equal-Dt curve here: the surface is held at {Cs.toFixed(2)} wt%, so{' '}
          {target.toFixed(2)} wt% is never reached at any depth, at any temperature, for any
          length of time. There is nothing to be equivalent to — which is why this panel is
          absent rather than showing zeros.
        </p>
      </div>
    );
  }

  const W = 560;
  const H = 210;
  const PAD = { l: 54, r: 20, t: 12, b: 42 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const logs = curve.points.map((p) => Math.log10(p.seconds / 3600));
  const loLog = Math.floor(Math.min(...logs));
  const hiLog = Math.ceil(Math.max(...logs));
  const sx = (T: number) => PAD.l + ((T - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * plotW;
  const sy = (h: number) =>
    PAD.t + plotH - ((Math.log10(h) - loLog) / (hiLog - loLog)) * plotH;
  const path = curve.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.tempC)},${sy(p.seconds / 3600)}`)
    .join(' ');
  const decades: number[] = [];
  for (let e = loLog; e <= hiLog; e++) decades.push(e);

  return (
    <div className="dd-equaldt">
      <h3>Equivalent treatments — same Dt, same profile</h3>
      <p className="density-eq">
        x / 2√(Dt) fixed ⟹ Dt = {curve.dt.toExponential(2)} m² · · · t = Dt / D(T)
      </p>

      <svg
        className="dd-plot"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Every temperature and time reaching ${target} wt% at ${(depth * 1000).toFixed(2)} millimetres, on a logarithmic time axis`}
      >
        {decades.map((e) => (
          <g key={e}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(10 ** e)} y2={sy(10 ** e)} className="dd-grid" />
            <text x={PAD.l - 8} y={sy(10 ** e) + 4} className="dd-tick" textAnchor="end">
              {hourLabel(e)}
            </text>
          </g>
        ))}
        <path d={path} className="dd-line" />
        <circle cx={sx(tempC)} cy={sy(hours)} r={5} className="dd-now" />
        <text
          x={sx(tempC) + (tempC > (TEMP_MIN + TEMP_MAX) / 2 ? -8 : 8)}
          y={sy(hours) - 8}
          className="dd-marker-label"
          textAnchor={tempC > (TEMP_MIN + TEMP_MAX) / 2 ? 'end' : 'start'}
        >
          you are here
        </text>
        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
        {[400, 600, 800, 1000, 1200].map((T) => (
          <text key={T} x={sx(T)} y={H - 22} className="dd-tick" textAnchor="middle">
            {T}
          </text>
        ))}
        <text x={W / 2} y={H - 6} className="dd-tick" textAnchor="middle">
          temperature (°C)
        </text>
      </svg>

      <p className="density-note">
        Holding {target.toFixed(2)} wt% at {(depth * 1000).toFixed(2)} mm — the case depth the
        sliders above currently produce — takes {hours.toFixed(1)} h at {tempC} °C. Every point on
        that line is the same treatment
        {options.length > 0 ? ':' : ', but none of it is reachable from here:'}
      </p>

      {/* Unreachable from the three sliders as they stand — `model.test.ts`
          sweeps all 45,360 of their states and finds none — but the sentence
          above promises equivalents unconditionally, and the promise should
          not be able to dangle if a bound ever moves. */}
      {options.length === 0 && (
        <p className="density-note">
          The line is real and the equivalence holds along all of it — this treatment simply has no
          equivalent the two sliders above can be set to. Every temperature between{' '}
          {TEMP_MIN} and {TEMP_MAX} °C on it wants a time outside {HOURS_MIN}–{HOURS_MAX} h. Raise
          the temperature or lengthen the hold and the equivalents come back.
        </p>
      )}

      <div className="mi-family-list">
        {options.map((o) => {
          const snapped = Math.round(o.hours / HOURS_STEP) * HOURS_STEP;
          return (
            <button
              key={o.tempC}
              aria-pressed={o.tempC === tempC}
              className={`mi-chip ${o.tempC === tempC ? 'mi-chip-on' : ''}`}
              onClick={() => {
                setTempC(o.tempC);
                setHours(Math.min(HOURS_MAX, Math.max(HOURS_MIN, snapped)));
              }}
            >
              {o.tempC} °C · {o.hours < 10 ? o.hours.toFixed(1) : o.hours.toFixed(0)} h
            </button>
          );
        })}
      </div>

      <p className="density-note">
        Clicking one sets both sliders at once. The time slider steps in {HOURS_STEP} h, so the
        case depth shifts a little from the figure on the chip — the setting is snapped, the curve
        is not. The line is steep because D is <em>exponential</em> in temperature while depth
        grows only as √t: that is the same claim the paragraph below makes in words, drawn. Buying
        an hour back costs very little heat, and buying a day back costs almost none.
      </p>
    </div>
  );
}

function DiffusionPanel() {
  // Distinct keys from the vacancy panel above: both live in this one module,
  // so they share a query string.
  const [sysId, setSysId] = useRouteString('sys', 'c-fe-fcc');
  const [tempC, setTempC] = useRouteNumber('difT', 950, TEMP_MIN, TEMP_MAX);
  const [hours, setHours] = useRouteNumber('h', 5, HOURS_MIN, HOURS_MAX);
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

      <EqualDtPanel
        sys={sys}
        target={caseTarget}
        depth={caseDepth}
        C0={C0}
        Cs={Cs}
        tempC={tempC}
        hours={hours}
        setTempC={setTempC}
        setHours={setHours}
      />

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
