import { useMemo } from 'react';
import { useRouteEnum, useRouteNumber, useRouteString } from '../useRoute';
import { MECH_MATERIALS } from '../mechanical/materials';
import {
  BRITTLE_SOLIDS, FRACTURE_ALLOYS, GROWTH_CLASSES, S590_CURVE,
  S590_P_MAX, S590_P_MIN, getFatigueBehaviour, getFractureAlloy, getGrowthClass,
  s590Parameter, s590Stress,
} from '../failure/materials';
import {
  criticalCrackSize, criticalStress, cyclesToFailure, fatigueStrength, fitSn,
  griffithCrackLength, growthRate, larsonMiller, lefmSizeRequirement,
  parisLife, plasticZoneRadius, ruptureHours, stressIntensity,
} from '../failure/model';

const W = 660;
const H = 380;
const PAD = { l: 66, r: 24, t: 18, b: 50 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

type Panel = 'fracture' | 'fatigue' | 'growth' | 'creep';
const PANELS: Panel[] = ['fracture', 'fatigue', 'growth', 'creep'];
const PANEL_LABEL: Record<Panel, string> = {
  fracture: 'Fracture toughness',
  fatigue: 'Fatigue (S–N)',
  growth: 'Crack growth',
  creep: 'Creep rupture',
};

export function FailureAnalysis() {
  const [panel, setPanel] = useRouteEnum<Panel>('panel', 'fracture', PANELS);

  return (
    <div className="fa-wrap">
      <div className="fa-tabs" role="tablist" aria-label="Failure mode">
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

      {panel === 'fracture' && <FracturePanel />}
      {panel === 'fatigue' && <FatiguePanel />}
      {panel === 'growth' && <GrowthPanel />}
      {panel === 'creep' && <CreepPanel />}
    </div>
  );
}

/* ============================================================== fracture == */

function FracturePanel() {
  const [alloyId, setAlloyId] = useRouteString('alloy', '4340-425');
  const [sigma, setSigma] = useRouteNumber('sigma', 400, 20, 1600);
  const [crackMm, setCrackMm] = useRouteNumber('a', 2, 0.05, 50);
  const [Y, setY] = useRouteNumber('Y', 1, 0.8, 1.5);

  const alloy = getFractureAlloy(alloyId);
  const a = crackMm / 1000;
  const ac = criticalCrackSize(alloy.kic, sigma, Y);
  const K = stressIntensity(sigma, a, Y);
  const sigmaC = criticalStress(alloy.kic, a, Y);
  const ry = plasticZoneRadius(Math.min(K, alloy.kic), alloy.yieldStrength);
  const sizeReq = lefmSizeRequirement(alloy.kic, alloy.yieldStrength);
  const willBreak = K >= alloy.kic;
  // LEFM needs small-scale yielding; past ~80% of yield the assumption is going.
  const nearYield = sigma > 0.8 * alloy.yieldStrength;
  const thinSection = a < sizeReq;

  // sigma_c against crack length, log-log.
  const aMin = 5e-5, aMax = 0.05;
  const sx = (v: number) => PAD.l + (Math.log10(v / aMin) / Math.log10(aMax / aMin)) * plotW;
  const sMin = 10, sMax = 3000;
  const sy = (v: number) =>
    PAD.t + plotH - (Math.log10(Math.max(v, sMin) / sMin) / Math.log10(sMax / sMin)) * plotH;

  const curve = useMemo(() => {
    const px = (v: number) => PAD.l + (Math.log10(v / aMin) / Math.log10(aMax / aMin)) * plotW;
    const py = (v: number) =>
      PAD.t + plotH - (Math.log10(Math.max(v, sMin) / sMin) / Math.log10(sMax / sMin)) * plotH;
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const av = aMin * (aMax / aMin) ** (i / 120);
      pts.push(`${px(av)},${py(criticalStress(alloy.kic, av, Y))}`);
    }
    return pts.join(' ');
  }, [alloy.kic, Y]);

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select value={alloyId} onChange={(e) => setAlloyId(e.target.value)} aria-label="Alloy">
            {FRACTURE_ALLOYS.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div className="fa-sliders">
          <Slider label="Applied stress" unit="MPa" value={sigma} min={20} max={1600} step={10} onChange={setSigma} />
          <Slider label="Crack length a" unit="mm" value={crackMm} min={0.05} max={50} step={0.05} onChange={setCrackMm} fixed={2} />
          <Slider label="Geometry factor Y" unit="" value={Y} min={0.8} max={1.5} step={0.01} onChange={setY} fixed={2} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Critical stress against crack length for ${alloy.name}`}>
          {[1e-4, 1e-3, 1e-2].map((t) => (
            <line key={t} x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={PAD.t + plotH} className="dd-grid" />
          ))}
          {[10, 100, 1000].map((s) => (
            <line key={s} x1={PAD.l} x2={W - PAD.r} y1={sy(s)} y2={sy(s)} className="dd-grid" />
          ))}

          {/* Yield strength: above this the part yields before it fractures. */}
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(alloy.yieldStrength)} y2={sy(alloy.yieldStrength)} className="fa-yield" />
          <text x={W - PAD.r - 4} y={sy(alloy.yieldStrength) - 6} className="ht-edge-label" textAnchor="end">
            yield {alloy.yieldStrength} MPa
          </text>

          <polyline points={curve} className="fa-curve" />

          <line x1={sx(a)} x2={sx(a)} y1={PAD.t} y2={PAD.t + plotH} className="ht-path" />
          <circle cx={sx(a)} cy={sy(Math.min(sigma, sMax))} r={5}
            className={willBreak ? 'fa-dot-bad' : 'fa-dot-ok'} />

          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          {[[1e-4, '0.1'], [1e-3, '1'], [1e-2, '10']].map(([v, l]) => (
            <text key={String(l)} x={sx(v as number)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">{l}</text>
          ))}
          {[10, 100, 1000].map((s) => (
            <text key={s} x={PAD.l - 8} y={sy(s) + 4} className="dd-tick" textAnchor="end">{s}</text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 10} className="dd-tick" textAnchor="middle">crack length (mm, log)</text>
          <text x={16} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 16 ${PAD.t + plotH / 2})`}>critical stress (MPa, log)</text>
        </svg>

        <p className="trend-note">{alloy.note}</p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{(ac * 1000).toFixed(2)} mm</h2>
        <p className="detail-meta">critical crack size at {sigma} MPa</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">K_IC</th><td>{alloy.kic} MPa√m</td></tr>
            <tr><th scope="row">Yield strength</th><td>{alloy.yieldStrength} MPa</td></tr>
            <tr><th scope="row">K at a = {crackMm.toFixed(2)} mm</th>
              <td className={willBreak ? 'err-off' : 'err-ok'}>{K.toFixed(1)} MPa√m</td></tr>
            <tr><th scope="row">Fracture stress at that crack</th><td>{sigmaC.toFixed(0)} MPa</td></tr>
            <tr><th scope="row">Plastic zone r_y</th><td>{(ry * 1000).toFixed(3)} mm</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          {willBreak
            ? `K has reached K_IC: a ${crackMm.toFixed(2)} mm crack runs at ${sigma} MPa. Fast fracture is unstable — once it starts there is no further load increase needed.`
            : `K = ${K.toFixed(1)} MPa√m against a toughness of ${alloy.kic}, so a ${crackMm.toFixed(2)} mm crack holds at ${sigma} MPa. It would take ${(ac * 1000).toFixed(2)} mm to fracture, or ${sigmaC.toFixed(0)} MPa at this crack length.`}
        </p>

        {nearYield && (
          <p className="ht-caveat">
            <strong>Outside LEFM.</strong> At {sigma} MPa you are past 80% of this alloy’s yield
            strength, so the plastic zone is no longer small beside the crack. Linear-elastic
            fracture mechanics stops applying here and the number above understates the tolerable
            flaw — the failure mode is becoming net-section yielding, not fast fracture.
          </p>
        )}
        {!nearYield && thinSection && (
          <p className="ht-caveat">
            <strong>Section-size caveat.</strong> A valid plane-strain measurement needs the crack
            and the remaining ligament to exceed 2.5·(K_IC/σy)² = {(sizeReq * 1000).toFixed(1)} mm
            (ASTM E399). At {crackMm.toFixed(2)} mm this is a thin-section problem, where the real
            toughness is higher than K_IC and this estimate is conservative.
          </p>
        )}

        <div className="density-box">
          <h3>Why it matters</h3>
          <p className="density-note">
            Critical crack size goes as the <em>square</em> of the toughness-to-stress ratio, so
            halving the design stress makes the tolerable flaw four times longer. This is the whole
            argument for damage-tolerant design: choose the stress so that the critical crack is
            comfortably larger than the smallest flaw inspection can reliably find.
          </p>
        </div>

        <GriffithBox />
      </aside>
    </div>
  );
}

