import { useMemo } from 'react';
import { useRouteEnum, useRouteNumber, useRouteString } from '../useRoute';
import {
  EMF_SERIES, GALVANIC_SERIES, POURBAIX, electrochemistryFor, getPourbaix, regionAt,
} from '../corrosion/data';
import {
  G102_K_MILS_PER_YEAR, areaRatioFactor, currentDensityToCPR, equivalentWeight,
  galvanicCouple, hydrogenLine, nernstPotential, nernstSlope, oxygenLine,
} from '../corrosion/model';

const W = 660;
const H = 400;
const PAD = { l: 62, r: 24, t: 20, b: 48 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

/** Pourbaix axis bounds. Fixed, so the diagram does not rescale as you drag. */
const PH_MIN = 0;
const PH_MAX = 14;
const PB_E_MIN = -1.8;
const PB_E_MAX = 1.3;

type Panel = 'couple' | 'emf' | 'pourbaix';
const PANELS: Panel[] = ['couple', 'emf', 'pourbaix'];
const PANEL_LABEL: Record<Panel, string> = {
  couple: 'Galvanic couple',
  emf: 'EMF series & Nernst',
  pourbaix: 'Pourbaix diagrams',
};

export function Corrosion() {
  const [panel, setPanel] = useRouteEnum<Panel>('panel', 'couple', PANELS);
  return (
    <div className="fa-wrap">
      <div className="fa-tabs" role="tablist" aria-label="Corrosion topic">
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
      {panel === 'couple' && <CouplePanel />}
      {panel === 'emf' && <EmfPanel />}
      {panel === 'pourbaix' && <PourbaixPanel />}
    </div>
  );
}

/* ================================================================ couple == */

function CouplePanel() {
  const [aName, setAName] = useRouteString('a', 'Carbon steel');
  const [bName, setBName] = useRouteString('b', 'Copper');
  const [anodeArea, setAnodeArea] = useRouteNumber('aa', 10, 0.1, 100);
  const [cathodeArea, setCathodeArea] = useRouteNumber('ca', 10, 0.1, 100);
  // Log-scaled: measured corrosion current densities span 0.01–1000 µA/cm².
  const [logI, setLogI] = useRouteNumber('logi', 0, -2, 3);

  const a = GALVANIC_SERIES.find((g) => g.name === aName) ?? GALVANIC_SERIES[19];
  const b = GALVANIC_SERIES.find((g) => g.name === bName) ?? GALVANIC_SERIES[11];
  const couple = galvanicCouple(a, b);
  const anodeIsA = couple.anode === a.name;
  const ratio = areaRatioFactor(cathodeArea, anodeArea);

  // Vertical scale of the whole series, so the gap is visible rather than stated.
  const eMin = -1.7;
  const eMax = 0.35;
  const sy = (e: number) => PAD.t + plotH - ((e - eMin) / (eMax - eMin)) * plotH;

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select value={aName} onChange={(e) => setAName(e.target.value)} aria-label="First metal">
            {GALVANIC_SERIES.map((g) => (<option key={g.name} value={g.name}>{g.name}</option>))}
          </select>
          <select value={bName} onChange={(e) => setBName(e.target.value)} aria-label="Second metal">
            {GALVANIC_SERIES.map((g) => (<option key={g.name} value={g.name}>{g.name}</option>))}
          </select>
        </div>
        <div className="fa-sliders">
          <Slider label="Anode area" unit="cm²" value={anodeArea} min={0.1} max={100} step={0.1} onChange={setAnodeArea} fixed={1} />
          <Slider label="Cathode area" unit="cm²" value={cathodeArea} min={0.1} max={100} step={0.1} onChange={setCathodeArea} fixed={1} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="Galvanic series in seawater, with the selected couple marked">
          <line x1={PAD.l + 90} x2={PAD.l + 90} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          {GALVANIC_SERIES.map((g) => {
            const picked = g.name === a.name || g.name === b.name;
            return (
              <g key={g.name}>
                <circle cx={PAD.l + 90} cy={sy(g.potential)} r={picked ? 6 : 3}
                  className={picked ? (g.name === couple.anode ? 'co-anode' : 'co-cathode') : 'co-dot'} />
                {picked && (
                  <text x={PAD.l + 104} y={sy(g.potential) + 4} className="co-pick-label">
                    {g.name} · {g.potential.toFixed(2)} V
                    {g.name === couple.anode ? ' — corrodes' : ' — protected'}
                  </text>
                )}
              </g>
            );
          })}
          {[0, -0.5, -1, -1.5].map((e) => (
            <text key={e} x={PAD.l + 78} y={sy(e) + 4} className="dd-tick" textAnchor="end">{e.toFixed(1)}</text>
          ))}
          <text x={20} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 20 ${PAD.t + plotH / 2})`}>potential in seawater (V vs SCE)</text>
          <text x={PAD.l + 90} y={PAD.t - 6} className="ht-edge-label" textAnchor="middle">noble</text>
          <text x={PAD.l + 90} y={PAD.t + plotH + 18} className="ht-edge-label" textAnchor="middle">active</text>
        </svg>

        <p className="ht-caveat">
          <strong>Ordering is the data; the voltages are typical.</strong> The sequence of this
          series in seawater is well established, but the potential of any alloy shifts with
          aeration, flow and temperature. Use the order to decide what corrodes, and the gap only
          as a measure of how strongly the couple is driven.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{couple.anode}</h2>
        <p className="detail-meta">corrodes; {couple.cathode} is protected</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">Driving voltage</th><td>{couple.emf.toFixed(2)} V</td></tr>
            <tr><th scope="row">{a.name}</th><td>{a.potential.toFixed(2)} V {anodeIsA ? '(anode)' : '(cathode)'}</td></tr>
            <tr><th scope="row">{b.name}</th><td>{b.potential.toFixed(2)} V {anodeIsA ? '(cathode)' : '(anode)'}</td></tr>
            <tr><th scope="row">Cathode : anode area</th>
              <td className={ratio > 5 ? 'err-off' : 'err-ok'}>{ratio.toFixed(1)} : 1</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          {couple.emf < 0.05
            ? `${a.name} and ${b.name} sit within ${(couple.emf * 1000).toFixed(0)} mV of one another, so there is almost no driving force. Pairing metals that are close in the series is the standard way to make a galvanic couple harmless.`
            : `A ${couple.emf.toFixed(2)} V difference drives ${couple.anode} to corrode wherever the two are in electrical contact and a conducting electrolyte bridges them. Break any one of those three and nothing happens.`}
        </p>

        {ratio > 5 && (
          <p className="ht-caveat">
            <strong>Unfavourable area ratio.</strong> The cathode is {ratio.toFixed(0)}× the anode,
            so the current the large cathode draws is concentrated into a small anode. It is the
            current <em>density</em> that removes metal, so the {couple.anode} penetrates roughly{' '}
            {ratio.toFixed(0)}× faster than it would with equal areas. This is why a steel bolt in a
            copper plate perforates, while a copper bolt in a steel plate is a nuisance at worst.
          </p>
        )}

        <RatePanel anode={couple.anode} ratio={ratio} logI={logI} setLogI={setLogI} />

        <div className="density-box">
          <h3>Three things are needed</h3>
          <p className="density-note">
            A galvanic cell needs an anode, a cathode, and an electrolyte joining them while the
            metals are electrically connected. Every practical remedy removes one: insulate the
            joint, paint the <em>cathode</em> (never only the anode — that shrinks the anode area
            and makes it worse), or choose metals closer together in the series.
          </p>
        </div>

        {(a.note || b.note) && (
          <p className="trend-note">{a.note ?? b.note}</p>
        )}
      </aside>
    </div>
  );
}

/**
 * Voltage says which way; current density says how fast. The module is
 * otherwise entirely thermodynamic and says so, which leaves a student unable
 * to answer the only question an engineer asks.
 *
 * The current density is an **input**. i_corr cannot be predicted from the
 * couple — it depends on the electrolyte, aeration, flow and the polarisation
 * behaviour of both metals — so the control is framed as "suppose you
 * measured", and the panel never presents it as something derived here.
 */
const PLATE_MM = 3;
const PLATE_YEARS = [1, 5, 20];

function RatePanel({
  anode, ratio, logI, setLogI,
}: {
  anode: string;
  ratio: number;
  logI: number;
  setLogI: (v: number) => void;
}) {
  const chem = electrochemistryFor(anode);
  const i = 10 ** logI;

  if (!chem) {
    return (
      <div className="density-box">
        <h3>How fast?</h3>
        <p className="density-note">
          No penetration rate is offered for <strong>{anode}</strong>. Faraday’s law needs an
          equivalent weight, and for a multi-phase alloy that is a composition-weighted average
          rather than A/n — not something derivable from anything this module ships. Pick an
          elemental anode (zinc, copper, aluminium, magnesium…) or carbon steel to see the
          arithmetic.
        </p>
      </div>
    );
  }

  const EW = equivalentWeight(chem.atomicMass, chem.valence);
  // The area ratio concentrates the same total current into a smaller anode,
  // and it is the anodic current *density* that removes metal.
  const iAnode = i * ratio;
  const mmPerYear = currentDensityToCPR(iAnode, EW, chem.density);
  const milsPerYear = currentDensityToCPR(iAnode, EW, chem.density, G102_K_MILS_PER_YEAR);
  const yearsToPerforate = mmPerYear > 0 ? PLATE_MM / mmPerYear : Infinity;

  return (
    <div className="density-box">
      <h3>How fast? — Faraday’s law</h3>
      <p className="density-eq">CR = K·(i / ρ)·EW</p>

      <Slider
        label="Suppose you measured"
        unit="µA/cm² at equal areas"
        value={logI}
        min={-2}
        max={3}
        step={0.1}
        onChange={setLogI}
        display={i < 1 ? i.toFixed(2) : i.toFixed(1)}
      />

      <table className="detail-props">
        <tbody>
          <tr><th scope="row">Equivalent weight</th><td>{EW.toFixed(2)} g/eq</td></tr>
          <tr><th scope="row">Density</th><td>{chem.density} g/cm³</td></tr>
          <tr>
            <th scope="row">i at the anode</th>
            <td>{(iAnode < 1 ? iAnode.toFixed(2) : iAnode.toFixed(1))} µA/cm²</td>
          </tr>
          <tr>
            <th scope="row">Penetration</th>
            <td>{mmPerYear < 0.01 ? mmPerYear.toExponential(2) : mmPerYear.toFixed(3)} mm/yr</td>
          </tr>
          <tr>
            <th scope="row"> in mils per year</th>
            <td>{milsPerYear < 0.01 ? milsPerYear.toExponential(2) : milsPerYear.toFixed(2)} mpy</td>
          </tr>
        </tbody>
      </table>

      <p className="density-note">
        A {PLATE_MM} mm plate of {anode.toLowerCase()} loses{' '}
        {PLATE_YEARS.map((y, idx) => {
          const lost = Math.min(mmPerYear * y, PLATE_MM);
          return (
            <span key={y}>
              {idx > 0 ? ', ' : ''}
              <strong>
                {lost >= PLATE_MM ? `all ${PLATE_MM} mm` : `${lost.toFixed(lost < 0.1 ? 3 : 2)} mm`}
              </strong>{' '}
              in {y} year{y === 1 ? '' : 's'}
            </span>
          );
        })}
        {'. '}
        {yearsToPerforate <= 200
          ? `It perforates after about ${yearsToPerforate < 1 ? `${(yearsToPerforate * 12).toFixed(1)} months` : `${yearsToPerforate.toFixed(1)} years`}.`
          : 'At that rate it outlasts any structure it could be part of.'}
      </p>

      <p className="ht-caveat">
        <strong>i_corr is a measurement, not a prediction.</strong> Nothing on this page can derive
        it: the driving voltage sets the <em>direction</em>, and the kinetics of the electrolyte set
        the <em>rate</em>. A 1.6 V couple in dry air corrodes at nothing at all. What the couple
        does control is the geometry term — the {ratio.toFixed(1)} : 1 area ratio above
        multiplies the anodic current density by {ratio.toFixed(1)}, and that is why the same pair
        of metals can be harmless or perforate in a season.
      </p>

      <p className="density-note">{chem.basis}</p>
    </div>
  );
}

/* =================================================================== emf == */

function EmfPanel() {
  const [metal, setMetal] = useRouteString('metal', 'Zinc');
  const [logMolar, setLogMolar] = useRouteNumber('c', 0, -6, 0);
  const [tempC, setTempC] = useRouteNumber('T', 25, 0, 100);

  const metals = EMF_SERIES.filter((e) => e.metal);
  const entry = metals.find((e) => e.metal === metal) ?? metals[0];
  const molar = 10 ** logMolar;
  const T_K = tempC + 273.15;
  const E = nernstPotential(entry.E0, entry.n, molar, T_K);

  const eMin = -3.1;
  const eMax = 1.6;
  const sy = (e: number) => PAD.t + plotH - ((e - eMin) / (eMax - eMin)) * plotH;

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select value={metal} onChange={(e) => setMetal(e.target.value)} aria-label="Metal">
            {metals.map((m) => (<option key={m.metal} value={m.metal!}>{m.metal}</option>))}
          </select>
        </div>
        <div className="fa-sliders">
          <Slider label="Ion activity" unit={`mol/L (10^${logMolar.toFixed(1)})`} value={logMolar}
            min={-6} max={0} step={0.1} onChange={setLogMolar} fixed={1} />
          <Slider label="Temperature" unit="°C" value={tempC} min={0} max={100} step={1} onChange={setTempC} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="Standard EMF series with the selected half-cell marked">
          <line x1={PAD.l + 70} x2={PAD.l + 70} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          {/* The hydrogen reference: everything below it is displaced by acid. */}
          <line x1={PAD.l + 40} x2={W - PAD.r} y1={sy(0)} y2={sy(0)} className="fa-yield" />
          <text x={W - PAD.r} y={sy(0) - 6} className="ht-edge-label" textAnchor="end">
            H⁺/H₂ reference, 0 V
          </text>
          {EMF_SERIES.map((e) => {
            const picked = e.metal === entry.metal;
            return (
              <g key={e.reaction}>
                <circle cx={PAD.l + 70} cy={sy(e.E0)} r={picked ? 6 : 3}
                  className={picked ? 'co-cathode' : 'co-dot'} />
                {picked && (
                  <text x={PAD.l + 84} y={sy(e.E0) + 4} className="co-pick-label">
                    {e.reaction} · E° = {e.E0.toFixed(3)} V
                  </text>
                )}
              </g>
            );
          })}
          {/* Where the Nernst shift puts it. */}
          <circle cx={PAD.l + 70} cy={sy(E)} r={5} className="co-anode" />
          <text x={PAD.l + 84} y={sy(E) + 18} className="co-pick-label">
            at {fmtMolar(molar)}: E = {E.toFixed(3)} V
          </text>
          {[1, 0, -1, -2, -3].map((e) => (
            <text key={e} x={PAD.l + 58} y={sy(e) + 4} className="dd-tick" textAnchor="end">{e}</text>
          ))}
          <text x={20} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 20 ${PAD.t + plotH / 2})`}>standard potential (V vs SHE)</text>
        </svg>

        <p className="ht-caveat">
          <strong>This is not the galvanic series.</strong> The EMF series ranks pure metals in
          1 M solution of their own ions. Real alloys in seawater rank differently — passive
          stainless sits near copper there, though chromium and iron are both far below copper
          here — because passivity is an oxide film, not a standard potential. Use the galvanic
          series for engineering decisions and this one for the thermodynamics.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{E.toFixed(3)} V</h2>
        <p className="detail-meta">{entry.metal} at {fmtMolar(molar)}, {tempC} °C</p>

        <p className="density-eq">E = E° + (RT/nF)·ln[Mⁿ⁺]</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">E° (standard)</th><td>{entry.E0.toFixed(3)} V</td></tr>
            <tr><th scope="row">Electrons n</th><td>{entry.n}</td></tr>
            <tr><th scope="row">Nernst slope</th><td>{(nernstSlope(T_K) * 1000).toFixed(1)} mV/decade</td></tr>
            <tr><th scope="row">Shift from standard</th><td>{((E - entry.E0) * 1000).toFixed(0)} mV</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          Diluting the metal ion makes the metal <em>more active</em>, by{' '}
          {(nernstSlope(T_K) / entry.n * 1000).toFixed(0)} mV for every factor of ten. That is the
          mechanism behind crevice corrosion: the solution inside a crevice becomes depleted, so the
          metal there turns anodic to the identical metal just outside it, and a joint corrodes
          without any second metal being involved at all.
        </p>

        <div className="density-box">
          <h3>Reading the series</h3>
          <p className="density-note">
            Anything below the hydrogen line is displaced by acid — which is why iron, zinc and
            aluminium dissolve in it and copper, silver and gold do not. The further apart two
            metals sit, the harder their couple is driven.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================== pourbaix == */

