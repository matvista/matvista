import { useMemo, useState } from 'react';
import { useRouteString } from '../useRoute';
import { METALS } from '../crystal/metals';
import {
  REFLECTION_RULES,
  XRD_SAMPLES,
  XRD_SOURCES,
  braggReach,
  computePattern,
  dSpacing,
  familyLabel,
  formatIntensity,
  isAllowed,
  multiplicity,
  type XrdSample,
  type XrdSource,
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
  const reach = useMemo(
    () => braggReach(sample.lattice, sample.a, source.lambda),
    [sample, source],
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
          <strong>Why the source changes how many peaks exist.</strong> Bragg’s law gives
          sin θ = λ/2d, and a sine cannot exceed 1, so no plane spaced closer than{' '}
          <strong>d = λ/2 = {reach.dMin.toFixed(4)} nm</strong> can diffract at any angle. At{' '}
          λ = {source.lambda} nm, {sample.name.replace(/ \(.*\)/, '')} has {reach.reachable}{' '}
          reflection {reach.reachable === 1 ? 'family' : 'families'} above that floor, of which{' '}
          {peaks.length} {peaks.length === 1 ? 'falls' : 'fall'} inside the 2θ ≤ {MAX_2THETA}°
          window drawn here.
          {reach.smallestD != null && (
            <> The closest spacing this anode reaches is d = {reach.smallestD.toFixed(4)} nm.</>
          )}{' '}
          Nothing about the crystal changed; the ruler did.
        </p>
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

        <ExtinctionPanel sample={sample} source={source} />
      </aside>
    </div>
  );
}

/**
 * Shows which low-index reflections the lattice forbids — the systematic
 * absences are what identify the structure, so they deserve to be visible
 * rather than merely missing from the pattern.
 */
function ExtinctionPanel({ sample, source }: { sample: XrdSample; source: XrdSource }) {
  const { lattice, a } = sample;
  const lambda = source.lambda;
  /**
   * The reverse of S12's link: an allowed reflection opens in the Miller
   * module, on the same metal, so `a` — and therefore d, the verdict and the
   * angle — agree.
   *
   * **Only where that metal exists.** The Miller module answers "is this
   * reflection allowed" for its *selected metal*, reading the lattice off the
   * metal and not off the `s` param this link also sets. Silicon and polonium
   * are shipped samples with no entry in `crystal/metals.ts`, so a link from
   * them arrived with no metal, fell back to copper, and answered a different
   * question: six of polonium's twelve chips read "allowed" here and
   * "extinct" on arrival, and silicon's (111) went from 28.44° to copper's
   * 43.32°. Those chips are no longer links. The `hcp` filter mirrors the
   * Miller module's own metal list, which is cubic-only.
   */
  const metal = METALS.find(
    (m) => m.symbol.toLowerCase() === sample.id && m.structure !== 'hcp',
  );
  const CANDIDATES: [number, number, number][] = [
    [1, 0, 0], [1, 1, 0], [1, 1, 1], [2, 0, 0], [2, 1, 0], [2, 1, 1],
    [2, 2, 0], [3, 0, 0], [3, 1, 0], [3, 1, 1], [2, 2, 2], [4, 0, 0],
  ];

  return (
    <div className="density-box">
      <h3>Reflection rule</h3>
      <p className="density-eq">{REFLECTION_RULES[lattice]}</p>
      <div className="xrd-extinct">
        {CANDIDATES.map(([h, k, l]) => {
          const ok = isAllowed(lattice, h, k, l);
          const d = dSpacing(a, h, k, l);
          // λ/2d is sin θ. Above 1 there is no angle to measure at — the
          // reflection is allowed by the lattice and out of reach of this
          // anode, which is a different thing from being extinct.
          const sinTheta = lambda / (2 * d);
          const outOfReach = ok && sinTheta > 1;
          const cls = !ok ? 'xrd-off' : outOfReach ? 'xrd-far' : 'xrd-on';
          const label = familyLabel(h, k, l);
          const body = (
            <>
              {label}
              {ok && <em> · d {d.toFixed(3)}</em>}
              {outOfReach && <em> · λ/2d {sinTheta.toFixed(2)}</em>}
            </>
          );
          // Forbidden families are not linked: there is nothing to look at.
          // Nor is anything, when the sample is not a metal the Miller module
          // can select — see above.
          return ok && metal ? (
            <a
              key={label}
              className={`xrd-chip xrd-chip-link ${cls}`}
              href={`#/miller?plane=${label}&s=${lattice}&metal=${metal.symbol}&source=${source.id}`}
            >
              {body}
            </a>
          ) : (
            <span key={label} className={`xrd-chip ${cls}`}>
              {body}
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
        {metal ? (
          <>
            Every reachable index above is a link into the Miller module, which draws that plane in
            the cell and shows where its spacing comes from — on {metal.name.toLowerCase()}, at this
            same anode, so the verdict and the angle there are the ones in the table.
          </>
        ) : (
          <>
            These indices are not links. The Miller module answers the same question against a
            metal from its own list, and {sample.name.replace(/\s*\(.*\)$/, '').toLowerCase()} is
            not on it — the link would silently answer for copper instead, which is a different
            lattice and a different spacing.
          </>
        )}
      </p>
      <p className="density-note">
        Indices marked <span className="xrd-chip xrd-far">λ/2d &gt; 1</span> are the other kind of
        missing: the lattice allows them, but sin θ would have to exceed 1, so this wavelength
        cannot reach them. Change the anode and they come back. A systematic absence never does —
        that is the difference, and it is why a pattern is indexed against a stated λ.
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
