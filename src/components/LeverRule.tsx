import { useEffect, useId, useRef, useState } from 'react';
import {
  EUTECTOID_T,
  EUTECTOID_X,
  PEARLITE_FERRITE,
  asPercent,
  eutectoidSplit,
} from '../phase/eutectoid';
import { LEVER_DEFAULT, LEVER_GEOMETRY, LEVER_RANGE } from '../landing/lever';

/**
 * The landing page's one live figure.
 *
 * Everything else on that page is a plate: generated offline, committed, and
 * true. Plates are the right form for most of it, but the page opens by
 * promising "something you drive rather than read" and then, for six thousand
 * pixels, gives the reader nothing to drive. This is the instrument that makes
 * the claim checkable in the place it is made.
 *
 * It is deliberately the *smallest* interesting instrument in the app rather
 * than a second copy of the phase module. One control, one alloy system, one
 * temperature — and the whole of the teaching point:
 *
 *   - **The proeutectoid constituent flips at 0.76 wt% C.** Below it the phase
 *     that separates before the reaction is ferrite; above it, cementite. Same
 *     diagram, same lever rule, opposite answer — and a steel that is tough on
 *     one side of that line is brittle on the other.
 *   - **Microconstituent fractions are not phase fractions.** Students who have
 *     understood this for Pb–Sn routinely fail to transfer it to steel, because
 *     Fe–C is taught with different words.
 *
 * The second point is *drawn*, not asserted, and that took a redraft. The bars
 * first showed pearlite as one block in a colour of its own, under a phase bar
 * in two others, and the prose beside them claimed a reader could see the
 * ferrite inside pearlite counted into total ferrite. They could not: it was
 * behind a third colour, and above 0.76 wt% C the microconstituent bar had no
 * ferrite in it at all.
 *
 * So there are two colours, one per phase, and pearlite is drawn as what it is
 * — its own 88.9 % ferrite and 11.1 % cementite, from `PEARLITE_FERRITE` —
 * under a bracket that names it. Segments are then ordered by phase rather than
 * by when they formed, ferrite first, which makes the identity visible as
 * geometry: **the boundary between the two colours falls at the same x in both
 * bars, at every composition.** Proeutectoid ferrite plus the ferrite inside
 * pearlite *is* total ferrite; the algebra cancels to (c − x)/(c − a), and
 * `eutectoid.test.ts` asserts it rather than trusting the derivation.
 *
 * The numbers come from `phase/eutectoid.ts`, which is also where
 * `phase/systems.ts` gets the four fixed points it draws the diagram from — so
 * the instrument and the module a reader clicks through to cannot disagree.
 * `phase/eutectoid.test.ts` walks the whole domain proving it, and
 * `lever-rule.behaviour.test.tsx` checks that what is on screen is what was
 * computed, including where every segment boundary lands.
 *
 * No animation and no requestAnimationFrame: it recomputes on input and only on
 * input. Six multiplications is not work worth scheduling.
 */

/** The two phases, and nothing else. Colour means phase here, exactly. */
const PHASE_TOKEN = {
  ferrite: 'var(--fig-a)',
  cementite: 'var(--fig-d)',
} as const;

interface Segment {
  key: string;
  label: string;
  fraction: number;
  phase: keyof typeof PHASE_TOKEN;
}

