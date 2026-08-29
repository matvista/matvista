import { NAV_GROUPS } from '../nav';
import { MODULE_MARKS } from './moduleMarks';
import { useReveal } from '../landing/motion';
import { LatticePlate } from '../assets/figures/LatticePlate';
import { PhaseFigure } from '../assets/figures/PhaseFigure';
import { FatigueFigure } from '../assets/figures/FatigueFigure';
import { AshbyFigure } from '../assets/figures/AshbyFigure';
import { XrdFigure } from '../assets/figures/XrdFigure';
import '../landing.css';

/**
 * The front door.
 *
 * Set as a textbook plate rather than a product page, and the figures on it are
 * real: Figures 2 to 5 are emitted by the scripts in `scripts/`, which import
 * the same model code the modules run. That is the whole argument the page is
 * making — "computed from the published relations, not drawn to look right" —
 * so illustrating it with invented artwork would have undercut the one claim
 * worth making. It also means a figure cannot drift from the data behind it
 * without `figures.test.ts` noticing. Figure 1 is drawn from
 * `landing/lattice.ts`, which belongs to this page rather than to a module,
 * and the copy is careful not to claim otherwise.
 *
 * Deliberately the only eagerly-loaded view, so it must stay cheap. The plates
 * are inline SVG, which costs bundle bytes but no request and — the reason it
 * is worth it — inherits the page's custom properties, so one asset themes for
 * light, dark and system rather than needing a copy per theme.
 *
 * The hero used to run an animated canvas. It is a still plate now: at the
 * quality a rotating lattice needed to look good it was re-projecting and
 * re-shading sixty-three atoms every frame, forever, on the one view every
 * visitor loads, to say something a single well-drawn image says at rest.
 *
 * Every module link is a real anchor rather than a button: routing is
 * hash-based, so `href="#/miller?..."` works natively, survives middle-click
 * and "open in new tab", and is announced as a link.
 */

interface ModuleCard {
  id: string;
  title: string;
  href: string;
  /** What a reader can actually answer with it — concrete, not adjectives. */
  detail: string;
  art: React.ReactNode;
}

