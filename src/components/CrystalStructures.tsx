import { useEffect, useMemo, useState } from 'react';
import elementsRaw from '../data/elements.json';
import { useRouteString } from '../useRoute';
import { STRUCTURES, getStructure, packingFactor } from '../crystal/structures';
import { coordinationShell } from '../crystal/geometry';
import { IDEAL_COA, METALS, theoreticalDensity } from '../crystal/metals';
import { prefersReducedMotion } from '../motion';
import { CrystalScene, type ViewMode } from './CrystalScene';
import type { ElementData } from '../types';

// Imported here rather than passed down: `App` no longer holds the dataset, and
// this module is lazy, so the data rides in a chunk the reader has asked for.
const elements = elementsRaw as ElementData[];

export function CrystalStructures() {
  const [id, setId] = useRouteString('s', 'fcc');
  const [mode, setMode] = useState<ViewMode>('ball');
  const [showCell, setShowCell] = useState(true);
  const [showBonds, setShowBonds] = useState(false);
  const [showCoordination, setShowCoordination] = useState(false);
  // A cell that spins on its own is exactly what "reduce motion" is asking us
  // not to do. There is a checkbox either way, so this only sets the default.
  const [autoRotate, setAutoRotate] = useState(!prefersReducedMotion());
  const [metalSymbol, setMetalSymbol] = useRouteString('metal', 'Cu');

  const structure = getStructure(id);
  const metal = METALS.find((m) => m.symbol === metalSymbol) ?? METALS[4];

  // Both numbers the panel used to recite are now derived. APF comes from the
  // a↔R relation; CN is the length of the neighbour list the "coordination
  // shell" checkbox already highlights, so the label and the picture cannot
  // disagree. `coordinationShell` tiles a 3×3×3 supercell, so it is memoised.
  const packing = packingFactor(structure);
  const shell = useMemo(() => coordinationShell(structure), [structure]);
  const cn = shell?.neighbours.length ?? structure.CN;

  // Keep the density example in step with the structure on screen.
  useEffect(() => {
    if (id !== 'fcc' && id !== 'bcc' && id !== 'hcp') return;
    setMetalSymbol((current) => {
      const held = METALS.find((m) => m.symbol === current);
      if (held?.structure === id) return current;
      return METALS.find((m) => m.structure === id)?.symbol ?? current;
    });
  }, [id, setMetalSymbol]);

  /**
   * One concrete substitution under the R-cancelling derivation, using the
   * metal already selected below. Cubic only: the HCP metals carry a measured
   * c/a that differs from the ideal 1.633 the structure's cell volume assumes,
   * so substituting their R under it would print a number that is neither the
   * ideal APF nor the metal's own.
   */
  const substitution = useMemo(() => {
    if (!packing || structure.cell !== 'cubic') return null;
    if (metal.structure !== structure.id) return null;
    const a = packing.aOverR * metal.R;
    const spheres = packing.sphereVolume * metal.R ** 3;
    const cell = packing.cellVolume * metal.R ** 3;
    return { name: metal.name, R: metal.R, a, spheres, cell, apf: spheres / cell };
  }, [packing, structure, metal]);

  // The density calculator only applies to the elemental metal structures.
  const densityStructure = getStructure(metal.structure);
  const density = useMemo(() => {
    const el = elements.find((e) => e.symbol === metal.symbol);
    if (!el?.atomic_mass || !densityStructure.aOverR) return null;
    // For HCP, use the metal's measured c/a rather than the ideal 1.633 —
    // zinc and cadmium deviate far enough to swing the answer by ~15%.
    const volumeOverA3 =
      metal.coa != null ? ((3 * Math.sqrt(3)) / 2) * metal.coa : densityStructure.volumeOverA3;
    const result = theoreticalDensity(
      densityStructure.N,
      el.atomic_mass,
      metal.R,
      densityStructure.aOverR,
      volumeOverA3,
    );
    return { ...result, measured: el.density, mass: el.atomic_mass };
  }, [metal, densityStructure]);

  const error =
    density?.measured != null
      ? ((density.rho - density.measured) / density.measured) * 100
      : null;

  return (
    <div className="crystal-layout">
      <div className="crystal-main">
        <div className="crystal-controls">
          <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Crystal structure">
            {STRUCTURES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="toggle-group" role="group" aria-label="Display mode">
            <button
              className={`toggle ${mode === 'ball' ? 'toggle-on' : ''}`}
              aria-pressed={mode === 'ball'}
              onClick={() => setMode('ball')}
            >
              Ball & stick
            </button>
            <button
              className={`toggle ${mode === 'fill' ? 'toggle-on' : ''}`}
              aria-pressed={mode === 'fill'}
              onClick={() => setMode('fill')}
            >
              Space-filling
            </button>
          </div>
        </div>

        <CrystalScene
          structure={structure}
          mode={mode}
          showCell={showCell}
          showBonds={showBonds}
          showCoordination={showCoordination}
          autoRotate={autoRotate}
        />

        <div className="crystal-checks">
          <label>
            <input type="checkbox" checked={showCell} onChange={(e) => setShowCell(e.target.checked)} />
            Unit cell
          </label>
          <label>
            <input type="checkbox" checked={showBonds} onChange={(e) => setShowBonds(e.target.checked)} />
            Bonds
          </label>
          <label>
            <input
              type="checkbox"
              checked={showCoordination}
              onChange={(e) => setShowCoordination(e.target.checked)}
            />
            Coordination shell (CN = {cn})
          </label>
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

        <p className="trend-note">{structure.note}</p>
      </div>

      <aside className="detail">
        <h2 className="crystal-title">{structure.name}</h2>
        <p className="detail-meta">{structure.system} system</p>

        <table className="detail-props">
          <tbody>
            <tr>
              <th scope="row">Atoms per cell (N)</th>
              <td>{structure.N}</td>
            </tr>
            <tr>
              <th scope="row">Coordination number</th>
              <td>{cn}</td>
            </tr>
            <tr>
              <th scope="row">Packing factor (APF)</th>
              <td>{packing ? packing.apf.toFixed(3) : `${structure.APF.toFixed(2)} (tabulated)`}</td>
            </tr>
            <tr>
              <th scope="row">Lattice parameter</th>
              <td>{structure.aFromR}</td>
            </tr>
          </tbody>
        </table>

        <p className="detail-summary">
          <strong>Found in:</strong> {structure.examples}
        </p>

        <div className="density-box">
          <h3>Where the packing factor comes from</h3>
          {packing ? (
            <>
              <table className="mi-deriv-table apf-deriv">
                <tbody>
                  <tr>
                    <th scope="row">Atoms per cell N</th>
                    <td>{packing.N}</td>
                  </tr>
                  <tr>
                    <th scope="row">{structure.aFromR}</th>
                    <td>a = {packing.aOverR.toFixed(3)} R</td>
                  </tr>
                  <tr>
                    <th scope="row">Spheres N · (4/3)πR³</th>
                    <td>{packing.sphereVolume.toFixed(3)} R³</td>
                  </tr>
                  <tr>
                    <th scope="row">
                      Cell V꜀ = {structure.cell === 'hexagonal' ? '(3√3/2) a²c' : 'a³'}
                    </th>
                    <td>{packing.cellVolume.toFixed(3)} R³</td>
                  </tr>
                  <tr className="mi-deriv-result">
                    <th scope="row">APF = spheres / cell</th>
                    <td>{packing.apf.toFixed(3)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="density-note">
                {substitution ? (
                  <>
                    Substituting {substitution.name}: R = {substitution.R.toFixed(4)} nm gives a ={' '}
                    {substitution.a.toFixed(4)} nm, so {packing.N} × (4/3)π({substitution.R.toFixed(4)})³
                    ÷ ({substitution.a.toFixed(4)})³ = {substitution.spheres.toFixed(5)} ÷{' '}
                    {substitution.cell.toFixed(5)} = {substitution.apf.toFixed(3)}.{' '}
                  </>
                ) : null}
                R cancels in the quotient, which is the point: the packing factor belongs to the
                arrangement, not to the element. Every element that adopts this structure has the same
                one, whatever its atoms measure.
              </p>
            </>
          ) : (
            <p className="density-note">
              {structure.name} has no single atomic radius — two ion sizes set the cell — so there is
              no hard-sphere derivation to show. Its stated APF of {structure.APF.toFixed(2)} is a
              tabulated value, not one this page computes.
            </p>
          )}
        </div>

        <div className="density-box">
          <h3>Theoretical density</h3>
          <p className="density-eq">ρ = nA / (V꜀ · N<sub>A</sub>)</p>
          <select
            value={metalSymbol}
            onChange={(e) => setMetalSymbol(e.target.value)}
            aria-label="Metal for density calculation"
          >
            {METALS.map((m) => (
              <option key={m.symbol} value={m.symbol}>
                {m.name} · {m.structure.toUpperCase()}
              </option>
            ))}
          </select>

          {density && (
            <table className="detail-props">
              <tbody>
                <tr>
                  <th scope="row">R</th>
                  <td>{metal.R.toFixed(4)} nm</td>
                </tr>
                <tr>
                  <th scope="row">a</th>
                  <td>{density.a.toFixed(4)} nm</td>
                </tr>
                {metal.coa != null && (
                  <tr>
                    <th scope="row">c/a</th>
                    <td>
                      {metal.coa.toFixed(3)}
                      <span className="coa-ideal">
                        {' '}
                        (ideal {IDEAL_COA})
                      </span>
                    </td>
                  </tr>
                )}
                <tr>
                  <th scope="row">Predicted ρ</th>
                  <td>{density.rho.toFixed(2)} g/cm³</td>
                </tr>
                <tr>
                  <th scope="row">Measured ρ</th>
                  <td>{density.measured != null ? `${density.measured} g/cm³` : '—'}</td>
                </tr>
                {error != null && (
                  <tr>
                    <th scope="row">Error</th>
                    <td className={Math.abs(error) < 3 ? 'err-ok' : 'err-off'}>
                      {error > 0 ? '+' : ''}
                      {error.toFixed(1)}%
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          <p className="density-note">
            Hard spheres, stacked by the rules of {metal.structure.toUpperCase()}, predict a real
            metal’s density to within a fraction of a percent for the cubic structures — evidence
            that the geometry on screen is genuinely how the atoms sit. HCP uses each metal’s
            measured c/a: assume the ideal 1.633 instead and zinc and cadmium, whose real ratios
            are near 1.86, come out ~15% too dense.
          </p>
        </div>
      </aside>
    </div>
  );
}
