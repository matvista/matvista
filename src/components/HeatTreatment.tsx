import { useMemo, useState } from 'react';
import { useRouteNumber, useRouteString } from '../useRoute';
import {
  JOMINY_DISTANCES,
  JOMINY_RATES,
  STEELS,
  getSteel,
  martensiteStart,
} from '../heattreat/steels';
import {
  buildTtt,
  coolingPath,
  criticalCoolingRate,
  predict,
  productCarbon,
  tangentCoolingRate,
  TRACE_FRACTION,
  type CurvePoint,
  type Product,
} from '../heattreat/model';

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

const AUSTENITISE = 850;

export function HeatTreatment() {
  // The steel and the cooling rate are the scenario; the Jominy panel is just
  // whether a section is expanded, so it stays out of the URL.
  const [steelId, setSteelId] = useRouteString('steel', '1080');
  const [rate, setRate] = useRouteNumber('rate', 50, 0.01, 5000);
  const [showJominy, setShowJominy] = useState(true);

  const steel = getSteel(steelId);
  const ttt = useMemo(() => buildTtt(steel), [steel]);
  const outcome = useMemo(
    () => predict(steel, ttt, AUSTENITISE, rate),
    [steel, ttt, rate],
  );
  // Ferrite actually reported for this path, used to gate the two disclosures
  // below — the enrichment caveat only means anything once ferrite has formed.
  const ferriteFraction =
    outcome.fractions.find((f) => f.product === 'proeutectoid ferrite')?.fraction ?? 0;

  const solid = outcome.fractions
    .filter((f) => f.product !== 'martensite')
    .reduce((a, f) => a + f.fraction, 0);
  const carbonInSolid = outcome.fractions.reduce(
    (a, f) => a + f.fraction * productCarbon(f.product, steel.composition.C),
    0,
  );
  const enrichedCarbon =
    solid < 1 ? (steel.composition.C - carbonInSolid) / (1 - solid) : steel.composition.C;

  const critical = useMemo(
    () => criticalCoolingRate(steel, ttt, AUSTENITISE),
    [steel, ttt],
  );
  const tangent = tangentCoolingRate(steel, AUSTENITISE);
  const path = useMemo(
    () => coolingPath(AUSTENITISE, rate, T_MIN, T_MAX),
    [rate],
  );

  const sx = (t: number) =>
    PAD.l + (Math.log10(t / T_MIN) / Math.log10(T_MAX / T_MIN)) * plotW;
  const sy = (T: number) =>
    PAD.t + plotH - ((T - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * plotH;

  const line = (pts: CurvePoint[]) =>
    pts
      .filter((p) => p.t >= T_MIN && p.t <= T_MAX && p.T >= TEMP_MIN)
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
              min={Math.log10(0.01)}
              max={Math.log10(5000)}
              step={0.01}
              value={Math.log10(rate)}
              onChange={(e) => setRate(10 ** Number(e.target.value))}
              aria-label="Cooling rate, °C per second"
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
            { T: ttt.ms, label: 'Mˢ' },
            { T: ttt.m50, label: 'M50' },
            { T: ttt.m90, label: 'M90' },
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
              cx={sx((AUSTENITISE - outcome.startTemp) / rate)}
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
                title={`${f.product} ${(f.fraction * 100).toFixed(0)}%`}
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
                <strong>{(f.fraction * 100).toFixed(0)}%</strong>
              </li>
            ))}
        </ul>

        <p className="detail-summary">{outcome.summary}</p>

        <table className="detail-props">
          <tbody>
            <tr>
              <th scope="row">Austenitised at</th>
              <td>{AUSTENITISE} °C</td>
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
            {ttt.a3 !== null && (
              <tr>
                <th scope="row">Ae₃ (Andrews)</th>
                <td>{Math.round(ttt.a3)} °C</td>
              </tr>
            )}
            <tr>
              <th scope="row">Mˢ (Andrews)</th>
              <td>
                {Math.round(martensiteStart(steel.composition))} °C
                {ferriteFraction > 0 && ' (bulk composition)'}
              </td>
            </tr>
            <tr>
              <th scope="row">M90</th>
              <td className={ttt.m90 < 20 ? 'err-off' : ''}>
                {Math.round(ttt.m90)} °C
              </td>
            </tr>
          </tbody>
        </table>

        {ferriteFraction > 0 && (
          <p className="ht-caveat">
            <strong>The ferrite fraction is an upper bound.</strong> It comes from the lever rule on
            the <em>binary</em> Fe–Fe₃C diagram, against the eutectoid at 0.76 wt% C. Manganese,
            chromium, nickel and molybdenum all lower the eutectoid carbon, so an alloy steel
            reaches the eutectoid composition sooner and rejects <em>less</em> proeutectoid ferrite
            than this: for {steel.name.split(' —')[0]} an effective eutectoid near 0.60–0.65 wt% C
            would give roughly 35–40% rather than{' '}
            {(ttt.equilibriumFerrite * 100).toFixed(0)}%. Ae₃ above is Andrews' regression over the
            whole composition and does account for the alloying; the fraction does not.
          </p>
        )}

        {ferriteFraction > 0 && (
          <p className="ht-caveat">
            <strong>Mˢ is computed from the bulk composition.</strong> Rejecting ferrite leaves the
            untransformed austenite richer in carbon than the steel as a whole — here about{' '}
            {enrichedCarbon.toFixed(2)} wt% C against {steel.composition.C.toFixed(2)} — and carbon
            is the term that dominates Andrews' Mˢ. The real Mˢ for that austenite is roughly{' '}
            {Math.round(423 * (enrichedCarbon - steel.composition.C))} °C below the figure above.
            Feeding the enrichment back would move the whole construction, including every critical
            cooling rate, so it is not done here — the number is stated as it is computed.
          </p>
        )}

        {ttt.m90 < 20 && (
          <p className="ht-caveat">
            <strong>Retained austenite.</strong> M90 sits at {Math.round(ttt.m90)} °C — below room
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

function fmtRate(r: number): string {
  if (r >= 100) return r.toFixed(0);
  if (r >= 10) return r.toFixed(0);
  if (r >= 1) return r.toFixed(1);
  return r.toFixed(2);
}