const CARDS: ModuleCard[] = [
  {
    id: 'trends',
    title: 'Periodic trends',
    href: '#/trends?el=W&prop=melt',
    detail: 'Colour the whole table by electronegativity, ionisation energy, melting point or density, and read the trend across a period or down a group. Elements with no measured value for a property are shown as having none.',
    art: MODULE_MARKS.trends,
  },
  {
    id: 'crystals',
    title: 'Crystal structures',
    href: '#/crystals',
    detail: 'Eight structures from simple cubic to perovskite, in ball-and-stick or space-filling, with a density calculator that lands within a fraction of a percent for the cubic metals — and shows you where the ideal-c/a assumption breaks down for HCP.',
    art: MODULE_MARKS.crystals,
  },
  {
    id: 'miller',
    title: 'Miller indices',
    href: '#/miller?plane=111',
    detail: 'Type any (hkl) and watch the plane cut the cell, with intercepts, d-spacing, family members and a Schmid-factor ranking across all 12 FCC or 48 BCC slip systems.',
    art: MODULE_MARKS.miller,
  },
  {
    id: 'defects',
    title: 'Defects & diffusion',
    href: '#/defects',
    detail: 'Put a point defect into a lattice, compute the equilibrium vacancy fraction, and solve Fick’s second law for a carburising profile.',
    art: MODULE_MARKS.defects,
  },
  {
    id: 'phase',
    title: 'Phase diagrams',
    href: '#/phase?T=650&sys=fe-c&x=0.4',
    detail: 'Click anywhere on Cu–Ni, Pb–Sn or Fe–Fe₃C and get the phases present, the tie line, lever-rule mass fractions and the microstructure that results.',
    art: MODULE_MARKS.phase,
  },
  {
    id: 'heattreat',
    title: 'Heat treatment',
    href: '#/heattreat',
    detail: 'Drag a cooling rate across an isothermal diagram and see the products it produces, read by Scheil additivity, with a Jominy end-quench comparison across three grades.',
    art: MODULE_MARKS.heattreat,
  },
  {
    id: 'mechanical',
    title: 'Mechanical properties',
    href: '#/mechanical',
    detail: 'Engineering curves for seven metals with the 0.2% offset construction, resilience and toughness areas, a true-stress overlay, and grain-size strengthening.',
    art: MODULE_MARKS.mechanical,
  },
  {
    id: 'failure',
    title: 'Failure analysis',
    href: '#/failure',
    detail: 'Find the critical crack size for a real alloy, read an S–N curve that only flattens for the alloys that actually have a fatigue limit, grow a crack by Paris’ law, and trade temperature against time with Larson–Miller.',
    art: MODULE_MARKS.failure,
  },
  {
    id: 'semiconductors',
    title: 'Semiconductors',
    href: '#/semiconductors',
    detail: 'Compare band gaps against the visible spectrum, dope a crystal and watch conductivity cross from extrinsic to intrinsic as it heats, then bend the bands across a junction and read off the built-in potential.',
    art: MODULE_MARKS.semiconductors,
  },
  {
    id: 'corrosion',
    title: 'Corrosion',
    href: '#/corrosion',
    detail: 'Pair any two alloys and see which one corrodes, how hard the couple is driven, and why a small anode beside a large cathode is the dangerous arrangement — then read the pH–potential map that says whether a metal is immune, passive or dissolving.',
    art: MODULE_MARKS.corrosion,
  },
  {
    id: 'xrd',
    title: 'XRD simulator',
    href: '#/xrd',
    detail: 'Generate a diffraction pattern for four lattice types across four X-ray sources, with every peak indexed and the extinction rules shown working.',
    art: MODULE_MARKS.xrd,
  },
  {
    id: 'selection',
    title: 'Material selection',
    href: '#/selection',
    detail: 'A log–log chart of 54 materials with movable guide lines for E/ρ, E^½/ρ, E^⅓/ρ, σ/ρ and σ^⅔/ρ, ranking candidates live as you move the line.',
    art: MODULE_MARKS.selection,
  },
];

const CARD_OF: Record<string, ModuleCard> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/**
 * What each course group is *for*, in one line.
 *
 * The four groups and their membership come from `NAV_GROUPS`, so the index
 * below cannot list a module the header menu does not have. Only this
 * sentence lives here — it is landing-page copy, and the header has no room
 * for it.
 */
const GROUP_NOTE: Record<string, string> = {
  structure: 'What the material is, at the scale of atoms and their arrangement.',
  microstructure: 'What is going on inside it, and what heat and time do to that.',
  properties: 'How it behaves when you load it, heat it, or wire it into a circuit.',
  analysis: 'How you measure what you have, and choose what you need.',
};

/**
 * Headline figures. Each is asserted against the data it describes in
 * `docs.test.ts`, so a module added without updating this list fails the suite
 * rather than quietly leaving a wrong number on the front page.
 */
const FACTS: { n: string; label: string }[] = [
  { n: String(NAV_GROUPS.flatMap((g) => g.items).length), label: 'interactive modules' },
  { n: '118', label: 'elements in the table' },
  { n: '54', label: 'materials in the Ashby chart' },
  { n: '8', label: 'crystal structures in 3D' },
];

/**
 * The worked example, at 0.4 wt% C just below the eutectoid.
 *
 * These are not illustrative numbers. Every one is asserted in
 * `docs.test.ts` against `steelMicrostructure(0.4)` and `lever()` from
 * `phase/systems`, which is the same code the phase module calls — so if the
 * model changes, the front page fails the suite instead of quietly lying about
 * what the app computes. They are written out rather than computed here to
 * keep `phase/systems` out of the eagerly-loaded chunk.
 */
const WORKED = {
  href: '#/phase?T=650&sys=fe-c&x=0.4',
  rows: [
    { term: 'Proeutectoid α (ferrite)', value: '48.8 %', key: true },
    { term: 'Pearlite', value: '51.2 %', key: true },
    { term: 'Total α (ferrite)', value: '94.3 %', key: false },
    { term: 'Total Fe₃C (cementite)', value: '5.7 %', key: false },
  ],
};

