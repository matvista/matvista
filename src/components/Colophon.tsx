/**
 * The colophon under the landing page.
 *
 * It renders from `App.tsx`, *outside* `<main>`, and that placement is the
 * whole reason it is a component rather than a section at the bottom of
 * `Landing.tsx`. Per ARIA-in-HTML a `<footer>` maps to the `contentinfo`
 * landmark only when it is not inside `main`, `article`, `section`, `aside` or
 * `nav` — nested there it is a generic box, and a screen-reader user gets no
 * landmark to jump to and no way to tell where the page's content ended.
 *
 * A colophon rather than the four columns of links a footer is usually made of.
 * Four columns of link lists is precisely the vocabulary `landing.css` records
 * throwing out, wearing a serif; and the module index further up the page is
 * already the canonical list of the twelve. What belongs here is what a printed
 * book puts on its last page: where the numbers came from, how the figures were
 * made, what it is set in, and who may copy it.
 *
 * Landing page only. The module pages carry dense chrome of their own and end
 * in a control panel rather than in prose; whether they want a foot is a
 * separate question from whether the front door does.
 */
export function Colophon() {
  return (
    <footer className="ld ld-colophon">
      <p className="ld-kicker">Colophon</p>

      <div className="ld-colophon-cols">
        <section>
          <h2>Where the numbers come from</h2>
          <p>
            Invariant reactions, solubility limits, tabulated radii, moduli and band gaps
            are taken from Callister &amp; Rethwisch, <em>Materials Science and
            Engineering: An Introduction</em>, and cited module by module. The curves
            between those fixed points are constructed — fitted or linearised — and every
            module says which of the two it is showing rather than implying a precision it
            does not have. Element data derives from Periodic-Table-JSON, CC BY-SA.
          </p>
        </section>

        <section>
          <h2>How the figures are made</h2>
          <p>
            Every plate from Fig. 2 on is emitted by the scripts in <code>scripts/</code>,
            which import the same model code the modules run, and committed. Rebuild them
            with <code>npm run figures</code>. A test re-runs that generator in process and
            compares it with what is on disk, so a change to a model cannot quietly leave a
            stale diagram on the front page — it fails the suite instead. Fig. 1 is the
            exception worth naming: its geometry comes from a landing-page file no module
            imports, so it is generated the same way but is nobody's output but its own.
          </p>
        </section>

        <section>
          <h2>What it does not do</h2>
          <p>
            No analytics, no cookies, no accounts, and no network requests at all once the
            page has loaded — the data, the models and the figures are all part of the
            bundle. Nothing you type into a module leaves your browser. The type is three
            system stacks — a serif for display, a monospace for labels and figures, and
            the interface sans for everything else — so there is no font to fetch either.
          </p>
        </section>

        <section>
          <h2>Copying</h2>
          <p>
            Open source under the MIT licence: use it in a class, fork it, take the models
            out and put them somewhere else.
          </p>
          <p className="ld-colophon-repo">
            <a className="ld-link" href="https://github.com/matvista/matvista">
              Source on GitHub
              <span className="ld-arrow" aria-hidden="true">
                →
              </span>
            </a>
          </p>
        </section>
      </div>
    </footer>
  );
}
