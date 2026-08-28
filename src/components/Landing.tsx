import { NAV_GROUPS } from '../nav';

/**
 * The front door.
 *
 * Deliberately the only eagerly-loaded view, so it must stay cheap: every
 * graphic here is inline SVG drawn from CSS custom properties. No raster
 * images, no icon font, no external stylesheet — partly because the deployment
 * is static assets on Cloudflare Pages with no runtime fetches, and partly
 * because SVG is what the modules themselves draw with, so the page looks like
 * the thing it is advertising.
 *
 * Every module link is a real anchor rather than a button: routing is
 * hash-based, so `href="#/miller?..."` works natively, survives middle-click
 * and "open in new tab", and is announced as a link.
 */

interface ModuleCard {
  id: string;
  title: string;
  href: string;
  blurb: string;
  /** What a reader can actually answer with it — concrete, not adjectives. */
  detail: string;
  art: React.ReactNode;
}

/* ------------------------------------------------------------------ artwork */
/* Each thumbnail is the module's own visual signature, reduced to its outline:
   a reader who has used the app should recognise the module before reading. */

const artPeriodic = (
  <svg viewBox="0 0 96 60" role="img" aria-hidden="true">
    {Array.from({ length: 9 }, (_, c) =>
      Array.from({ length: 5 }, (_, r) => (
        <rect
          key={`${c}-${r}`}
          x={4 + c * 10}
          y={4 + r * 10}
          width={8}
          height={8}
          rx={1.5}
          fill="var(--ld-art)"
          opacity={0.25 + ((c + r * 2) % 7) * 0.11}
        />
      )),
    )}
  </svg>
);

const artCrystal = (
  <svg viewBox="0 0 96 60" role="img" aria-hidden="true">
    <g stroke="var(--ld-art)" strokeWidth="1" fill="none" opacity="0.55">
      <path d="M28 18h30v26H28z" />
      <path d="M40 10h30v26H40z" />
      <path d="M28 18l12-8M58 18l12-8M58 44l12-8M28 44l12-8" />
    </g>
    {[[28, 18], [58, 18], [28, 44], [58, 44], [40, 10], [70, 10], [70, 36], [40, 36], [49, 27]].map(
      ([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === 8 ? 6 : 4.5} fill="var(--ld-art)" />
      ),
    )}
  </svg>
);

const artMiller = (
  <svg viewBox="0 0 96 60" role="img" aria-hidden="true">
    <g stroke="var(--ld-art)" strokeWidth="1" fill="none" opacity="0.5">
      <path d="M26 16h34v30H26z" />
      <path d="M38 8h34v30H38z" />
      <path d="M26 16l12-8M60 16l12-8M60 46l12-8M26 46l12-8" />
    </g>
    <path d="M26 46L60 16l12-8-34 30z" fill="var(--ld-art)" opacity="0.42" />
    <path d="M26 46L60 16" stroke="var(--ld-art)" strokeWidth="1.6" fill="none" />
  </svg>
);

const artDefects = (
  <svg viewBox="0 0 96 60" role="img" aria-hidden="true">
    {Array.from({ length: 6 }, (_, c) =>
      Array.from({ length: 4 }, (_, r) => {
        const gap = c === 3 && r === 1;
        return gap ? (
          <circle
            key={`${c}-${r}`}
            cx={14 + c * 14}
            cy={12 + r * 12}
            r={4.5}
            fill="none"
            stroke="var(--ld-art)"
            strokeDasharray="2 2"
          />
        ) : (
          <circle
            key={`${c}-${r}`}
            cx={14 + c * 14}
            cy={12 + r * 12}
            r={4.5}
            fill="var(--ld-art)"
            opacity={0.75}
          />
        );
      }),
    )}
  </svg>
);

const artPhase = (
  <svg viewBox="0 0 96 60" role="img" aria-hidden="true">
    <path d="M12 50h74M12 50V8" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    <path d="M12 16Q40 44 52 44Q66 44 86 20" fill="none" stroke="var(--ld-art)" strokeWidth="1.6" />
    <path d="M12 30Q34 44 52 44Q70 44 86 34" fill="none" stroke="var(--ld-art)" strokeWidth="1.2" opacity="0.6" />
    <path d="M12 44h74" stroke="var(--ld-art)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
    <circle cx="52" cy="44" r="3.2" fill="var(--ld-accent)" />
  </svg>
);