/**
 * The three figures shown at full width further down, each paired with what it
 * is for and the module it came from. Kept as data because the markup for the
 * three is identical — three hand-written copies of it is three places for a
 * caption to go stale.
 */
const SHOWCASE: { n: number; title: string; body: string; href: string; cta: string; figure: React.ReactNode }[] =
  [
    {
      n: 3,
      title: 'Not every alloy has a fatigue limit',
      body:
        'Steel and titanium flatten out: below a certain amplitude — 190 MPa for this 1020 — they survive indefinitely. Nickel has no such limit, and its curve keeps falling until it crosses under the steel it started above. For an alloy like that, "infinite life" is a decision about a number of cycles rather than a property you can lean on.',
      href: '#/failure',
      cta: 'Open failure analysis',
      figure: <FatigueFigure />,
    },
    {
      n: 4,
      title: 'Choosing a material is choosing a slope',
      body:
        'Stiffness against density for 54 materials, log on both axes. A performance index is a straight line on this chart, and moving it sweeps out the candidates that beat a given value — which is why the answer for a light stiff beam is not the same as for a light stiff tie.',
      href: '#/selection',
      cta: 'Open material selection',
      figure: <AshbyFigure />,
    },
    {
      n: 5,
      title: 'The missing peaks are the information',
      body:
        'Copper, indexed. Every reflection on this plate is all-odd or all-even, and that is the whole identification: in an FCC crystal the structure factor extinguishes the mixed indices, so (100) and (110) are not weak here, they are absent. Switch the sample in the module and a different set goes missing.',
      href: '#/xrd',
      cta: 'Open the XRD simulator',
      figure: <XrdFigure />,
    },
  ];

