import { useMemo } from 'react';
import { useRouteEnum, useRouteNumber } from '../useRoute';
import {
  PE_AMORPHOUS,
  PE_GRADES,
  POLYMERS,
  peCrystallineDensity,
} from '../polymer/polymers';
import {
  chainDimensions,
  dispersity,
  displayRange,
  histogram,
  livingDispersity,
  livingGrowth,
  numberAverageDp,
  percentCrystallinity,
  stepGrowth,
  stepGrowthDispersity,
  weightAverageDp,
} from '../polymer/model';

const W = 660;
const H = 400;
const PAD = { l: 62, r: 24, t: 20, b: 48 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;
const BARS = 40;

const POLYMER_IDS = POLYMERS.map((p) => p.id);

type Route = 'step' | 'living';
const ROUTES: Route[] = ['step', 'living'];

type Panel = 'weight' | 'chain' | 'crystallinity';
const PANELS: Panel[] = ['weight', 'chain', 'crystallinity'];
const PANEL_LABEL: Record<Panel, string> = {
  weight: 'Molecular weight',
  chain: 'Chain dimensions',
  crystallinity: 'Crystallinity',
};

export function Polymers() {
  const [panel, setPanel] = useRouteEnum<Panel>('panel', 'weight', PANELS);
  return (
    <div className="fa-wrap">
      <div className="fa-tabs" role="tablist" aria-label="Polymer topic">
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
      {panel === 'weight' && <WeightPanel />}
      {panel === 'chain' && <ChainPanel />}
      {panel === 'crystallinity' && <CrystallinityPanel />}
    </div>
  );
}

/**
 * The synthesis, shared by the first two panels: the degree of polymerisation
 * the distribution gives is the chain length the next panel measures.
 */
function useSynthesis() {
  const [polyId, setPolyId] = useRouteEnum('poly', 'pe', POLYMER_IDS);
  const [route, setRoute] = useRouteEnum<Route>('route', 'step', ROUTES);
  // Conversion stops at 0.99 — the interesting range is entirely in the last
  // per cent, and past it the distribution is thousands of terms long for a
  // curve that has stopped changing shape.
  const [p, setP] = useRouteNumber('p', 0.95, 0.5, 0.99);
  const [nu, setNu] = useRouteNumber('nu', 100, 10, 800);
  const polymer = POLYMERS.find((x) => x.id === polyId)!;

  const dist = useMemo(
    () => (route === 'step' ? stepGrowth(p) : livingGrowth(nu)),
    [route, p, nu],
  );

  const xn = numberAverageDp(dist);
  const xw = weightAverageDp(dist);
  return {
    polymer, setPolyId, route, setRoute, p, setP, nu, setNu, dist,
    xn,
    xw,
    dispersity: dispersity(dist),
    mn: xn * polymer.mass,
    mw: xw * polymer.mass,
  };
}

function SynthesisControls({
  polyId, route, p, nu, setPolyId, setRoute, setP, setNu,
}: {
  polyId: string; route: Route; p: number; nu: number;
  setPolyId: (v: string) => void; setRoute: (v: Route) => void;
  setP: (v: number) => void; setNu: (v: number) => void;
}) {
  return (
    <>
      <div className="crystal-controls">
        <select value={polyId} onChange={(e) => setPolyId(e.target.value)} aria-label="Polymer">
          {POLYMERS.map((p2) => (
            <option key={p2.id} value={p2.id}>{p2.label}</option>
          ))}
        </select>
        <button
          className={`toggle ${route === 'step' ? 'toggle-on' : ''}`}
          aria-pressed={route === 'step'}
          onClick={() => setRoute('step')}
        >
          Step growth
        </button>
        <button
          className={`toggle ${route === 'living' ? 'toggle-on' : ''}`}
          aria-pressed={route === 'living'}
          onClick={() => setRoute('living')}
        >
          Living chain growth
        </button>
      </div>
      <div className="fa-sliders">
        {route === 'step' ? (
          <Slider label="Extent of reaction p" unit="" value={p} min={0.5} max={0.99} step={0.005}
            onChange={setP} display={p.toFixed(3)} />
        ) : (
          <Slider label="Monomers added per chain ν" unit="" value={nu} min={10} max={800}
            step={1} onChange={setNu} fixed={0} />
        )}
      </div>
    </>
  );
}

/* ================================================================ weight == */

function WeightPanel() {
  const s = useSynthesis();
  const bars = useMemo(() => histogram(s.dist, BARS, displayRange(s.dist)), [s.dist]);

  const maxDp = bars[bars.length - 1].dp;
  const peak = Math.max(...bars.flatMap((b) => [b.x, b.w]));
  const sx = (dp: number) => PAD.l + (dp / maxDp) * plotW;
  const sy = (v: number) => PAD.t + plotH - (v / peak) * plotH;
  const barW = Math.max(1, (plotW / BARS) * 0.42);

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <SynthesisControls
          polyId={s.polymer.id} route={s.route} p={s.p} nu={s.nu}
          setPolyId={s.setPolyId} setRoute={s.setRoute} setP={s.setP} setNu={s.setNu}
        />

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Chain length distribution for ${s.polymer.label}, by number and by weight`}>
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l + plotW} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />

          {bars.map((b, i) => (
            <g key={i}>
              <rect className="py-bar-x" x={sx(b.dp) - barW} y={sy(b.x)}
                width={barW} height={PAD.t + plotH - sy(b.x)} />
              <rect className="py-bar-w" x={sx(b.dp)} y={sy(b.w)}
                width={barW} height={PAD.t + plotH - sy(b.w)} />
            </g>
          ))}

          {/* The two averages of one sample, marked where they fall. That they
              are different numbers is the panel's entire point, so they are
              drawn rather than only printed. */}
          <line x1={sx(s.xn)} x2={sx(s.xn)} y1={PAD.t} y2={PAD.t + plotH} className="py-mn" />
          <line x1={sx(s.xw)} x2={sx(s.xw)} y1={PAD.t} y2={PAD.t + plotH} className="py-mw" />
          <text x={sx(s.xn) + 5} y={PAD.t + 14} className="co-pick-label">X̄n = {s.xn.toFixed(0)}</text>
          <text x={sx(s.xw) + 5} y={PAD.t + 30} className="co-pick-label">X̄w = {s.xw.toFixed(0)}</text>

          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <text key={f} x={PAD.l + f * plotW} y={PAD.t + plotH + 18} className="dd-tick"
              textAnchor="middle">{Math.round(f * maxDp)}</text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 8} className="dd-tick" textAnchor="middle">
            degree of polymerisation
          </text>
          <text x={18} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 18 ${PAD.t + plotH / 2})`}>fraction of the sample</text>

          <rect x={PAD.l + plotW - 176} y={PAD.t + 4} width={10} height={10} className="py-bar-x" />
          <text x={PAD.l + plotW - 162} y={PAD.t + 13} className="co-pick-label">by number</text>
          <rect x={PAD.l + plotW - 84} y={PAD.t + 4} width={10} height={10} className="py-bar-w" />
          <text x={PAD.l + plotW - 70} y={PAD.t + 13} className="co-pick-label">by weight</text>
        </svg>

        <p className="ht-caveat">
          <strong>Two histograms, one sample.</strong> The pale bars count chains — every
          molecule votes once, however big. The solid bars weigh them, so a chain twice the
          size counts twice. They are the same polymer, and they do not have the same average:
          that is what an osmometer and a light-scattering instrument disagree about, and
          neither of them is wrong.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">Đ = {s.dispersity.toFixed(3)}</h2>
        <p className="detail-meta">
          {s.route === 'step'
            ? `step growth at ${(s.p * 100).toFixed(1)}% conversion`
            : `living growth, ν = ${s.nu}`}
        </p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">Repeat unit</th>
              <td>{s.polymer.formula}, {s.polymer.mass.toFixed(2)} g/mol</td></tr>
            <tr><th scope="row">X̄n</th><td>{s.xn.toFixed(1)}</td></tr>
            <tr><th scope="row">X̄w</th><td>{s.xw.toFixed(1)}</td></tr>
            <tr><th scope="row">M̄n</th><td>{Math.round(s.mn).toLocaleString()} g/mol</td></tr>
            <tr><th scope="row">M̄w</th><td>{Math.round(s.mw).toLocaleString()} g/mol</td></tr>
            <tr><th scope="row">Closed form</th>
              <td>{s.route === 'step'
                ? `1 + p = ${stepGrowthDispersity(s.p).toFixed(3)}`
                : `1 + ν/(1+ν)² = ${livingDispersity(s.nu).toFixed(3)}`}</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          {s.route === 'step'
            ? `X̄n = 1/(1−p), so a hundred-mer needs 99% conversion and a thousand-mer needs 99.9%. That is why a condensation polymer is a purity problem before it is a chemistry problem: an impurity that caps one chain end in a hundred puts a ceiling on the molecular weight no amount of further reaction can lift. And the dispersity is 1 + p — pinned near 2 whatever you do.`
            : `Every chain starts at the same moment and grows for the same time, so the lengths are Poisson about ν and the dispersity is 1 + ν/(1+ν)² — approaching 1 as the chains get longer, which is the whole reason to run a living polymerisation. Step growth cannot get below 1.5 at any conversion worth having.`}
        </p>

        <p className="ht-caveat">
          <strong>The repeat unit mass is computed, not tabulated.</strong>{' '}
          {s.polymer.formula} is a structure, so its {s.polymer.mass.toFixed(2)} g/mol is
          arithmetic over the same atomic masses the <a href="#/trends">periodic table</a> is
          coloured by. Nothing here restates a molar mass that could drift from the element
          data behind it.
        </p>
      </aside>
    </div>
  );
}