/**
 * Griffith is kept in its own box, restricted to brittle solids. Offering it
 * beside the metals above would invite applying it to them, where the plastic
 * work at the crack tip dwarfs the surface energy and the answer is wrong by
 * orders of magnitude.
 */
function GriffithBox() {
  const [solidId, setSolidId] = useRouteString('solid', 'glass');
  const [gStress, setGStress] = useRouteNumber('gs', 40, 5, 300);
  const solid = BRITTLE_SOLIDS.find((s) => s.id === solidId) ?? BRITTLE_SOLIDS[0];
  const flaw = griffithCrackLength(solid.E, solid.gamma, gStress);

  return (
    <div className="density-box">
      <h3>Griffith — brittle solids only</h3>
      <p className="density-note">
        σ_c = √(2·E·γs / π·a). This is the ideally brittle case, where all the work of fracture
        goes into new surface. It does <strong>not</strong> apply to the metals above: their crack
        tips do plastic work that outweighs surface energy by orders of magnitude, which is why
        metals need K_IC instead.
      </p>
      <div className="crystal-controls">
        <select value={solidId} onChange={(e) => setSolidId(e.target.value)} aria-label="Brittle solid">
          {BRITTLE_SOLIDS.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
      </div>
      <Slider label="Applied stress" unit="MPa" value={gStress} min={5} max={300} step={1} onChange={setGStress} />
      <table className="detail-props">
        <tbody>
          <tr><th scope="row">E</th><td>{solid.E} GPa</td></tr>
          <tr><th scope="row">γs</th><td>{solid.gamma} J/m²</td></tr>
          <tr><th scope="row">Largest tolerable flaw</th><td>{(flaw * 1e6).toFixed(1)} µm</td></tr>
        </tbody>
      </table>
      <p className="density-note">{solid.note}</p>
    </div>
  );
}

/* =============================================================== fatigue == */

function FatiguePanel() {
  const [matId, setMatId] = useRouteString('m', 'steel1020');
  const [amp, setAmp] = useRouteNumber('amp', 150, 5, 900);

  const mat = MECH_MATERIALS.find((m) => m.id === matId) ?? MECH_MATERIALS[5];
  const beh = getFatigueBehaviour(mat.id);
  const fit = useMemo(
    () => fitSn(mat.uts, beh.ratio, beh.kneeCycles, beh.hasEnduranceLimit),
    [mat.uts, beh.ratio, beh.kneeCycles, beh.hasEnduranceLimit],
  );
  const life = cyclesToFailure(fit, amp);

  const nMin = 1e3, nMax = 1e9;
  // The Basquin fit is anchored between 10^3 and the knee. Reporting a life
  // four decades past the last anchor would be extrapolation dressed as a
  // measurement — an aluminium alloy at a low amplitude otherwise reads
  // "6757.0B cycles", which is a number nothing in the fit supports.
  const beyondRange = life != null && life > nMax;
  const sx = (n: number) => PAD.l + (Math.log10(n / nMin) / Math.log10(nMax / nMin)) * plotW;
  const yMax = Math.max(mat.uts, 100);
  const sy = (s: number) => PAD.t + plotH - (s / yMax) * plotH;

  // The scales are recomputed inside the memo rather than closed over: a memo
  // keyed on `yMax` that reads an `sy` built from a previous `yMax` is exactly
  // how a chart silently keeps drawing the old axis.
  const curve = useMemo(() => {
    const px = (n: number) => PAD.l + (Math.log10(n / nMin) / Math.log10(nMax / nMin)) * plotW;
    const py = (v: number) => PAD.t + plotH - (v / yMax) * plotH;
    const pts: string[] = [];
    for (let i = 0; i <= 160; i++) {
      const n = nMin * (nMax / nMin) ** (i / 160);
      pts.push(`${px(n)},${py(fatigueStrength(fit, n))}`);
    }
    return pts.join(' ');
  }, [fit, yMax]);

  const decades = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select value={matId} onChange={(e) => setMatId(e.target.value)} aria-label="Material">
            {MECH_MATERIALS.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </div>
        <div className="fa-sliders">
          <Slider label="Stress amplitude" unit="MPa" value={amp} min={5} max={Math.round(mat.uts)} step={1} onChange={setAmp} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Estimated S–N curve for ${mat.name}`}>
          {decades.map((n) => (
            <line key={n} x1={sx(n)} x2={sx(n)} y1={PAD.t} y2={PAD.t + plotH} className="dd-grid" />
          ))}

          {beh.hasEnduranceLimit && (
            <>
              <line x1={sx(beh.kneeCycles)} x2={W - PAD.r} y1={sy(fit.kneeStress)} y2={sy(fit.kneeStress)} className="fa-endurance" />
              <text x={W - PAD.r - 4} y={sy(fit.kneeStress) - 6} className="ht-edge-label" textAnchor="end">
                endurance limit {fit.kneeStress.toFixed(0)} MPa
              </text>
            </>
          )}

          <polyline points={curve} className="fa-curve" />
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(amp)} y2={sy(amp)} className="ht-path" />
          {life != null && life <= nMax && (
            <circle cx={sx(life)} cy={sy(amp)} r={5} className="fa-dot-bad" />
          )}

          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          {decades.map((n) => (
            <text key={n} x={sx(n)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">
              10{sup(Math.log10(n))}
            </text>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <text key={f} x={PAD.l - 8} y={sy(f * yMax) + 4} className="dd-tick" textAnchor="end">
              {Math.round(f * yMax)}
            </text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 10} className="dd-tick" textAnchor="middle">cycles to failure (log)</text>
          <text x={16} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 16 ${PAD.t + plotH / 2})`}>stress amplitude (MPa)</text>
        </svg>

        <p className="ht-caveat">
          <strong>Constructed, not measured.</strong> These curves are estimated from tensile
          strength by the standard design rules — 0.9·UTS at 10³ cycles, and{' '}
          {beh.hasEnduranceLimit
            ? `an endurance limit of ${beh.ratio}·UTS at 10⁶ cycles`
            : `a fatigue strength of ${beh.ratio}·UTS at ${fmtPow(beh.kneeCycles)} cycles`}{' '}
          — with a Basquin power law between. Real S–N data scatters by a factor of several in
          life at a given stress, so read the shape and the comparison, not the exact cycle count.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">
          {life == null ? '∞' : beyondRange ? '> 10⁹' : fmtCycles(life)}
        </h2>
        <p className="detail-meta">cycles at {amp} MPa amplitude</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">Tensile strength</th><td>{mat.uts} MPa</td></tr>
            <tr><th scope="row">Yield strength</th><td>{mat.yield} MPa</td></tr>
            <tr><th scope="row">Endurance limit</th>
              <td className={beh.hasEnduranceLimit ? 'err-ok' : 'err-off'}>
                {beh.hasEnduranceLimit ? `${fit.kneeStress.toFixed(0)} MPa` : 'none'}
              </td></tr>
            <tr><th scope="row">S at 10⁶ cycles</th><td>{fatigueStrength(fit, 1e6).toFixed(0)} MPa</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          {beh.hasEnduranceLimit && life == null
            ? `Below the endurance limit of ${fit.kneeStress.toFixed(0)} MPa, this alloy survives indefinitely: the S–N curve is flat, so no number of cycles at ${amp} MPa will fail it.`
            : life == null
              ? 'No life predicted.'
              : beyondRange
                ? `Past 10⁹ cycles, which is beyond the range this estimate covers — the curve is anchored at 10³ and ${fmtPow(beh.kneeCycles)} cycles, and reading it further out is extrapolation, not prediction. What it does say is that ${amp} MPa is comfortably below the fatigue strength quoted at ${fmtPow(beh.kneeCycles)} cycles.`
                : `${fmtCycles(life)} cycles at ${amp} MPa. ${
                    beh.hasEnduranceLimit
                      ? `Drop the amplitude to ${fit.kneeStress.toFixed(0)} MPa and the life becomes unlimited.`
                      : 'There is no amplitude at which this alloy lasts forever — the curve keeps falling.'
                  }`}
        </p>

        {!beh.hasEnduranceLimit && (
          <p className="ht-caveat">
            <strong>No endurance limit.</strong> {mat.name} is non-ferrous, and non-ferrous alloys
            generally have no fatigue limit: the S–N curve keeps descending, so a design life must
            be stated as a number of cycles rather than as "safe forever". Quoting a single fatigue
            strength for aluminium only means anything if the cycle count is quoted with it —
            here, {fmtPow(beh.kneeCycles)}.
          </p>
        )}

        <div className="density-box">
          <h3>Why fatigue dominates</h3>
          <p className="density-note">
            Most components that fail in service fail here rather than by yielding: the stress
            amplitude that eventually breaks them is a fraction of the yield strength — for{' '}
            {mat.name}, {(fit.kneeStress / mat.yield * 100).toFixed(0)}% of it — and nothing in a
            static strength calculation predicts that.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ========================================================== crack growth == */

function GrowthPanel() {
  const [classId, setClassId] = useRouteString('cls', 'ferritic');
  const [a0Mm, setA0Mm] = useRouteNumber('a0', 1, 0.1, 20);
  const [dSigma, setDSigma] = useRouteNumber('ds', 150, 20, 500);
  const [Y, setY] = useRouteNumber('Y', 1, 0.8, 1.5);

  const cls = getGrowthClass(classId);
  const a0 = a0Mm / 1000;
  const af = criticalCrackSize(cls.kic, dSigma, Y);
  const life = parisLife(cls.C, cls.m, a0, af, dSigma, Y);

  // Crack length against cycles.
  const pts = useMemo(() => {
    if (life == null || life <= 0) return '';
    const out: string[] = [];
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (af - a0) * (i / steps) ** 3; // dense near a0, where growth is slow
      const n = parisLife(cls.C, cls.m, a0, a, dSigma, Y) ?? 0;
      out.push(`${gx(n / life)},${gy(a / af)}`);
    }
    return out.join(' ');
  }, [cls, a0, af, dSigma, Y, life]);

  function gx(f: number) { return PAD.l + f * plotW; }
  function gy(f: number) { return PAD.t + plotH - f * plotH; }

  const kMax = stressIntensity(dSigma, af, Y);
  const belowThreshold = stressIntensity(dSigma, a0, Y) < 3;

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Steel class">
            {GROWTH_CLASSES.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
          </select>
        </div>
        <div className="fa-sliders">
          <Slider label="Initial crack a₀" unit="mm" value={a0Mm} min={0.1} max={20} step={0.1} onChange={setA0Mm} fixed={1} />
          <Slider label="Stress range Δσ" unit="MPa" value={dSigma} min={20} max={500} step={5} onChange={setDSigma} />
          <Slider label="Geometry factor Y" unit="" value={Y} min={0.8} max={1.5} step={0.01} onChange={setY} fixed={2} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Crack length against cycles for ${cls.name}`}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={gx(f)} x2={gx(f)} y1={PAD.t} y2={PAD.t + plotH} className="dd-grid" />
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={PAD.l} x2={W - PAD.r} y1={gy(f)} y2={gy(f)} className="dd-grid" />
          ))}
          <polyline points={pts} className="fa-curve" />
          <line x1={PAD.l} x2={W - PAD.r} y1={gy(1)} y2={gy(1)} className="fa-yield" />
          <text x={W - PAD.r - 4} y={gy(1) - 6} className="ht-edge-label" textAnchor="end">
            a_c = {(af * 1000).toFixed(1)} mm
          </text>
          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <text key={f} x={gx(f)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">
              {life == null ? '—' : fmtCycles(life * f)}
            </text>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <text key={f} x={PAD.l - 8} y={gy(f) + 4} className="dd-tick" textAnchor="end">
              {(af * 1000 * f).toFixed(1)}
            </text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 10} className="dd-tick" textAnchor="middle">cycles</text>
          <text x={16} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 16 ${PAD.t + plotH / 2})`}>crack length (mm)</text>
        </svg>

        <p className="trend-note">{cls.note}</p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{life == null ? '—' : fmtCycles(life)}</h2>
        <p className="detail-meta">cycles from {a0Mm.toFixed(1)} mm to fracture</p>

        <p className="density-eq">da/dN = C·(ΔK)<sup>m</sup>, ΔK = Y·Δσ·√(πa)</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">C</th><td>{cls.C.toExponential(2)} m/cycle</td></tr>
            <tr><th scope="row">m</th><td>{cls.m}</td></tr>
            <tr><th scope="row">Assumed K_IC</th><td>{cls.kic} MPa√m</td></tr>
            <tr><th scope="row">Critical crack a_c</th><td>{(af * 1000).toFixed(2)} mm</td></tr>
            <tr><th scope="row">ΔK at a₀</th><td>{stressIntensity(dSigma, a0, Y).toFixed(1)} MPa√m</td></tr>
            <tr><th scope="row">ΔK at a_c</th><td>{kMax.toFixed(1)} MPa√m</td></tr>
            <tr><th scope="row">da/dN at a₀</th><td>{growthRate(cls.C, cls.m, a0, dSigma, Y).toExponential(2)} m/cycle</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          {life == null
            ? `A ${a0Mm.toFixed(1)} mm crack is already at or past the critical size for Δσ = ${dSigma} MPa — there is no propagation life left.`
            : `Most of that life is spent while the crack is small: with m = ${cls.m}, growth rate goes as a^${(cls.m / 2).toFixed(2)}, so the last millimetre passes in a small fraction of the total. That is why an inspection interval is set by the time from detectable to critical, not by the total life.`}
        </p>

        {belowThreshold && (
          <p className="ht-caveat">
            <strong>Below the threshold.</strong> ΔK at the starting crack is under about
            3 MPa√m, which is the region where cracks in steel effectively stop growing. Paris’
            law is a stage-II fit and does not describe this region — the real life here is far
            longer than the number above, and may be unlimited.
          </p>
        )}

        <div className="density-box">
          <h3>Domain</h3>
          <p className="density-note">
            These are Barsom &amp; Rolfe’s upper-bound design equations for <em>steels</em> in air.
            They are not transferable to aluminium or titanium — the constants differ by orders of
            magnitude — which is why only steel classes are offered here. K_IC is the
            representative value for the class, not a measurement of a particular heat.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ================================================================= creep == */

function CreepPanel() {
  const [tempC, setTempC] = useRouteNumber('T', 800, 500, 1000);
  const [stress, setStress] = useRouteNumber('s', 140, 20, 600);

  const T = tempC + 273.15;
  const P = s590Parameter(stress);
  const hours = ruptureHours(P * 1000, T);
  const outside = P <= S590_P_MIN + 1e-9 || P >= S590_P_MAX - 1e-9;
  const pNow = larsonMiller(T, Math.max(hours, 1e-6)) / 1000;

  const pMin = 19, pMax = 28;
  const sx = (p: number) => PAD.l + ((p - pMin) / (pMax - pMin)) * plotW;
  const sMin = 20, sMax = 700;
  const sy = (s: number) =>
    PAD.t + plotH - (Math.log10(Math.max(s, sMin) / sMin) / Math.log10(sMax / sMin)) * plotH;

  const curve = S590_CURVE.map((c) => `${sx(c.P)},${sy(c.stress)}`).join(' ');

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="fa-sliders">
          <Slider label="Temperature" unit="°C" value={tempC} min={500} max={1000} step={5} onChange={setTempC} />
          <Slider label="Stress" unit="MPa" value={stress} min={20} max={600} step={5} onChange={setStress} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="Larson–Miller master curve for the S-590 alloy">
          {[20, 22, 24, 26, 28].map((p) => (
            <line key={p} x1={sx(p)} x2={sx(p)} y1={PAD.t} y2={PAD.t + plotH} className="dd-grid" />
          ))}
          {[20, 50, 100, 200, 500].map((s) => (
            <line key={s} x1={PAD.l} x2={W - PAD.r} y1={sy(s)} y2={sy(s)} className="dd-grid" />
          ))}
          <polyline points={curve} className="fa-curve" />
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(stress)} y2={sy(stress)} className="ht-path" />
          <circle cx={sx(P)} cy={sy(stress)} r={5} className="fa-dot-ok" />

          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          {[20, 22, 24, 26, 28].map((p) => (
            <text key={p} x={sx(p)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">{p}</text>
          ))}
          {[20, 50, 100, 200, 500].map((s) => (
            <text key={s} x={PAD.l - 8} y={sy(s) + 4} className="dd-tick" textAnchor="end">{s}</text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 10} className="dd-tick" textAnchor="middle">
            P = T(20 + log t) ÷ 1000
          </text>
          <text x={16} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 16 ${PAD.t + plotH / 2})`}>stress (MPa, log)</text>
        </svg>

        <p className="ht-caveat">
          <strong>Digitised master curve.</strong> The S-590 curve is read off Callister &amp;
          Rethwisch fig. 8.32 and is approximate. It reproduces the book’s worked example — 140 MPa
          at 800 °C gives about 233 hours — but treat it as a teaching curve, not design data.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">{fmtHours(hours)}</h2>
        <p className="detail-meta">rupture life at {tempC} °C, {stress} MPa</p>

        <p className="density-eq">P = T(C + log₁₀ t_r), C = 20</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">Temperature</th><td>{T.toFixed(0)} K</td></tr>
            <tr><th scope="row">P from the curve</th><td>{(P * 1000).toFixed(0)}</td></tr>
            <tr><th scope="row">Rupture life</th><td>{hours.toPrecision(3)} h</td></tr>
            <tr><th scope="row">Check: P at that life</th>
              <td className={Math.abs(pNow - P) < 0.01 ? 'err-ok' : 'err-off'}>
                {(pNow * 1000).toFixed(0)}
              </td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          The whole point of the Larson–Miller parameter is that time and temperature trade
          against one another through a single number. Raising the temperature by 50 °C here
          shortens the life to {fmtHours(ruptureHours(P * 1000, T + 50))} — creep design is far
          more sensitive to temperature than to stress.
        </p>

        {outside && (
          <p className="ht-caveat">
            <strong>Off the curve.</strong> {stress} MPa sits beyond the digitised range
            ({S590_CURVE[S590_CURVE.length - 1].stress}–{S590_CURVE[0].stress} MPa), so the
            parameter has been clamped to the end of the data. The life shown is an
            extrapolation and should not be read as a prediction.
          </p>
        )}

        <div className="density-box">
          <h3>Reading it the other way</h3>
          <p className="density-note">
            Fix the life you need and the parameter follows: 10 000 hours at {tempC} °C needs
            P = {(larsonMiller(T, 10000) / 1000).toFixed(1)} × 10³, which this curve says the alloy
            can carry at about {s590Stress(larsonMiller(T, 10000) / 1000).toFixed(0)} MPa. That is
            how a creep-limited design stress is actually chosen.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ================================================================ shared == */

function Slider({
  label, unit, value, min, max, step, onChange, fixed = 0,
}: {
  label: string; unit: string; value: number; min: number; max: number;
  step: number; onChange: (v: number) => void; fixed?: number;
}) {
  return (
    <label className="fa-slider">
      <span>
        {label} <strong>{value.toFixed(fixed)}</strong> {unit}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label}${unit ? `, ${unit}` : ''}`}
      />
    </label>
  );
}

function sup(n: number): string {
  const map: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(Math.round(n)).split('').map((c) => map[c] ?? c).join('');
}

function fmtPow(n: number): string {
  const e = Math.log10(n);
  return Number.isInteger(e) ? `10${sup(e)}` : `${(n / 10 ** Math.floor(e)).toFixed(0)}×10${sup(Math.floor(e))}`;
}

function fmtCycles(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return n.toFixed(0);
}

function fmtHours(h: number): string {
  if (!Number.isFinite(h)) return '—';
  if (h >= 8760) return `${(h / 8760).toPrecision(3)} years`;
  if (h >= 24) return `${(h / 24).toPrecision(3)} days`;
  return `${h.toPrecision(3)} h`;
}