export function Landing() {
  return (
    <div className="ld">
      <section className="ld-hero">
        <div className="ld-hero-copy">
          <p className="ld-kicker">Interactive materials science</p>
          <h1 className="ld-h1">See why materials behave the way they do.</h1>
          <p className="ld-lede">
            Twelve modules covering the core of an undergraduate materials course, each one
            something you drive rather than read: rotate a unit cell, drag a cooling rate
            across a TTT diagram, move a tie line and watch the phase fractions follow.
          </p>
          <div className="ld-cta">
            <a className="ld-btn" href="#/trends">
              Open the periodic table
              <span className="ld-arrow" aria-hidden="true">
                →
              </span>
            </a>
            <a className="ld-link" href="#modules">
              See all twelve modules
              <span className="ld-arrow" aria-hidden="true">
                ↓
              </span>
            </a>
          </div>
          <p className="ld-note">
            Free and open source · runs entirely in your browser · nothing to install
          </p>
        </div>

        <figure className="ld-plate ld-hero-art">
          <div className="ld-plate-art">
            <LatticePlate />
          </div>
          <figcaption>
            <span className="ld-fig-n">Fig. 1</span>
            The face-centred cubic lattice, two cells on a side, with one unit cell outlined.
            The arrangement behind aluminium, copper, nickel and austenite.
          </figcaption>
        </figure>
      </section>

      <section className="ld-facts">
        {FACTS.map((f) => (
          <div key={f.label} className="ld-fact">
            <strong>{f.n}</strong>
            <span>{f.label}</span>
          </div>
        ))}
      </section>

      <Reveal className="ld-section ld-worked">
        <div className="ld-worked-copy">
          <p className="ld-kicker">A worked example</p>
          <h2 className="ld-h2">Computed, not drawn to look right.</h2>
          <p className="ld-sub">
            Take a plain carbon steel at 0.4 wt% C and cool it just below the eutectoid at
            727 °C. The diagram beside this is the app's own Fe–Fe₃C construction; the
            fractions below are what the lever rule gives on that tie line, from the same
            function the module calls.
          </p>

          <div className="ld-readout">
            <p className="ld-readout-h">Fe–0.4 wt% C, just below 727 °C</p>
            <dl>
              {WORKED.rows.map((r) => (
                <div key={r.term} style={{ display: 'contents' }}>
                  <dt>{r.term}</dt>
                  <dd className={r.key ? 'is-key' : undefined}>{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="ld-note">
            Microconstituent and phase fractions differ, and both are given — pearlite is a
            two-phase lamellar mixture, so its ferrite counts toward the total.
          </p>

          <p style={{ margin: '1.4rem 0 0' }}>
            <a className="ld-link" href={WORKED.href}>
              Open this exact point in the module
              <span className="ld-arrow" aria-hidden="true">
                →
              </span>
            </a>
          </p>
        </div>

        <figure className="ld-plate">
          <PlateArt label="Figure 2. The iron–iron carbide phase diagram, with the eutectoid marked and a tie line at 0.4 wt% carbon and 650 °C.">
            <PhaseFigure />
          </PlateArt>
          <figcaption>
            <span className="ld-fig-n">Fig. 2</span>
            The iron–iron carbide diagram, with the eutectoid marked and the tie line drawn
            at the composition and temperature above.
          </figcaption>
        </figure>
      </Reveal>

      <Reveal className="ld-section" id="modules">
        <p className="ld-kicker">The modules</p>
        <h2 className="ld-h2">Grouped the way a course is.</h2>
        <p className="ld-sub">
          Four families, three modules each. Every one stands alone as something you can
          teach with, study from, or reach for as a reference.
        </p>

        {NAV_GROUPS.map((group, i) => (
          <div key={group.id} className="ld-group">
            <div className="ld-group-head">
              <h3>
                <span className="ld-group-n">{String(i + 1).padStart(2, '0')}</span>
                {group.label}
              </h3>
              <p>{GROUP_NOTE[group.id]}</p>
            </div>
            <ul className="ld-index">
              {group.items.map((item) => {
                const card = CARD_OF[item.id];
                // `docs.test.ts` asserts every nav id has a card, so this is
                // unreachable — but the landing page is the one eagerly-loaded
                // view, and a missing entry here would blank the whole site
                // rather than one module.
                if (!card) return null;
                return (
                  <li key={item.id}>
                    {/* No `aria-label`. The natural name — title then detail
                        — runs long, but `detail` is rendered nowhere else, so
                        overriding the name to the bare title is not trimming a
                        duplicate, it is deleting the description for anyone
                        who cannot see it. */}
                    <a className="ld-row" href={card.href}>
                      <span className="ld-row-mark" aria-hidden="true">
                        {card.art}
                      </span>
                      <span>
                        <span className="ld-row-title">{card.title}</span>
                        <span className="ld-row-blurb">{card.detail}</span>
                      </span>
                      <span className="ld-row-go" aria-hidden="true">
                        →
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Reveal>

      <Reveal className="ld-section">
        <p className="ld-kicker">What it draws</p>
        <h2 className="ld-h2">Three more of the app's own figures.</h2>
        <p className="ld-sub">
          Generated by the same model code the modules run, not redrawn for this page. Each
          one is the static form of something you can move in the module behind it.
        </p>

        {/* Each row is one <figure>: the plate and the prose beside it are a
            figure and its caption, and splitting them across two unrelated
            siblings would leave a figure with no caption next to a paragraph
            with no subject. */}
        {SHOWCASE.map((s) => (
          <figure key={s.n} className="ld-showcase">
            <div className="ld-plate">
              <PlateArt label={`Figure ${s.n}. ${s.title}.`}>{s.figure}</PlateArt>
            </div>
            <figcaption className="ld-showcase-copy">
              <p className="ld-fig-n">Fig. {s.n}</p>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <a className="ld-link" href={s.href}>
                {s.cta}
                <span className="ld-arrow" aria-hidden="true">
                  →
                </span>
              </a>
            </figcaption>
          </figure>
        ))}
      </Reveal>

      <Reveal className="ld-section">
        <p className="ld-kicker">How the numbers are made</p>
        <h2 className="ld-h2">Four commitments the modules keep.</h2>
        <p className="ld-sub">
          A teaching tool earns its place by being honest about what it knows, and about
          where the knowing stops.
        </p>
        <div className="ld-principles">
          <article className="ld-principle">
            <span className="ld-principle-n">01</span>
            <h3>Data and interpolation are kept apart</h3>
            <p>
              Fixed points — invariant reactions, solubility limits, tabulated radii and
              moduli — are cited to Callister &amp; Rethwisch. The curves between them are
              constructed, and every module says which is which rather than implying a
              precision it does not have.
            </p>
          </article>
          <article className="ld-principle">
            <span className="ld-principle-n">02</span>
            <h3>Approximations say so</h3>
            <p>
              Laying a continuous cooling path over an isothermal diagram is a textbook
              construction, not a measurement, so the heat-treatment module tells you that
              and explains which way the answer leans.
            </p>
          </article>
          <article className="ld-principle">
            <span className="ld-principle-n">03</span>
            <h3>Surprises get explained, not hidden</h3>
            <p>
              When 1080 shows M90 below room temperature, that is retained austenite, and the
              module says so — a result worth understanding rather than a number worth
              suppressing.
            </p>
          </article>
          <article className="ld-principle">
            <span className="ld-principle-n">04</span>
            <h3>Every view has a link</h3>
            <p>
              A specific plane, steel or cooling rate lives in the URL, so a worked example
              can be handed to a class as a link and it opens exactly as you left it.
            </p>
          </article>
        </div>
      </Reveal>

      <Reveal className="ld-section">
        <p className="ld-kicker">Who it is for</p>
        <h2 className="ld-h2">Three ways people use it.</h2>
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
              Set up a case, copy the address bar, paste it into a worksheet. The link
              carries the state, so everyone opens the same diagram.
            </p>
          </div>
          <div>
            <h3>Engineers</h3>
            <p>
              A quick reference for the relations you half-remember — d-spacing, Schmid
              factors, hardenability, performance indices — with the working shown.
            </p>
          </div>
        </div>
      </Reveal>

      <section className="ld-close">
        <h2 className="ld-h2">Pick something and start pulling on it.</h2>
        <p>
          Nothing to sign up for and nothing to install. Every module opens straight from a
          link, and every view you reach has one of its own.
        </p>
        <div className="ld-cta">
          <a className="ld-btn" href="#/crystals">
            Open a unit cell
            <span className="ld-arrow" aria-hidden="true">
              →
            </span>
          </a>
          <a className="ld-link" href="#/heattreat">
            Quench some steel
            <span className="ld-arrow" aria-hidden="true">
              →
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}

/**
 * The frame around a data figure.
 *
 * Two jobs, both of them about small screens. The plates are drawn on a
 * 640-unit viewBox with 11px axis labels, and at 390px the figure renders about
 * 340px wide, which puts the tick labels at an effective six pixels — a figure
 * nobody can read, on a page whose entire argument is that its figures are
 * real. So below 700px the art scrolls inside its own box at a floor width
 * instead of shrinking, which is the same treatment `index.css` gives a wide
 * table.
 *
 * That makes it a scroll container, and a scroll container has to be reachable
 * from the keyboard — Chrome and Firefox now focus one automatically, Safari
 * does not, so the `tabIndex` is explicit rather than inherited from browser
 * behaviour. The label it needs to carry as a focus target is worth having
 * anyway: the SVG inside is `aria-hidden`, so without it a screen-reader user
 * has no way to encounter the figure at all.
 */
function PlateArt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ld-plate-art" role="group" tabIndex={0} aria-label={label}>
      {children}
    </div>
  );
}

/**
 * A section that fades in when it is scrolled to.
 *
 * The hidden resting state lives in CSS, so the guarantee that matters is the
 * one `useReveal` makes: under reduced motion, or in a browser without
 * `IntersectionObserver`, `shown` starts true and the section is simply there.
 * A reveal that can strand content invisible is worse than no reveal.
 */
function Reveal({
  className,
  id,
  children,
}: {
  className?: string;
  id?: string;
  children: React.ReactNode;
}) {
  const { ref, shown } = useReveal<HTMLElement>();
  return (
    <section ref={ref} id={id} className={`${className ?? ''} ld-reveal${shown ? ' is-in' : ''}`}>
      {children}
    </section>
  );
}
