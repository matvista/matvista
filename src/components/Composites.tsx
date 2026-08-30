import { Fragment } from 'react';
import { useRouteEnum, useRouteNumber } from '../useRoute';
import { FIBRES, MATRICES, agreement } from '../composite/materials';
import {
  ORIENTATIONS,
  criticalLength,
  discontinuousStrength,
  fibreLoadFraction,
  longitudinalModulus,
  longitudinalStrength,
  matrixStressAtFibreFailure,
  mixtureDensity,
  orientationModulus,
  transverseModulus,
} from '../composite/model';
import type { OrientationId } from '../composite/model';
import { INDICES, SELECTION_MATERIALS, indexValue } from '../selection/materials';

const W = 660;
const H = 400;
const PAD = { l: 62, r: 24, t: 20, b: 48 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

const FIBRE_IDS = FIBRES.map((f) => f.id);
const MATRIX_IDS = MATRICES.map((m) => m.id);
const ORIENTATION_IDS = ORIENTATIONS.map((o) => o.id);

type Panel = 'mixture' | 'strength' | 'short';
const PANELS: Panel[] = ['mixture', 'strength', 'short'];
const PANEL_LABEL: Record<Panel, string> = {
  mixture: 'Rule of mixtures',
  strength: 'Strength, and its ceiling',
  short: 'Short fibres',
};

export function Composites() {
  const [panel, setPanel] = useRouteEnum<Panel>('panel', 'mixture', PANELS);
  return (
    <div className="fa-wrap">
      <div className="fa-tabs" role="tablist" aria-label="Composites topic">
        {PANELS.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={panel === p}
            className={`toggle ${panel === p ? 'toggle-on' : ''}`}
            onClick={() => setPanel(p)}
          >
            {PANEL_LABEL[p]}
          </button>
        ))}
      </div>
      {panel === 'mixture' && <MixturePanel />}
      {panel === 'strength' && <StrengthPanel />}
      {panel === 'short' && <ShortFibrePanel />}
    </div>
  );
}

/** The two selectors and the volume fraction, shared by all three panels. */
function useLayup() {
  const [fibreId, setFibreId] = useRouteEnum('f', 'e-glass', FIBRE_IDS);
  const [matrixId, setMatrixId] = useRouteEnum('m', 'epoxy', MATRIX_IDS);
  const [vf, setVf] = useRouteNumber('vf', 0.6, 0, 0.8);
  const fibre = FIBRES.find((x) => x.id === fibreId)!;
  const matrix = MATRICES.find((x) => x.id === matrixId)!;
  return { fibre, matrix, vf, setFibreId, setMatrixId, setVf };
}

