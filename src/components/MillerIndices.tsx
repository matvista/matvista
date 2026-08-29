import { useEffect, useMemo, useState } from 'react';
import { useRouteNumber, useRouteString } from '../useRoute';
import { STRUCTURES, getStructure } from '../crystal/structures';
import { METALS } from '../crystal/metals';
import {
  acute,
  angleBetween,
  resolvedShearStress,
  bareIndices,
  drawnOffset,
  dSpacing,
  family,
  formatFamily,
  formatIndices,
  intercepts,
  liesInPlane,
  parseIndices,
  rankSystems,
  reduce,
  SLIP_MODES,
  slipSystems,
  type Triple,
} from '../crystal/miller';
import { prefersReducedMotion } from '../motion';
import { MillerScene } from './MillerScene';
import { AXIS_COLORS } from '../color';

const CUBIC = STRUCTURES.filter((s) => s.cell === 'cubic');

/**
 * d = a/√(h²+k²+l²) is a cubic-only relation, so the spacing calculator offers
 * only cubic metals. HCP needs 1/d² = (4/3)(h²+hk+k²)/a² + l²/c², and the
 * four-index Miller–Bravais scheme to go with it.
 */
const CUBIC_METALS = METALS.filter((m) => m.structure !== 'hcp');

/** Presets that cover the planes a course actually asks about. */
const PLANE_PRESETS = ['111', '110', '100', '1̄11', '112', '123'];
const DIRECTION_PRESETS = ['111', '110', '100', '1̄10', '112', '123'];