const artHeat = (
  <svg viewBox="0 0 96 60" role="img" aria-hidden="true">
    <path d="M12 50h74M12 50V8" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    <path d="M22 12Q52 22 34 30Q52 40 74 48" fill="none" stroke="var(--ld-art)" strokeWidth="1.6" />
    <path d="M30 12Q66 24 46 32Q64 42 84 48" fill="none" stroke="var(--ld-art)" strokeWidth="1.1" strokeDasharray="3 2" opacity="0.6" />
    <path d="M14 10L76 46" stroke="var(--ld-accent)" strokeWidth="1.5" fill="none" />
  </svg>
);

const artStress = (
  <svg viewBox="0 0 96 60" role="img" aria-hidden="true">
    <path d="M12 50h74M12 50V8" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    <path d="M12 50L30 20Q46 8 62 14Q74 19 80 34" fill="none" stroke="var(--ld-art)" strokeWidth="1.8" />
    <path d="M20 50L34 27" stroke="var(--ld-accent)" strokeWidth="1.1" strokeDasharray="3 2" fill="none" />
    <circle cx="62" cy="14" r="3" fill="var(--ld-accent)" />
  </svg>
);

const artXrd = (
  <svg viewBox="0 0 96 60" role="img" aria-hidden="true">
    <path d="M10 50h78" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    {[[20, 16], [30, 34], [42, 24], [52, 42], [60, 30], [70, 44], [80, 40]].map(([x, y], i) => (
      <path key={i} d={`M${x} 50V${y}`} stroke="var(--ld-art)" strokeWidth="2.2" strokeLinecap="round" />
    ))}
  </svg>
);

