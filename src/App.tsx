import { Suspense, lazy } from 'react';
import { AppNav } from './components/AppNav';
import { findItemOrNull } from './nav';
import { Landing } from './components/Landing';
import { useTab } from './useRoute';
import './index.css';

/**
 * Modules load on demand.
 *
 * Deployment is Cloudflare Pages: static assets, hashed and immutably cached at
 * the edge, so a split chunk costs one extra request on first open and nothing
 * after. What that buys is first paint — three.js is far and away the largest
 * dependency here and it is reachable from only three modules, so shipping it
 * to a reader who opened the periodic table was most of the payload wasted.
 *
 * The landing page is the one eager view, because it is what a visitor sees
 * first; everything behind it, the periodic table included, is a chunk away.
 */
const PeriodicTrends = lazy(() =>
  import('./components/PeriodicTrends').then((m) => ({ default: m.PeriodicTrends })),
);
const CrystalStructures = lazy(() =>
  import('./components/CrystalStructures').then((m) => ({ default: m.CrystalStructures })),
);
const MillerIndices = lazy(() =>
  import('./components/MillerIndices').then((m) => ({ default: m.MillerIndices })),
);
const DefectsDiffusion = lazy(() =>
  import('./components/DefectsDiffusion').then((m) => ({ default: m.DefectsDiffusion })),
);
const StressStrain = lazy(() =>
  import('./components/StressStrain').then((m) => ({ default: m.StressStrain })),
);
const FailureAnalysis = lazy(() =>
  import('./components/FailureAnalysis').then((m) => ({ default: m.FailureAnalysis })),
);
const PhaseDiagrams = lazy(() =>
  import('./components/PhaseDiagrams').then((m) => ({ default: m.PhaseDiagrams })),
);
const HeatTreatment = lazy(() =>
  import('./components/HeatTreatment').then((m) => ({ default: m.HeatTreatment })),
);
const AshbyChart = lazy(() =>
  import('./components/AshbyChart').then((m) => ({ default: m.AshbyChart })),
);
const XrdSimulator = lazy(() =>
  import('./components/XrdSimulator').then((m) => ({ default: m.XrdSimulator })),
);

export default function App() {
  const [tab, setTab] = useTab();

  return (
    <div className={`app ${tab === 'home' ? 'app-home' : ''}`}>
      <header className="app-header">
        <button className="app-brand" onClick={() => setTab('home')} aria-label="MatVista home">
          MatVista
        </button>
        <AppNav tab={tab} onSelect={setTab} />
        {/* Every module page needs a heading of its own; the landing page brings
            its own <h1>, so this one only appears behind it. It stays in the DOM
            at narrow widths where it is visually hidden, or small screens would
            have no <h1> at all. */}
        {tab !== 'home' && (
          <h1 className="nav-current" aria-live="polite">
            {findItemOrNull(tab)?.label ?? ''}
          </h1>
        )}
      </header>

      {tab === 'home' && <Landing />}

      {tab !== 'home' && (
        <Suspense fallback={<p className="mod-loading">Loading module…</p>}>
          {tab === 'trends' && <PeriodicTrends />}
          {tab === 'crystals' && <CrystalStructures />}
          {tab === 'miller' && <MillerIndices />}
          {tab === 'defects' && <DefectsDiffusion />}
          {tab === 'mechanical' && <StressStrain />}
          {tab === 'failure' && <FailureAnalysis />}
          {tab === 'phase' && <PhaseDiagrams />}
          {tab === 'heattreat' && <HeatTreatment />}
          {tab === 'selection' && <AshbyChart />}
          {tab === 'xrd' && <XrdSimulator />}
        </Suspense>
      )}
    </div>
  );
}
