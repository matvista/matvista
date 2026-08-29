import { useMemo, useState } from 'react';
import { useRouteString } from '../useRoute';
import {
  XRD_SAMPLES,
  XRD_SOURCES,
  computePattern,
  dSpacing,
  familyLabel,
  formatIntensity,
  isAllowed,
  multiplicity,
  type XrdLattice,
} from '../xrd/diffraction';

const W = 760;
const H = 360;
const PAD = { l: 56, r: 20, t: 22, b: 48 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

const MAX_2THETA = 140;

export function XrdSimulator() {
  const [sampleId, setSampleId] = useRouteString('sample', 'cu');
  const [sourceId, setSourceId] = useRouteString('source', 'cu');
  const [selected, setSelected] = useState<string | null>(null);
  const [compareId, setCompareId] = useRouteString('compare', 'none');

  const sample = XRD_SAMPLES.find((s) => s.id === sampleId) ?? XRD_SAMPLES[0];
  const source = XRD_SOURCES.find((s) => s.id === sourceId) ?? XRD_SOURCES[0];
  const compare = XRD_SAMPLES.find((s) => s.id === compareId);

  const peaks = useMemo(
    () => computePattern(sample.lattice, sample.a, source.lambda, MAX_2THETA),
    [sample, source],
  );
  const comparePeaks = useMemo(
    () => (compare ? computePattern(compare.lattice, compare.a, source.lambda, MAX_2THETA) : []),
    [compare, source],
  );

  const sx = (twoTheta: number) => PAD.l + (twoTheta / MAX_2THETA) * plotW;
  const sy = (intensity: number) => PAD.t + plotH - (intensity / 105) * plotH;

  const ticks = [0, 20, 40, 60, 80, 100, 120, 140];

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select value={sampleId} onChange={(e) => { setSampleId(e.target.value); setSelected(null); }} aria-label="Sample">
            {XRD_SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} aria-label="X-ray source">
            {XRD_SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <select value={compareId} onChange={(e) => setCompareId(e.target.value)} aria-label="Overlay">
            <option value="none">No overlay</option>
            {XRD_SAMPLES.filter((s) => s.id !== sampleId).map((s) => (
              <option key={s.id} value={s.id}>
                Overlay: {s.name}
              </option>
            ))}
          </select>
        </div>

        <svg className="ss-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Powder diffraction pattern of ${sample.name}`}>
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} className="dd-grid" />
              <text x={PAD.l - 8} y={sy(v) + 4} className="dd-tick" textAnchor="end">
                {v}
              </text>
            </g>
          ))}

          {compare &&
            comparePeaks.map((p) => (
              <line
                key={`c${familyLabel(p.h, p.k, p.l)}`}
                x1={sx(p.twoTheta)}
                x2={sx(p.twoTheta)}
                y1={sy(0)}
                y2={sy(p.intensity)}
                className="xrd-peak-ghost"
              />
            ))}

          {peaks.map((p) => {
            const id = familyLabel(p.h, p.k, p.l);
            const isSel = selected === id;
            return (
              <g key={id} className="xrd-peak-group" onClick={() => setSelected(isSel ? null : id)}>
                <line
                  x1={sx(p.twoTheta)}
                  x2={sx(p.twoTheta)}
                  y1={sy(0)}
                  y2={sy(p.intensity)}
                  className={`xrd-peak ${isSel ? 'xrd-peak-sel' : ''}`}
                />
                {/* Hit target — the bars are too thin to click reliably. */}
                <rect x={sx(p.twoTheta) - 7} y={PAD.t} width={14} height={plotH} className="xrd-hit" />
                {p.intensity > 12 && (
                  <text x={sx(p.twoTheta)} y={sy(p.intensity) - 6} className="xrd-label" textAnchor="middle">
                    {id}
                  </text>
                )}
              </g>
            );
          })}

          <line x1={PAD.l} x2={W - PAD.r} y1={sy(0)} y2={sy(0)} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={sy(0)} className="dd-axis" />
          {ticks.map((t) => (
            <text key={t} x={sx(t)} y={H - 26} className="dd-tick" textAnchor="middle">
              {t}
            </text>
          ))}
          <text x={W / 2} y={H - 8} className="dd-tick" textAnchor="middle">
            diffraction angle 2θ (degrees)
          </text>
          <text
            x={14}
            y={PAD.t + plotH / 2}
            className="dd-tick"
            transform={`rotate(-90 14 ${PAD.t + plotH / 2})`}
            textAnchor="middle"
          >
            relative intensity
          </text>
        </svg>

        <p className="trend-note">{sample.note}</p>
        <p className="density-note">
          Peak <strong>positions</strong> come straight from Bragg’s law and are exact — copper’s
          first four lines land at 43.32, 50.45, 74.13 and 89.95° against published values of 43.3,
          50.4, 74.1 and 90.0°. <strong>Intensities are indicative</strong>: multiplicity, structure
          factor and Lorentz–polarisation are computed properly, but the atomic scattering factor
          and thermal damping use one generic coefficient rather than per-element data.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{sample.name}</h2>
        <p className="detail-meta">
          a = {sample.a.toFixed(4)} nm · λ = {source.lambda} nm · {peaks.length} reflections
        </p>

        <table className="detail-props xrd-table">
          <thead>
            <tr>
              <th scope="col">hkl</th>
              <th scope="col">2θ</th>
              <th scope="col">d (nm)</th>
              <th scope="col">m</th>
              <th scope="col">I</th>
            </tr>
          </thead>
          <tbody>
            {peaks.map((p) => {
              const id = familyLabel(p.h, p.k, p.l);
              return (
                <tr
                  key={id}
                  className={selected === id ? 'xrd-row-sel' : ''}
                  onClick={() => setSelected(selected === id ? null : id)}
                >
                  <th scope="row">{id}</th>
                  <td>{p.twoTheta.toFixed(2)}°</td>
                  <td>{p.d.toFixed(4)}</td>
                  <td>{p.multiplicity}</td>
                  <td>{formatIntensity(p.intensity)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <ExtinctionPanel lattice={sample.lattice} a={sample.a} />
      </aside>
    </div>
  );
}

/**
 * Shows which low-index reflections the lattice forbids — the systematic
 * absences are what identify the structure, so they deserve to be visible
 * rather than merely missing from the pattern.
 */
function ExtinctionPanel({ lattice, a }: { lattice: XrdLattice; a: number }) {
  const CANDIDATES: [number, number, number][] = [
    [1, 0, 0], [1, 1, 0], [1, 1, 1], [2, 0, 0], [2, 1, 0], [2, 1, 1],
    [2, 2, 0], [3, 0, 0], [3, 1, 0], [3, 1, 1], [2, 2, 2], [4, 0, 0],
  ];

  const RULES: Record<XrdLattice, string> = {
    sc: 'All reflections present.',
    bcc: '(h + k + l) must be even.',
    fcc: 'h, k, l must be all odd or all even.',
    diamond: 'FCC rule, plus all-even reflections require h + k + l ≡ 0 (mod 4).',
  };

  return (
    <div className="density-box">
      <h3>Reflection rule</h3>
      <p className="density-eq">{RULES[lattice]}</p>
      <div className="xrd-extinct">
        {CANDIDATES.map(([h, k, l]) => {
          const ok = isAllowed(lattice, h, k, l);
          return (
            <span key={`${h}${k}${l}`} className={`xrd-chip ${ok ? 'xrd-on' : 'xrd-off'}`}>
              {h}
              {k}
              {l}
              {ok && <em> · d {dSpacing(a, h, k, l).toFixed(3)}</em>}
            </span>
          );
        })}
      </div>
      <p className="density-note">
        Struck-through indices are <strong>systematically absent</strong> — the lattice cancels them
        by destructive interference. Those absences are the fingerprint: an FCC pattern opens on
        111, a BCC pattern on 110, and the diamond lattice additionally kills 200 and 222. Reading
        which peaks are <em>missing</em> is how a structure is identified.
      </p>
      <p className="density-note">
        Multiplicity m counts the symmetry-equivalent planes in a family — 8 for {'{111}'}, 6 for{' '}
        {'{100}'}, 48 for {'{321}'} — and it scales intensity because more equivalent planes means
        more crystallites correctly oriented to diffract. Check: {'{321}'} has m ={' '}
        {multiplicity(3, 2, 1)}.
      </p>
    </div>
  );
}
