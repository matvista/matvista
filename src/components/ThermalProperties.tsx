import { useRouteEnum, useRouteNumber } from '../useRoute';
import {
  CERAMICS,
  DEBYE_STIFF,
  MEASURED_SPECIFIC_HEAT,
  METALS,
  THERMAL_MATERIALS,
} from '../thermal/materials';
import { element } from '../thermal/elements';
import {
  DULONG_PETIT,
  LORENZ_SOMMERFELD,
  deltaTForStress,
  dulongPetitSpecificHeat,
  expansionMeltProduct,
  lorenzNumber,
  thermalShockResistance,
  thermalStress,
} from '../thermal/model';
import { FRACTURE_ALLOYS } from '../failure/materials';
import { criticalCrackSize } from '../failure/model';

const W = 660;
const H = 400;
const PAD = { l: 62, r: 24, t: 20, b: 48 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

const MATERIAL_IDS = THERMAL_MATERIALS.map((m) => m.id);
const ALLOY_IDS = FRACTURE_ALLOYS.map((a) => a.id);

type Panel = 'capacity' | 'stress' | 'conduction';
const PANELS: Panel[] = ['capacity', 'stress', 'conduction'];
const PANEL_LABEL: Record<Panel, string> = {
  capacity: 'Heat capacity',
  stress: 'Expansion & thermal stress',
  conduction: 'Conduction & thermal shock',
};

export function ThermalProperties() {
  const [panel, setPanel] = useRouteEnum<Panel>('panel', 'stress', PANELS);
  return (
    <div className="fa-wrap">
      <div className="fa-tabs" role="tablist" aria-label="Thermal topic">
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
      {panel === 'capacity' && <CapacityPanel />}
      {panel === 'stress' && <StressPanel />}
      {panel === 'conduction' && <ConductionPanel />}
    </div>
  );
}

/* ============================================================== capacity == */

function CapacityPanel() {
  const points = METALS.map((m) => ({
    label: m.label,
    symbol: m.element!,
    mass: element(m.element!).atomic_mass,
    predicted: dulongPetitSpecificHeat(element(m.element!).atomic_mass),
    measured: MEASURED_SPECIFIC_HEAT[m.element!],
  }));
  const stiff = DEBYE_STIFF.map((s) => ({
    ...s,
    mass: element(s.symbol).atomic_mass,
    predicted: dulongPetitSpecificHeat(element(s.symbol).atomic_mass),
  }));

  const massMax = 210;
  const cMax = 3.0;
  const sx = (m: number) => PAD.l + (m / massMax) * plotW;
  const sy = (c: number) => PAD.t + plotH - (c / cMax) * plotH;

  // The rule itself, drawn: c = 3R/A is a hyperbola, not a cloud of points.
  // It starts where it enters the box rather than at the lightest element —
  // 3R/A passes 3 J/g·K at A = 8.3 and climbs without bound below that, so a
  // curve begun at A = 4 leaves the plot through the top and draws over the
  // axis label on its way.
  const massAtTop = DULONG_PETIT / cMax;
  const curve = Array.from({ length: 200 }, (_, i) => {
    const a = massAtTop + ((massMax - massAtTop) * i) / 199;
    return `${i === 0 ? 'M' : 'L'}${sx(a).toFixed(1)},${sy(dulongPetitSpecificHeat(a)).toFixed(1)}`;
  }).join('');

  /**
   * Label placement, because four of the nine metals are within 16 g/mol of
   * each other. Tantalum and tungsten are 2.9 apart, which is seven units on
   * this axis: they ran together into "TaW", and moving one below its dot only
   * put it under its neighbour's.
   *
   * So a crowded *run* gets one label naming all of it, centred underneath.
   * At seven units apart no reader could match a symbol to a dot anyway, and
   * the panel's claim is that all nine sit on the curve — not which is which.
   */
  const sorted = [...points].sort((a, b) => a.mass - b.mass);
  const runs: (typeof sorted)[] = [];
  for (const p of sorted) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (last && sx(p.mass) - sx(last.mass) < 26) run.push(p);
    else runs.push([p]);
  }

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="Specific heat against atomic mass, with the Dulong–Petit rule">
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l + plotW} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />

          <path d={curve} className="tp-rule" fill="none" />

          {sorted.map((p) => (
            <circle key={p.symbol} cx={sx(p.mass)} cy={sy(p.measured)} r={4} className="tp-measured" />
          ))}
          {runs.map((run) =>
            run.length === 1 ? (
              <text key={run[0].symbol} x={sx(run[0].mass) + 6} y={sy(run[0].measured) + 4}
                className="co-pick-label">{run[0].symbol}</text>
            ) : (
              <text
                key={run[0].symbol}
                x={(sx(run[0].mass) + sx(run[run.length - 1].mass)) / 2}
                y={sy(Math.min(...run.map((p) => p.measured))) + 20}
                textAnchor="middle"
                className="co-pick-label"
              >
                {run.map((p) => p.symbol).join(' ')}
              </text>
            ),
          )}
          {stiff.map((s) => (
            <g key={s.symbol}>
              <line x1={sx(s.mass)} x2={sx(s.mass)} y1={sy(s.measured)} y2={sy(s.predicted)}
                className="tp-miss" />
              <circle cx={sx(s.mass)} cy={sy(s.measured)} r={4} className="tp-stiff" />
              <text x={sx(s.mass) + 7} y={sy(s.measured) + 4} className="co-pick-label">{s.symbol}</text>
            </g>
          ))}

          {[0, 1, 2, 3].map((c) => (
            <text key={c} x={PAD.l - 8} y={sy(c) + 4} className="dd-tick" textAnchor="end">{c}</text>
          ))}
          {[0, 50, 100, 150, 200].map((m) => (
            <text key={m} x={sx(m)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">{m}</text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 8} className="dd-tick" textAnchor="middle">
            atomic mass (g/mol)
          </text>
          <text x={18} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 18 ${PAD.t + plotH / 2})`}>specific heat (J/g·K)</text>
        </svg>

        <p className="ht-caveat">
          <strong>Nothing on this panel is tabulated except the dots.</strong> The curve is
          c = 3R/A evaluated over the atomic masses in{' '}
          <a href="#/trends">the periodic table's own dataset</a> — every solid stores the same
          energy per atom, so it stores less per gram the heavier its atoms are. The nine
          filled circles are measured specific heats, and they sit on the curve to within 7%.
          The three that miss it are the result: carbon, beryllium and silicon are light atoms
          held by stiff bonds, so their vibrational modes are not all excited at 300 K and the
          classical limit overshoots — threefold, for diamond.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">3R = {DULONG_PETIT.toFixed(2)} J/mol·K</h2>
        <p className="detail-meta">for every solid, above its Debye temperature</p>

        <table className="detail-props">
          <thead>
            <tr><th scope="col"></th><th scope="col">3R/A</th><th scope="col">measured</th></tr>
          </thead>
          <tbody>
            {points.slice(0, 5).map((p) => (
              <tr key={p.symbol}>
                <th scope="row">{p.label}</th>
                <td>{p.predicted.toFixed(3)}</td>
                <td>{p.measured.toFixed(3)}</td>
              </tr>
            ))}
            {stiff.map((s) => (
              <tr key={s.symbol}>
                <th scope="row">{s.label}</th>
                <td className="err-off">{s.predicted.toFixed(3)}</td>
                <td>{s.measured.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="detail-summary">
          A mole of aluminium and a mole of tungsten take the same heat to warm by a degree.
          A kilogram of aluminium takes{' '}
          {(dulongPetitSpecificHeat(element('Al').atomic_mass) /
            dulongPetitSpecificHeat(element('W').atomic_mass)).toFixed(1)}× as much as a
          kilogram of tungsten, and the ratio is just the ratio of their atomic masses
          upside down.
        </p>
      </aside>
    </div>
  );
}

/* ================================================================ stress == */

function StressPanel() {
  const [matId, setMatId] = useRouteEnum('mat', 'al', MATERIAL_IDS);
  const [dT, setDT] = useRouteNumber('dt', 100, 5, 500);
  const [alloyId, setAlloyId] = useRouteEnum('alloy', ALLOY_IDS[0], ALLOY_IDS);
  const mat = THERMAL_MATERIALS.find((m) => m.id === matId)!;
  const alloy = FRACTURE_ALLOYS.find((a) => a.id === alloyId)!;

  const sigma = thermalStress(mat.modulus, mat.alpha, dT);
  const dTtoStrength = deltaTForStress(mat.modulus, mat.alpha, mat.strength);
  // Metres from `failure/model.ts`, converted here only for display.
  const ac = criticalCrackSize(alloy.kic, Math.max(sigma, 1e-6), 1) * 1000;

  const sxT = (t: number) => PAD.l + (t / 500) * plotW;
  const maxSigma = Math.max(400, thermalStress(mat.modulus, mat.alpha, 500));
  const syS = (s: number) => PAD.t + plotH - (s / maxSigma) * plotH;

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select value={matId} onChange={(e) => setMatId(e.target.value)} aria-label="Material">
            {THERMAL_MATERIALS.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
          </select>
        </div>
        <div className="fa-sliders">
          <Slider label="Temperature change ΔT" unit="K" value={dT} min={5} max={500} step={1}
            onChange={setDT} fixed={0} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Thermal stress against temperature change for constrained ${mat.label}`}>
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l + plotW} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />

          {/* Every material at once, so the slope — which is Eα — is the
              comparison rather than a number in a table. */}
          {THERMAL_MATERIALS.map((m) => (
            <line
              key={m.id}
              x1={sxT(0)} y1={syS(0)}
              x2={sxT(500)} y2={syS(thermalStress(m.modulus, m.alpha, 500))}
              className={m.id === matId ? 'tp-line-on' : 'tp-line'}
            />
          ))}

          <line x1={PAD.l} x2={PAD.l + plotW} y1={syS(mat.strength)} y2={syS(mat.strength)}
            className="cp-asymptote" />
          <text x={PAD.l + plotW} y={syS(mat.strength) - 6} className="co-pick-label" textAnchor="end">
            {mat.label} fails around {mat.strength} MPa
          </text>

          <circle cx={sxT(dT)} cy={syS(sigma)} r={5} className="tp-point" />

          {[0, 100, 200, 300, 400, 500].map((t) => (
            <text key={t} x={sxT(t)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">{t}</text>
          ))}
          {[0, 0.5, 1].map((f) => (
            <text key={f} x={PAD.l - 8} y={syS(f * maxSigma) + 4} className="dd-tick" textAnchor="end">
              {Math.round(f * maxSigma)}
            </text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 8} className="dd-tick" textAnchor="middle">
            temperature change ΔT (K)
          </text>
          <text x={18} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 18 ${PAD.t + plotH / 2})`}>thermal stress (MPa)</text>
        </svg>

        <p className="ht-caveat">
          <strong>Nothing here depends on the size of the part.</strong> σ = E·α·ΔT is the
          stress it would take to squeeze the bar back to the length it wanted, and that is a
          stress rather than a force — so a thicker section develops exactly the same one. The
          fix is never more metal; it is an expansion joint, a lower α, or a lower modulus.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{sigma.toFixed(0)} MPa</h2>
        <p className="detail-meta">{mat.label}, fully constrained, ΔT = {dT} K</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">E</th><td>{mat.modulus} GPa</td></tr>
            <tr><th scope="row">α</th><td>{mat.alpha.toFixed(1)} × 10⁻⁶/K</td></tr>
            <tr><th scope="row">E·α</th><td>{(mat.modulus * mat.alpha / 1000).toFixed(3)} MPa/K</td></tr>
            <tr><th scope="row">ΔT to reach {mat.strength} MPa</th>
              <td className={dT >= dTtoStrength ? 'err-off' : 'err-ok'}>{dTtoStrength.toFixed(0)} K</td></tr>
            {mat.element && (
              <tr><th scope="row">α · T<sub>melt</sub></th>
                <td>{expansionMeltProduct(mat.alpha, element(mat.element).melt!).toFixed(4)}</td></tr>
            )}
          </tbody>
        </table>

        {/* The loop into failure: a thermal stress is a stress, so it has a
            critical crack size, computed by that module's own function. */}
        <h3 className="detail-h3">…and what that stress does to a flaw</h3>
        <div className="crystal-controls">
          <select value={alloyId} onChange={(e) => setAlloyId(e.target.value)}
            aria-label="Alloy for the critical crack size">
            {FRACTURE_ALLOYS.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </div>
        <p className="detail-summary">
          At {sigma.toFixed(0)} MPa, a through-thickness flaw in {alloy.name} runs unstable
          past <strong>{ac < 1000 ? `${ac.toFixed(2)} mm` : 'any practical size'}</strong>.
          Critical crack size goes as 1/σ², and the stress goes as ΔT — so doubling the
          temperature swing quarters the flaw you can live with. That is why a thermal
          transient is a fracture problem and not only a strength one.
          The number comes from <a href="#/failure">the failure module</a>'s own
          `criticalCrackSize`, not from a second copy of it.
        </p>
      </aside>
    </div>
  );
}

/* ============================================================ conduction == */

function ConductionPanel() {
  const T = 300;
  const points = METALS.map((m) => ({
    ...m,
    sigma: 1 / (m.resistivity! * 1e-9),
    L: lorenzNumber(m.conductivity, m.resistivity!, T),
  }));

  const sMax = 7e7;
  const kMax = 450;
  const sx = (s: number) => PAD.l + (s / sMax) * plotW;
  const sy = (k: number) => PAD.t + plotH - (k / kMax) * plotH;

  const shock = [...CERAMICS]
    .map((c) => ({
      ...c,
      tsr: thermalShockResistance(c.strength, c.conductivity, c.modulus, c.alpha),
    }))
    .sort((a, b) => b.tsr - a.tsr);
  const tsrMax = Math.max(...shock.map((s) => s.tsr));

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="Thermal against electrical conductivity for nine metals, with the Wiedemann–Franz line">
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l + plotW} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />

          {/* Sommerfeld's prediction: k = L·σ·T, a straight line through the
              origin whose slope is a constant of nature, not of the metal. */}
          <line x1={sx(0)} y1={sy(0)} x2={sx(sMax)} y2={sy(LORENZ_SOMMERFELD * sMax * T)}
            className="tp-rule" />
          <text x={sx(sMax * 0.62)} y={sy(LORENZ_SOMMERFELD * sMax * 0.62 * T) - 8}
            className="co-pick-label" textAnchor="end">
            k = L σ T, L = 2.44 × 10⁻⁸
          </text>

          {points.map((p) => (
            <g key={p.id}>
              <circle cx={sx(p.sigma)} cy={sy(p.conductivity)} r={4} className="tp-measured" />
              <text x={sx(p.sigma) + 6} y={sy(p.conductivity) + 4} className="co-pick-label">
                {p.element}
              </text>
            </g>
          ))}

          {[0, 100, 200, 300, 400].map((k) => (
            <text key={k} x={PAD.l - 8} y={sy(k) + 4} className="dd-tick" textAnchor="end">{k}</text>
          ))}
          {[0, 2, 4, 6].map((s) => (
            <text key={s} x={sx(s * 1e7)} y={PAD.t + plotH + 18} className="dd-tick"
              textAnchor="middle">{s}</text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 8} className="dd-tick" textAnchor="middle">
            electrical conductivity (10⁷ S/m)
          </text>
          <text x={18} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 18 ${PAD.t + plotH / 2})`}>thermal conductivity (W/m·K)</text>
        </svg>

        <p className="ht-caveat">
          <strong>This line is what checks the data.</strong> The electrons that carry charge
          carry heat, so k/σT is nearly a constant of nature rather than a property of the
          metal — and a conductivity entered wrong by a factor of two would sit visibly off
          this line. The nine metals here run{' '}
          {(Math.min(...points.map((p) => p.L)) * 1e8).toFixed(2)}–
          {(Math.max(...points.map((p) => p.L)) * 1e8).toFixed(2)} × 10⁻⁸, against Sommerfeld's
          2.44. Close enough to be a law; loose enough to be interesting.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">Thermal shock</h2>
        <p className="detail-meta">σf·k / (E·α), a figure of merit with units of temperature</p>

        {/* HTML rather than SVG. This sits in the narrow detail column, and an
            SVG scaled to fit it renders its labels at whatever size the column
            happens to be — which is how the first version came out with a
            24-pixel "Alumina" beside a 5-pixel axis on the panel next to it. */}
        <ul className="tp-shock">
          {shock.map((c) => (
            <li key={c.id}>
              <span className="tp-shock-label">{c.label}</span>
              <span className="tp-shock-track">
                <span className="tp-shock-fill" style={{ width: `${(c.tsr / tsrMax) * 100}%` }} />
              </span>
              <span className="tp-shock-value">
                {c.tsr < 1000 ? c.tsr.toFixed(0) : `${(c.tsr / 1000).toFixed(1)}k`}
              </span>
            </li>
          ))}
        </ul>

        <p className="detail-summary">
          Soda-lime and borosilicate have the same flexural strength in Appendix B and moduli
          within 2%, so the whole gap between them is α: 9.0 against 3.3 × 10⁻⁶/K. That is
          the entire reason one dish survives the counter and the other does not. Fused silica
          takes it further — α = 0.55 — which is why it can be taken from a furnace and
          quenched in water.
        </p>

        <p className="detail-summary">
          <strong>Alumina topping the list is the formula talking, not a mistake.</strong>{' '}
          This is the σf·k/(Eα) form, and alumina's conductivity is twenty times a glass's, so
          it wins on the k in the numerator despite an α seven times fused silica's. Drop the
          k — the σf/(Eα) form, which is the one that applies to a quench severe enough that
          conduction cannot keep up — and fused silica leads by an order of magnitude. Two
          figures of merit, two orderings, and which one to use is a question about the
          transient rather than about the material.
        </p>

        <p className="ht-caveat">
          <strong>These five are the least-checked entries in the module.</strong> The metals
          above have their conductivities checked against their resistivities by
          Wiedemann–Franz and their expansions against their melting points; a ceramic has
          neither — no free electrons, and no element row to take a melting point from. What
          they carry is an <em>ordering</em>, and the suite asserts it: fused silica above
          borosilicate above soda-lime, by wide margins. It is weaker, and saying so is better
          than implying otherwise.
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