const artSelection = (
  <svg viewBox="0 0 96 60" role="img" aria-hidden="true">
    <path d="M12 50h74M12 50V8" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    {[[26, 34], [34, 24], [44, 30], [40, 16], [56, 22], [64, 36], [70, 18], [50, 40], [78, 28]].map(
      ([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={3.4} fill="var(--ld-art)" opacity={0.7} />
      ),
    )}
    <path d="M16 46L82 12" stroke="var(--ld-accent)" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
  </svg>
);

const artFailure = (
  <svg viewBox="0 0 96 60" role="img" aria-hidden="true">
    <path d="M12 50h74M12 50V8" stroke="var(--ld-art)" strokeWidth="1" opacity="0.5" fill="none" />
    {/* an S–N curve that knees over into an endurance limit */}
    <path d="M16 14Q40 34 58 40H84" fill="none" stroke="var(--ld-art)" strokeWidth="1.8" />
    <path d="M58 40H84" fill="none" stroke="var(--ld-accent)" strokeWidth="1.8" />
    {/* a crack opening from the edge */}
    <path d="M20 50l4-6 3 5 3-6" fill="none" stroke="var(--ld-accent)" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const CARDS: ModuleCard[] = [
  {
    id: 'trends',
    title: 'Periodic trends',
    href: '#/trends?el=W&prop=melt',
    blurb: 'Heatmap the periodic table by any property.',
    detail: 'Colour the whole table by electronegativity, ionisation energy, melting point or density, and read the trend across a period or down a group. Elements with no measured value for a property are shown as having none.',
    art: artPeriodic,
  },
  {
    id: 'crystals',
    title: 'Crystal structures',
    href: '#/crystals',
    blurb: '3D unit cells and theoretical density.',
    detail: 'Eight structures from simple cubic to perovskite, in ball-and-stick or space-filling, with a density calculator that lands within a fraction of a percent for the cubic metals — and shows you where the ideal-c/a assumption breaks down for HCP.',
    art: artCrystal,
  },
  {
    id: 'miller',
    title: 'Miller indices',
    href: '#/miller?plane=111',
    blurb: 'Planes, directions and slip systems.',
    detail: 'Type any (hkl) and watch the plane cut the cell, with intercepts, d-spacing, family members and a Schmid-factor ranking across all 12 FCC or 48 BCC slip systems.',
    art: artMiller,
  },
  {
    id: 'defects',
    title: 'Defects & diffusion',
    href: '#/defects',
    blurb: 'Vacancies, impurities and case hardening.',
    detail: 'Put a point defect into a lattice, compute the equilibrium vacancy fraction, and solve Fick’s second law for a carburising profile.',
    art: artDefects,
  },
  {
    id: 'phase',
    title: 'Phase diagrams',
    href: '#/phase?T=650&sys=fe-c&x=0.4',
    blurb: 'Tie lines, the lever rule, steel microstructure.',
    detail: 'Click anywhere on Cu–Ni, Pb–Sn or Fe–Fe₃C and get the phases present, the tie line, lever-rule mass fractions and the microstructure that results.',
    art: artPhase,
  },
  {
    id: 'heattreat',
    title: 'Heat treatment',
    href: '#/heattreat',
    blurb: 'TTT curves, quenching, hardenability.',
    detail: 'Drag a cooling rate across an isothermal diagram and see the products it produces, read by Scheil additivity, with a Jominy end-quench comparison across three grades.',
    art: artHeat,
  },
  {
    id: 'mechanical',
    title: 'Mechanical properties',
    href: '#/mechanical',
    blurb: 'Stress–strain curves and Hall–Petch.',
    detail: 'Engineering curves for seven metals with the 0.2% offset construction, resilience and toughness areas, a true-stress overlay, and grain-size strengthening.',
    art: artStress,
  },
  {
    id: 'failure',
    title: 'Failure analysis',
    href: '#/failure',
    blurb: 'Fracture, fatigue, crack growth and creep.',
    detail: 'Find the critical crack size for a real alloy, read an S–N curve that only flattens for the alloys that actually have a fatigue limit, grow a crack by Paris’ law, and trade temperature against time with Larson–Miller.',
    art: artFailure,
  },
  {
    id: 'xrd',
    title: 'XRD simulator',
    href: '#/xrd',
    blurb: 'Powder patterns and indexed peaks.',
    detail: 'Generate a diffraction pattern for four lattice types across four X-ray sources, with every peak indexed and the extinction rules shown working.',
    art: artXrd,
  },
  {
    id: 'selection',
    title: 'Material selection',
    href: '#/selection',
    blurb: 'Ashby charts and performance indices.',
    detail: 'A log–log chart of 54 materials with movable guide lines for E/ρ, E^½/ρ, E^⅓/ρ, σ/ρ and σ^⅔/ρ, ranking candidates live as you move the line.',
    art: artSelection,
  },
];

const GROUP_OF: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.id, g.label])),
);

