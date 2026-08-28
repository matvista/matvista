import { useState } from 'react';
import elementsRaw from './data/elements.json';
import type { ElementData, PropertyDef } from './types';
import { PROPERTIES } from './types';
import { RAMP } from './color';
import { PeriodicTable } from './components/PeriodicTable';
import { ElementDetail } from './components/ElementDetail';
import { CrystalStructures } from './components/CrystalStructures';
import { MillerIndices } from './components/MillerIndices';
import { DefectsDiffusion } from './components/DefectsDiffusion';
import { StressStrain } from './components/StressStrain';
import { PhaseDiagrams } from './components/PhaseDiagrams';
import { AshbyChart } from './components/AshbyChart';
import { XrdSimulator } from './components/XrdSimulator';
import { AppNav } from './components/AppNav';
import type { Tab } from './nav';
import './index.css';

const elements = elementsRaw as ElementData[];

export default function App() {
  const [tab, setTab] = useState<Tab>('trends');
  const [property, setProperty] = useState<PropertyDef>(PROPERTIES[0]);
  const [selected, setSelected] = useState<ElementData | null>(
    elements.find((e) => e.symbol === 'Fe') ?? null,
  );
  const [hovered, setHovered] = useState<ElementData | null>(null);

  const values = elements
    .map((e) => e[property.key] as number | null)
    .filter((v): v is number => v != null && v > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const hoverValue = hovered ? (hovered[property.key] as number | null) : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>MatVista</h1>
        <AppNav tab={tab} onSelect={setTab} />
      </header>

      {tab === 'crystals' && <CrystalStructures elements={elements} />}

      {tab === 'miller' && <MillerIndices />}

      {tab === 'defects' && <DefectsDiffusion />}

      {tab === 'mechanical' && <StressStrain />}

      {tab === 'phase' && <PhaseDiagrams />}

      {tab === 'selection' && <AshbyChart />}

      {tab === 'xrd' && <XrdSimulator />}

      {tab === 'trends' && (
        <>
      <div className="controls">
        <label htmlFor="prop">Color by</label>
        <select
          id="prop"
          value={property.key}
          onChange={(e) =>
            setProperty(PROPERTIES.find((p) => p.key === e.target.value) ?? PROPERTIES[0])
          }
        >
          {PROPERTIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <div className="legend" aria-hidden="true">
          <span className="legend-label">
            {min.toLocaleString()} {property.unit}
          </span>
          <div
            className="legend-bar"
            style={{ background: `linear-gradient(to right, ${RAMP.join(',')})` }}
          />
          <span className="legend-label">
            {max.toLocaleString()} {property.unit}
            {property.log ? ' (log)' : ''}
          </span>
        </div>
        <div className="hover-readout" role="status">
          {hovered
            ? `${hovered.name}: ${
                hoverValue != null ? `${hoverValue} ${property.unit}` : 'no data'
              }`
            : 'Hover an element'}
        </div>
      </div>

      <main className="layout">
        <div>
          <PeriodicTable
            elements={elements}
            property={property}
            selected={selected}
            onSelect={setSelected}
            onHover={setHovered}
          />
          <p className="trend-note">
            <strong>Trend to spot:</strong> {property.trendNote}
          </p>
        </div>
        {selected && <ElementDetail element={selected} />}
      </main>
        </>
      )}
    </div>
  );
}
