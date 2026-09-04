import { Suspense, lazy } from 'react';
import { NAV_GROUPS, MODULE_COUNT, capitalisedWord, numberWord } from '../nav';
import { plateHeight, plateWidth } from '../landing/indexPlateBox';
import { useReveal } from '../motion';
import { LeverRule } from './LeverRule';
import { PhaseFigure } from '../assets/figures/PhaseFigure';
import { SpecimenStage } from './SpecimenStage';
import { LaboratoryWorkbench } from './LaboratoryWorkbench';
import { ModulesDirectory } from './ModulesDirectory';
import '../landing.css';

/**
 * The front door.
 *
 * Set as a textbook plate rather than a product page, and the figures on it are
 * real: Figures 2 to 6 are emitted by the scripts in `scripts/`, which import
 * the same model code the modules run. That is the whole argument the page is
 * making — "computed from the published relations, not drawn to look right" —
 * so illustrating it with invented artwork would have undercut the one claim
 * worth making. It also means a figure cannot drift from the data behind it
 * without `figures.test.ts` noticing. Figure 1 is drawn from
 * `landing/lattice.ts`, which belongs to this page rather than to a module,
 * and the copy is careful not to claim otherwise.
 *
 * One thing on the page is *not* a plate, and the distinction is the point.
 * `LeverRule` is an instrument: it recomputes on a control, from the same
 * function the phase module calls. A page whose opening sentence promises
 * "something you drive rather than read" spent six thousand pixels giving the
 * reader nothing to drive; that is what it is for, and it is marked "Live"
 * where the plates are marked "Fig.".
 *
 * Deliberately the only eagerly-loaded view, so it must stay cheap. The plates
 * are inline SVG, which costs bundle bytes but no request and — the reason it
 * is worth it — inherits the page's custom properties, so one asset themes for
 * light, dark and system rather than needing a copy per theme. The exception is
 * `ModuleIndexPlate`: twelve panels is 18 kB of markup, it sits two screens
 * below the fold, and `docs/GAUNTLET.md` is explicit that anything a reader
 * does not need before their first interaction should be a dynamic import. It
 * is `lazy()`, and — see `IndexPlate` — the import is not started until the
 * reader is approaching it, inside a box that already reserves its aspect ratio
 * so nothing moves when it lands.
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

/*
 * The four plates that are not on the first two screens.
 *
 * Between them the three showcase figures are 34 kB of committed SVG markup and
 * the figure index is another 19 kB, all of it three screens or more below the
 * fold, all of it in the one chunk every visitor parses before anything paints.
 * `docs/GAUNTLET.md` is explicit about this: anything a reader does not need
 * before their first interaction should be a dynamic `import()`.
 *
 * What stays eager is Fig. 1, which is the hero, and Fig. 2, which is the proof
 * standing beside the page's central claim and is reached in a second's
 * scrolling. A plate that flickered there would undercut the argument it is
 * making.
 */
const ModuleIndexPlate = lazy(() =>
  import('../assets/figures/ModuleIndexPlate').then((m) => ({ default: m.ModuleIndexPlate })),
);
const FatigueFigure = lazy(() =>
  import('../assets/figures/FatigueFigure').then((m) => ({ default: m.FatigueFigure })),
);
const AshbyFigure = lazy(() =>
  import('../assets/figures/AshbyFigure').then((m) => ({ default: m.AshbyFigure })),
);
const XrdFigure = lazy(() =>
  import('../assets/figures/XrdFigure').then((m) => ({ default: m.XrdFigure })),
);

/**
 * A row of the module index.
 *
 * No `art`. Each row used to open with the module's signature mark — one of the
 * twelve hand-drawn abstractions in `moduleMarks.tsx` — and that was reasonable
 * while the mark was the only picture of a module anywhere on the page. Fig. 3
 * now sits directly above this list showing the same twelve modules as their
 * real output, and twelve faint approximations under twelve real figures is a
 * comparison the approximations lose. The marks stay in the header, where they
 * are the only picture available and are drawn at chrome scale.
 */
interface ModuleCard {
  id: string;
  title: string;
  href: string;
  /** What a reader can actually answer with it — concrete, not adjectives. */
  detail: string;
}