/* ================================================================= chain == */

function ChainPanel() {
  const s = useSynthesis();
  const bonds = Math.round(s.xn) * s.polymer.backboneBonds;
  const { contour, endToEnd } = chainDimensions(bonds);

  // One scale for both, or the comparison is not a comparison.
  const scale = (plotW - 40) / contour;

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <SynthesisControls
          polyId={s.polymer.id} route={s.route} p={s.p} nu={s.nu}
          setPolyId={s.setPolyId} setRoute={s.setRoute} setP={s.setP} setNu={s.setNu}
        />

        <svg className="ht-plot" viewBox={`0 0 ${W} 260`} role="img"
          aria-label={`Contour length against end-to-end distance for a ${bonds}-bond chain`}>
          <text x={PAD.l} y={40} className="dd-tick">pulled straight — contour length</text>
          <line x1={PAD.l} x2={PAD.l + contour * scale} y1={60} y2={60} className="py-contour" />
          <text x={PAD.l} y={82} className="co-pick-label">{contour.toFixed(1)} nm</text>

          <text x={PAD.l} y={140} className="dd-tick">left alone — root-mean-square end to end</text>
          <line x1={PAD.l} x2={PAD.l + endToEnd * scale} y1={160} y2={160} className="py-coil" />
          <text x={PAD.l} y={182} className="co-pick-label">{endToEnd.toFixed(2)} nm</text>

          {/* The coil drawn at its own size against the contour bar above it.
              At any useful chain length the second line is a stub, which is
              the fact the panel exists to make unmissable. */}
          <text x={PAD.l} y={222} className="co-pick-label">
            the same chain, {(contour / endToEnd).toFixed(0)}× shorter end to end than it is long
          </text>
        </svg>

        <p className="ht-caveat">
          <strong>Pure geometry, and it is why polymers are not stiff.</strong> The contour
          grows with N and the coil with √N, so the ratio between them keeps growing: a longer
          chain is not a longer object, it is a denser tangle. Stretching a rubber band is
          mostly unwinding coils rather than stretching bonds, which is why its modulus is a
          thousandth of a metal's and why it pulls back when you let go — entropy, not
          bond energy.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{contour.toFixed(0)} nm of chain</h2>
        <p className="detail-meta">in a coil {endToEnd.toFixed(1)} nm across</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">X̄n</th><td>{s.xn.toFixed(0)} repeat units</td></tr>
            <tr><th scope="row">Backbone bonds</th><td>{bonds.toLocaleString()}</td></tr>
            <tr><th scope="row">Contour length L</th><td>{contour.toFixed(1)} nm</td></tr>
            <tr><th scope="row">End to end r</th><td>{endToEnd.toFixed(2)} nm</td></tr>
            <tr><th scope="row">L / r</th><td>{(contour / endToEnd).toFixed(1)}</td></tr>
            <tr><th scope="row">M̄n</th><td>{Math.round(s.mn).toLocaleString()} g/mol</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          L = N·d·sin(θ/2) with a 0.154 nm C–C bond at 109.5°, so each bond advances only
          0.126 nm along the chain axis — the zig-zag costs 18% of the length before anything
          else happens. r = d·√N is the random walk. Both come from the degree of
          polymerisation on the previous panel, so changing the conversion there moves this.
        </p>
      </aside>
    </div>
  );
}

