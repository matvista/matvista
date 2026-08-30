import { useMemo, useState } from 'react';
import { useRouteEnum, useRouteNumber, useRouteString } from '../useRoute';
import {
  HARDNESS_SCALES,
  brinell,
  isFerrous,
  knoop,
  tensileFromBrinell,
  vickers,
  type HardnessScale,
} from '../mechanical/hardness';
import {
  MECH_MATERIALS,
  buildCurve,
  hallPetch,
  trueStrain,
  trueStress,
  type MechMaterial,
} from '../mechanical/materials';

const W = 720;
const H = 380;
const PAD = { l: 62, r: 20, t: 16, b: 46 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

/** Callister's 0.002 strain offset construction for yield strength. */
const OFFSET = 0.002;

export function StressStrain() {
  const [id, setId] = useRouteString('m', 'steel1020');
  const [compare, setCompare] = useState(false);
  const [showTrue, setShowTrue] = useState(false);
  const [showResilience, setShowResilience] = useState(true);
  const [zoomElastic, setZoomElastic] = useState(false);

  const material = MECH_MATERIALS.find((m) => m.id === id) ?? MECH_MATERIALS[5];
  const curve = useMemo(() => buildCurve(material), [material]);

  // Axes are shared across materials in compare mode so curves are comparable.
  // The elastic region is a sliver at full scale — yield strain is under 0.1%
  // against 25% total elongation — so the 0.2% offset construction and the
  // resilience area are unreadable unless the x-axis is rescaled.
  const xMax = compare
    ? Math.max(...MECH_MATERIALS.map((m) => m.elongation / 100))
    : zoomElastic
      ? Math.max(0.012, curve.yieldStrain * 6)
      : curve.fractureStrain;
  const yMax = compare
    ? Math.max(...MECH_MATERIALS.map((m) => m.uts)) * 1.08
    : zoomElastic
      ? material.yield * 1.6
      : material.uts * 1.15;

  const sx = (strain: number) => PAD.l + (strain / xMax) * plotW;
  const sy = (stress: number) => PAD.t + plotH - (stress / yMax) * plotH;

  const toPath = (pts: { strain: number; stress: number }[]) =>
    pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.strain).toFixed(1)},${sy(p.stress).toFixed(1)}`)
      .join(' ');

  const truePoints = useMemo(
    () =>
      curve.points
        .filter((p) => p.strain <= curve.utsStrain)
        .map((p) => ({
          strain: trueStrain(p.strain),
          stress: trueStress(p.stress, p.strain),
        })),
    [curve],
  );

  const E_MPa = material.E * 1000;
  // The offset line: same slope as the elastic region, shifted by 0.002 strain.
  const offsetLine = [
    { strain: OFFSET, stress: 0 },
    { strain: OFFSET + material.yield / E_MPa, stress: material.yield },
  ];

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Material">
            {MECH_MATERIALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <label className="ss-check">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
            Compare all
          </label>
          <label className="ss-check">
            <input
              type="checkbox"
              checked={showTrue}
              onChange={(e) => setShowTrue(e.target.checked)}
            />
            True stress–strain
          </label>
          <label className="ss-check">
            <input
              type="checkbox"
              checked={showResilience}
              onChange={(e) => setShowResilience(e.target.checked)}
            />
            Resilience
          </label>
          <label className="ss-check">
            <input
              type="checkbox"
              checked={zoomElastic}
              disabled={compare}
              onChange={(e) => setZoomElastic(e.target.checked)}
            />
            Zoom to elastic region
          </label>
        </div>

        <svg className="ss-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Engineering stress–strain curve">
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

          {compare &&
            MECH_MATERIALS.filter((m) => m.id !== material.id).map((m) => (
              <path key={m.id} d={toPath(buildCurve(m, 120).points)} className="ss-line-ghost" />
            ))}

          {showResilience && !compare && (
            <polygon
              points={`${sx(0)},${sy(0)} ${sx(curve.elasticYieldStrain)},${sy(material.yield)} ${sx(curve.elasticYieldStrain)},${sy(0)}`}
              className="ss-resilience"
            />
          )}

          {showTrue && !compare && <path d={toPath(truePoints)} className="ss-line-true" />}

          <path
            d={toPath(curve.points.filter((p) => p.strain <= xMax * 1.001))}
            className="ss-line"
          />

          {!compare && (
            <>
              <path d={toPath(offsetLine)} className="ss-offset" />
              <circle cx={sx(curve.yieldStrain)} cy={sy(material.yield)} r={4} className="ss-pt-yield" />
              {!zoomElastic && (
                <>
                  <circle cx={sx(curve.utsStrain)} cy={sy(material.uts)} r={4} className="ss-pt-uts" />
                  <circle
                    cx={sx(curve.fractureStrain)}
                    cy={sy(curve.fractureStress)}
                    r={4}
                    className="ss-pt-frac"
                  />
                  <text
                    x={sx(curve.utsStrain)}
                    y={sy(material.uts) - 10}
                    className="ss-label"
                    textAnchor="middle"
                  >
                    UTS {material.uts} MPa
                  </text>
                </>
              )}
              <text
                x={sx(curve.yieldStrain) + 8}
                y={sy(material.yield) + 14}
                className="ss-label-yield"
              >
                yield {material.yield} MPa
              </text>
              {!zoomElastic && (
                <text
                  x={sx(curve.fractureStrain)}
                  y={sy(curve.fractureStress) - 10}
                  className="ss-label"
                  textAnchor="end"
                >
                  fracture
                </text>
              )}
              {zoomElastic && (
                <text x={sx(OFFSET) + 4} y={PAD.t + plotH - 8} className="ss-label">
                  0.002 offset
                </text>
              )}
            </>
          )}

          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          <text x={PAD.l} y={H - 22} className="dd-tick">0</text>
          <text x={W - PAD.r} y={H - 22} className="dd-tick" textAnchor="end">
            {(xMax * 100).toFixed(xMax < 0.05 ? 1 : 0)}% strain
          </text>
          <text x={W / 2} y={H - 6} className="dd-tick" textAnchor="middle">
            engineering strain
          </text>
          <text x={PAD.l - 8} y={PAD.t + 10} className="dd-tick" textAnchor="end">
            {yMax.toFixed(0)}
          </text>
          <text x={PAD.l - 8} y={PAD.t + plotH} className="dd-tick" textAnchor="end">
            0
          </text>
          <text
            x={16}
            y={PAD.t + plotH / 2}
            className="dd-tick"
            transform={`rotate(-90 16 ${PAD.t + plotH / 2})`}
            textAnchor="middle"
          >
            engineering stress (MPa)
          </text>
        </svg>

        <p className="density-note">
          Curves are <strong>constructed</strong> to pass exactly through each material’s published
          E, yield, tensile strength and elongation (Callister tables 6.1 and 6.2); the shape
          between those anchors is an elastic → power-law-hardening → necking model. Treat the
          marked points as data and the line between them as interpolation.
        </p>
      </section>

      <MaterialReadout material={material} curve={curve} />

      <HallPetchPanel />
    </div>
  );
}

function MaterialReadout({
  material,
  curve,
}: {
  material: MechMaterial;
  curve: ReturnType<typeof buildCurve>;
}) {
  return (
    <aside className="detail">
      <h2 className="crystal-title">{material.name}</h2>
      <p className="detail-meta">Annealed · room temperature</p>

      <table className="detail-props">
        <tbody>
          <tr>
            <th scope="row">Modulus E</th>
            <td>{material.E} GPa</td>
          </tr>
          <tr>
            <th scope="row">Shear modulus G</th>
            <td>{material.G} GPa</td>
          </tr>
          <tr>
            <th scope="row">Poisson’s ratio ν</th>
            <td>{material.nu}</td>
          </tr>
          <tr>
            <th scope="row">Yield σ<sub>y</sub> (0.2% offset)</th>
            <td>{material.yield} MPa</td>
          </tr>
          <tr>
            <th scope="row">Tensile strength</th>
            <td>{material.uts} MPa</td>
          </tr>
          <tr>
            <th scope="row">Ductility %EL</th>
            <td>{material.elongation}%</td>
          </tr>
          <tr>
            <th scope="row">Elastic strain at σ<sub>y</sub></th>
            <td>{(curve.elasticYieldStrain * 100).toFixed(3)}%</td>
          </tr>
          <tr>
            <th scope="row">Resilience U<sub>r</sub></th>
            <td>{curve.resilience.toFixed(3)} MJ/m³</td>
          </tr>
          <tr>
            <th scope="row">Toughness (static)</th>
            <td>{curve.toughness.toFixed(0)} MJ/m³</td>
          </tr>
          <tr>
            <th scope="row">Working stress (N = 2)</th>
            <td>{(material.yield / 2).toFixed(0)} MPa</td>
          </tr>
        </tbody>
      </table>

      <p className="detail-summary">{material.note}</p>

      <p className="density-note">
        <strong>U<sub>r</sub> = σ<sub>y</sub>²/2E</strong> is the elastic energy a material stores
        and gives back — the spring criterion, so it rewards high strength and *low* stiffness.
        Toughness is the whole area under the curve, which needs strength <em>and</em> ductility
        together. The two rank materials quite differently: check titanium against brass.
      </p>
        {/* P2 — hardness, computed from the scale's own definition. */}
        <HardnessBox materialId={material.id} materialName={material.name} />

    </aside>
  );
}

function HallPetchPanel() {
  const [d, setD] = useRouteNumber('d', 0.05, 0.005, 0.2);
  const [sigma0, setSigma0] = useRouteNumber('s0', 70, 20, 200);
  const [ky, setKy] = useRouteNumber('ky', 23.4, 5, 40);

  const sy = hallPetch(d, sigma0, ky);

  const W2 = 720;
  const H2 = 200;
  const P = { l: 62, r: 20, t: 14, b: 40 };
  const pw = W2 - P.l - P.r;
  const ph = H2 - P.t - P.b;
  const dMin = 0.005;
  const dMax = 0.2;
  const yTop = hallPetch(dMin, sigma0, ky) * 1.1;

  const pts: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const dd = dMin + ((dMax - dMin) * i) / 100;
    const x = P.l + ((dd - dMin) / (dMax - dMin)) * pw;
    const y = P.t + ph - (hallPetch(dd, sigma0, ky) / yTop) * ph;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const markX = P.l + ((d - dMin) / (dMax - dMin)) * pw;
  const markY = P.t + ph - (sy / yTop) * ph;

  return (
    <section className="dd-block dd-wide">
      <h2 className="dd-title">Strengthening — why fine grains are stronger</h2>
      <p className="density-eq">
        σ<sub>y</sub> = σ<sub>0</sub> + k<sub>y</sub> · d<sup>−1/2</sup>
      </p>

      <div className="dd-controls-grid">
        <label className="dd-slider">
          <span>
            Grain diameter d <strong>{d.toFixed(3)} mm</strong>
          </span>
          <input
            type="range"
            min={0.005}
            max={0.2}
            step={0.005}
            value={d}
            onChange={(e) => setD(+e.target.value)}
          />
        </label>
        <label className="dd-slider">
          <span>
            σ<sub>0</sub> <strong>{sigma0} MPa</strong>
          </span>
          <input
            type="range"
            min={20}
            max={200}
            step={5}
            value={sigma0}
            onChange={(e) => setSigma0(+e.target.value)}
          />
        </label>
        <label className="dd-slider">
          <span>
            k<sub>y</sub> <strong>{ky.toFixed(1)} MPa·mm<sup>1/2</sup></strong>
          </span>
          <input
            type="range"
            min={5}
            max={40}
            step={0.5}
            value={ky}
            onChange={(e) => setKy(+e.target.value)}
          />
        </label>
        <div className="dd-slider">
          <span>
            Yield strength <strong className="hp-out">{sy.toFixed(0)} MPa</strong>
          </span>
        </div>
      </div>

      <svg className="ss-plot" viewBox={`0 0 ${W2} ${H2}`} role="img" aria-label="Yield strength versus grain size">
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={P.l} x2={W2 - P.r} y1={P.t + ph * f} y2={P.t + ph * f} className="dd-grid" />
        ))}
        <path d={pts.join(' ')} className="ss-line" />
        <line x1={markX} x2={markX} y1={P.t} y2={P.t + ph} className="dd-marker" />
        <circle cx={markX} cy={markY} r={4} className="ss-pt-yield" />
        <line x1={P.l} x2={W2 - P.r} y1={P.t + ph} y2={P.t + ph} className="dd-axis" />
        <line x1={P.l} x2={P.l} y1={P.t} y2={P.t + ph} className="dd-axis" />
        <text x={P.l} y={H2 - 18} className="dd-tick">fine ({dMin} mm)</text>
        <text x={W2 - P.r} y={H2 - 18} className="dd-tick" textAnchor="end">
          coarse ({dMax} mm)
        </text>
        <text x={W2 / 2} y={H2 - 4} className="dd-tick" textAnchor="middle">
          grain diameter
        </text>
        <text x={P.l - 8} y={P.t + 10} className="dd-tick" textAnchor="end">
          {yTop.toFixed(0)}
        </text>
        <text x={P.l - 8} y={P.t + ph} className="dd-tick" textAnchor="end">
          0
        </text>
      </svg>

      <p className="trend-note">
        Grain boundaries obstruct dislocations: a dislocation crossing into a neighbouring grain
        must change direction to follow a differently oriented slip plane, and the disordered
        boundary itself is a barrier. More boundary area therefore means more obstruction, so a
        fine-grained metal is stronger — and unusually, <em>tougher too</em>, which makes grain
        refinement the one strengthening mechanism that does not cost ductility.
      </p>
      <p className="density-note">
        Defaults are typical literature values for low-carbon steel (σ<sub>0</sub> ≈ 70 MPa,
        k<sub>y</sub> ≈ 0.74 MPa·m<sup>1/2</sup> = 23.4 MPa·mm<sup>1/2</sup>), not from Callister —
        his illustration uses 70Cu–30Zn brass. The constants are material-specific; the
        d<sup>−1/2</sup> shape is the general result. Note the relation fails for both very coarse
        and extremely fine grains.
      </p>
    </section>
  );
}

/* ============================================================== hardness == */

const INDENTER_COLOR = '#4a3aa7';

/**
 * P2 — hardness, and what it does and does not convert to.
 *
 * Each scale is computed from its own definition on the reader's inputs, so
 * nothing here is a lookup. Cross-scale conversion is *not* offered, and the
 * panel says why rather than leaving it as an absence — the misconception this
 * exists to correct is that a conversion table is physics.
 */
function HardnessBox({ materialId, materialName }: { materialId: string; materialName: string }) {
  const [scaleId, setScaleId] = useRouteEnum<HardnessScale>('hs', 'brinell', [
    'brinell',
    'vickers',
    'knoop',
  ]);
  const [loadKgf, setLoadKgf] = useRouteNumber('hl', 500, 1, 3000);
  const [sizeMm, setSizeMm] = useRouteNumber('hd', 3, 0.05, 9);

  const scale = HARDNESS_SCALES.find((s) => s.id === scaleId)!;
  const value =
    scaleId === 'brinell'
      ? brinell(loadKgf, 10, sizeMm)
      : scaleId === 'vickers'
        ? vickers(loadKgf, sizeMm)
        : knoop(loadKgf, sizeMm);

  const ferrous = isFerrous(materialId);
  // Derived in one step: an intermediate `hb` that was null off the Brinell
  // scale duplicated the guard the row below already applies, so mutating it
  // changed nothing a reader could see.
  const ts =
    scaleId === 'brinell' && value != null ? tensileFromBrinell(value, ferrous) : null;

  // Indenter sketches, drawn to the same scale so the shapes can be compared.
  const S = 120;
  const sketch =
    scaleId === 'brinell' ? (
      <circle cx={S / 2} cy={S / 2 - 10} r={34} fill="none" stroke={INDENTER_COLOR} strokeWidth={2} />
    ) : scaleId === 'vickers' ? (
      <polygon points={`${S / 2},${S / 2 + 26} ${S / 2 - 30},${S / 2 - 34} ${S / 2 + 30},${S / 2 - 34}`}
        fill="none" stroke={INDENTER_COLOR} strokeWidth={2} />
    ) : (
      <polygon points={`${S / 2},${S / 2 + 26} ${S / 2 - 46},${S / 2 - 14} ${S / 2 + 46},${S / 2 - 14}`}
        fill="none" stroke={INDENTER_COLOR} strokeWidth={2} />
    );

  return (
    <div className="density-box">
      <h3>Hardness</h3>
      <div className="fa-controls">
        <select value={scaleId} onChange={(e) => setScaleId(e.target.value as HardnessScale)}
          aria-label="Hardness scale">
          {HARDNESS_SCALES.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.symbol})</option>
          ))}
        </select>
        <label className="fa-slider">
          <span>Load <strong>{loadKgf.toFixed(0)}</strong> kgf</span>
          <input type="range" min={1} max={3000} step={1} value={loadKgf}
            onChange={(e) => setLoadKgf(Number(e.target.value))} aria-label="Load, kgf" />
        </label>
        <label className="fa-slider">
          <span>
            {scaleId === 'brinell' ? 'Impression' : 'Diagonal'}{' '}
            <strong>{sizeMm.toFixed(2)}</strong> mm
          </span>
          <input type="range" min={0.05} max={9} step={0.05} value={sizeMm}
            onChange={(e) => setSizeMm(Number(e.target.value))}
            aria-label="Impression size, mm" />
        </label>
      </div>

      <svg viewBox={`0 0 ${S} ${S}`} className="hd-indenter" role="img"
        aria-label={`${scale.name} indenter: ${scale.indenter}`}>
        <line x1={8} x2={S - 8} y1={S / 2 + 26} y2={S / 2 + 26} stroke="#6b7280" strokeWidth={1.5} />
        {sketch}
      </svg>

      <table className="detail-props">
        <tbody>
          <tr>
            <th scope="row">{scale.name} ({scale.symbol})</th>
            <td>{value == null ? 'not a valid impression' : value.toFixed(0)}</td>
          </tr>
          <tr>
            <th scope="row">Indenter</th>
            <td>{scale.indenter}</td>
          </tr>
          <tr>
            <th scope="row">Tensile strength from hardness</th>
            <td className={ts == null ? 'err-off' : ''}>
              {scaleId !== 'brinell'
                ? 'Brinell only'
                : ts == null
                  ? `refused for ${materialName}`
                  : `${ts.toFixed(0)} MPa`}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="trend-note">{scale.note}</p>

      {scaleId === 'brinell' && !ferrous && (
        <p className="err-note">
          <strong>Refused.</strong> TS ≈ 3.45·HB is calibrated on <em>steels</em>.{' '}
          {materialName} is not one, and applying it anyway would return a confident number
          with nothing behind it. This is not a caveat about the correlation — it is what
          ASTM E140&rsquo;s own scope says about hardness conversions generally: they are not
          transferable between material classes.
        </p>
      )}

      <p className="trend-note">
        <strong>No conversion table here, on purpose.</strong> Every figure above is computed
        from the scale&rsquo;s own definition — the indenter geometry, the load and the
        impression you measured — so it is arithmetic rather than a lookup. Converting between
        scales is empirical, calibrated per material class, and this module does not ship a
        ladder for it. Treating one as physics is the misconception the panel exists to
        correct.
      </p>
    </div>
  );
}