const CARDS: ModuleCard[] = [
  {
    id: 'trends',
    title: 'Periodic trends',
    href: '#/trends?el=W&prop=melt',
    detail: 'Colour the whole table by electronegativity, ionisation energy, melting point or density, and read the trend across a period or down a group. Elements with no measured value for a property are shown as having none.',
  },
  {
    id: 'crystals',
    title: 'Crystal structures',
    href: '#/crystals',
    detail: 'Eight structures from simple cubic to perovskite, in ball-and-stick or space-filling, with a density calculator that lands within a fraction of a percent for the cubic metals — and shows you where the ideal-c/a assumption breaks down for HCP.',
  },
  {
    id: 'miller',
    title: 'Miller indices',
    href: '#/miller?plane=111',
    detail: 'Type any (hkl) and watch the plane cut the cell, with intercepts, d-spacing, family members and a Schmid-factor ranking across all 12 FCC or 48 BCC slip systems.',
  },
  {
    id: 'defects',
    title: 'Defects & diffusion',
    href: '#/defects',
    detail: 'Put a point defect into a lattice, compute the equilibrium vacancy fraction, and solve Fick’s second law for a carburising profile.',
  },
  {
    id: 'polymers',
    title: 'Polymers',
    href: '#/polymers',
    detail: 'Run a polymerisation and watch the distribution it produces — two histograms of one sample, counted by number and by weight, with the two averages they disagree about. Then the degree of polymerisation becomes a chain: 252 nm of polyethylene folded into a coil 7 nm across. Repeat-unit masses are computed from the app\u2019s own element data, and crystalline density from the unit cell.',
  },
  {
    id: 'phase',
    title: 'Phase diagrams',
    href: '#/phase?T=650&sys=fe-c&x=0.4',
    detail: 'Click anywhere on Cu–Ni, Pb–Sn or Fe–Fe₃C and get the phases present, the tie line, lever-rule mass fractions and the microstructure that results.',
  },
  {
    id: 'heattreat',
    title: 'Heat treatment',
    href: '#/heattreat',
    detail: 'Drag a cooling rate across an isothermal diagram and see the products it produces, read by Scheil additivity, with a Jominy end-quench comparison across three grades.',
  },
  {
    id: 'mechanical',
    title: 'Mechanical properties',
    href: '#/mechanical',
    detail: 'Engineering curves for seven metals with the 0.2% offset construction, resilience and toughness areas, a true-stress overlay, and grain-size strengthening.',
  },
  {
    id: 'composites',
    title: 'Composites',
    href: '#/composites',
    detail: 'Specify a laminate — fibre, matrix, volume fraction — and get the two bounds on its modulus, the load the fibres actually carry, and a specific stiffness ranked against the 54 materials on the Ashby chart. Then the ceiling: the strength rule of mixtures overshoots the measured composite by close to a factor of two, and the module shows the gap rather than printing the number.',
  },
  {
    id: 'thermal',
    title: 'Thermal properties',
    href: '#/thermal',
    detail: 'Constrain a bar, change its temperature, and read the stress it cannot relieve — then hand that stress to the failure module and get the flaw size it makes critical. Dulong\u2019s rule is drawn over the app\u2019s own atomic masses, with the three elements it fails and why; Wiedemann\u2013Franz is drawn as the line that checks the conductivities against the resistivities.',
  },
  {
    id: 'failure',
    title: 'Failure analysis',
    href: '#/failure',
    detail: 'Find the critical crack size for a real alloy, read an S–N curve that only flattens for the alloys that actually have a fatigue limit, grow a crack by Paris’ law, and trade temperature against time with Larson–Miller.',
  },
  {
    id: 'semiconductors',
    title: 'Semiconductors',
    href: '#/semiconductors',
    detail: 'Compare band gaps against the visible spectrum, dope a crystal and watch conductivity cross from extrinsic to intrinsic as it heats, then bend the bands across a junction and read off the built-in potential.',
  },
  {
    id: 'corrosion',
    title: 'Corrosion',
    href: '#/corrosion',
    detail: 'Pair any two alloys and see which one corrodes, how hard the couple is driven, and why a small anode beside a large cathode is the dangerous arrangement — then read the pH–potential map that says whether a metal is immune, passive or dissolving.',
  },
  {
    id: 'xrd',
    title: 'XRD simulator',
    href: '#/xrd',
    detail: 'Generate a diffraction pattern for four lattice types across four X-ray sources, with every peak indexed and the extinction rules shown working.',
  },
  {
    id: 'selection',
    title: 'Material selection',
    href: '#/selection',
    detail: 'A log–log chart of 54 materials with movable guide lines for E/ρ, E^½/ρ, E^⅓/ρ, σ/ρ and σ^⅔/ρ, ranking candidates live as you move the line.',
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

export { CARDS, CARD_OF, GROUP_NOTE };

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
 * Copper's (111) and (100), computed rather than quoted.
 *
 * These are the numbers behind the page's claim that two modules agree, and
 * they are asserted in `docs.test.ts` against `dSpacing` from
 * `crystal/miller.ts` and `braggTwoTheta` / `isAllowed` from
 * `xrd/diffraction.ts`, reading the lattice parameter and the wavelength out of
 * `XRD_SAMPLES` and `XRD_SOURCES` rather than restating them here.
 *
 * 43.32°, not the 43.3° of the literature: the two are the same reflection, and
 * the difference is the point of quoting a computed number rather than a
 * remembered one. Copper's *a* is derived from an atomic radius of 0.1278 nm,
 * which is why it is 0.36147 nm rather than a round 0.3615.
 *
 * (100) is the counter-example and it has to be stated exactly. It is not
 * missing because Bragg's law has no solution for it — it has a perfectly good
 * d-spacing, and a perfectly good angle at 24.61° — but because the structure
 * factor of an FCC lattice vanishes for mixed indices. Absent, not unreachable.
 */
const AGREEMENT = {
  a: '0.3615',
  lambda: '0.15406',
  allowed: { plane: '(111)', d: '0.2087', twoTheta: '43.32' },
  extinct: { plane: '(100)', d: '0.3615', twoTheta: '24.61' },
};

/**
 * The worked examples the README hands out as links, on the page that makes
 * the claim about them.
 *
 * Every id in every query below is checked in `docs.test.ts` against the data
 * it names — `sys=fe-c` against `PHASE_SYSTEMS`, `steel=4340` against
 * `STEELS`, `geom=vessel` against `CRACK_GEOMETRIES`, and so on. Route names
 * are stable; parameters are what rot, and a dead link on the page that
 * promises links would be the worst possible one to ship.
 */
const SHAREABLE: { href: string; shows: string }[] = [
  { href: '#/heattreat?rate=1200&steel=4340', shows: '4340 quenched at 1200 °C per second' },
  { href: '#/miller?plane=110&s=bcc&sigma=90', shows: '(110) in a BCC cell, 90 MPa applied' },
  { href: '#/phase?T=200&sys=pb-sn&x=40', shows: 'Pb–40 wt% Sn at 200 °C, on the tie line' },
  { href: '#/trends?el=W&prop=melt', shows: 'the table coloured by melting point, tungsten selected' },
  { href: '#/failure?geom=vessel&p=12', shows: 'leak before break in a thin-walled vessel at 12 MPa' },
  { href: '#/xrd?sample=fe&source=cr', shows: 'iron on a chromium anode, where the λ ≤ 2d limit bites' },
];

/**
 * The three figures shown at full width further down, each paired with what it
 * is for and the module it came from. Kept as data because the markup for the
 * three is identical — three hand-written copies of it is three places for a
 * caption to go stale.
 */
const SHOWCASE: { n: number; title: string; body: string; href: string; cta: string; figure: React.ReactNode }[] =
  [
    {
      n: 4,
      title: 'Not every alloy has a fatigue limit',
      body:
        'Steel and titanium flatten out: below a certain amplitude — 190 MPa for this 1020 — they survive indefinitely. Nickel has no such limit, and its curve keeps falling until it crosses under the steel it started above. For an alloy like that, "infinite life" is a decision about a number of cycles rather than a property you can lean on.',
      href: '#/failure',
      cta: 'Open failure analysis',
      figure: <FatigueFigure />,
    },
    {
      n: 5,
      title: 'Choosing a material is choosing a slope',
      body:
        'Stiffness against density for 54 materials, log on both axes. A performance index is a straight line on this chart, and moving it sweeps out the candidates that beat a given value — which is why the answer for a light stiff beam is not the same as for a light stiff tie.',
      href: '#/selection',
      cta: 'Open material selection',
      figure: <AshbyFigure />,
    },
    {
      n: 6,
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
            {capitalisedWord(MODULE_COUNT)} modules covering the core of an undergraduate materials course, each one
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
              See all {numberWord(MODULE_COUNT)} modules
              <span className="ld-arrow" aria-hidden="true">
                ↓
              </span>
            </a>
          </div>
          <p className="ld-note">
            Free and open source · runs entirely in your browser · nothing to install
          </p>
        </div>

        <SpecimenStage />
      </section>

      <section className="ld-facts">
        {FACTS.map((f) => (
          <div key={f.label} className="ld-fact">
            <strong>{f.n}</strong>
            <span>{f.label}</span>
          </div>
        ))}
      </section>

      <Reveal className="ld-chapter ld-worked-chapter">
        <div className="ld-worked">
          <div className="ld-worked-copy">
            <p className="ld-kicker">A worked example</p>
            <h2 className="ld-h2">Computed, not drawn to look right.</h2>
            <p className="ld-sub">
              Take a plain carbon steel and cool it slowly to just below the eutectoid at
              727 °C. The diagram beside this is the app's own Fe–Fe₃C construction; the bars
              underneath are what the lever rule gives on that tie line, from the same
              function the module calls — and they move.
            </p>
            <p className="ld-body">
              Slide past 0.76 wt% C and the constituent that separates out before the
              reaction changes from ferrite to cementite — same diagram, same lever rule,
              opposite answer. Then watch where the two colours meet. The boundary falls at
              the same place in both bars, at every composition, because pearlite is itself
              88.9 % ferrite and that ferrite counts toward the total. Microconstituent
              fractions and phase fractions are different questions; the bars answer both,
              and show why the answers are not the same number.
            </p>
          </div>

          <figure className="ld-plate">
            <PlateArt label="Figure 2. The iron–iron carbide phase diagram, with the eutectoid marked and a tie line at 0.4 wt% carbon and 650 °C.">
              <PhaseFigure />
            </PlateArt>
            <figcaption>
              <span className="ld-fig-n">Fig. 2</span>
              The iron–iron carbide diagram, with the eutectoid marked and the tie line drawn
              at 0.4 wt% carbon and 650 °C. Fixed, because it is a printed plate; the
              instrument below is not.
            </figcaption>
          </figure>
        </div>

        <LeverRule />
      </Reveal>

      <LaboratoryWorkbench />

      <Reveal className="ld-chapter" id="modules">
        <p className="ld-kicker">The modules</p>
        <h2 className="ld-h2">
          {capitalisedWord(MODULE_COUNT)} modules. {capitalisedWord(MODULE_COUNT)} figures. All of
          them computed.
        </h2>
        <p className="ld-sub">
          Every panel below is that module's own output — the periodic table shaded by
          melting point, with the eleven elements that have no measured one left unshaded;
          the nose of a real TTT curve; all 54 materials of the Ashby chart; α-iron's
          diffraction lines. One column per course group, which is also how the header is
          arranged.
        </p>

        <figure className="ld-plate ld-plate-wide">
          <PlateArt label={`Figure 3. ${capitalisedWord(MODULE_COUNT)} panels, one for each module, each plotted from that module's own model code, arranged in four columns by course group.`}>
            {/* The ratio is the plate's own viewBox, and it is not 1224/724 any
                more: the box grew a row when the thirteenth module landed in a
                column that already held three. A stale ratio here is a
                reserved box of the wrong height, which is the layout shift
                this wrapper exists to prevent. */}
            <NearbyPlate ratio={`${plateWidth(NAV_GROUPS.length)} / ${plateHeight(NAV_GROUPS.map((g) => g.items.length))}`}>
              <ModuleIndexPlate />
            </NearbyPlate>
          </PlateArt>
          <figcaption>
            <span className="ld-fig-n">Fig. 3</span>
            The {numberWord(MODULE_COUNT)} modules, drawn by the {numberWord(MODULE_COUNT)} modules. Nothing here is an
            illustration of the app; it is the app's output at thumbnail size.
          </figcaption>
        </figure>

        <ModulesDirectory />
      </Reveal>

      <Reveal className="ld-chapter ld-narrow">
        <p className="ld-kicker">Where two modules meet</p>
        <h2 className="ld-h2">The same reflection, from both ends.</h2>
        <p className="ld-sub">
          The Miller module turns a plane into a d-spacing. The XRD module turns a d-spacing
          into the angle a peak appears at. They are different pages built from different
          files, so the only honest way to claim they agree is to make the claim checkable.
          A test takes every reflection the XRD page offers as a link, opens the Miller page
          it leads to, and fails if the two disagree about whether that reflection is
          allowed or about the angle it appears at — across five samples and four anodes.
          It found them disagreeing once, which is why it exists.
        </p>

        <ol className="ld-chain">
          <li>
            <span className="ld-chain-n">1</span>
            <div>
              <h3>
                {AGREEMENT.allowed.plane} in copper, <em>a</em> = {AGREEMENT.a} nm
              </h3>
              <p>
                Miller reduces the indices, takes the reciprocal, and gets{' '}
                <strong>d = {AGREEMENT.allowed.d} nm</strong>.
              </p>
            </div>
          </li>
          <li>
            <span className="ld-chain-n">2</span>
            <div>
              <h3>Bragg, on a copper anode at λ = {AGREEMENT.lambda} nm</h3>
              <p>
                XRD puts that spacing at{' '}
                <strong>2θ = {AGREEMENT.allowed.twoTheta}°</strong> — the first line of the
                pattern in Fig. 6, and the number the Miller page prints too. The literature
                says 43.3°; this says what the model computes, which is the difference
                between quoting and calculating.
              </p>
            </div>
          </li>
          <li>
            <span className="ld-chain-n">3</span>
            <div>
              <h3>
                And {AGREEMENT.extinct.plane}, which is not there at all
              </h3>
              <p>
                It has a d-spacing — {AGREEMENT.extinct.d} nm — and Bragg's law solves for it
                perfectly well, at {AGREEMENT.extinct.twoTheta}°. It is absent because the
                structure factor of an FCC lattice vanishes for mixed indices, not because
                there was nowhere to put it. Both modules say so, and say it the same way.
              </p>
            </div>
          </li>
        </ol>

        <div className="ld-cta">
          <a className="ld-link" href="#/miller?plane=111">
            See (111) cut the cell
            <span className="ld-arrow" aria-hidden="true">
              →
            </span>
          </a>
          <a className="ld-link" href="#/xrd?sample=cu&source=cu">
            See the peak it makes
            <span className="ld-arrow" aria-hidden="true">
              →
            </span>
          </a>
        </div>
      </Reveal>

      <Reveal className="ld-chapter">
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
              <PlateArt label={`Figure ${s.n}. ${s.title}.`}>
                <NearbyPlate ratio="640 / 420">{s.figure}</NearbyPlate>
              </PlateArt>
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

      <Reveal className="ld-chapter ld-narrow">
        <p className="ld-kicker">Hand it to a class</p>
        <h2 className="ld-h2">The address bar is the worksheet.</h2>
        <p className="ld-sub">
          Anything that changes the answer — the steel, the plane, the cooling rate, the
          composition, the anode — lives in the URL. Set a case up, copy the address, paste
          it into a handout, and everyone opens the same diagram. These six are real; each
          one is a link.
        </p>
        <ul className="ld-links">
          {SHAREABLE.map((s) => (
            <li key={s.href}>
              <a href={s.href}>
                <code>{s.href}</code>
                <span>{s.shows}</span>
              </a>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal className="ld-chapter">
        <p className="ld-kicker">Curriculum</p>
        <h2 className="ld-h2">Classroom Worksheets & Problem Sets</h2>
        <p className="ld-sub">
          Pre-configured problem sets ready to assign directly to undergraduate metallurgy and materials science classes.
        </p>
        <div className="ld-worksheets-grid">
          <div className="ld-worksheet-card">
            <h3>01. Eutectoid Steel Lever Rule</h3>
            <p>Determine equilibrium phase fractions for hypoeutectoid vs hypereutectoid carbon steels at 650 °C.</p>
            <a className="ld-link" href="#/phase?T=650&sys=fe-c&x=0.4">
              Open Problem Set <span className="ld-arrow" aria-hidden="true">→</span>
            </a>
          </div>
          <div className="ld-worksheet-card">
            <h3>02. FCC Slip Systems & Schmid's Law</h3>
            <p>Identify active slip planes and calculate resolved shear stress on (111)[101] under uniaxial tension.</p>
            <a className="ld-link" href="#/miller?plane=111">
              Open Problem Set <span className="ld-arrow" aria-hidden="true">→</span>
            </a>
          </div>
          <div className="ld-worksheet-card">
            <h3>03. Pressure Vessel Fracture Mechanics</h3>
            <p>Evaluate leak-before-break conditions and critical crack length in a thin-walled cylindrical vessel.</p>
            <a className="ld-link" href="#/failure?geom=vessel&p=12">
              Open Problem Set <span className="ld-arrow" aria-hidden="true">→</span>
            </a>
          </div>
          <div className="ld-worksheet-card">
            <h3>04. TTT Cooling Curve & Quenching</h3>
            <p>Integrate Scheil additivity along continuous cooling paths for 4340 alloy steel.</p>
            <a className="ld-link" href="#/heattreat?rate=1200&steel=4340">
              Open Problem Set <span className="ld-arrow" aria-hidden="true">→</span>
            </a>
          </div>
          <div className="ld-worksheet-card">
            <h3>05. Periodic Property Trends</h3>
            <p>Correlate electronegativity and atomic radius trends against observed elemental melting points.</p>
            <a className="ld-link" href="#/trends?el=W&prop=melt">
              Open Problem Set <span className="ld-arrow" aria-hidden="true">→</span>
            </a>
          </div>
          <div className="ld-worksheet-card">
            <h3>06. X-Ray Powder Diffraction</h3>
            <p>Verify Bragg angles and systematic extinction rules for copper and iron powder samples.</p>
            <a className="ld-link" href="#/xrd?sample=cu&source=cu">
              Open Problem Set <span className="ld-arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </Reveal>

      <Reveal className="ld-chapter">
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

      <Reveal className="ld-chapter">
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
        <div className="ld-close-copy">
          <h2 className="ld-h2 ld-h2-close">Pick something and start pulling on it.</h2>
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
        </div>
      </section>
    </div>
  );
}

/**
 * A plate whose markup is fetched when the reader gets near it.
 *
 * `lazy()` alone is not deferral. React starts the import the moment the
 * component *renders*, and every section of this page is in the first render
 * tree, so the chunks were going out on page load. They did not block first
 * paint, which is the part that matters most — but "off the critical path" and
 * "not fetched at all unless someone scrolls" are different things, and only
 * one of them was true.
 *
 * So each plate mounts on its own `useReveal`, with a positive bottom margin so
 * the fetch starts a little before the box is on screen. The guarantee that
 * makes this safe is the one `useReveal` already gives: `shown` starts *true*
 * under reduced motion or in a browser without `IntersectionObserver`, so the
 * failure mode is fetching markup nobody needed, never an empty frame.
 *
 * The box holds the plate's own aspect ratio either way, so nothing on the page
 * moves when a chunk lands.
 */
function NearbyPlate({ ratio, children }: { ratio: string; children: React.ReactNode }) {
  const { ref, shown } = useReveal<HTMLDivElement>({
    threshold: 0,
    rootMargin: '0px 0px 300px 0px',
  });
  return (
    <div ref={ref} className="ld-plate-slot" style={{ aspectRatio: ratio }}>
      {shown && <Suspense fallback={null}>{children}</Suspense>}
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