/* ======================================================== crystallinity == */

function CrystallinityPanel() {
  const rhoC = peCrystallineDensity();
  const rhoA = PE_AMORPHOUS;
  const [rho, setRho] = useRouteNumber('rho', 0.945, rhoA, rhoC);
  const pct = percentCrystallinity(rho, rhoA, rhoC);

  const sx = (r: number) => PAD.l + ((r - rhoA) / (rhoC - rhoA)) * plotW;
  const sy = (c: number) => PAD.t + plotH - (c / 100) * plotH;
  const curve = Array.from({ length: 121 }, (_, i) => {
    const r = rhoA + ((rhoC - rhoA) * i) / 120;
    return `${i === 0 ? 'M' : 'L'}${sx(r).toFixed(1)},${sy(percentCrystallinity(r, rhoA, rhoC)).toFixed(1)}`;
  }).join('');

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="fa-sliders">
          <Slider label="Specimen density" unit="g/cm³" value={rho} min={rhoA} max={rhoC}
            step={0.001} onChange={setRho} fixed={3} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="Per cent crystallinity against specimen density for polyethylene">
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l + plotW} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />

          {/* Straight-line interpolation, to show that this is not one. */}
          <line x1={sx(rhoA)} y1={sy(0)} x2={sx(rhoC)} y2={sy(100)} className="py-linear" />
          <path d={curve} className="py-crystallinity" fill="none" />

          {PE_GRADES.map((g) => {
            const c = percentCrystallinity(g.density, rhoA, rhoC);
            return (
              <g key={g.id}>
                <circle cx={sx(g.density)} cy={sy(c)} r={4} className="py-grade" />
                <text x={sx(g.density) + 7} y={sy(c) + 4} className="co-pick-label">
                  {g.label} · {c.toFixed(0)}%
                </text>
              </g>
            );
          })}

          <circle cx={sx(rho)} cy={sy(pct)} r={5} className="py-point" />

          {[0, 25, 50, 75, 100].map((c) => (
            <text key={c} x={PAD.l - 8} y={sy(c) + 4} className="dd-tick" textAnchor="end">{c}</text>
          ))}
          {[rhoA, (rhoA + rhoC) / 2, rhoC].map((r) => (
            <text key={r} x={sx(r)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">
              {r.toFixed(3)}
            </text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 8} className="dd-tick" textAnchor="middle">
            specimen density (g/cm³)
          </text>
          <text x={18} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 18 ${PAD.t + plotH / 2})`}>per cent crystallinity</text>
        </svg>

        <p className="ht-caveat">
          <strong>The faint straight line is what this is not.</strong> Crystallinity is a
          <em> volume</em> fraction read through a <em>mass</em> measurement, so the ρc and ρs
          outside the bracket bend the curve above the interpolation: at the midpoint density
          the specimen is {percentCrystallinity((rhoA + rhoC) / 2, rhoA, rhoC).toFixed(0)}%
          crystalline, not 50%. Half the mass is less than half the volume, because the
          crystal is the denser phase.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{pct.toFixed(1)}% crystalline</h2>
        <p className="detail-meta">polyethylene at {rho.toFixed(3)} g/cm³</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">ρc, from the unit cell</th><td>{rhoC.toFixed(3)} g/cm³</td></tr>
            <tr><th scope="row">ρa, fully amorphous</th><td>{rhoA.toFixed(3)} g/cm³</td></tr>
            {PE_GRADES.map((g) => (
              <tr key={g.id}>
                <th scope="row">{g.label}</th>
                <td>{g.density.toFixed(3)} g/cm³ · {percentCrystallinity(g.density, rhoA, rhoC).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="detail-summary">
          The three grades are the same molecule and differ only in how well it packs. LDPE's
          branches keep the chains apart and it lands near{' '}
          {percentCrystallinity(PE_GRADES[0].density, rhoA, rhoC).toFixed(0)}%; HDPE is
          essentially unbranched and reaches{' '}
          {percentCrystallinity(PE_GRADES[2].density, rhoA, rhoC).toFixed(0)}%. Their densities
          come from the same Appendix B the <a href="#/selection">Ashby chart</a> plots.
        </p>

        <p className="ht-caveat">
          <strong>ρc is derived, not tabulated.</strong> Two ethylene repeat units in an
          orthorhombic cell, through the same n·A/(V·N_A) the{' '}
          <a href="#/crystals">crystal structures</a> module uses for a metal. The cell
          parameters are checked by what they produce: they have to land on 0.998 g/cm³, and
          the three grades above then have to land inside the crystallinity ranges they are
          known for. Only ρa is a measured number standing on its own, and those two checks
          are what keep it honest.
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