function PourbaixPanel() {
  const [metalId, setMetalId] = useRouteString('m', 'fe');
  const [pH, setPH] = useRouteNumber('pH', 7, 0, 14);
  const [E, setE] = useRouteNumber('E', 0, -1.6, 1.2);

  const metal = getPourbaix(metalId);
  const region = regionAt(metal, pH, E);

  const sx = (v: number) => PAD.l + ((v - PH_MIN) / (PH_MAX - PH_MIN)) * plotW;
  const sy = (v: number) => PAD.t + plotH - ((v - PB_E_MIN) / (PB_E_MAX - PB_E_MIN)) * plotH;

  // Scales are rebuilt inside the memo rather than closed over, for the same
  // reason as in the failure module: a memo that captures a scale function can
  // keep drawing an axis that has since changed.
  const waterLines = useMemo(() => {
    const px = (v: number) => PAD.l + ((v - PH_MIN) / (PH_MAX - PH_MIN)) * plotW;
    const py = (v: number) => PAD.t + plotH - ((v - PB_E_MIN) / (PB_E_MAX - PB_E_MIN)) * plotH;
    const h: string[] = [];
    const o: string[] = [];
    for (let p = PH_MIN; p <= PH_MAX; p += 0.5) {
      h.push(`${px(p)},${py(hydrogenLine(p))}`);
      o.push(`${px(p)},${py(oxygenLine(p))}`);
    }
    return { h: h.join(' '), o: o.join(' ') };
  }, []);

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select value={metalId} onChange={(e) => setMetalId(e.target.value)} aria-label="Metal">
            {POURBAIX.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
        <div className="fa-sliders">
          <Slider label="pH" unit="" value={pH} min={0} max={14} step={0.1} onChange={setPH} fixed={1} />
          <Slider label="Potential" unit="V vs SHE" value={E} min={-1.6} max={1.2} step={0.02} onChange={setE} fixed={2} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Simplified Pourbaix diagram for ${metal.name}`}>
          {metal.regions.map((r) => {
            const xs = r.points.map((p) => p[0]);
            const ys = r.points.map((p) => p[1]);
            const x = sx(Math.min(...xs));
            const y = sy(Math.max(...ys));
            return (
              <rect key={r.label} x={x} y={y}
                width={sx(Math.max(...xs)) - x}
                height={sy(Math.min(...ys)) - y}
                className={`co-${r.kind}`} />
            );
          })}
          {metal.regions.map((r) => {
            const xs = r.points.map((p) => p[0]);
            const ys = r.points.map((p) => p[1]);
            return (
              <text key={`${r.label}-t`}
                x={sx((Math.min(...xs) + Math.max(...xs)) / 2)}
                y={sy((Math.min(...ys) + Math.max(...ys)) / 2)}
                className="co-region-label" textAnchor="middle">{r.label}</text>
            );
          })}

          {/* Water's own stability limits — exact, from the Nernst equation. */}
          <polyline points={waterLines.h} className="co-water" />
          <polyline points={waterLines.o} className="co-water" />
          <text x={sx(1)} y={sy(oxygenLine(1)) - 6} className="ht-edge-label">O₂ line</text>
          <text x={sx(1)} y={sy(hydrogenLine(1)) - 6} className="ht-edge-label">H₂ line</text>

          <circle cx={sx(pH)} cy={sy(E)} r={6} className="co-anode" />

          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          {[0, 2, 4, 6, 8, 10, 12, 14].map((p) => (
            <text key={p} x={sx(p)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">{p}</text>
          ))}
          {[-1.5, -1, -0.5, 0, 0.5, 1].map((e) => (
            <text key={e} x={PAD.l - 8} y={sy(e) + 4} className="dd-tick" textAnchor="end">{e}</text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 8} className="dd-tick" textAnchor="middle">pH</text>
          <text x={16} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 16 ${PAD.t + plotH / 2})`}>potential (V vs SHE)</text>
        </svg>

        <p className="trend-note">{metal.note}</p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{region ? region.label : 'off the diagram'}</h2>
        <p className="detail-meta">at pH {pH.toFixed(1)}, {E.toFixed(2)} V</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">Verdict</th>
              <td className={region?.kind === 'corrosion' ? 'err-off' : 'err-ok'}>
                {region ? VERDICT[region.kind] : '—'}
              </td></tr>
            <tr><th scope="row">H₂ line here</th><td>{hydrogenLine(pH).toFixed(3)} V</td></tr>
            <tr><th scope="row">O₂ line here</th><td>{oxygenLine(pH).toFixed(3)} V</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          {E < hydrogenLine(pH)
            ? 'Below the hydrogen line: water itself is unstable here and hydrogen is evolved. Cathodic protection works in this band, and over-protecting a high-strength steel into it can charge the metal with hydrogen and embrittle it.'
            : E > oxygenLine(pH)
              ? 'Above the oxygen line: water is oxidised and oxygen is evolved. Few practical environments reach here without an applied potential.'
              : 'Between the two water lines — the band in which real aqueous environments sit. Aerated water sits near the upper line, deaerated water near the lower.'}
        </p>

        <p className="ht-caveat">
          <strong>Thermodynamics, not rate.</strong> A Pourbaix diagram says which phase is
          stable, never how fast anything happens. A region marked corrosion may corrode
          imperceptibly slowly, and passivation depends on a film that abrasion or chloride can
          strip. These boundaries are also straight-line simplifications of curves, drawn for an
          ion activity of 10⁻⁶ M at 25 °C.
        </p>

        <div className="density-box">
          <h3>Two ways out</h3>
          <p className="density-note">
            The diagram shows the only two thermodynamic escapes from corrosion: push the
            potential down into immunity, which is cathodic protection, or move the chemistry into
            a passive field, which is what alloying with chromium and controlling pH achieve.
          </p>
        </div>
      </aside>
    </div>
  );
}

const VERDICT: Record<string, string> = {
  immunity: 'immune — the metal is stable',
  corrosion: 'corrodes — the ion is stable',
  passivation: 'passivates — a protective oxide is stable',
};

/* ================================================================ shared == */

/**
 * `display` exists for the log-scaled sliders: the input's own value is the
 * exponent, which is not the quantity anyone reads. It also becomes
 * `aria-valuetext`, so a screen reader hears "1.0 µA/cm²" rather than the
 * exponent 0. (When U6/U9 lift this into a shared control, that pairing is the
 * part to keep.)
 */
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

function fmtMolar(m: number): string {
  if (m >= 0.1) return `${m.toFixed(2)} M`;
  return `${m.toExponential(1)} M`;
}