export function MillerIndices() {
  const [structureId, setStructureId] = useRouteString('s', 'fcc');
  const [planeText, setPlaneText] = useRouteString('plane', '111');
  const [directionText, setDirectionText] = useRouteString('dir', '1̄10');
  const [showPlane, setShowPlane] = useState(true);
  const [showDirection, setShowDirection] = useState(true);
  const [showAtoms, setShowAtoms] = useState(true);
  const [showIntercepts, setShowIntercepts] = useState(true);
  // A cell that spins on its own is exactly what "reduce motion" is asking us
  // not to do. There is a checkbox either way, so this only sets the default.
  const [autoRotate, setAutoRotate] = useState(!prefersReducedMotion());
  const [metalSymbol, setMetalSymbol] = useRouteString('metal', 'Cu');
  const [slipModeId, setSlipModeId] = useRouteString('slip', 'fcc');
  const [axisText, setAxisText] = useRouteString('axis', '123');
  const [sigma, setSigma] = useRouteNumber('sigma', 50, 0, 300);

  // Keep the slip panel in step with the cell on screen, the way the crystal
  // module keeps its density example in step with its structure selector.
  useEffect(() => {
    if (structureId === 'fcc' || structureId === 'bcc') setSlipModeId(structureId);
  }, [structureId, setSlipModeId]);

  const structure = getStructure(structureId);
  const plane = useMemo(() => parseIndices(planeText), [planeText]);
  const direction = useMemo(() => parseIndices(directionText), [directionText]);
  const axis = useMemo(() => parseIndices(axisText), [axisText]);

  const metal = CUBIC_METALS.find((m) => m.symbol === metalSymbol) ?? CUBIC_METALS[0];
  const metalStructure = getStructure(metal.structure);
  // a from the hard-sphere relation, the same route the density calculator takes.
  const a = metalStructure.aOverR ? metal.R * metalStructure.aOverR : null;

  const slipMode = SLIP_MODES.find((m) => m.id === slipModeId) ?? SLIP_MODES[0];
  const ranked = useMemo(
    () => (axis ? rankSystems(slipMode, axis) : []),
    [slipMode, axis],
  );
  const systemCount = useMemo(() => slipSystems(slipMode).length, [slipMode]);
  const mMax = ranked.length ? ranked[0].m : null;
  // Several systems usually tie at the maximum — all of them slip together.
  const tied = mMax != null ? ranked.filter((r) => Math.abs(r.m - mMax) < 1e-6).length : 0;

  const planeFamily = useMemo(() => (plane ? family(reduce(plane)) : []), [plane]);
  const reduced = plane ? reduce(plane) : null;

  return (
    <div className="mi-layout">
      <div className="mi-main">
        <div className="crystal-controls">
          <select
            value={structureId}
            onChange={(e) => setStructureId(e.target.value)}
            aria-label="Crystal structure"
          >
            {CUBIC.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mi-inputs">
          <div className="mi-input-block">
            <label htmlFor="mi-plane">
              Plane <span className="mi-swatch mi-swatch-plane" /> (hkl)
            </label>
            <input
              id="mi-plane"
              value={planeText}
              onChange={(e) => setPlaneText(e.target.value)}
              className={plane || !planeText ? '' : 'mi-invalid'}
              placeholder="111"
              spellCheck={false}
              aria-invalid={!plane && !!planeText}
              aria-describedby="mi-plane-err"
            />
            <div className="mi-presets">
              {PLANE_PRESETS.map((p) => (
                <button key={p} className="mi-chip" onClick={() => setPlaneText(p)}>
                  ({p})
                </button>
              ))}
            </div>
          </div>

          <div className="mi-input-block">
            <label htmlFor="mi-dir">
              Direction <span className="mi-swatch mi-swatch-dir" /> [uvw]
            </label>
            <input
              id="mi-dir"
              value={directionText}
              onChange={(e) => setDirectionText(e.target.value)}
              className={direction || !directionText ? '' : 'mi-invalid'}
              placeholder="110"
              spellCheck={false}
              aria-invalid={!direction && !!directionText}
              aria-describedby="mi-dir-err"
            />
            {!direction && directionText && (
              <p id="mi-dir-err" className="mi-error">
                Not a valid direction — try 110, 1-10 or 1̄10.
              </p>
            )}
            <div className="mi-presets">
              {DIRECTION_PRESETS.map((p) => (
                <button key={p} className="mi-chip" onClick={() => setDirectionText(p)}>
                  [{p}]
                </button>
              ))}
            </div>
          </div>
        </div>

        <MillerScene
          structure={structure}
          plane={showPlane ? plane : null}
          direction={showDirection ? direction : null}
          showAtoms={showAtoms}
          showIntercepts={showIntercepts}
          autoRotate={autoRotate}
        />

        <div className="crystal-checks">
          <label>
            <input type="checkbox" checked={showPlane} onChange={(e) => setShowPlane(e.target.checked)} />
            Plane
          </label>
          <label>
            <input
              type="checkbox"
              checked={showDirection}
              onChange={(e) => setShowDirection(e.target.checked)}
            />
            Direction
          </label>
          <label>
            <input type="checkbox" checked={showAtoms} onChange={(e) => setShowAtoms(e.target.checked)} />
            Atoms
          </label>
          <label>
            <input
              type="checkbox"
              checked={showIntercepts}
              onChange={(e) => setShowIntercepts(e.target.checked)}
            />
            Intercepts
          </label>
          <label>
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
            />
            Rotate
          </label>
        </div>

        <div className="mi-axis-key">
          <span>
            <i style={{ background: AXIS_COLORS.a }} /> a (x)
          </span>
          <span>
            <i style={{ background: AXIS_COLORS.b }} /> b (y)
          </span>
          <span>
            <i style={{ background: AXIS_COLORS.c }} /> c (z)
          </span>
          <span className="drag-hint">Drag to rotate · scroll to zoom</span>
        </div>

        {plane && <Derivation hkl={plane} />}
      </div>

      <aside className="detail">
        <h2 className="crystal-title">
          {plane ? formatIndices(plane, 'plane') : '—'}
          {direction ? ` · ${formatIndices(direction, 'direction')}` : ''}
        </h2>
        <p className="detail-meta">{structure.name}</p>

        {!plane && planeText && (
          <p id="mi-plane-err" className="mi-error">
            Not a valid plane — try 111, 1-10 or 1̄11.
          </p>
        )}

        {plane && reduced && (
          <table className="detail-props">
            <tbody>
              <tr>
                <th scope="row">Family</th>
                <td>
                  {formatFamily(reduced, 'plane')} · {planeFamily.length} planes
                </td>
              </tr>
              {reduced.join() !== plane.join() && (
                <tr>
                  <th scope="row">Lowest terms</th>
                  <td>{formatIndices(reduced, 'plane')}</td>
                </tr>
              )}
              {direction && (
                <>
                  <tr>
                    <th scope="row">
                      Normal ∠ {formatIndices(direction, 'direction')}
                    </th>
                    <td>{acute(angleBetween(plane, direction)).toFixed(2)}°</td>
                  </tr>
                  <tr>
                    <th scope="row">Direction in plane?</th>
                    <td className={liesInPlane(plane, direction) ? 'err-ok' : 'err-off'}>
                      {liesInPlane(plane, direction) ? 'yes — a possible slip system' : 'no'}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        )}

        <div className="density-box">
          <h3>Interplanar spacing</h3>
          <p className="density-eq">
            d<sub>hkl</sub> = a / √(h² + k² + l²)
          </p>
          <select
            value={metalSymbol}
            onChange={(e) => setMetalSymbol(e.target.value)}
            aria-label="Metal for spacing calculation"
          >
            {CUBIC_METALS.map((m) => (
              <option key={m.symbol} value={m.symbol}>
                {m.name} · {m.structure.toUpperCase()}
              </option>
            ))}
          </select>

          {plane && a != null && (
            <table className="detail-props">
              <tbody>
                <tr>
                  <th scope="row">a</th>
                  <td>{a.toFixed(4)} nm</td>
                </tr>
                <tr>
                  <th scope="row">√(h²+k²+l²)</th>
                  <td>{Math.sqrt(plane.reduce((s, v) => s + v * v, 0)).toFixed(4)}</td>
                </tr>
                <tr>
                  <th scope="row">
                    d<sub>hkl</sub>
                  </th>
                  <td>{dSpacing(plane, a).toFixed(4)} nm</td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="density-note">
            This is the same d that sets diffraction peak positions — feed it into Bragg’s law,
            λ = 2d sin θ, and you have the angles the XRD module plots. Note that (200) is not a
            different set of planes from (100): it is the same family indexed at half the spacing,
            which is why the two give different peaks.
          </p>
        </div>

        {plane && (
          <div className="mi-family">
            <h3>{formatFamily(reduce(plane), 'plane')} members</h3>
            <div className="mi-family-list">
              {planeFamily.map((m) => (
                <button
                  key={m.join(',')}
                  className={`mi-chip ${m.join(',') === plane.join(',') ? 'mi-chip-on' : ''}`}
                  onClick={() => setPlaneText(bareIndices(m))}
                >
                  {formatIndices(m, 'plane')}
                </button>
              ))}
            </div>
            <p className="density-note">
              Every member is crystallographically identical — same atomic arrangement, same
              spacing. A plane and its negative are one plane seen from either side, which is why
              {' '}
              {formatFamily(reduce(plane), 'plane')} has {planeFamily.length} members rather than{' '}
              {planeFamily.length * 2}.
            </p>
          </div>
        )}
      </aside>

      <section className="mi-slip">
        <div className="mi-slip-head">
          <h3>Slip systems &amp; Schmid factor</h3>
          <div className="mi-slip-controls">
            <select
              value={slipModeId}
              onChange={(e) => setSlipModeId(e.target.value)}
              aria-label="Slip mode"
            >
              {SLIP_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <label htmlFor="mi-axis">Tensile axis</label>
            <input
              id="mi-axis"
              value={axisText}
              onChange={(e) => setAxisText(e.target.value)}
              className={`mi-axis-input ${axis || !axisText ? '' : 'mi-invalid'}`}
              spellCheck={false}
              aria-invalid={!axis && !!axisText}
            />
            <label htmlFor="mi-sigma">σ</label>
            <input
              id="mi-sigma"
              type="range"
              min={0}
              max={300}
              step={5}
              value={sigma}
              onChange={(e) => setSigma(Number(e.target.value))}
              className="mi-sigma"
            />
            <span className="mi-sigma-val">{sigma} MPa</span>
          </div>
        </div>

        <p className="density-eq">τ = σ · cos φ · cos λ</p>

        {axis && mMax != null ? (
          <>
            <div className="mi-slip-summary">
              <div className="mi-stat">
                <span className="mi-stat-val">{systemCount}</span>
                <span className="mi-stat-label">systems</span>
              </div>
              <div className="mi-stat">
                <span className="mi-stat-val">{mMax.toFixed(4)}</span>
                <span className="mi-stat-label">max Schmid factor</span>
              </div>
              <div className="mi-stat">
                <span className="mi-stat-val">{tied}</span>
                <span className="mi-stat-label">tied at maximum</span>
              </div>
              <div className="mi-stat">
                <span className="mi-stat-val">{resolvedShearStress(sigma, mMax).toFixed(1)}</span>
                <span className="mi-stat-label">τ on that system (MPa)</span>
              </div>
            </div>

            {/* The slip table is wider than a phone; let it scroll on its own
                rather than forcing the whole page sideways. Focusable and
                labelled, because a scroll region a mouse can reach must be
                reachable from a keyboard too. */}
            <div className="table-scroll" role="region" aria-label="Slip systems, ranked" tabIndex={0}>
            <table className="mi-table">
              <thead>
                <tr>
                  <th>Plane</th>
                  <th>Direction</th>
                  <th>Family</th>
                  <th>φ</th>
                  <th>λ</th>
                  <th>m</th>
                  <th>τ (MPa)</th>
                </tr>
              </thead>
              <tbody>
                {ranked.slice(0, 12).map((s, i) => (
                  <tr key={i} className={Math.abs(s.m - mMax) < 1e-6 ? 'mi-row-hot' : ''}>
                    <td>
                      <button className="mi-link" onClick={() => setPlaneText(bareIndices(s.plane))}>
                        {formatIndices(s.plane, 'plane')}
                      </button>
                    </td>
                    <td>
                      <button className="mi-link" onClick={() => setDirectionText(bareIndices(s.direction))}>
                        {formatIndices(s.direction, 'direction')}
                      </button>
                    </td>
                    <td className="mi-dim">{s.familyLabel}</td>
                    <td>{s.phi.toFixed(1)}°</td>
                    <td>{s.lambda.toFixed(1)}°</td>
                    <td>{s.m.toFixed(4)}</td>
                    <td>{(sigma * s.m).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {ranked.length > 12 && (
              <p className="mi-dim">Showing the 12 highest of {ranked.length} systems.</p>
            )}
          </>
        ) : (
          <p className="mi-error">Enter a tensile axis such as 100, 111 or 123.</p>
        )}

        <p className="trend-note">{slipMode.note}</p>
      </section>
    </div>
  );
}

/**
 * The reciprocal construction, laid out as the four lines students write:
 * intercepts, their reciprocals, clearing fractions, and the result.
 */
function Derivation({ hkl }: { hkl: Triple }) {
  const rows = intercepts(hkl);
  const n = drawnOffset(hkl);
  return (
    <div className="mi-derivation">
      <table className="mi-deriv-table">
        <thead>
          <tr>
            <th />
            <th>a</th>
            <th>b</th>
            <th>c</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Intercept</th>
            {rows.map((r) => (
              <td key={r.axis}>{r.value == null ? '∞' : fmtFraction(r.value)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">Reciprocal</th>
            {rows.map((r) => (
              <td key={r.axis}>{r.value == null ? '0' : fmtSigned(r.index)}</td>
            ))}
          </tr>
          <tr className="mi-deriv-result">
            <th scope="row">Index</th>
            {hkl.map((v, i) => (
              <td key={i}>{v < 0 ? `${Math.abs(v)}̄` : v}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="trend-note">
        Reciprocals are what keep the notation finite: a plane parallel to an axis meets it at
        infinity, and 1/∞ = 0. That is the whole reason a zero appears in {formatIndices(hkl)} —
        it marks an axis the plane never touches, not an intercept at the origin.
      </p>
      {n !== 1 && (
        <p className="trend-note">
          <strong>Origin shifted.</strong> These intercepts are negative, so the plane they
          describe lies outside the cell. Drawn instead is the parallel member of the same set,
          h·x + k·y + l·z = {n}, reached by moving the origin to the corner that makes every
          intercept positive — the standard construction for a barred index. It is the same
          plane crystallographically: same spacing, same atoms, same {formatFamily(reduce(hkl))}{' '}
          family.
        </p>
      )}
    </div>
  );
}

/** A true minus sign, matching the intercept row above it. */
function fmtSigned(v: number): string {
  return v < 0 ? `−${Math.abs(v)}` : `${v}`;
}

/** Show 1/2 rather than 0.5 — intercepts are read as fractions of the cell edge. */
function fmtFraction(v: number): string {
  const inv = 1 / v;
  if (Math.abs(inv - Math.round(inv)) < 1e-9) {
    const d = Math.round(inv);
    if (d === 1) return '1';
    if (d === -1) return '−1';
    return d < 0 ? `−1/${Math.abs(d)}` : `1/${d}`;
  }
  return v.toFixed(3);
}