export function Landing() {
  return (
    <div className="ld">
      <section className="ld-hero">
        <div className="ld-hero-copy">
          <p className="ld-eyebrow">Interactive materials science</p>
          <h1 className="ld-title">
            See why materials
            <br />
            behave the way they do.
          </h1>
          <p className="ld-lede">
            MatVista turns the core of an undergraduate materials course into ten things you
            can actually drive: rotate a unit cell, drag a cooling rate across a TTT diagram,
            move a tie line and watch the phase fractions follow. Every number is computed
            from the published relations, not drawn to look right.
          </p>
          <div className="ld-cta">
            <a className="ld-btn ld-btn-primary" href="#/trends">
              Start with the periodic table
            </a>
            <a className="ld-btn" href="#modules">
              Browse all ten modules
            </a>
          </div>
          <p className="ld-note">
            Free and open source · runs entirely in your browser · nothing to install
          </p>
        </div>
        <div className="ld-hero-art" aria-hidden="true">
          <HeroArt />
        </div>
      </section>

      <section className="ld-strip">
        {[
          ['10', 'interactive modules'],
          ['118', 'elements in the table'],
          ['54', 'materials in the Ashby chart'],
          ['0', 'sign-ups or downloads'],
        ].map(([n, label]) => (
          <div key={label} className="ld-stat">
            <strong>{n}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="ld-section" id="modules">
        <h2 className="ld-h2">The ten modules</h2>
        <p className="ld-sub">
          Grouped the way a course is: what the material <em>is</em>, what is going on inside
          it, how it <em>behaves</em>, and how you measure or choose it.
        </p>
        <div className="ld-grid">
          {CARDS.map((c) => (
            <a key={c.id} className="ld-card" href={c.href}>
              <div className="ld-card-art">{c.art}</div>
              <div className="ld-card-body">
                <span className="ld-card-group">{GROUP_OF[c.id]}</span>
                <h3>{c.title}</h3>
                <p className="ld-card-blurb">{c.blurb}</p>
                <p className="ld-card-detail">{c.detail}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="ld-section">
        <h2 className="ld-h2">Built to be trusted with</h2>
        <div className="ld-features">
          <article className="ld-feature">
            <h3>Data and interpolation are kept apart</h3>
            <p>
              Fixed points — invariant reactions, solubility limits, tabulated radii and moduli
              — are cited to Callister &amp; Rethwisch. The curves between them are constructed,
              and every module says which is which rather than implying a precision it does not
              have.
            </p>
          </article>
          <article className="ld-feature">
            <h3>Approximations say so</h3>
            <p>
              Laying a continuous cooling path over an isothermal diagram is a textbook
              construction, not a measurement, so the heat-treatment module tells you that and
              explains which way the answer leans.
            </p>
          </article>
          <article className="ld-feature">
            <h3>Surprises get explained, not hidden</h3>
            <p>
              When 1080 shows M90 below room temperature, that is retained austenite, and the
              module says so — a result worth understanding rather than a number worth
              suppressing.
            </p>
          </article>
          <article className="ld-feature">
            <h3>Every view has a link</h3>
            <p>
              A specific plane, steel or cooling rate lives in the URL, so a worked example can
              be handed to a class as a link and it opens exactly as you left it.
            </p>
          </article>
        </div>
      </section>

      <section className="ld-section ld-audience">
        <h2 className="ld-h2">Who it is for</h2>
        <div className="ld-cols">
          <div>
            <h3>Students</h3>
            <p>
              Work the geometry until it is obvious. Type indices and see the plane; move the
              composition and watch the lever rule do what the textbook says it does.
            </p>
          </div>
          <div>
            <h3>Instructors</h3>
            <p>
              Set up a case, copy the address bar, paste it into a worksheet. The link carries
              the state, so everyone opens the same diagram.
            </p>
          </div>
          <div>
            <h3>Engineers</h3>
            <p>
              A quick reference for the relations you half-remember — d-spacing, Schmid factors,
              hardenability, performance indices — with the working shown.
            </p>
          </div>
        </div>
      </section>

      <section className="ld-final">
        <h2>Pick something and start pulling on it.</h2>
        <div className="ld-cta">
          <a className="ld-btn ld-btn-primary" href="#/crystals">
            Open a unit cell
          </a>
          <a className="ld-btn" href="#/heattreat">
            Quench some steel
          </a>
        </div>
      </section>
    </div>
  );
}

/**
 * Hero artwork: a close-packed plane fading into its lattice, with one cell
 * outlined. Drawn rather than photographed so it themes with the page and costs
 * nothing to load.
 */
function HeroArt() {
  const rows = 6;
  const cols = 7;
  const dots: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 34 + c * 42 + (r % 2 ? 21 : 0);
      const y = 34 + r * 38;
      const d = Math.hypot(x - 150, y - 130);
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={x}
          cy={y}
          r={13}
          fill="var(--ld-accent)"
          opacity={Math.max(0.1, 0.78 - d / 420)}
        />,
      );
    }
  }
  return (
    <svg viewBox="0 0 340 280" className="ld-hero-svg" role="img" aria-hidden="true">
      <g stroke="var(--ld-art)" strokeWidth="1" opacity="0.35" fill="none">
        {Array.from({ length: rows }, (_, r) => (
          <path key={`h${r}`} d={`M20 ${34 + r * 38}H330`} />
        ))}
        {Array.from({ length: cols }, (_, c) => (
          <path key={`d${c}`} d={`M${34 + c * 42} 24L${34 + c * 42 + 96} 240`} />
        ))}
      </g>
      {dots}
      <path
        d="M76 110h84v76H76z"
        fill="none"
        stroke="var(--ld-ring)"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
    </svg>
  );
}