function LayupControls({
  fibreId, matrixId, vf, setFibreId, setMatrixId, setVf,
}: {
  fibreId: string; matrixId: string; vf: number;
  setFibreId: (v: string) => void; setMatrixId: (v: string) => void; setVf: (v: number) => void;
}) {
  return (
    <>
      <div className="crystal-controls">
        <select value={fibreId} onChange={(e) => setFibreId(e.target.value)} aria-label="Fibre">
          {FIBRES.map((f) => (<option key={f.id} value={f.id}>{f.label}</option>))}
        </select>
        <select value={matrixId} onChange={(e) => setMatrixId(e.target.value)} aria-label="Matrix">
          {MATRICES.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
        </select>
      </div>
      <div className="fa-sliders">
        {/* Stops at 0.8. Above roughly 0.7 the fibres cannot be wetted out and
            the laminate is voids, so the range is the process window rather
            than the arithmetic's domain — the formulas run happily to 1.0 and
            would be describing a material nobody can lay up. */}
        <Slider label="Fibre volume fraction Vf" unit="" value={vf} min={0} max={0.8} step={0.01}
          onChange={setVf} display={vf.toFixed(2)} />
      </div>
    </>
  );
}

/* =============================================================== mixture == */

function MixturePanel() {
  const { fibre, matrix, vf, setFibreId, setMatrixId, setVf } = useLayup();
  const [orientation, setOrientation] = useRouteEnum<OrientationId>('o', 'aligned', ORIENTATION_IDS);
  const k = ORIENTATIONS.find((o) => o.id === orientation)!.k;

  const upper = longitudinalModulus(fibre, matrix, vf);
  const lower = transverseModulus(fibre, matrix, vf);
  const oriented = orientationModulus(fibre, matrix, vf, k);
  const density = mixtureDensity(fibre, matrix, vf);
  const fibreLoad = fibreLoadFraction(fibre, matrix, vf);

  // Fixed to the fibre's own modulus so the curve does not rescale as the
  // slider moves: the shape of the two bounds is the lesson, and a y-axis that
  // followed the point would flatten it out of existence.
  const eMax = fibre.modulus;
  const sx = (v: number) => PAD.l + v * plotW;
  const sy = (e: number) => PAD.t + plotH - (e / eMax) * plotH;

  const curve = (fn: (v: number) => number): string =>
    Array.from({ length: 101 }, (_, i) => {
      const v = i / 100;
      return `${i === 0 ? 'M' : 'L'}${sx(v).toFixed(1)},${sy(fn(v)).toFixed(1)}`;
    }).join('');

  // The composite as a point among the 54, by the same index the Ashby guide
  // line ranks with. Strength is the upper bound, and is labelled as one there.
  const built = {
    name: `${fibre.label}–${matrix.label}`,
    cls: 'composite' as const,
    density,
    modulus: upper,
    strength: longitudinalStrength(fibre, matrix, vf),
  };
  const idx = INDICES.find((i) => i.id === 'e12-rho')!;
  const mine = indexValue(built, idx);
  const beaten = SELECTION_MATERIALS.filter((m) => indexValue(m, idx) < mine).length;

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <LayupControls
          fibreId={fibre.id} matrixId={matrix.id} vf={vf}
          setFibreId={setFibreId} setMatrixId={setMatrixId} setVf={setVf}
        />
        <div className="crystal-controls">
          {ORIENTATIONS.map((o) => (
            <button
              key={o.id}
              className={`toggle ${orientation === o.id ? 'toggle-on' : ''}`}
              aria-pressed={orientation === o.id}
              onClick={() => setOrientation(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Modulus against fibre volume fraction for ${fibre.label} in ${matrix.label}`}>
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l + plotW} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />

          <path d={curve((v) => longitudinalModulus(fibre, matrix, v))} className="cp-upper" fill="none" />
          <path d={curve((v) => transverseModulus(fibre, matrix, v))} className="cp-lower" fill="none" />
          {k !== 1 && (
            <path d={curve((v) => orientationModulus(fibre, matrix, v, k))} className="cp-oriented" fill="none" />
          )}

          <circle cx={sx(vf)} cy={sy(upper)} r={5} className="cp-point-upper" />
          <circle cx={sx(vf)} cy={sy(lower)} r={5} className="cp-point-lower" />
          <line x1={sx(vf)} x2={sx(vf)} y1={PAD.t} y2={PAD.t + plotH} className="cp-vline" />

          <text x={sx(0.5)} y={sy(longitudinalModulus(fibre, matrix, 0.5)) - 10} className="co-pick-label"
            textAnchor="middle">isostrain — loaded along the fibres</text>
          <text x={sx(0.72)} y={sy(transverseModulus(fibre, matrix, 0.72)) + 18} className="co-pick-label"
            textAnchor="middle">isostress — loaded across them</text>

          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <text key={v} x={sx(v)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">
              {v.toFixed(2)}
            </text>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
            <text key={frac} x={PAD.l - 8} y={sy(frac * eMax) + 4} className="dd-tick" textAnchor="end">
              {(frac * eMax).toFixed(0)}
            </text>
          ))}
          <text x={sx(0.5)} y={H - 8} className="dd-tick" textAnchor="middle">fibre volume fraction Vf</text>
          <text x={18} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 18 ${PAD.t + plotH / 2})`}>modulus of elasticity (GPa)</text>
        </svg>

        <p className="ht-caveat">
          <strong>{fibre.isotropic ? 'Both curves are bounds.' : 'The lower curve is a floor, not a prediction.'}</strong>{' '}
          {fibre.isotropic
            ? `Glass is isotropic, so the isostress expression is a fair estimate of the transverse modulus as well as a bound on it.`
            : `${fibre.label} is strongly anisotropic — its modulus across the filament is a small fraction of the ${fibre.modulus} GPa along it — and the isostress expression is given the axial value because that is the only one tabulated. The real transverse modulus of such a laminate is well above this line. Use it as the floor it is.`}
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{fibre.label} in {matrix.label}</h2>
        <p className="detail-meta">{(vf * 100).toFixed(0)} vol% fibre, aligned continuous</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">E, along the fibres</th><td>{upper.toFixed(1)} GPa</td></tr>
            <tr><th scope="row">E, across them</th><td>{lower.toFixed(2)} GPa</td></tr>
            <tr><th scope="row">Anisotropy</th><td>{(upper / lower).toFixed(1)}×</td></tr>
            {k !== 1 && (
              <tr><th scope="row">E, {ORIENTATIONS.find((o) => o.id === orientation)!.label.toLowerCase()}</th>
                <td>{oriented.toFixed(1)} GPa</td></tr>
            )}
            <tr><th scope="row">Density</th><td>{density.toFixed(3)} g/cm³</td></tr>
            <tr><th scope="row">Load carried by fibres</th><td>{(fibreLoad * 100).toFixed(1)}%</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          The fibres are {(vf * 100).toFixed(0)}% of the volume and carry{' '}
          {(fibreLoad * 100).toFixed(0)}% of the load, because equal strain means the stiffer phase
          takes stress in proportion to its modulus. That is the whole mechanism: the matrix is
          there to hold the fibres apart, transfer load into them through shear, and keep them from
          buckling — not to carry the load itself.
        </p>

        {/* The loop into Ashby. Not a link with a claim attached: the number is
            computed here by the selection module's own `indexValue`. */}
        <p className="detail-summary">
          As a point on the <a href="#/selection">Ashby chart</a>, this layup has a specific
          stiffness E<sup>½</sup>/ρ of <strong>{mine.toFixed(2)}</strong>, which beats{' '}
          <strong>{beaten}</strong> of the {SELECTION_MATERIALS.length} materials plotted there.
          Density is the exact rule of mixtures — mass is conserved and volumes add — so this is
          the one composite property that is not a bound.
        </p>
      </aside>
    </div>
  );
}

/* ============================================================== strength == */

function StrengthPanel() {
  const { fibre, matrix, vf, setFibreId, setMatrixId, setVf } = useLayup();
  const bound = longitudinalStrength(fibre, matrix, vf);
  const sigmaM = matrixStressAtFibreFailure(fibre, matrix);
  const rows = agreement();

  const worst = Math.max(...rows.map((r) => r.strength.predicted));
  // 240, not 300: the label sits to the right of its own bar, and the longest
  // of them ran 1.8 units past the 660-wide viewBox at 300 — clipped, which is
  // the sort of thing that reads as fine on one dataset and truncates on the
  // next. The bars are a comparison with each other, so the absolute width is
  // free to give the labels room.
  const sw = (s: number) => (s / worst) * 240;

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <LayupControls
          fibreId={fibre.id} matrixId={matrix.id} vf={vf}
          setFibreId={setFibreId} setMatrixId={setMatrixId} setVf={setVf}
        />

        <h2 className="crystal-title">What the rule of mixtures predicts, against what was measured</h2>
        <p className="detail-summary">
          Appendix B tabulates the three bare fibres <em>and</em> three composites made from them at
          Vf = 0.60. Those are independent rows: the model links them. For modulus and density it
          lands within a few per cent. For strength it overshoots every one, in the same direction,
          by close to a factor of two.
        </p>

        <table className="detail-props cp-agreement">
          <thead>
            <tr><th scope="col">Composite</th><th scope="col">Property</th>
              <th scope="col">Rule of mixtures</th><th scope="col">Measured</th><th scope="col"></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.name}>
                <tr>
                  <th scope="row" rowSpan={2}>{r.name.replace(' (longitudinal)', '')}</th>
                  <td>E</td>
                  <td>{r.modulus.predicted.toFixed(1)} GPa</td>
                  <td>{r.modulus.measured} GPa</td>
                  <td className="err-ok">{((r.modulus.ratio - 1) * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>σ*</td>
                  <td>{r.strength.predicted.toFixed(0)} MPa</td>
                  <td>{r.strength.measured} MPa</td>
                  <td className="err-off">{r.strength.ratio.toFixed(2)}× high</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>

        <svg className="ht-plot" viewBox="0 0 660 210" role="img"
          aria-label="Predicted against measured longitudinal strength for three composites">
          {rows.map((r, i) => (
            <g key={r.name} transform={`translate(0 ${20 + i * 60})`}>
              <text x={0} y={14} className="dd-tick">{r.name.replace(' (longitudinal)', '')}</text>
              <rect x={230} y={2} width={sw(r.strength.predicted)} height={14} className="cp-bar-bound" />
              <rect x={230} y={20} width={sw(r.strength.measured)} height={14} className="cp-bar-real" />
              <text x={236 + sw(r.strength.predicted)} y={13} className="dd-tick">
                {r.strength.predicted.toFixed(0)} — rule of mixtures
              </text>
              <text x={236 + sw(r.strength.measured)} y={31} className="dd-tick">
                {r.strength.measured} MPa — measured
              </text>
            </g>
          ))}
        </svg>

        <p className="ht-caveat">
          <strong>Why the gap, and why it is not a bug in the formula.</strong> The σ*<sub>f</sub>
          {' '}the rule of mixtures wants is the strength of the fibre <em>in the composite</em>. What
          a property table gives is a pristine single filament tested in isolation. A fibre in a real
          laminate carries handling damage, a flaw distribution over its whole length rather than
          over a gauge length, and a stress concentration beside every neighbouring break. The
          stiffness rule needs no such correction because modulus is not flaw-controlled — which is
          exactly why the modulus column above agrees and this one does not.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{bound.toFixed(0)} MPa</h2>
        <p className="detail-meta">upper bound for {fibre.label} in {matrix.label} at Vf = {vf.toFixed(2)}</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">Fibre contribution</th><td>{(fibre.strength * vf).toFixed(0)} MPa</td></tr>
            <tr><th scope="row">Matrix contribution</th><td>{(sigmaM.stress * (1 - vf)).toFixed(0)} MPa</td></tr>
            <tr><th scope="row">σ′<sub>m</sub> at fibre failure</th><td>{sigmaM.stress.toFixed(0)} MPa</td></tr>
            <tr><th scope="row">Fibre failure strain</th><td>{(sigmaM.fibreFailureStrain * 100).toFixed(2)}%</td></tr>
          </tbody>
        </table>

        {sigmaM.matrixFailsFirst && (
          <p className="ht-caveat">
            <strong>The matrix does not survive the fibre.</strong> {fibre.label} fails at{' '}
            {(sigmaM.fibreFailureStrain * 100).toFixed(2)}% strain, and {matrix.label} at that strain
            would be carrying {(matrix.modulus * 1000 * sigmaM.fibreFailureStrain).toFixed(0)} MPa —
            past its own {matrix.strength} MPa. So σ′<sub>m</sub> is held at the matrix strength here
            rather than extrapolated past it. In a real laminate the matrix has cracked by then and
            the fibres carry on alone, which is one more reason the number above is a ceiling.
          </p>
        )}

        <p className="detail-summary">
          Use it as a ceiling and a comparison, not as a design allowable. What it is good for is
          the shape of the answer: strength scales with Vf almost linearly, the matrix term is
          nearly negligible at any useful fibre loading, and doubling the fibre fraction roughly
          doubles the strength — none of which the measured value contradicts.
        </p>
      </aside>
    </div>
  );
}

/* ================================================================= short == */

function ShortFibrePanel() {
  const { fibre, matrix, vf, setFibreId, setMatrixId, setVf } = useLayup();
  // Interfacial shear strength is a property of the *pair* and its sizing, not
  // of the fibre, so it is supplied rather than tabulated. 10–150 MPa spans
  // weak thermoplastic bonds to a well-coupled thermoset.
  const [tau, setTau] = useRouteNumber('tau', 75, 10, 150);
  const [lengthMm, setLengthMm] = useRouteNumber('l', 1, 0.01, 10);

  const lc = criticalLength(fibre.strength, fibre.diameter, tau);
  const result = discontinuousStrength(fibre, matrix, vf, lengthMm, fibre.diameter, tau);
  const continuous = longitudinalStrength(fibre, matrix, vf);

  // Log x: l/l_c spans three decades and the interesting behaviour is all in
  // the first one.
  const lMin = 0.01;
  const lMax = 10;
  const sx = (l: number) => PAD.l + (Math.log10(l / lMin) / Math.log10(lMax / lMin)) * plotW;
  const sy = (s: number) => PAD.t + plotH - (s / continuous) * plotH;

  const curve = Array.from({ length: 201 }, (_, i) => {
    const l = lMin * Math.pow(lMax / lMin, i / 200);
    const s = discontinuousStrength(fibre, matrix, vf, l, fibre.diameter, tau).strength;
    return `${i === 0 ? 'M' : 'L'}${sx(l).toFixed(1)},${sy(s).toFixed(1)}`;
  }).join('');

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <LayupControls
          fibreId={fibre.id} matrixId={matrix.id} vf={vf}
          setFibreId={setFibreId} setMatrixId={setMatrixId} setVf={setVf}
        />
        <div className="fa-sliders">
          <Slider label="Fibre length" unit="mm" value={lengthMm} min={0.01} max={10} step={0.01}
            onChange={setLengthMm} fixed={2} />
          <Slider label="Interfacial shear strength τc" unit="MPa" value={tau} min={10} max={150}
            step={1} onChange={setTau} fixed={0} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Strength against fibre length for ${fibre.label} in ${matrix.label}`}>
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l + plotW} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />

          <line x1={PAD.l} x2={PAD.l + plotW} y1={sy(continuous)} y2={sy(continuous)} className="cp-asymptote" />
          <text x={PAD.l + plotW} y={sy(continuous) - 6} className="co-pick-label" textAnchor="end">
            continuous-fibre ceiling, {continuous.toFixed(0)} MPa
          </text>

          <path d={curve} className="cp-upper" fill="none" />

          {lc >= lMin && lc <= lMax && (
            <>
              <line x1={sx(lc)} x2={sx(lc)} y1={PAD.t} y2={PAD.t + plotH} className="cp-vline" />
              <text x={sx(lc) + 6} y={PAD.t + 14} className="co-pick-label">
                l_c = {lc.toFixed(2)} mm
              </text>
            </>
          )}
          <circle cx={sx(lengthMm)} cy={sy(result.strength)} r={5} className="cp-point-upper" />

          {[0.01, 0.1, 1, 10].map((l) => (
            <text key={l} x={sx(l)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">{l}</text>
          ))}
          {[0, 0.5, 1].map((frac) => (
            <text key={frac} x={PAD.l - 8} y={sy(frac * continuous) + 4} className="dd-tick" textAnchor="end">
              {(frac * continuous).toFixed(0)}
            </text>
          ))}
          <text x={sx(0.3)} y={H - 8} className="dd-tick" textAnchor="middle">fibre length (mm, log scale)</text>
          <text x={18} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 18 ${PAD.t + plotH / 2})`}>longitudinal strength (MPa)</text>
        </svg>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{result.strength.toFixed(0)} MPa</h2>
        <p className="detail-meta">
          {result.regime === 'below' ? 'below the critical length' : 'above the critical length'}
        </p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">Critical length l_c</th><td>{lc.toFixed(3)} mm</td></tr>
            <tr><th scope="row">l / l_c</th><td>{(lengthMm / lc).toFixed(2)}</td></tr>
            <tr><th scope="row">Filament diameter</th><td>{(fibre.diameter * 1000).toFixed(0)} µm (nominal)</td></tr>
            <tr><th scope="row">Aspect ratio l/d</th><td>{(lengthMm / fibre.diameter).toFixed(0)}</td></tr>
            <tr><th scope="row">Fraction of the ceiling</th>
              <td>{((result.strength / continuous) * 100).toFixed(0)}%</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          {result.regime === 'below'
            ? `At ${lengthMm.toFixed(2)} mm the fibre is shorter than l_c, so the shear the interface can transfer over its length never loads it to its own ${fibre.strength} MPa. It pulls out instead of breaking, and the strength is set by τc and the length — not by how strong the fibre is. Making the fibre stronger here would change nothing.`
            : `At ${lengthMm.toFixed(2)} mm the fibre is ${(lengthMm / lc).toFixed(1)}× the critical length, so most of it reaches full stress and only the two ends are under-loaded. The shortfall against continuous fibre is l_c/2l — ${((lc / (2 * lengthMm)) * 100).toFixed(0)}% of the fibre contribution here.`}
        </p>

        <p className="ht-caveat">
          <strong>τc is yours to supply, and that is deliberate.</strong> Interfacial shear strength
          belongs to a fibre–matrix <em>pair</em>, to its sizing and to its cure — not to the fibre.
          There is no honest column for it in a fibre table, so this module asks for it rather than
          inventing one. The diameter above is nominal for the same reason: commercial fibre comes
          in a range, and l_c scales with it linearly.
        </p>
      </aside>
    </div>
  );
}

function Slider({
  label, unit, value, min, max, step, onChange, fixed = 0, display,
}: {
  label: string; unit: string; value: number; min: number; max: number;
  step: number; onChange: (v: number) => void; fixed?: number; display?: string;
}) {
  const shown = display ?? value.toFixed(fixed);
  return (
    <label className="fa-slider">
      <span>{label} <strong>{shown}</strong> {unit}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={display ? `${shown} ${unit}`.trim() : undefined}
        aria-label={`${label}${unit ? `, ${unit}` : ''}`} />
    </label>
  );
}