export function LeverRule() {
  const [carbon, setCarbon] = useState(LEVER_DEFAULT);
  const sliderId = useId();
  const split = eutectoidSplit(carbon);

  // Unreachable: every step of the control is inside the domain, and
  // `lever-rule.behaviour.test.tsx` walks all of them. Handled rather than
  // asserted, because a blank panel is a better failure than a thrown render on
  // the one view the whole site loads eagerly.
  if (!split) return null;

  const pearliteFerrite = split.pearliteFraction * PEARLITE_FERRITE;
  const pearliteCementite = split.pearliteFraction - pearliteFerrite;
  const proeutectoidIsFerrite = split.proeutectoid === 'α (ferrite)';

  const pearliteSegments: Segment[] = [
    { key: 'pearlite-ferrite', label: 'α in pearlite', fraction: pearliteFerrite, phase: 'ferrite' },
    {
      key: 'pearlite-cementite',
      label: 'Fe₃C in pearlite',
      fraction: pearliteCementite,
      phase: 'cementite',
    },
  ];

  /*
   * Ordered by phase, not by when it formed. Proeutectoid ferrite goes to the
   * left of pearlite's ferrite; proeutectoid cementite goes to the right of
   * pearlite's cementite. Either way all the ferrite is on the left, which is
   * what lets the colour boundary line up with the phase bar below.
   */
  const micro: Segment[] =
    split.proeutectoid == null
      ? pearliteSegments
      : proeutectoidIsFerrite
        ? [
            {
              key: 'proeutectoid',
              label: 'Proeutectoid α',
              fraction: split.proeutectoidFraction,
              phase: 'ferrite',
            },
            ...pearliteSegments,
          ]
        : [
            ...pearliteSegments,
            {
              key: 'proeutectoid',
              label: 'Proeutectoid Fe₃C',
              fraction: split.proeutectoidFraction,
              phase: 'cementite',
            },
          ];

  /** Where the pearlite bracket starts, as a fraction of the bar. */
  const bracketFrom =
    split.proeutectoid != null && proeutectoidIsFerrite ? split.proeutectoidFraction : 0;

  const phases: Segment[] = [
    { key: 'ferrite', label: 'α (ferrite)', fraction: split.totalFerrite, phase: 'ferrite' },
    { key: 'cementite', label: 'Fe₃C (cementite)', fraction: split.totalCementite, phase: 'cementite' },
  ];

  /* One short sentence, not the whole panel. A live region that wraps a table
     re-reads the table on every arrow keypress — the defect
     `live-regions.behaviour.test.tsx` was written to catch. The composition
     itself is not repeated here: `aria-valuetext` on the slider already says
     it, and saying it twice is the same double-announcement one level down. */
  const announcement =
    split.proeutectoid == null
      ? 'No proeutectoid phase: the structure is wholly pearlite.'
      : `${asPercent(split.proeutectoidFraction)} proeutectoid ${split.proeutectoid}, ` +
        `${asPercent(split.pearliteFraction)} pearlite.`;

  const microCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = microCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background pearlite lamellae colonies
    ctx.fillStyle = '#181a22';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.2;

    for (let i = 0; i < 35; i++) {
      const cx = (i * 47) % w;
      const cy = (i * 31) % h;
      const angle = i * 0.4;
      for (let l = -18; l < 18; l += 4) {
        ctx.beginPath();
        ctx.moveTo(
          cx + Math.cos(angle) * l - Math.sin(angle) * 15,
          cy + Math.sin(angle) * l + Math.cos(angle) * 15,
        );
        ctx.lineTo(
          cx + Math.cos(angle) * l + Math.sin(angle) * 15,
          cy + Math.sin(angle) * l - Math.cos(angle) * 15,
        );
        ctx.stroke();
      }
    }

    // Proeutectoid grains overlay
    const wPro = split ? split.proeutectoidFraction : 0;
    if (wPro > 0.02) {
      ctx.fillStyle = proeutectoidIsFerrite ? 'rgba(56, 189, 248, 0.85)' : 'rgba(245, 158, 11, 0.85)';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = 1.5;

      const grainCount = Math.floor(wPro * 28);
      for (let g = 0; g < grainCount; g++) {
        const gx = ((g * 67 + 30) % (w - 40)) + 20;
        const gy = ((g * 43 + 20) % (h - 40)) + 20;
        const gr = 8 + (g % 5) * 3;

        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }, [carbon, proeutectoidIsFerrite, split]);

  const PRESETS = [
    { label: '0.20% AISI 1020', value: 0.20 },
    { label: '0.40% AISI 1040', value: 0.40 },
    { label: '0.76% Eutectoid 1080', value: 0.76 },
    { label: '1.20% Tool Steel', value: 1.20 },
  ];

  return (
    <div className="ld-live">
      <div className="ld-live-head">
        <p className="ld-live-tag">Live — moves with the control</p>
        
        <div className="ld-presets-row" role="toolbar" aria-label="Alloy composition presets">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`ld-preset-btn ${Math.abs(carbon - p.value) < 0.005 ? 'active' : ''}`}
              onClick={() => setCarbon(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="ld-live-control" htmlFor={sliderId}>
          Carbon content
        </label>
        <p className="ld-live-value" aria-hidden="true">
          <strong>{carbon.toFixed(2)}</strong> wt%
        </p>
        <input
          id={sliderId}
          type="range"
          min={LEVER_RANGE.min}
          max={LEVER_RANGE.max}
          step={LEVER_RANGE.step}
          value={carbon}
          aria-valuetext={`${carbon.toFixed(2)} weight percent carbon`}
          onChange={(e) => setCarbon(Number(e.target.value))}
        />
      </div>

      {/* A scroll container below about 1000 px — see `landing.css` — and a
          scroll container has to be reachable from the keyboard. Safari will
          not focus one on its own, which is the same reason `PlateArt` carries
          an explicit `tabIndex`; the label it needs as a focus target is worth
          having anyway, because the SVG inside is hidden from assistive
          technology and the `<dl>` below is what should be read instead. */}
      <div
        className="ld-live-art"
        role="group"
        tabIndex={0}
        aria-label="Live figure: this steel's microconstituents and its phases, drawn as two bars. The fractions are listed below it."
      >
        <LeverBars
          carbon={carbon}
          micro={micro}
          phases={phases}
          bracketFrom={bracketFrom}
          bracket={split.pearliteFraction}
        />
      </div>

      <dl className="ld-readout">
        {split.proeutectoid != null && (
          <div style={{ display: 'contents' }}>
            <dt>
              <span
                className="ld-swatch"
                style={{ background: PHASE_TOKEN[proeutectoidIsFerrite ? 'ferrite' : 'cementite'] }}
                aria-hidden="true"
              />
              Proeutectoid {split.proeutectoid}
            </dt>
            <dd className="is-key">{asPercent(split.proeutectoidFraction)}</dd>
          </div>
        )}
        <div style={{ display: 'contents' }}>
          {/* No swatch: pearlite is a mixture rather than a phase, and it is
              drawn above as the two phases it is made of. A colour of its own
              would be the third colour this figure was redrawn to remove. */}
          <dt className="ld-readout-plain">Pearlite (α + Fe₃C)</dt>
          <dd className="is-key">{asPercent(split.pearliteFraction)}</dd>
        </div>
        {phases.map((s) => (
          <div key={s.key} style={{ display: 'contents' }}>
            <dt>
              <span
                className="ld-swatch"
                style={{ background: PHASE_TOKEN[s.phase] }}
                aria-hidden="true"
              />
              Total {s.label}
            </dt>
            <dd>{asPercent(s.fraction)}</dd>
          </div>
        ))}
      </dl>

      <div className="ld-micrograph-box">
        <div className="ld-micrograph-header">
          <span className="ld-micrograph-tag">Simulated 500× Metallography Micrograph</span>
          <span className="ld-micrograph-alloy">
            {carbon < 0.76 ? 'Hypoeutectoid' : Math.abs(carbon - 0.76) < 0.005 ? 'Eutectoid' : 'Hypereutectoid'} (Fe–{carbon.toFixed(2)} wt% C)
          </span>
        </div>
        <canvas
          ref={microCanvasRef}
          width={320}
          height={160}
          className="ld-micrograph-canvas"
          title="Simulated optical micrograph showing pearlite colonies and proeutectoid grains"
        />
        <div className="ld-micrograph-legend">
          <span className="legend-item"><span className="dot dot-pearlite"></span> Pearlite (α + Fe₃C lamellae)</span>
          {split.proeutectoid != null && (
            <span className="legend-item">
              <span className={`dot ${proeutectoidIsFerrite ? 'dot-ferrite' : 'dot-cementite'}`}></span>
              Proeutectoid {split.proeutectoid}
            </span>
          )}
        </div>
      </div>

      {/* Visually hidden, not absent. The four numbers are already on screen in
          the table above and inside the bars; what a screen-reader user lacks
          is one short thing to hear when the control moves, and printing that a
          third time in full-strength ink was clutter for everyone who can see
          the other two. */}
      <p className="ld-live-say" aria-live="polite">
        {announcement}
      </p>

      <p className="ld-note">
        {split.proeutectoid == null
          ? `At exactly ${EUTECTOID_X} wt% C nothing separates out ahead of the reaction: the whole of the austenite transforms at once, and the structure is pearlite through and through.`
          : split.kind === 'hypoeutectoid'
            ? `Below ${EUTECTOID_X} wt% C the phase that separates before the reaction is ferrite, and the steel is the softer, tougher kind.`
            : `Above ${EUTECTOID_X} wt% C it is cementite instead, forming a brittle network on the old austenite grain boundaries.`}{' '}
        Both bars are cooled to just below {EUTECTOID_T} °C.
      </p>

      {/* `Number(toFixed(2))` rather than `carbon` straight: a range input's
          value is min + n·step, and while browsers serialise that to the
          shortest round-trip decimal today, an `x=0.7600000000000001` in a link
          meant to be pasted into a worksheet would be an ugly way to find out
          otherwise. Two decimals is exactly the control's step. */}
      <p className="ld-live-link">
        <a className="ld-link" href={`#/phase?T=650&sys=fe-c&x=${Number(carbon.toFixed(2))}`}>
          Open this steel in the phase module
          <span className="ld-arrow" aria-hidden="true">
            →
          </span>
        </a>
      </p>
    </div>
  );
}

/**
 * The composition scale, the two bars, and the bracket that names pearlite.
 *
 * Segments are drawn as a tinted fill inside a full-strength rule rather than
 * as a solid block with a reversed label. A solid `--fig-a` carries white text
 * at 5.5:1 in light and 3.0:1 in dark, which is under the floor in one of the
 * two themes. An 18 % tint over the plate keeps every label on `--fig-ink` and
 * comfortably clear of it — measured against both fills:
 *
 *     light  fig-a 10.55:1   fig-d 10.79:1
 *     dark   fig-a 10.90:1   fig-d 10.39:1
 *
 * and the 1.4px rule around each segment, which WCAG 1.4.11 asks 3:1 of, is the
 * undiluted token: 5.36 and 4.90 in light, 5.85 and 7.18 in dark.
 *
 * `aria-hidden`, because the `<dl>` beside it carries the same numbers as text
 * and a screen-reader user should hear them once.
 */
function LeverBars({
  carbon,
  micro,
  phases,
  bracketFrom,
  bracket,
}: {
  carbon: number;
  micro: Segment[];
  phases: Segment[];
  /** Where the pearlite bracket starts, as a fraction of the bar. */
  bracketFrom: number;
  /** How wide it is — the pearlite fraction. */
  bracket: number;
}) {
  const g = LEVER_GEOMETRY;
  const span = g.barRight - g.barLeft;
  const atFraction = (f: number) => g.barLeft + f * span;
  const atComposition = (x: number) =>
    g.axisLeft +
    ((x - LEVER_RANGE.min) / (LEVER_RANGE.max - LEVER_RANGE.min)) * (g.axisRight - g.axisLeft);

  const bar = (segments: Segment[], y: number) => {
    let x = g.barLeft;
    return segments.map((s) => {
      /*
       * Pearlite's two parts are labelled by name and not by number.
       *
       * They are drawn to show where the ferrite in pearlite goes, not to be
       * read as values — and printed to one decimal they invite an addition
       * that comes out wrong: 48.8 % proeutectoid ferrite and 45.6 % ferrite in
       * pearlite make 94.4, under a bar correctly labelled 94.3. The widths are
       * exact; only the printing rounds, and the four numbers a reader actually
       * needs are all in the table below.
       */
      const withValue = !s.key.startsWith('pearlite-');
      const w = Math.max(0, s.fraction * span);
      const at = x;
      x += w;
      return (
        <g key={s.key}>
          <rect
            className="ld-live-seg"
            data-seg={s.key}
            x={at}
            y={y}
            width={w}
            height={g.barH}
            fill={PHASE_TOKEN[s.phase]}
            fillOpacity={0.18}
            stroke={PHASE_TOKEN[s.phase]}
            strokeWidth={1.4}
          />
          {/* Only where the segment can hold the text. A label that spills past
              its own segment points at the wrong one. */}
          {w > 150 && (
            <text
              x={at + w / 2}
              y={y + g.barH / 2 + 4}
              textAnchor="middle"
              fontSize="12"
              fill="var(--fig-ink)"
            >
              {withValue ? `${s.label} — ${asPercent(s.fraction)}` : s.label}
            </text>
          )}
        </g>
      );
    });
  };

  /** 0 and 100 % in the gutters the inset opens, so the bar's units are stated. */
  const ends = (y: number) => (
    <>
      <text
        x={g.barLeft - 8}
        y={y + g.barH / 2 + 4}
        textAnchor="end"
        fontSize="11"
        fill="var(--fig-label)"
      >
        0
      </text>
      <text x={g.barRight + 8} y={y + g.barH / 2 + 4} fontSize="11" fill="var(--fig-label)">
        100 %
      </text>
    </>
  );

  const markerX = atComposition(carbon);
  const eutectoidX = atComposition(EUTECTOID_X);
  const bracketX0 = atFraction(bracketFrom);
  const bracketX1 = atFraction(bracketFrom + bracket);

  return (
    <svg
      viewBox={`0 0 ${g.viewW} ${g.viewH}`}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      {/* The composition scale: where the control is, and where the eutectoid
          is, on one line. Not a second control — the slider above is — so it
          carries a marker rather than a handle. */}
      <text x={eutectoidX} y={12} textAnchor="middle" fontSize="12" fill="var(--fig-accent)">
        eutectoid, {EUTECTOID_X} wt% C
      </text>
      <line
        x1={g.axisLeft}
        y1={g.axisY}
        x2={g.axisRight}
        y2={g.axisY}
        stroke="var(--fig-grid)"
        strokeWidth="1.4"
      />
      <line
        x1={eutectoidX}
        y1={g.axisY - 11}
        x2={eutectoidX}
        y2={g.axisY + 11}
        stroke="var(--fig-accent)"
        strokeWidth="1.4"
      />
      <circle cx={markerX} cy={g.axisY} r="6.5" fill="var(--fig-accent)" />
      <text x={g.axisLeft} y={g.axisY + 26} fontSize="12" fill="var(--fig-label)">
        {LEVER_RANGE.min.toFixed(2)} wt% C
      </text>
      <text x={g.axisRight} y={g.axisY + 26} textAnchor="end" fontSize="12" fill="var(--fig-label)">
        {LEVER_RANGE.max} wt% C — the most carbon a steel can hold
      </text>

      <text x={g.barLeft} y={g.microLabelY} fontSize="12" fill="var(--fig-label)">
        Microconstituents, by mass — ordered by phase, ferrite first
      </text>
      {ends(g.microY)}
      {bar(micro, g.microY)}

      {/* The bracket. Pearlite is the two segments it spans, and naming it under
          them rather than colouring it is what lets the colours mean phases. */}
      <path
        d={`M${bracketX0},${g.bracketY - 6}V${g.bracketY}H${bracketX1}V${g.bracketY - 6}`}
        fill="none"
        stroke="var(--fig-label)"
        strokeWidth="1.2"
      />
      <text
        x={(bracketX0 + bracketX1) / 2}
        y={g.bracketLabelY}
        textAnchor="middle"
        fontSize="12"
        fill="var(--fig-label)"
      >
        Pearlite — {asPercent(bracket)}
      </text>

      <text x={g.barLeft} y={g.phaseLabelY} fontSize="12" fill="var(--fig-label)">
        Phases, by mass — the same steel, counted a different way
      </text>
      {ends(g.phaseY)}
      {bar(phases, g.phaseY)}
    </svg>
  );
}
