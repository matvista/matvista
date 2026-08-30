import { useMemo } from 'react';
import { useRouteEnum, useRouteNumber, useRouteString } from '../useRoute';
import { DOPABLE, SEMICONDUCTORS } from '../electronic/materials';
import {
  driveInJunction,
  driveInProfile,
  driveInSurface,
  junctionSharpness,
  predepositionDose,
  predepositionJunction,
  predepositionProfile,
} from '../electronic/doping';
import {
  FREEZE_OUT_K, K_B, VISIBLE_MAX_NM, VISIBLE_MIN_NM, builtInPotential, carriers,
  conductivity, depletionSplit, depletionWidth, fermiOffset, intrinsicCarriers,
  intrinsicOnsetTemp, isDegenerate, isFreezeOut, photonEnergy, photonWavelength,
  thermalVoltage, wavelengthToRgb,
  diodeCurrentRatio,
  millivoltsPerDecade,
  rectificationRatio,
  saturationCurrentRatio,
  hallCoefficient,
  hallVoltage,
  carriersFromHall,
  hallSingleCarrierValid,
  hallCarrierType,
  minorityShare,
  biasedDepletionWidth,
} from '../electronic/model';
import type { Semiconductor } from '../electronic/materials';

const W = 660;
const H = 380;
const PAD = { l: 66, r: 26, t: 20, b: 50 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

/** m⁻³ per cm⁻³. Doping is quoted per cm³ everywhere in the literature. */
const CM3 = 1e6;

/**
 * Axis bounds for the conductivity plot, at module scope on purpose. Declared
 * inside the component they become fresh values every render, and a memo that
 * closes over them then needs them in its dependency array — the same
 * exhaustive-deps warning this codebase has now produced four times.
 * 1000/T from 1 to 10 spans 1000 K down to 100 K.
 */
const INV_MIN = 1;
const INV_MAX = 20; // 1000 K down to 50 K, so freeze-out is on the plot
const LOG_MIN = -6;
const LOG_MAX = 6;

type Panel = 'gaps' | 'doping' | 'junction' | 'diode' | 'hall' | 'profile';
const PANELS: Panel[] = ['gaps', 'doping', 'junction', 'diode', 'hall', 'profile'];
const PANEL_LABEL: Record<Panel, string> = {
  gaps: 'Band gaps',
  doping: 'Doping & conductivity',
  junction: 'p–n junction',
  diode: 'The diode',
  hall: 'Hall effect',
  profile: 'Making a junction',
};

export function Semiconductors() {
  const [panel, setPanel] = useRouteEnum<Panel>('panel', 'gaps', PANELS);
  return (
    <div className="fa-wrap">
      <div className="fa-tabs" role="tablist" aria-label="Semiconductor topic">
        {PANELS.map((p) => (
          <button key={p} role="tab" aria-selected={panel === p}
            className={`toggle ${panel === p ? 'toggle-on' : ''}`} onClick={() => setPanel(p)}>
            {PANEL_LABEL[p]}
          </button>
        ))}
      </div>
      {panel === 'gaps' && <GapPanel />}
      {panel === 'doping' && <DopingPanel />}
      {panel === 'junction' && <JunctionPanel />}
      {panel === 'diode' && <DiodePanel />}
      {panel === 'hall' && <HallPanel />}
      {panel === 'profile' && <ProfilePanel />}
    </div>
  );
}

/* ================================================================== gaps == */

/**
 * One material's emission colour, or a stated reason there is none.
 *
 * Gated on `gapKind`, which keeps the module's existing direct/indirect
 * teaching honest: GaP has a visible-range gap and is a poor emitter, and that
 * has to show as an **absence** rather than a colour. The wavelength is
 * printed in text beside the swatch, so the colour is never the only carrier.
 */
function EmissionRow({ s }: { s: Semiconductor }) {
  const nm = photonWavelength(s.Eg)!;
  const rgb = s.gapKind === 'direct' ? wavelengthToRgb(nm) : null;
  const reason =
    s.gapKind === 'indirect'
      ? 'indirect gap — a poor emitter whatever its wavelength'
      : nm > VISIBLE_MAX_NM
        ? 'infrared — direct, but invisible'
        : 'ultraviolet';
  return (
    <li>
      {rgb ? (
        <i
          className="sc-swatch"
          style={{ background: `rgb(${rgb.r} ${rgb.g} ${rgb.b})` }}
          aria-hidden="true"
        />
      ) : (
        <i className="sc-swatch sc-swatch-none" aria-hidden="true" />
      )}
      <span>
        <strong>{s.formula}</strong> · {nm.toFixed(0)} nm
        {rgb ? ' · visible' : ` · ${reason}`}
      </span>
    </li>
  );
}

/**
 * P10 — the wavelength ticks along the top of the band-gap chart.
 *
 * λ = hc/E, and the axis is linear in E, so equal steps in **wavelength** are
 * not equal steps along it. |dE/dλ| = hc/λ², so a fixed Δλ covers more of the
 * axis the shorter the wavelength: the ticks *spread* toward the right and
 * crowd at the left. Measured against `EV_MAX`, a 200 nm step is 1.9% of the
 * plot at 2000 → 1800 nm and 28.7% at 600 → 400 nm — fifteen times wider. An
 * earlier version of this note had it the other way round.
 *
 * Which is why this list is not an arithmetic sequence. The steps shorten as λ
 * falls, precisely to undo that, so the drawn ticks come out between 7.7% and
 * 14.4% of the plot apart instead of between 1.9% and 29%.
 *
 * The visible band, 400–750 nm, is 1.65–3.10 eV: it starts 46% across and ends
 * 86% across, occupying 40% of the axis through the middle and right — not the
 * "right-hand third" this note also used to claim.
 */
const NM_TICKS = [2000, 1200, 800, 600, 500, 450, 400, 360];

/**
 * Right-hand end of the energy axis, eV.
 *
 * Was `maxGap * 1.15` = 2.76 eV, which cut the visible band off at its right
 * edge and left no room for the bar labels — they ran off the plot once the
 * wavelength was added to them. 3.6 eV contains the whole 1.65–3.10 eV visible
 * band and the photon slider's full 3.5 eV reach, so neither the shading nor
 * the marker can leave the chart.
 */
const EV_MAX = 3.6;

function GapPanel() {
  const [tempK, setTempK] = useRouteNumber('T', 300, 100, 800);
  // Photon energy the sample is illuminated with. eV rather than nm because
  // the chart's axis is eV and the comparison with E_g has to be direct.
  const [photonEv, setPhotonEv] = useRouteNumber('ph', 2, 0.3, 3.5);

  const barH = (plotH - 10) / SEMICONDUCTORS.length;
  const sx = (eV: number) => PAD.l + (eV / EV_MAX) * plotW;
  const photonNm = photonWavelength(photonEv)!;
  // The answer the photon slider exists to give, in one line. Deliberately a
  // count rather than a list of formulae: it goes into `aria-valuetext`, which
  // is read on every step of the slider, and seven names per step is not an
  // announcement.
  const absorbing = SEMICONDUCTORS.filter((s) => photonEv >= s.Eg).length;
  const photonAnswer =
    `${photonEv.toFixed(2)} eV, ${photonNm.toFixed(0)} nm — absorbed by ` +
    `${absorbing} of the ${SEMICONDUCTORS.length}, transparent to ` +
    `${SEMICONDUCTORS.length - absorbing}`;

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="fa-sliders">
          <Slider label="Temperature" unit="K" value={tempK} min={100} max={800} step={5} onChange={setTempK} />
          <Slider
            label="Illuminating photon"
            unit={`eV — λ = ${photonNm.toFixed(0)} nm`}
            value={photonEv}
            min={0.3}
            max={3.5}
            step={0.01}
            onChange={setPhotonEv}
            fixed={2}
            valueText={photonAnswer}
          />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="Band gaps of the tabulated semiconductors at 300 K">
          {SEMICONDUCTORS.map((s, i) => {
            const y = PAD.t + i * barH + 4;
            return (
              <g key={s.id}>
                <text x={PAD.l - 8} y={y + barH / 2} className="dd-tick" textAnchor="end">
                  {s.formula}
                </text>
                <rect x={PAD.l} y={y} width={sx(s.Eg) - PAD.l} height={barH - 10}
                  className={s.gapKind === 'direct' ? 'sc-direct' : 'sc-indirect'} rx={2} />
                <text x={sx(s.Eg) + 6} y={y + barH / 2 + 1} className="sc-bar-label">
                  {s.Eg.toFixed(2)} eV · {photonWavelength(s.Eg)!.toFixed(0)} nm · {s.gapKind}
                </text>
              </g>
            );
          })}
          {/* Visible light spans roughly 1.65–3.1 eV; below it a gap cannot emit
              visible light at all, which is why the LED problem is a gap problem. */}
          <rect
            x={sx(photonEnergy(VISIBLE_MAX_NM)!)}
            y={PAD.t}
            width={sx(photonEnergy(VISIBLE_MIN_NM)!) - sx(photonEnergy(VISIBLE_MAX_NM)!)}
            height={plotH}
            className="sc-visible"
          />
          <text x={sx(photonEnergy(VISIBLE_MAX_NM)!) + 4} y={PAD.t + plotH - 6} className="ht-edge-label">
            visible light
          </text>

          {/* The photon the slider is shining on the samples. Everything to its
              left absorbs; everything to its right is transparent. */}
          <line
            x1={sx(photonEv)}
            x2={sx(photonEv)}
            y1={PAD.t - 4}
            y2={PAD.t + plotH}
            className="sc-photon"
          />
          <text x={sx(photonEv)} y={PAD.t + plotH + 14} className="sc-bar-label" textAnchor="middle">
            photon {photonEv.toFixed(2)} eV
          </text>

          {/* Wavelength ticks along the top — the same axis in the other unit. */}
          {NM_TICKS.filter((nm) => photonEnergy(nm)! <= EV_MAX).map((nm) => (
            <g key={nm}>
              <line
                x1={sx(photonEnergy(nm)!)}
                x2={sx(photonEnergy(nm)!)}
                y1={PAD.t - 8}
                y2={PAD.t - 3}
                className="dd-axis"
              />
              <text x={sx(photonEnergy(nm)!)} y={PAD.t - 11} className="dd-tick" textAnchor="middle">
                {nm}
              </text>
            </g>
          ))}
          <text x={PAD.l} y={PAD.t - 11} className="dd-tick" textAnchor="end">
            nm
          </text>

          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          <text x={PAD.l + plotW / 2} y={H - 10} className="dd-tick" textAnchor="middle">band gap (eV)</text>
        </svg>

        <p className="trend-note">
          Gap and mobility trade against one another across this table. A wide gap keeps
          intrinsic carriers away and lets a device run hot, but the same strong, ionic bonding
          that widens it also scatters carriers and collapses mobility — germanium moves
          electrons three times faster than silicon and is useless above about 100 °C.
        </p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">n<sub>i</sub> at {tempK} K</h2>
        <p className="detail-meta">intrinsic carriers, per cm³</p>

        <div className="table-scroll" role="region" aria-label="Intrinsic carrier concentrations" tabIndex={0}>
          <table className="detail-props">
            <tbody>
              {DOPABLE.map((s) => {
                const ni = intrinsicCarriers(s.carriers.ni300, s.Eg, tempK) / CM3;
                return (
                  <tr key={s.id}>
                    <th scope="row">{s.formula}</th>
                    <td>{fmtExp(ni)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="detail-summary">
          Every factor of ten here costs about {(2 * K_B * tempK * Math.LN10).toFixed(2)} eV of
          gap at this temperature. That is the whole reason the table spans ten orders of
          magnitude while the gaps span barely one.
        </p>

        <p className="ht-caveat">
          <strong>The gap is held constant.</strong> Real gaps narrow as temperature rises —
          silicon's by roughly 0.3 meV/K — so these figures understate n<sub>i</sub> at the hot
          end, by about 40% at 800 K for silicon. The shape and the ordering are right; treat
          the absolute values above room temperature as indicative.
        </p>

        <div className="density-box">
          <h3>Shine {photonEv.toFixed(2)} eV on it</h3>
          <p className="density-eq">λ = 1239.8 / E ⟹ {photonNm.toFixed(0)} nm</p>
          {/* The one line that changes when the slider moves — not the table
              below it, which is seven rows and would be re-read in full on
              every 0.01 eV step. The same sentence is the slider's own
              `aria-valuetext`, so it reaches a reader operating the control and
              a reader who arrived by link alike. */}
          <p className="detail-meta" aria-live="polite" aria-atomic="true">
            {photonAnswer}
          </p>
          <table className="detail-props">
            <tbody>
              {SEMICONDUCTORS.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.formula}</th>
                  <td className={photonEv >= s.Eg ? 'sc-absorbs' : 'sc-transparent'}>
                    {photonEv >= s.Eg ? 'absorbs' : 'transparent'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="density-note">
            A photon is absorbed only if it carries at least the gap — anything less passes
            straight through, which is why silicon is opaque to visible light and a window onto
            the infrared, and why germanium lenses are used in thermal cameras. Slide down past
            2.40 eV and cadmium sulfide turns transparent: that threshold is the photoresistor,
            and it is why a CdS cell responds to daylight and ignores an infrared remote.
          </p>
        </div>

        <div className="density-box">
          <h3>What colour is that gap?</h3>
          <ul className="sc-swatches">
            {SEMICONDUCTORS.map((s) => (
              <EmissionRow key={s.id} s={s} />
            ))}
          </ul>
          <p className="density-note">
            A direct gap can absorb or emit a photon on its own. An indirect one needs a lattice
            vibration to carry the momentum difference too, which makes the process far less
            likely — so silicon, for all its virtues, makes a poor light emitter, and the LEDs
            and lasers are built from the direct-gap compounds. GaP’s 2.25 eV lands in the green
            and it still gets no swatch here, because the gap is indirect: a visible-range gap is
            necessary for a bright emitter and nowhere near sufficient.
          </p>
          <p className="density-note">
            Blue needs about 2.7 eV — shorter than every direct gap in this table. That gap is why
            blue LEDs took thirty years and a different material system (gallium nitride) to
            arrive, long after red and green were routine.
          </p>
          <p className="ht-caveat">
            <strong>The swatches are decorative.</strong> They come from a piecewise hue ramp, not
            from the CIE colour-matching functions, and they make no claim about your display. The
            wavelength beside each one is the number that means something.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ================================================================ doping == */

function DopingPanel() {
  const [matId, setMatId] = useRouteString('m', 'si');
  const [logDope, setLogDope] = useRouteNumber('dope', 16, 13, 20);
  const [type, setType] = useRouteEnum<'n' | 'p'>('type', 'n', ['n', 'p']);
  const [tempK, setTempK] = useRouteNumber('T', 300, 50, 800);

  const mat = DOPABLE.find((s) => s.id === matId) ?? DOPABLE[1];
  const dope = 10 ** logDope * CM3;
  const Nd = type === 'n' ? dope : 0;
  const Na = type === 'p' ? dope : 0;

  const ni = intrinsicCarriers(mat.carriers.ni300, mat.Eg, tempK);
  const c = carriers(ni, Nd, Na);
  const sigma = conductivity(c, mat.mu_e, mat.mu_h);
  const offset = fermiOffset(c.n, ni, tempK);
  const degenerate = isDegenerate(offset, mat.Eg, tempK);
  const frozen = isFreezeOut(tempK);
  const onset = intrinsicOnsetTemp(mat.carriers.ni300, mat.Eg, dope);

  // Conductivity against 1000/T — the plot that shows all three regimes.
  const sx = (inv: number) => PAD.l + ((inv - INV_MIN) / (INV_MAX - INV_MIN)) * plotW;
  const sy = (logS: number) =>
    PAD.t + plotH - ((Math.min(LOG_MAX, Math.max(LOG_MIN, logS)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * plotH;

  const curve = useMemo(() => {
    const px = (inv: number) => PAD.l + ((inv - INV_MIN) / (INV_MAX - INV_MIN)) * plotW;
    const py = (logS: number) =>
      PAD.t + plotH - ((Math.min(LOG_MAX, Math.max(LOG_MIN, logS)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * plotH;
    const pts: string[] = [];
    for (let i = 0; i <= 200; i++) {
      const inv = INV_MIN + ((INV_MAX - INV_MIN) * i) / 200;
      const T = 1000 / inv;
      const niT = intrinsicCarriers(mat.carriers.ni300, mat.Eg, T);
      const s = conductivity(carriers(niT, Nd, Na), mat.mu_e, mat.mu_h);
      pts.push(`${px(inv)},${py(Math.log10(s))}`);
    }
    return pts.join(' ');
  }, [mat, Nd, Na]);

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select value={matId} onChange={(e) => setMatId(e.target.value)} aria-label="Semiconductor">
            {DOPABLE.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
          <button className={`toggle ${type === 'n' ? 'toggle-on' : ''}`} aria-pressed={type === 'n'}
            onClick={() => setType('n')}>n-type (donors)</button>
          <button className={`toggle ${type === 'p' ? 'toggle-on' : ''}`} aria-pressed={type === 'p'}
            onClick={() => setType('p')}>p-type (acceptors)</button>
        </div>
        <div className="fa-sliders">
          <Slider label="Doping" unit={`per cm³ (10^${logDope.toFixed(1)})`} value={logDope}
            min={13} max={20} step={0.1} onChange={setLogDope} fixed={1} />
          {/* Down to 50 K, not 100: the freeze-out warning has to be reachable
              or it is a branch that can never render. */}
          <Slider label="Temperature" unit="K" value={tempK} min={50} max={800} step={5} onChange={setTempK} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Conductivity of ${mat.name} against inverse temperature`}>
          {[1, 5, 10, 15, 20].map((v) => (
            <line key={v} x1={sx(v)} x2={sx(v)} y1={PAD.t} y2={PAD.t + plotH} className="dd-grid" />
          ))}
          {[-6, -4, -2, 0, 2, 4, 6].map((v) => (
            <line key={v} x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} className="dd-grid" />
          ))}

          {/* Below ~100 K the dopants keep their carriers; the model assumes
              complete ionisation, so that region is marked rather than drawn. */}
          <rect x={sx(1000 / FREEZE_OUT_K)} y={PAD.t}
            width={Math.max(0, W - PAD.r - sx(1000 / FREEZE_OUT_K))} height={plotH}
            className="sc-invalid" />
          <text x={W - PAD.r - 6} y={PAD.t + 14} className="ht-edge-label" textAnchor="end">
            freeze-out — not modelled
          </text>

          <polyline points={curve} className="fa-curve" />
          <line x1={sx(1000 / tempK)} x2={sx(1000 / tempK)} y1={PAD.t} y2={PAD.t + plotH} className="ht-path" />
          <circle cx={sx(1000 / tempK)} cy={sy(Math.log10(sigma))} r={5} className="fa-dot-ok" />

          {/* Only when it lands inside the axes. Heavy doping pushes the onset
              past 1000 K, which is off the left edge — drawing it there put a
              line and a clipped label outside the plot frame. The temperature
              is reported in the table either way. */}
          {onset && 1000 / onset >= INV_MIN && 1000 / onset <= INV_MAX && (
            <>
              <line x1={sx(1000 / onset)} x2={sx(1000 / onset)} y1={PAD.t} y2={PAD.t + plotH} className="fa-endurance" />
              <text x={sx(1000 / onset) - 6} y={PAD.t + plotH - 8} className="ht-edge-label" textAnchor="end">
                intrinsic above {Math.round(onset)} K
              </text>
            </>
          )}

          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          {[1, 5, 10, 15, 20].map((v) => (
            <text key={v} x={sx(v)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">{v}</text>
          ))}
          {[-6, -3, 0, 3, 6].map((v) => (
            <text key={v} x={PAD.l - 8} y={sy(v) + 4} className="dd-tick" textAnchor="end">1e{v}</text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 8} className="dd-tick" textAnchor="middle">1000/T (K⁻¹)</text>
          <text x={16} y={PAD.t + plotH / 2} className="dd-tick" textAnchor="middle"
            transform={`rotate(-90 16 ${PAD.t + plotH / 2})`}>conductivity (Ω·m)⁻¹</text>
        </svg>

        <p className="trend-note">
          The flat stretch is the extrinsic plateau, where every dopant has given up its carrier
          and the count stops changing — the region a device is designed to live in. Where the
          curve turns up on the left, n<sub>i</sub> has caught the doping and the material has
          forgotten it was ever doped.
        </p>

        <p className="ht-caveat">
          <strong>Mobility is held constant.</strong> That is what makes the plateau perfectly
          flat here. In a real crystal mobility falls as temperature rises — phonon scattering
          grows — so the measured plateau slopes gently downwards instead. The carrier count is
          what this panel models; the scattering is not.
        </p>
      </section>

      <aside className="detail" aria-live="polite">
        <h2 className="crystal-title">{fmtExp(sigma)}</h2>
        <p className="detail-meta">conductivity, (Ω·m)⁻¹, at {tempK} K</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">Electrons n</th><td>{fmtExp(c.n / CM3)} cm⁻³</td></tr>
            <tr><th scope="row">Holes p</th><td>{fmtExp(c.p / CM3)} cm⁻³</td></tr>
            <tr><th scope="row">n<sub>i</sub></th><td>{fmtExp(ni / CM3)} cm⁻³</td></tr>
            <tr><th scope="row">E_F − E_i</th>
              <td className={degenerate ? 'err-off' : 'err-ok'}>{offset >= 0 ? '+' : ''}{offset.toFixed(3)} eV</td></tr>
            <tr><th scope="row">Extrinsic up to</th>
              <td>{onset ? `${Math.round(onset)} K` : 'beyond 2000 K'}</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          Doping at 10<sup>{logDope.toFixed(1)}</sup> cm⁻³ puts{' '}
          {fmtExp(Math.max(c.n, c.p) / CM3)} majority carriers per cm³ against an intrinsic{' '}
          {fmtExp(ni / CM3)} — a factor of {fmtExp(Math.max(c.n, c.p) / ni)}. The minority
          concentration falls by the same factor, because their product is fixed at n<sub>i</sub>².
        </p>

        {degenerate && (
          <p className="ht-caveat">
            <strong>Degenerate.</strong> The Fermi level has come within 3kT of a band edge, so
            Boltzmann statistics no longer apply and "one carrier per dopant" stops holding. The
            numbers above are outside the model's domain. {mat.formula} reaches this early
            because its gap is only {mat.Eg.toFixed(2)} eV — a flat "10¹⁹ cm⁻³" rule of thumb is
            silicon's number and does not transfer.
          </p>
        )}
        {frozen && (
          <p className="ht-caveat">
            <strong>Freeze-out.</strong> Below {FREEZE_OUT_K} K carriers fall back onto their
            dopants, and this model assumes every dopant is ionised. It over-predicts the
            conductivity here; the real curve bends down instead of staying flat.
          </p>
        )}

        <div className="density-box">
          <h3>Why doping wins</h3>
          <p className="density-note">
            Adding one dopant atom in ten million multiplies silicon's conductivity by around a
            million. Nothing else in materials science gives that much control for that little
            interference — it is the entire basis of the semiconductor industry.
          </p>
        </div>

        <p className="trend-note">{mat.note}</p>
      </aside>
    </div>
  );
}

/* ============================================================== junction == */

function JunctionPanel() {
  const [matId, setMatId] = useRouteString('m', 'si');
  const [logNa, setLogNa] = useRouteNumber('Na', 16, 13, 20);
  const [logNd, setLogNd] = useRouteNumber('Nd', 17, 13, 20);
  const [tempK, setTempK] = useRouteNumber('T', 300, 100, 800);

  const mat = DOPABLE.find((s) => s.id === matId) ?? DOPABLE[1];
  const Na = 10 ** logNa * CM3;
  const Nd = 10 ** logNd * CM3;
  const ni = intrinsicCarriers(mat.carriers.ni300, mat.Eg, tempK);
  const Vbi = builtInPotential(Na, Nd, ni, tempK);
  const Wdep = depletionWidth(Vbi, Na, Nd, mat.carriers.epsR);
  const { xp, xn } = depletionSplit(Wdep, Na, Nd);

  const offN = fermiOffset(carriers(ni, Nd, 0).n, ni, tempK);
  const offP = fermiOffset(carriers(ni, 0, Na).n, ni, tempK);
  const degenerate =
    isDegenerate(offN, mat.Eg, tempK) || isDegenerate(offP, mat.Eg, tempK);
  const impossible = Vbi >= mat.Eg;

  // Band diagram: bands flat outside, bending by V_bi across the depletion region.
  const mid = PAD.l + plotW / 2;
  const total = xp + xn || 1;
  // The junction sits at the centre and the region spreads either side in
  // proportion to how far it actually reaches. Scaling the *total* drawn width
  // to half the plot is what keeps it inside the axes: a strongly asymmetric
  // junction puts over 90% of the region on one side, and a per-side scale
  // pushed the shading off the left edge of the frame.
  const drawn = plotW / 2;
  const leftEdge = mid - drawn * (xp / total);
  const rightEdge = mid + drawn * (xn / total);
  const topY = PAD.t + 60;
  const gapPx = 90;
  const bendPx = Math.min(70, (Vbi / mat.Eg) * gapPx);

  const band = (yFlatLeft: number) => {
    const pts: string[] = [];
    pts.push(`${PAD.l},${yFlatLeft}`);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const x = leftEdge + (rightEdge - leftEdge) * t;
      // Smooth step, the shape a quadratic space-charge profile gives.
      const f = t * t * (3 - 2 * t);
      pts.push(`${x},${yFlatLeft - bendPx * f}`);
    }
    pts.push(`${W - PAD.r},${yFlatLeft - bendPx}`);
    return pts.join(' ');
  };

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <select value={matId} onChange={(e) => setMatId(e.target.value)} aria-label="Semiconductor">
            {DOPABLE.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
        <div className="fa-sliders">
          <Slider label="Acceptors N_a (p side)" unit={`10^${logNa.toFixed(1)} cm⁻³`} value={logNa}
            min={13} max={20} step={0.1} onChange={setLogNa} fixed={1} />
          <Slider label="Donors N_d (n side)" unit={`10^${logNd.toFixed(1)} cm⁻³`} value={logNd}
            min={13} max={20} step={0.1} onChange={setLogNd} fixed={1} />
          <Slider label="Temperature" unit="K" value={tempK} min={100} max={800} step={5} onChange={setTempK} />
        </div>

        <svg className="ht-plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Band bending across a ${mat.name} p–n junction`}>
          <rect x={leftEdge} y={PAD.t} width={rightEdge - leftEdge} height={plotH} className="sc-depletion" />
          <text x={(leftEdge + rightEdge) / 2} y={PAD.t + plotH - 8} className="ht-edge-label" textAnchor="middle">
            depletion region
          </text>
          <text x={PAD.l + 8} y={PAD.t + 16} className="ht-edge-label">p side</text>
          <text x={W - PAD.r - 8} y={PAD.t + 16} className="ht-edge-label" textAnchor="end">n side</text>

          <polyline points={band(topY)} className="sc-band" />
          <polyline points={band(topY + gapPx)} className="sc-band" />
          <text x={PAD.l + 4} y={topY - 8} className="sc-bar-label">E_c</text>
          <text x={PAD.l + 4} y={topY + gapPx + 18} className="sc-bar-label">E_v</text>

          {/* The Fermi level is flat at equilibrium — that is what "equilibrium"
              means, and it is why the bands must bend instead. */}
          <line x1={PAD.l} x2={W - PAD.r} y1={topY + gapPx - 24} y2={topY + gapPx - 24} className="sc-fermi" />
          <text x={W - PAD.r - 4} y={topY + gapPx - 30} className="ht-edge-label" textAnchor="end">E_F (flat)</text>

          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
          <text x={PAD.l + plotW / 2} y={H - 10} className="dd-tick" textAnchor="middle">position</text>
        </svg>

        <p className="trend-note">
          At equilibrium the Fermi level is flat across the whole device — that is what
          equilibrium means — so the bands themselves must bend to accommodate it. The height of
          that bend is the built-in potential, and it is the barrier a forward bias has to pay
          down before current flows.
        </p>
      </section>

      <aside className="detail" aria-live="polite">
        <h2 className="crystal-title">{Vbi.toFixed(3)} V</h2>
        <p className="detail-meta">built-in potential at {tempK} K</p>

        <p className="density-eq">V_bi = (kT/q)·ln(N_a·N_d / n_i²)</p>

        <table className="detail-props">
          <tbody>
            <tr><th scope="row">Depletion width W</th><td>{(Wdep * 1e9).toFixed(0)} nm</td></tr>
            <tr><th scope="row">Into the p side</th><td>{fmtNm(xp)}</td></tr>
            <tr><th scope="row">Into the n side</th><td>{fmtNm(xn)}</td></tr>
            <tr><th scope="row">kT/q</th><td>{(thermalVoltage(tempK) * 1000).toFixed(1)} mV</td></tr>
            <tr><th scope="row">Band gap</th>
              <td className={impossible ? 'err-off' : ''}>{mat.Eg.toFixed(2)} eV</td></tr>
          </tbody>
        </table>

        <p className="detail-summary">
          {Math.abs(logNa - logNd) < 0.05
            ? `Symmetrically doped, so the depletion region divides evenly — ${(xp * 1e9).toFixed(0)} nm each side.`
            : `The depletion region reaches ${(Math.max(xp, xn) / Math.min(xp, xn)).toFixed(0)}× further into the ${xp > xn ? 'p' : 'n'} side, because it is the lighter doped one: the same exposed charge needs more volume to find. A junction between a heavily and a lightly doped region is almost entirely inside the lightly doped one.`}
        </p>

        {impossible && (
          <p className="ht-caveat">
            <strong>Outside the model.</strong> The formula returns {Vbi.toFixed(2)} V against a
            band gap of {mat.Eg.toFixed(2)} eV, which cannot happen — the Fermi levels of the two
            sides cannot be separated by more than the gap. This is the Boltzmann approximation
            failing at degenerate doping, not a real junction.
          </p>
        )}
        {!impossible && degenerate && (
          <p className="ht-caveat">
            <strong>Degenerate doping.</strong> At least one side has its Fermi level within 3kT
            of a band edge, so Boltzmann statistics are no longer valid and these figures are
            approximate at best.
          </p>
        )}

        <div className="density-box">
          <h3>What sets the width</h3>
          <p className="density-note">
            Doping harder raises the built-in potential only logarithmically, but it narrows the
            depletion region roughly as the inverse square root — which is why a heavily doped
            junction is both slightly stronger and much thinner, and why tunnelling starts to
            matter when both sides are heavily doped.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ================================================================ shared == */

/**
 * `valueText` is for a control whose *answer* is not its number.
 *
 * A range input announces its value, and for temperature that is the whole
 * story. For the illuminating photon it is not: the reader moves it to find
 * out what absorbs and what stays transparent, and a slider that says
 * "2.00 eV" has told them the thing they already set. `aria-valuetext`
 * replaces the announced number entirely, so it has to carry the value too.
 */
function Slider({
  label, unit, value, min, max, step, onChange, fixed = 0, valueText,
}: {
  label: string; unit: string; value: number; min: number; max: number;
  step: number; onChange: (v: number) => void; fixed?: number; valueText?: string;
}) {
  return (
    <label className="fa-slider">
      <span>{label} <strong>{value.toFixed(fixed)}</strong> {unit}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={valueText}
        aria-label={`${label}${unit ? `, ${unit}` : ''}`} />
    </label>
  );
}

/** Depletion widths span orders of magnitude; a strongly asymmetric junction
 *  puts under a nanometre on the heavy side, which "0 nm" misrepresents. */
function fmtNm(m: number): string {
  const nm = m * 1e9;
  if (nm >= 10) return `${nm.toFixed(0)} nm`;
  if (nm >= 0.1) return `${nm.toFixed(2)} nm`;
  return `${(nm * 1000).toFixed(0)} pm`;
}

function fmtExp(v: number): string {
  if (!Number.isFinite(v) || v === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = v / 10 ** e;
  // The overflow has to be tested *after* rounding, not before. A mantissa of
  // 9.999999 is legitimately below ten, but toFixed(1) turns it into "10.0" —
  // which is how 10⁴ came out as "10.0×10³".
  if (Math.abs(Number(m.toFixed(1))) >= 10) {
    m /= 10;
    e += 1;
  }
  return `${m.toFixed(1)}×10${sup(e)}`;
}

function sup(n: number): string {
  const map: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
  };
  return String(n).split('').map((c) => map[c] ?? c).join('');
}

/* ================================================================= diode == */

/**
 * P9 — Shockley's law, normalised.
 *
 * The current axis is I/I_S throughout, and that is a scope decision rather
 * than a simplification: an absolute I_S needs minority-carrier lifetimes and
 * diffusion lengths this module cannot source, and every lesson here survives
 * normalisation. See `diodeCurrentRatio`.
 */
/**
 * The materials these two panels can actually model. `getSemiconductor` falls
 * back only for an *unknown* id; `cds`, `gap` and `znte` are perfectly valid
 * ids with `carriers: null`, and reading `ni300` off them threw. There is no
 * error boundary in this app, so that was a white screen from a hand-typed
 * hash — exactly what `useRouteNumber`'s own docstring promises cannot happen.
 */
const WITH_CARRIERS = SEMICONDUCTORS.filter((s) => s.carriers != null);
const WITH_HALL = SEMICONDUCTORS.filter((s) => s.carriers != null && s.mu_h != null);
const pick = (list: Semiconductor[], id: string) => list.find((s) => s.id === id) ?? list[0];

function DiodePanel() {
  const [matId, setMatId] = useRouteString('m', 'si');
  const [bias, setBias] = useRouteNumber('V', 0.4, -1, 0.8);
  const [tempK, setTempK] = useRouteNumber('T', 300, 100, 800);

  const mat = pick(WITH_CARRIERS, matId);
  const other = WITH_CARRIERS.find((s) => s.id !== mat.id)!;
  const W = 560;
  const H = 280;
  const PAD = { l: 62, r: 16, t: 16, b: 44 };

  const vMin = -1;
  const vMax = 0.8;
  const floorLog = -3;
  const logOf = (V: number) => {
    const r = Math.abs(diodeCurrentRatio(V, tempK));
    return r <= 10 ** floorLog ? floorLog : Math.log10(r);
  };
  /**
   * The top of the axis follows the curve rather than being fixed. A fixed
   * twelve decades put the operating point off the canvas over 5% of the
   * slider grid — the whole top of the bias slider below 336 K — while the
   * table beside it went on printing the value.
   */
  const topLog = Math.max(1, Math.ceil(logOf(vMax)));
  const sx = (V: number) => PAD.l + ((V - vMin) / (vMax - vMin)) * (W - PAD.l - PAD.r);
  const sy = (logI: number) =>
    PAD.t + ((topLog - logI) / (topLog - floorLog)) * (H - PAD.t - PAD.b);

  const curve = Array.from({ length: 160 }, (_, i) => {
    const V = vMin + ((vMax - vMin) * i) / 159;
    return `${sx(V)},${sy(logOf(V))}`;
  }).join(' ');

  const mvDec = millivoltsPerDecade(tempK);
  /**
   * The depletion region under bias — forward narrows it, reverse widens it as
   * √(V_bi − V). A symmetric 10²³ m⁻³ junction, so the figure is about the
   * bias rather than about a doping the panel does not otherwise show.
   */
  const DOPE = 1e23;
  const niHere = mat.carriers ? intrinsicCarriers(mat.carriers.ni300, mat.Eg, tempK) : null;
  const vbi = niHere == null ? null : builtInPotential(DOPE, DOPE, niHere, tempK);
  const epsR = mat.carriers?.epsR ?? null;
  const biasW =
    vbi == null || epsR == null ? null : biasedDepletionWidth(vbi, bias, DOPE, DOPE, epsR);
  const zeroW = vbi == null || epsR == null ? 0 : biasedDepletionWidth(vbi, 0, DOPE, DOPE, epsR);
  const ratio = mat.carriers && other.carriers
    ? saturationCurrentRatio(mat.carriers.ni300, other.carriers.ni300)
    : null;

  return (
    <section className="dd-block">
      <div className="fa-controls">
        <select value={matId} onChange={(e) => setMatId(e.target.value)} aria-label="Material">
          {WITH_CARRIERS.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Slider label="Bias" unit="V" value={bias} min={-1} max={0.8} step={0.01} fixed={2}
          onChange={setBias} />
        <Slider label="Temperature" unit="K" value={tempK} min={100} max={800} step={5}
          onChange={setTempK} />
      </div>

      <svg className="dd-plot" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Diode current normalised to the saturation current, log scale, against bias">
        {Array.from({ length: 5 }, (_, i) => Math.round(floorLog + ((topLog - floorLog) * i) / 4)).map((d) => (
          <g key={d}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(d)} y2={sy(d)} className="dd-grid" />
            <text x={PAD.l - 8} y={sy(d) + 4} className="dd-tick" textAnchor="end">
              10{sup(d)}
            </text>
          </g>
        ))}
        <line x1={sx(0)} x2={sx(0)} y1={PAD.t} y2={H - PAD.b} className="dd-grid" />
        <polyline points={curve} fill="none" stroke="#4a3aa7" strokeWidth={2} />
        <circle cx={sx(bias)} cy={sy(logOf(bias))} r={5} fill="#eb6834" stroke="#fff" strokeWidth={1.5} />
        <text x={W / 2} y={H - 8} className="dd-tick" textAnchor="middle">bias (V)</text>
      </svg>

      <table className="detail-props dd-results">
        <tbody>
          <tr>
            <th scope="row">I / I<sub>S</sub> at {bias.toFixed(2)} V</th>
            <td>{fmtExp(diodeCurrentRatio(bias, tempK))}</td>
          </tr>
          <tr>
            <th scope="row">Slope</th>
            <td>{mvDec.toFixed(1)} mV per decade</td>
          </tr>
          <tr>
            <th scope="row">Rectification at ±{Math.abs(bias).toFixed(2)} V</th>
            <td>{fmtExp(rectificationRatio(Math.abs(bias), tempK))}</td>
          </tr>
          {ratio != null && (
            <tr>
              <th scope="row">I<sub>S</sub> against {other.name}</th>
              <td>{fmtExp(ratio)}×</td>
            </tr>
          )}
          <tr>
            <th scope="row">Depletion width at this bias</th>
            <td>
              {biasW == null ? '—' : biasW === 0 ? 'barrier gone' : fmtNm(biasW)}
              {biasW != null && biasW > 0 && zeroW > 0 && (
                <> ({(biasW / zeroW).toFixed(2)}× its zero-bias width)</>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="trend-note">
        The current axis is <strong>normalised to I<sub>S</sub></strong>, deliberately. An
        absolute saturation current needs minority-carrier lifetimes and diffusion lengths this
        module does not carry, and inventing them would put a confident number on screen with
        nothing behind it. Nothing here depends on it.
      </p>
      <p className="trend-note">
        The slope holds no material property at all — it is 2.303·kT/q, the same for every diode
        ever made at this temperature, so a forward I–V is really a thermometer. And the
        familiar &ldquo;0.7 V for silicon, 0.3 V for germanium&rdquo; is not a fact about
        silicon: I<sub>S</sub> goes as n<sub>i</sub>², and that ratio alone accounts for the
        gap.
      </p>
    </section>
  );
}

/* ================================================================== hall == */

/**
 * P11 — the measurement that runs the module backwards.
 *
 * Everywhere else doping is the input and carrier concentration the output.
 * Here a voltage is measured and the concentration — and its *sign* — comes
 * back out, which is how carrier type is actually determined.
 */
function HallPanel() {
  const [matId, setMatId] = useRouteString('m', 'si');
  const [logDope, setLogDope] = useRouteNumber('dope', 16, 13, 20);
  const [type, setType] = useRouteEnum<'n' | 'p'>('type', 'n', ['n', 'p']);
  const [tempK, setTempK] = useRouteNumber('T', 300, 100, 800);
  const [current, setCurrent] = useRouteNumber('I', 10, 0.1, 100);
  const [field, setField] = useRouteNumber('B', 0.5, 0.05, 2);
  const [thickUm, setThickUm] = useRouteNumber('d', 500, 10, 2000);

  const mat = pick(WITH_HALL, matId);
  const ni = intrinsicCarriers(mat.carriers!.ni300, mat.Eg, tempK);
  const dope = 10 ** logDope * 1e6; // cm⁻³ in the URL, m⁻³ in the model
  const c = carriers(ni, type === 'n' ? dope : 0, type === 'p' ? dope : 0);
  const muH = mat.mu_h ?? 0;

  const R = hallCoefficient(c, mat.mu_e, muH);
  const I = current / 1000; // mA
  const d = thickUm * 1e-6;
  const V = hallVoltage(R, I, field, d);
  const valid = hallSingleCarrierValid(c, mat.mu_e, muH);
  const recovered = carriersFromHall(V, I, field, d);

  return (
    <section className="dd-block">
      <div className="fa-controls">
        <select value={matId} onChange={(e) => setMatId(e.target.value)} aria-label="Material">
          {WITH_HALL.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div className="fa-tabs" role="tablist" aria-label="Doping type">
          {(['n', 'p'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={type === t}
              className={`toggle ${type === t ? 'toggle-on' : ''}`} onClick={() => setType(t)}>
              {t}-type
            </button>
          ))}
        </div>
        <Slider label="Doping 10^" unit="cm⁻³" value={logDope} min={13} max={20} step={0.1}
          fixed={1} onChange={setLogDope} />
        <Slider label="Current" unit="mA" value={current} min={0.1} max={100} step={0.1}
          fixed={1} onChange={setCurrent} />
        <Slider label="Field" unit="T" value={field} min={0.05} max={2} step={0.05} fixed={2}
          onChange={setField} />
        <Slider label="Thickness" unit="µm" value={thickUm} min={10} max={2000} step={10}
          onChange={setThickUm} />
        <Slider label="Temperature" unit="K" value={tempK} min={100} max={800} step={5}
          onChange={setTempK} />
      </div>

      <table className="detail-props dd-results">
        <tbody>
          <tr>
            <th scope="row">Hall coefficient R<sub>H</sub></th>
            <td>{fmtExp(R)} m³/C</td>
          </tr>
          <tr>
            <th scope="row">Hall voltage V<sub>H</sub></th>
            <td>{(V * 1000).toFixed(3)} mV</td>
          </tr>
          <tr>
            <th scope="row">Carrier type from the sign</th>
            <td>{hallCarrierType(R) ?? '—'}-type</td>
          </tr>
          <tr>
            <th scope="row">Concentration recovered</th>
            <td>
              {valid && recovered != null
                ? `${fmtExp(recovered / 1e6)} cm⁻³`
                : 'not a single-carrier sample'}
            </td>
          </tr>
        </tbody>
      </table>

      {valid ? (
        <p className="trend-note">
          The sign of V<sub>H</sub> is doing something conductivity never can. Two samples doped
          to the <em>same</em> σ, one n-type and one p-type, are indistinguishable by a
          resistance measurement; put them in a field and they deflect opposite ways. That is
          how carrier type is determined in practice, and the concentration comes back out of
          the same measurement.
        </p>
      ) : (
        <p className="err-note">
          <strong>Refused.</strong> The minority carrier is now carrying{' '}
          {(minorityShare(c, mat.mu_e, muH) * 100).toFixed(0)}% of the current, so the
          single-carrier reading n = 1/(R<sub>H</sub>q) does not mean anything here: the two
          populations deflect the same way and their Hall voltages partly cancel, and the
          number that comes back is not any real population&rsquo;s. Push a p-type sample
          further this way and R<sub>H</sub> will eventually change sign while it is still
          p-type by doping, because at n = p the sign follows <em>mobility</em> rather than
          count and electrons are the more mobile carrier.
        </p>
      )}
    </section>
  );
}

/* =============================================== profile — making a junction == */

/**
 * P13 — the junction as a diffusion profile.
 *
 * `JunctionPanel` takes N_a and N_d as given, which leaves a reader believing
 * a junction is an abrupt step. Here it is made: dopant diffuses in, the
 * profile crosses the background doping, and where it crosses is the junction.
 *
 * √(Dt) is the control rather than a dopant table, for the reason in
 * `electronic/doping.ts`: every result depends on D and t only through their
 * product, and this repo will not ship diffusivities it cannot source.
 */
function ProfilePanel() {
  const [step, setStep] = useRouteEnum<'predep' | 'drivein'>('step', 'predep', [
    'predep',
    'drivein',
  ]);
  // √(Dt) in nm, which is the length the profile is measured in.
  const [rootDtNm, setRootDtNm] = useRouteNumber('rdt', 60, 5, 600);
  const [logCs, setLogCs] = useRouteNumber('Cs', 20, 18, 21);
  const [logCB, setLogCB] = useRouteNumber('CB', 15, 13, 18);
  // The predeposition that supplied the dose, when the drive-in step is shown.
  const [rootDt0Nm, setRootDt0Nm] = useRouteNumber('rdt0', 20, 5, 200);

  const Cs = 10 ** logCs * 1e6; // cm⁻³ in the URL, m⁻³ in the model
  const CB = 10 ** logCB * 1e6;
  const Dt = (rootDtNm * 1e-9) ** 2;
  const Dt0 = (rootDt0Nm * 1e-9) ** 2;
  const Q = predepositionDose(Cs, Dt0);

  const profile = (x: number) =>
    step === 'predep' ? predepositionProfile(Cs, x, Dt) : driveInProfile(Q, x, Dt);
  const xj = step === 'predep' ? predepositionJunction(Cs, CB, Dt) : driveInJunction(Q, CB, Dt);
  const surface = step === 'predep' ? Cs : driveInSurface(Q, Dt);
  const sharp = xj == null ? null : junctionSharpness(profile, CB, xj);

  const W = 560;
  const H = 300;
  const P = { l: 66, r: 16, t: 16, b: 46 };
  const xMax = Math.max(xj ?? 0, rootDtNm * 1e-9 * 4) * 1.25;
  const yTop = Math.ceil(Math.log10(Math.max(surface, CB) * 1.5));
  const yBot = Math.floor(Math.log10(CB / 100));
  const px = (x: number) => P.l + (x / xMax) * (W - P.l - P.r);
  const py = (c: number) =>
    P.t + ((yTop - Math.log10(Math.max(c, 10 ** yBot))) / (yTop - yBot)) * (H - P.t - P.b);

  const curve = Array.from({ length: 220 }, (_, i) => {
    const x = (xMax * i) / 219;
    return `${px(x)},${py(profile(x))}`;
  }).join(' ');

  return (
    <section className="dd-block">
      <div className="fa-tabs" role="tablist" aria-label="Process step">
        {(['predep', 'drivein'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={step === t}
            className={`toggle ${step === t ? 'toggle-on' : ''}`} onClick={() => setStep(t)}>
            {t === 'predep' ? 'Predeposition (erfc)' : 'Drive-in (Gaussian)'}
          </button>
        ))}
      </div>

      <div className="fa-controls">
        <Slider label="√(Dt)" unit="nm" value={rootDtNm} min={5} max={600} step={5}
          onChange={setRootDtNm} />
        {step === 'drivein' && (
          <Slider label="√(Dt) of the predeposition" unit="nm" value={rootDt0Nm} min={5} max={200}
            step={5} onChange={setRootDt0Nm} />
        )}
        <Slider label="Surface 10^" unit="cm⁻³" value={logCs} min={18} max={21} step={0.1}
          fixed={1} onChange={setLogCs} />
        <Slider label="Background 10^" unit="cm⁻³" value={logCB} min={13} max={18} step={0.1}
          fixed={1} onChange={setLogCB} />
      </div>

      <svg className="dd-plot" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Dopant concentration against depth, log scale, with the background level">
        {Array.from({ length: yTop - yBot + 1 }, (_, i) => yBot + i).map((d) => (
          <line key={d} x1={P.l} x2={W - P.r} y1={py(10 ** d)} y2={py(10 ** d)} className="dd-grid" />
        ))}
        <line x1={P.l} x2={W - P.r} y1={py(CB)} y2={py(CB)} stroke="#e34948" strokeWidth={1.6}
          strokeDasharray="6 4" />
        <text x={W - P.r} y={py(CB) - 6} className="dd-tick" textAnchor="end">background</text>
        <polyline points={curve} fill="none" stroke="#4a3aa7" strokeWidth={2} />
        {xj != null && xj < xMax && (
          <>
            <line x1={px(xj)} x2={px(xj)} y1={P.t} y2={H - P.b} stroke="#eb6834" strokeWidth={1.4} />
            <text x={px(xj) + 6} y={P.t + 14} className="dd-tick">x_j</text>
          </>
        )}
        <text x={W / 2} y={H - 8} className="dd-tick" textAnchor="middle">
          depth (0 to {(xMax * 1e9).toFixed(0)} nm)
        </text>
      </svg>

      <table className="detail-props dd-results">
        <tbody>
          <tr>
            <th scope="row">Surface concentration</th>
            <td>{fmtExp(surface / 1e6)} cm⁻³</td>
          </tr>
          <tr>
            <th scope="row">Junction depth x<sub>j</sub></th>
            <td>{xj == null ? 'no junction' : `${(xj * 1e9).toFixed(0)} nm`}</td>
          </tr>
          <tr>
            <th scope="row">Dose</th>
            <td>{fmtExp((step === 'predep' ? predepositionDose(Cs, Dt) : Q) / 1e4)} cm⁻²</td>
          </tr>
          <tr>
            <th scope="row">Crossing width, as a fraction of x<sub>j</sub></th>
            <td>{sharp == null ? '—' : sharp.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {xj == null ? (
        <p className="err-note">
          <strong>No junction.</strong>{' '}
          {step === 'predep'
            ? 'The background is already at or above the surface concentration, so the incoming dopant never overcomes it and there is nothing to cross.'
            : 'The dose has spread far enough that even its peak has fallen to the background. Over-driving does not deepen a junction indefinitely; it eventually erases it.'}
        </p>
      ) : (
        <p className="trend-note">
          The crossing takes place over <strong>{(sharp! * 100).toFixed(0)}%</strong> of the
          junction depth — that is the width over which the doping falls from ten times the
          background to a tenth of it. The abrupt-junction model the panel next door assumes
          treats that width as zero. It is a fair approximation when the number here is small,
          and this ratio is the same at every depth for a given profile shape, which is worth
          knowing: making the junction deeper does not make it relatively sharper.
        </p>
      )}

      <p className="trend-note">
        Same equation as carburising a gear shaft — Fick&rsquo;s second law — and only the
        boundary condition differs. Predeposition holds the surface at a fixed concentration
        while dopant flows in, so the dose grows as √(Dt). Drive-in seals the surface, so a
        fixed dose spreads and the surface concentration <em>falls</em>. √(Dt) is the control
        rather than a dopant table because every number here depends on D and t only through
        that product.
      </p>
    </section>
  );
}
