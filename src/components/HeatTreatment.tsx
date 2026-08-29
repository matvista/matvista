import { useMemo, useState } from 'react';
import { useRouteNumber, useRouteString } from '../useRoute';
import {
  JOMINY_DISTANCES,
  JOMINY_RATES,
  STEELS,
  getSteel,
  martensiteStart,
  type Steel,
} from '../heattreat/steels';
import {
  buildTtt,
  coolingPath,
  ferriteBand,
  criticalCoolingRate,
  predict,
  RATE_RANGE,
  tangentCoolingRate,
  untransformedAusteniteCarbon,
  TRACE_FRACTION,
  type CurvePoint,
  type Product,
} from '../heattreat/model';
import { EUTECTOID_T, FE_C, boundaryTemperature } from '../phase/systems';

const W = 720;
const H = 470;
const PAD = { l: 62, r: 96, t: 20, b: 52 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

/** Time axis, seconds — a decade either side of the slowest and fastest events. */
const T_MIN = 0.1;
const T_MAX = 1e6;
const TEMP_MIN = 0;
const TEMP_MAX = 800;

// Same viewBox width as the TTT chart above, so both scale their text by the
// same factor in the container and the two plots look like one family.
const JW = 720;
const JH = 300;
const JPAD = { l: 62, r: 24, t: 16, b: 48 };

/**
 * Product colours, chosen to clear 3:1 against **both** the light and the dark
 * page (WCAG 1.4.11, non-text contrast). These are hard-coded rather than
 * themed, so each has to work on either ground: the old fine-pearlite violet
 * sat at 2.27:1 on dark and the old bainite green at 2.67:1 on light.
 * The product name is always printed beside the swatch as well, so colour is
 * never the only thing carrying the meaning.
 *
 * Keyed on `Product` rather than `string`: the project sets neither `strict`
 * nor `noUncheckedIndexedAccess`, so a `Record<string, string>` would hand a
 * sixth product `undefined` and render `background: undefined` with no
 * compiler complaint. This way adding to `Product` fails the build until a
 * colour is chosen for it — which is how the ferrite swatch got missed once
 * already.
 */
const PRODUCT_COLOR: Record<Product, string> = {
  'proeutectoid ferrite': '#a8681d', // light 4.27, dark 4.32
  'coarse pearlite': '#2976d2', // light 4.32, dark 4.27
  'fine pearlite': '#776bbd', // light 4.31, dark 4.28
  bainite: '#15875e', // light 4.28, dark 4.31
  martensite: '#d34443', // light 4.26, dark 4.33
};

/**
 * Names the eutectoid-lowering elements this particular steel actually
 * contains, ranked by **per-unit** effect.
 *
 * One static sentence covered both grades and led with molybdenum, which 5140
 * does not contain at all, along with the nickel it went on to mention.
 *
 * Two things this deliberately does not do. It quotes no magnitude — b0b4181
 * established there is no published linear-additive formula for eutectoid
 * carbon in a multicomponent steel, and an earlier version of this comment
 * broke that policy in its own second paragraph by asserting "nickel moves it
 * by ≤0.02 wt%", unsourced and unasserted. And it says "per wt%" out loud,
 * because ranking by slope while writing "in this steel" reads as a claim
 * about this steel's actual composition: 4340 holds 0.25% Mo against 1.8% Ni,
 * so leading with molybdenum and calling nickel negligible is true of the
 * slopes and misleading about the amounts.
 */
function eutectoidShifters(steel: Steel): string {
  const strong: string[] = [];
  if (steel.composition.Mo > 0) strong.push('molybdenum steepest per wt%');
  const mid = [
    steel.composition.Mn > 0 ? 'manganese' : null,
    steel.composition.Cr > 0 ? 'chromium' : null,
  ].filter(Boolean) as string[];
  if (mid.length > 0) {
    strong.push(`${mid.join(' and ')} appreciably`);
  }
  if (steel.composition.Ni > 0) {
    strong.push(
      `nickel least of the four per wt%, though it is the most abundant here at ${steel.composition.Ni.toFixed(
        2,
      )}%`,
    );
  }
  return strong.length === 1
    ? strong[0]
    : `${strong.slice(0, -1).join(', ')} and ${strong[strong.length - 1]}`;
}

/**
 * The austenitising range the slider offers, °C.
 *
 * The floor is just above A₁ (727 °C) — below the eutectoid there is no
 * austenite to form at all, so it is not an austenitising temperature. The
 * ceiling is well past any practical hardening treatment.
 */
const AUST_MIN = 730;
const AUST_MAX = 1050;
const AUST_DEFAULT = 850;

export function HeatTreatment() {
  // The steel and the cooling rate are the scenario; the Jominy panel is just
  // whether a section is expanded, so it stays out of the URL.
  const [steelId, setSteelId] = useRouteString('steel', '1080');
  const [rate, setRate] = useRouteNumber('rate', 50, RATE_RANGE.min, RATE_RANGE.max);
  const [austT, setAustT] = useRouteNumber('austT', AUST_DEFAULT, AUST_MIN, AUST_MAX);
  const [showJominy, setShowJominy] = useState(true);

  const steel = getSteel(steelId);
  const ttt = useMemo(() => buildTtt(steel), [steel]);
  const outcome = useMemo(
    () => predict(steel, ttt, austT, rate),
    [steel, ttt, austT, rate],
  );
  // Ferrite actually reported for this path, used to gate the two disclosures
  // below — the enrichment caveat only means anything once ferrite has formed.
  const ferriteFraction =
    outcome.fractions.find((f) => f.product === 'proeutectoid ferrite')?.fraction ?? 0;

  const enrichedCarbon = untransformedAusteniteCarbon(outcome, steel.composition.C);
  // The enrichment only bears on Mˢ if austenite actually survives to it. On a
  // completed transformation there is none left, so saying "0.40 against 0.40,
  // roughly 0 °C below" would be noise dressed as a caveat.
  const msUnderstated =
    ferriteFraction > 0 && enrichedCarbon !== null && enrichedCarbon > steel.composition.C + 0.005;

  /**
   * Which legend entries are bounds, and in which direction.
   *
   * The split is `ferrite = min(f, αₑq)` and `pearlite = max(0, f − αₑq)`, so
   * the *same* unknown margin makes one an over-estimate and the other an
   * under-estimate. Two earlier versions got this wrong in opposite ways:
   * first the mark fired only once ferrite had saturated (so most of the
   * range showed a bare number that was still a ceiling), then it fired on
   * every ferrite entry but on no pearlite entry — which tells the reader the
   * pearlite figure is exact, and it is not, by 4.8–6.8 points for α′ in
   * 0.42–0.44.
   *
   * Pearlite is marked only where the split actually ran, which is where
   * ferrite is present in the same outcome; below the ferrite floor the
   * pearlite figure is the whole diffusional product, undivided and unbounded
   * by αₑq.
   */
  const boundOf = (product: string): 'upper' | 'lower' | null => {
    if (product === 'proeutectoid ferrite') return 'upper';
    if (/pearlite/.test(product) && ferriteFraction > 0) return 'lower';
    return null;
  };

  const band = useMemo(() => ferriteBand(steel, ttt, austT), [steel, ttt, austT]);

  const critical = useMemo(
    () => criticalCoolingRate(steel, ttt, austT),
    [steel, ttt, austT],
  );
  const tangent = tangentCoolingRate(steel, austT);
  const path = useMemo(
    () => coolingPath(austT, rate, T_MIN, T_MAX),
    [austT, rate],
  );

  /**
   * M12 — where this austenitising temperature sits on Fe–Fe₃C, read from the
   * phase module's own diagram rather than from a second copy of the numbers.
   * A hypoeutectoid steel has an A₃; a hypereutectoid one has an A_cm instead,
   * and `boundaryTemperature` returns null for the boundary that does not
   * reach it, which is the distinction rather than an error.
   */
  const carbon = steel.composition.C;
  const a1 = boundaryTemperature(FE_C, 'Eutectoid isotherm', carbon) ?? EUTECTOID_T;
  const a3 = boundaryTemperature(FE_C, 'A₃', carbon);
  const acm = boundaryTemperature(FE_C, 'A_cm', carbon);
  const equilibrium = FE_C.evaluate(carbon, austT);
  const undissolvedFerrite =
    equilibrium.phases.find((p) => p.name === 'α')?.fraction ?? 0;
  const undissolvedCementite =
    equilibrium.phases.find((p) => p.name === 'Fe₃C')?.fraction ?? 0;

  const sx = (t: number) =>
    PAD.l + (Math.log10(t / T_MIN) / Math.log10(T_MAX / T_MIN)) * plotW;
  const sy = (T: number) =>
    PAD.t + plotH - ((T - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * plotH;

  const line = (pts: CurvePoint[]) =>
    pts
      // The upper clip is what lets the austenitising temperature run past the
      // chart's 800 °C ceiling without the path drawing off the top of it.
      .filter((p) => p.t >= T_MIN && p.t <= T_MAX && p.T >= TEMP_MIN && p.T <= TEMP_MAX)
      .map((p) => `${sx(p.t)},${sy(p.T)}`)
      .join(' ');

  const decades = [0.1, 1, 10, 100, 1e3, 1e4, 1e5, 1e6];

  return (
    <div className="ht-layout">
      <div className="ht-main">
        <div className="crystal-controls">
          <select value={steelId} onChange={(e) => setSteelId(e.target.value)} aria-label="Steel">
            {STEELS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="ht-rate">
            <span>
              Cooling rate <strong>{fmtRate(rate)}</strong> °C/s
            </span>
            <input
              type="range"
              min={Math.log10(RATE_RANGE.min)}
              max={Math.log10(RATE_RANGE.max)}
              step={RATE_RANGE.step}
              value={Math.log10(rate)}
              onChange={(e) => setRate(10 ** Number(e.target.value))}
              aria-label="Cooling rate, °C per second"
            />
          </label>
          <label className="ht-rate">
            <span>
              Austenitised at <strong>{austT}</strong> °C
            </span>
            <input
              type="range"
              min={AUST_MIN}
              max={AUST_MAX}
              step={5}
              value={austT}
              onChange={(e) => setAustT(Number(e.target.value))}
              aria-label="Austenitising temperature, °C"
            />
          </label>
        </div>

        <svg
          className="ht-plot"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Isothermal transformation diagram for ${steel.name}`}
        >
          {decades.map((t) => (
            <line key={t} x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={PAD.t + plotH} className="dd-grid" />
          ))}
          {[100, 200, 300, 400, 500, 600, 700].map((T) => (
            <line key={T} x1={PAD.l} x2={W - PAD.r} y1={sy(T)} y2={sy(T)} className="dd-grid" />
          ))}

          {/* A₁: above it austenite is stable and nothing transforms. */}
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(ttt.a1)} y2={sy(ttt.a1)} className="ht-a1" />
          <text x={W - PAD.r + 6} y={sy(ttt.a1) + 4} className="ht-edge-label">
            A₁ {ttt.a1}°C
          </text>

          {/* Martensite lines are horizontal: the transformation is diffusionless,
              so it depends on temperature alone and not at all on time. */}
          {[
            // From the outcome, not the steel: on a ferrite-forming path the
            // austenite left to quench is enriched and its Mˢ is far lower, so
            // these lines move with the cooling rate.
            { T: outcome.ms, label: 'Mˢ' },
            { T: outcome.m50, label: 'M50' },
            { T: outcome.m90, label: 'M90' },
          ]
            .filter((m) => m.T >= TEMP_MIN + 8)
            .map((m) => (
            <g key={m.label}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={sy(m.T)}
                y2={sy(m.T)}
                className={m.label === 'Mˢ' ? 'ht-ms' : 'ht-mfrac'}
              />
              <text x={W - PAD.r + 6} y={sy(m.T) + 4} className="ht-edge-label">
                {m.label} {Math.round(m.T)}°C
              </text>
            </g>
            ))}

          <polyline points={line(ttt.start)} className="ht-start" />
          <polyline points={line(ttt.finish)} className="ht-finish" />

          <text x={sx(steel.nose.time) + 8} y={sy(steel.nose.temp) - 8} className="ht-curve-label">
            start
          </text>
          <text
            x={sx(steel.nose.time * steel.finishFactor) + 8}
            y={sy(steel.nose.temp) + 18}
            className="ht-curve-label"
          >
            finish
          </text>

          {/* The cooling path the slider describes. */}
          <polyline points={line(path)} className="ht-path" />

          {/* Where transformation begins, if it does. */}
          {outcome.startTemp != null && (
            <circle
              cx={sx((austT - outcome.startTemp) / rate)}
              cy={sy(outcome.startTemp)}
              r={5}
              className="ht-hit"
            />
          )}

          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />

          {decades.map((t) => (
            <text key={t} x={sx(t)} y={PAD.t + plotH + 18} className="dd-tick" textAnchor="middle">
              {fmtTime(t)}
            </text>
          ))}
          {[0, 200, 400, 600, 800].map((T) => (
            <text key={T} x={PAD.l - 8} y={sy(T) + 4} className="dd-tick" textAnchor="end">
              {T}
            </text>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 8} className="dd-tick" textAnchor="middle">
            time (s, log scale)
          </text>
          <text
            x={16}
            y={PAD.t + plotH / 2}
            className="dd-tick"
            textAnchor="middle"
            transform={`rotate(-90 16 ${PAD.t + plotH / 2})`}
          >
            temperature (°C)
          </text>
        </svg>

        <div className="ht-legend">
          <span>
            <i className="ht-key-start" /> transformation start (1%)
          </span>
          <span>
            <i className="ht-key-finish" /> finish (99%)
          </span>
          <span>
            <i className="ht-key-path" /> your cooling path
          </span>
        </div>

        <p className="trend-note">{steel.note}</p>

        <p className="ht-caveat">
          <strong>Read this with care.</strong> These are <em>isothermal</em> curves, measured by
          quenching to a temperature and holding. Laying a continuous cooling path over them is the
          standard textbook construction and it gets the mechanism and the ordering right, but a
          real continuous-cooling (CCT) diagram sits below and to the right — so this reads
          pearlite slightly sooner than a real furnace would.
        </p>
      </div>

      <aside className="detail">
        <h2 className="crystal-title">{outcome.hardness.toFixed(0)} HRC</h2>
        <p className="detail-meta">predicted at {fmtRate(rate)} °C/s</p>

        <div className="ht-bar" role="img" aria-label="Predicted phase fractions">
          {outcome.fractions
            .filter((f) => f.fraction >= TRACE_FRACTION)
            .map((f) => (
              <div
                key={f.product}
                className="ht-bar-seg"
                style={{
                  width: `${f.fraction * 100}%`,
                  background: PRODUCT_COLOR[f.product],
                }}
                title={`${f.product} ${
                  boundOf(f.product) === 'upper'
                    ? 'at most '
                    : boundOf(f.product) === 'lower'
                      ? 'at least '
                      : ''
                }${(f.fraction * 100).toFixed(0)}%`}
              />
            ))}
        </div>
        <ul className="ht-frac-list">
          {outcome.fractions
            .filter((f) => f.fraction >= TRACE_FRACTION)
            .map((f) => (
              <li key={f.product}>
                <i style={{ background: PRODUCT_COLOR[f.product] }} />
                {f.product}
                {/* The qualifier belongs on the number, not in a footnote
                    below it: the binary lever rule gives a ceiling for this
                    one, and a bare bold "49%" reads as a measurement. */}
                <strong
                  title={
                    boundOf(f.product) === null
                      ? undefined
                      : `${boundOf(f.product) === 'upper' ? 'Upper' : 'Lower'} bound — the two sides of the binary lever rule move together; see the note below`
                  }
                >
                  {boundOf(f.product) === 'upper' && (
                    <>
                      <span aria-hidden="true">≤ </span>
                      <span className="vh">at most </span>
                    </>
                  )}
                  {boundOf(f.product) === 'lower' && (
                    <>
                      <span aria-hidden="true">≥ </span>
                      <span className="vh">at least </span>
                    </>
                  )}
                  {(f.fraction * 100).toFixed(0)}%
                </strong>
              </li>
            ))}
        </ul>

        <p className="detail-summary">{outcome.summary}</p>

        <table className="detail-props">
          <tbody>
            <tr>
              <th scope="row">Austenitised at</th>
              <td>
                {austT} °C
                {a3 != null && ` · A₃ ${Math.round(a3)}`}
                {acm != null && ` · A_cm ${Math.round(acm)}`}
              </td>
            </tr>
            <tr>
              <th scope="row">Nose</th>
              <td>
                {fmtTime(steel.nose.time)} s @ {steel.nose.temp} °C
              </td>
            </tr>
            <tr>
              <th scope="row">Critical rate</th>
              <td>{critical == null ? 'faster than this model resolves' : `${fmtRate(critical)} °C/s`}</td>
            </tr>
            <tr>
              <th scope="row">Mˢ (Andrews)</th>
              <td>
                {Math.round(outcome.ms)} °C
                {msUnderstated && ' (enriched austenite)'}
              </td>
            </tr>
            <tr>
              <th scope="row">M90</th>
              <td className={outcome.m90 < 20 ? 'err-off' : ''}>
                {Math.round(outcome.m90)} °C
              </td>
            </tr>
          </tbody>
        </table>

        <AustenitisingPanel
          carbon={carbon}
          austT={austT}
          a1={a1}
          a3={a3}
          acm={acm}
          undissolvedFerrite={undissolvedFerrite}
          undissolvedCementite={undissolvedCementite}
          region={equilibrium.region}
        />

        {ferriteFraction > 0 && (
          <p className="ht-caveat">
            <strong>The ferrite fraction is an upper bound.</strong> It is the lever rule on the{' '}
            <em>binary</em> Fe–Fe₃C diagram, against the eutectoid at 0.76 wt% C. Alloying lowers
            the eutectoid carbon — in this steel {eutectoidShifters(steel)} — so it reaches the
            eutectoid composition sooner and rejects <em>less</em> ferrite than {(ttt.equilibriumFerrite * 100).toFixed(0)}%.
            No corrected figure is quoted, because there is not one to quote: a ternary Fe–C–X
            section is univariant rather than invariant, so a multicomponent steel has no single
            eutectoid <em>point</em>, the published pseudo-binary sections are explicitly not
            superposable, and there is no linear-additive formula for eutectoid carbon to combine
            them with. Read {(ttt.equilibriumFerrite * 100).toFixed(0)}% as the ceiling, not the
            answer — and a ceiling the true value drops further below as the quench gets faster,
            because this model has no ferrite kinetics of its own. Measured dilatometry on a
            0.4 wt% C steel sheds 52 to 22 vol% ferrite between 1 and 7 °C/s, a steady decline;
            {band === null ? null : (
              <>
                {' '}this construction holds {(band.slowFraction * 100).toFixed(0)}% from{' '}
                {fmtRate(band.slowRate)} °C/s down to {(band.fastFraction * 100).toFixed(0)}% at{' '}
                {fmtRate(band.fastRate)} °C/s, and then reports none at all.
              </>
            )}
          </p>
        )}

        {msUnderstated && (
          <p className="ht-caveat">
            <strong>Mˢ here is the enriched austenite's, not the steel's.</strong> Rejecting
            ferrite leaves what is left richer in carbon than the steel as a whole — about{' '}
            {enrichedCarbon!.toFixed(2)} wt% C against {steel.composition.C.toFixed(2)} — and carbon
            dominates Andrews' equation, so Mˢ, M50 and M90 above are{' '}
            {Math.round(martensiteStart(steel.composition) - outcome.ms)} °C below the bulk figure
            of {Math.round(martensiteStart(steel.composition))} °C, and the lines on the diagram
            move with them. What is <em>not</em> fed back is the floor the transformation
            integrates down to, which still uses the bulk value: the two are coupled and the
            coupled solution turns out to jump discontinuously with cooling rate. The cost is a
            diffusional fraction understated by at most about three points.
          </p>
        )}

        {outcome.m90 < 20 && (
          <p className="ht-caveat">
            <strong>Retained austenite.</strong> M90 sits at {Math.round(outcome.m90)} °C — below room
            temperature — so quenching to 20 °C cannot convert the last of the austenite however
            fast you go. Carbon is what pushes Mˢ down, which is why the problem belongs to
            high-carbon steels and why they get a sub-zero treatment when it matters.
          </p>
        )}

        <div className="density-box">
          <h3>Hardenability</h3>
          <p className="density-note">
            The critical rate is the slowest quench that still misses the nose entirely. Quench{' '}
            <em>faster</em> and you keep fully martensitic structure; quench <em>slower</em> and you
            start trading martensite away for pearlite and bainite. It is a property of the{' '}
            <em>steel</em>, and it is the number alloying is bought to change — note that 4340
            needs a quench roughly a hundred times gentler than 1080, while its martensite is
            actually a little softer.
          </p>
          <p className="density-note">
            Drawing a cooling line straight through the nose — the usual by-hand construction —
            gives {fmtRate(tangent)} °C/s for this steel
            {critical != null && `, against the ${fmtRate(critical)} °C/s quoted above`}. Merely
            touching the nose is not enough: the path has to linger near it long enough to
            accumulate a full incubation, which is what the diagram above actually integrates.
            Set the slider just below the quoted rate and the first trace of bainite appears —
            transformation beginning barely above Mˢ, on the lower limb of the C.
          </p>
          <button
            className={`toggle ${showJominy ? 'toggle-on' : ''}`}
            aria-pressed={showJominy}
            onClick={() => setShowJominy((v) => !v)}
          >
            {showJominy ? 'Hide' : 'Show'} Jominy comparison
          </button>
        </div>
      </aside>

      {showJominy && (
        <section className="ht-jominy">
          <h3>Jominy end-quench</h3>
          <p className="density-note">
            One bar, quenched on one end. The cooling rate at each distance is fixed by the test,
            not by the steel — so the hardness profile ranks grades directly. Where the curve stays
            flat, the whole section hardened.
          </p>
          <JominyChart activeId={steelId} onPick={setSteelId} />
        </section>
      )}
    </div>
  );
}

function JominyChart({ activeId, onPick }: { activeId: string; onPick: (id: string) => void }) {
  const plotW = JW - JPAD.l - JPAD.r;
  const plotH = JH - JPAD.t - JPAD.b;
  const maxD = JOMINY_DISTANCES[JOMINY_DISTANCES.length - 1];

  const sx = (d: number) => JPAD.l + (d / maxD) * plotW;
  const sy = (h: number) => JPAD.t + plotH - (h / 70) * plotH;

  return (
    <>
      <svg className="ht-plot" viewBox={`0 0 ${JW} ${JH}`} role="img" aria-label="Jominy hardness curves">
        {[10, 20, 30, 40, 50, 60, 70].map((h) => (
          <line key={h} x1={JPAD.l} x2={JW - JPAD.r} y1={sy(h)} y2={sy(h)} className="dd-grid" />
        ))}

        {STEELS.map((s) => (
          <polyline
            key={s.id}
            points={s.jominy.map((h, i) => `${sx(JOMINY_DISTANCES[i])},${sy(h)}`).join(' ')}
            className={`ht-jominy-line ${s.id === activeId ? 'ht-jominy-active' : ''}`}
          />
        ))}

        <line x1={JPAD.l} x2={JW - JPAD.r} y1={JPAD.t + plotH} y2={JPAD.t + plotH} className="dd-axis" />
        <line x1={JPAD.l} x2={JPAD.l} y1={JPAD.t} y2={JPAD.t + plotH} className="dd-axis" />

        {[0, 10, 20, 30, 40, 50].map((d) => (
          <text key={d} x={sx(d)} y={JPAD.t + plotH + 16} className="dd-tick" textAnchor="middle">
            {d}
          </text>
        ))}
        {[20, 40, 60].map((h) => (
          <text key={h} x={JPAD.l - 8} y={sy(h) + 4} className="dd-tick" textAnchor="end">
            {h}
          </text>
        ))}
        <text x={JPAD.l + plotW / 2} y={JH - 6} className="dd-tick" textAnchor="middle">
          distance from quenched end (mm)
        </text>
        <text
          x={14}
          y={JPAD.t + plotH / 2}
          className="dd-tick"
          textAnchor="middle"
          transform={`rotate(-90 14 ${JPAD.t + plotH / 2})`}
        >
          hardness (HRC)
        </text>
      </svg>

      <div className="ht-jominy-key">
        {STEELS.map((s) => (
          <button
            key={s.id}
            className={`mi-chip ${s.id === activeId ? 'mi-chip-on' : ''}`}
            onClick={() => onPick(s.id)}
          >
            {s.id}
          </button>
        ))}
        <span className="mi-dim">
          cooling rate at the quenched end ≈ {JOMINY_RATES[0]} °C/s, falling to{' '}
          {JOMINY_RATES[JOMINY_RATES.length - 1]} °C/s at {maxD} mm
        </span>
      </div>
    </>
  );
}

function fmtTime(t: number): string {
  if (t >= 1000) return `10^${Math.round(Math.log10(t))}`;
  if (t >= 1) return `${t}`;
  return `${t}`;
}

/* ======================================================== austenitising == */

/** The strip's window on Fe–Fe₃C: enough carbon and enough temperature to
 *  hold A₁, A₃ and A_cm for every shipped steel. */
const STRIP_X_MAX = 1.4;
const STRIP_T_MIN = 690;
// Above AUST_MAX, so the marker is on the strip at every slider setting.
const STRIP_T_MAX = 1060;
const SW = 300;
const SH = 200;
const SPAD = { l: 34, r: 10, t: 12, b: 28 };
const spw = SW - SPAD.l - SPAD.r;
const sph = SH - SPAD.t - SPAD.b;
const stx = (x: number) => SPAD.l + (x / STRIP_X_MAX) * spw;
const sty = (T: number) =>
  SPAD.t + sph - ((T - STRIP_T_MIN) / (STRIP_T_MAX - STRIP_T_MIN)) * sph;

/**
 * M12 — the austenitising temperature read against Fe–Fe₃C.
 *
 * The step before the quench that teaching consistently skips, and where the
 * equilibrium and kinetic diagrams actually meet: the austenitising
 * temperature is *chosen* from the phase diagram, A₃ + 30–50 °C, not picked.
 * Austenitise too low and you quench a two-phase structure, giving soft
 * ferrite patches no faster quench can fix.
 *
 * The boundaries are `FE_C.boundaries` — the same polylines the phase module
 * draws — clipped to this window, not a second copy of the numbers.
 */
function AustenitisingPanel({
  carbon, austT, a1, a3, acm, undissolvedFerrite, undissolvedCementite, region,
}: {
  carbon: number;
  austT: number;
  a1: number;
  a3: number | null;
  acm: number | null;
  undissolvedFerrite: number;
  undissolvedCementite: number;
  region: string;
}) {
  const target = a3 ?? a1;
  const belowA3 = a3 != null && austT < a3;

  return (
    <div className="density-box">
      <h3>Chosen from the phase diagram</h3>

      <svg
        className="ht-strip"
        viewBox={`0 0 ${SW} ${SH}`}
        role="img"
        aria-label={`Fe–Fe₃C phase diagram near the eutectoid, with this steel at ${carbon} wt% C austenitised at ${austT} °C, in the ${region} field`}
      >
        <defs>
          <clipPath id="ht-strip-clip">
            <rect x={SPAD.l} y={SPAD.t} width={spw} height={sph} />
          </clipPath>
        </defs>

        <g clipPath="url(#ht-strip-clip)">
          {FE_C.boundaries.map((b) => (
            <polyline
              key={b.label}
              points={b.points.map(([x, T]) => `${stx(x)},${sty(T)}`).join(' ')}
              className={`pd-boundary pd-${b.kind}`}
            />
          ))}
          {/* This steel's carbon, and where on it the furnace is set. */}
          <line x1={stx(carbon)} x2={stx(carbon)} y1={SPAD.t} y2={SPAD.t + sph} className="pd-cross" />
          <circle cx={stx(carbon)} cy={sty(austT)} r={5} className="pd-point" />
        </g>

        <text x={stx(0.05)} y={sty(960)} className="pd-region">γ</text>
        <text x={stx(0.25)} y={sty(760)} className="pd-region">α + γ</text>
        <text x={stx(1.1)} y={sty(760)} className="pd-region">γ + Fe₃C</text>
        <text x={stx(1.1)} y={sty(706)} className="pd-region">α + Fe₃C</text>

        <line x1={SPAD.l} x2={SW - SPAD.r} y1={SPAD.t + sph} y2={SPAD.t + sph} className="dd-axis" />
        <line x1={SPAD.l} x2={SPAD.l} y1={SPAD.t} y2={SPAD.t + sph} className="dd-axis" />
        {[0, 0.4, 0.8, 1.2].map((x) => (
          <text key={x} x={stx(x)} y={SH - 14} className="dd-tick" textAnchor="middle">
            {x}
          </text>
        ))}
        {[700, 800, 900, 1000].map((T) => (
          <text key={T} x={SPAD.l - 6} y={sty(T) + 4} className="dd-tick" textAnchor="end">
            {T}
          </text>
        ))}
        <text x={SPAD.l + spw / 2} y={SH - 2} className="dd-tick" textAnchor="middle">
          wt% C
        </text>
      </svg>

      <table className="detail-props">
        <tbody>
          <tr>
            <th scope="row">Equilibrium field</th>
            <td>{region}</td>
          </tr>
          <tr>
            <th scope="row">A₁ (eutectoid)</th>
            <td>{Math.round(a1)} °C</td>
          </tr>
          {a3 != null && (
            <tr>
              <th scope="row">A₃</th>
              <td>{Math.round(a3)} °C</td>
            </tr>
          )}
          {acm != null && (
            <tr>
              <th scope="row">A_cm</th>
              <td>{Math.round(acm)} °C</td>
            </tr>
          )}
          <tr>
            <th scope="row">Margin on {a3 != null ? 'A₃' : 'A₁'}</th>
            <td className={austT - target >= 30 && austT - target <= 60 ? 'err-ok' : ''}>
              {Math.abs(Math.round(austT - target))} °C {austT >= target ? 'above' : 'below'}
            </td>
          </tr>
          {undissolvedFerrite > 0 && (
            <tr>
              <th scope="row">Undissolved ferrite</th>
              <td className="err-off">{(undissolvedFerrite * 100).toFixed(0)}%</td>
            </tr>
          )}
          {undissolvedCementite > 0 && (
            <tr>
              <th scope="row">Undissolved Fe₃C</th>
              <td>{(undissolvedCementite * 100).toFixed(1)}%</td>
            </tr>
          )}
        </tbody>
      </table>

      {belowA3 && (
        <p className="ht-caveat">
          <strong>Below A₃ — an incomplete austenitisation.</strong> At {austT} °C this steel is
          still {region}: {(undissolvedFerrite * 100).toFixed(0)}% of it is ferrite, by the phase
          module's own lever rule, and ferrite has almost no carbon in it to harden. Quenching from
          here leaves soft ferrite patches in a martensitic matrix, and no faster quench fixes
          them — the fault was made in the furnace. The usual rule is A₃ + 30–50 °C, which is{' '}
          {Math.round(target + 30)}–{Math.round(target + 50)} °C for this grade.
        </p>
      )}

      {a3 == null && (
        <p className="density-note">
          This grade is <strong>hypereutectoid</strong>, so it has no A₃ — above A₁ it enters
          γ + Fe₃C, and only past A_cm at {acm == null ? '—' : Math.round(acm)} °C is the cementite
          gone. Hypereutectoid steels are deliberately austenitised <em>below</em> A_cm: the
          undissolved cementite is hard and keeps carbon out of solution, and dissolving it would
          raise the carbon in the austenite and drop Mˢ, in the worst case below room temperature.
        </p>
      )}

      <p className="ht-caveat">
        <strong>This control does not move the nose, and in this model it does not move the
        prediction either.</strong> Every C-curve here is anchored at A₁ = {Math.round(a1)} °C and
        nothing above it transforms, so a path starting at 1050 °C spends exactly the same time in
        each temperature interval below A₁ as one starting at 730 — the products, the hardness and
        the critical cooling rate come out identical, to twelve decimal places. What does change is
        the <em>tangent</em> construction, which is pure geometry from the start down to the nose,
        so the gap between the two widens as you austenitise higher. In reality a higher
        temperature also coarsens the austenite grain and pushes the nose right, increasing
        hardenability; that is not modelled, and the readouts above should not be read as saying it
        is.
      </p>
    </div>
  );
}

function fmtRate(r: number): string {
  if (r >= 100) return r.toFixed(0);
  if (r >= 10) return r.toFixed(0);
  if (r >= 1) return r.toFixed(1);
  return r.toFixed(2);
}
