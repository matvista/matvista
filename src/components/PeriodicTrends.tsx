import { useState } from 'react';
import elementsRaw from '../data/elements.json';
import type { ElementData, PropertyDef } from '../types';
import { PROPERTIES } from '../types';
import { RAMP } from '../color';
import { PeriodicTable } from './PeriodicTable';
import { ElementDetail } from './ElementDetail';
import { useRouteString } from '../useRoute';

const elements = elementsRaw as ElementData[];

/**
 * The periodic-trends module.
 *
 * Extracted from `App` when the landing page became the entry point: this view
 * carries the 76 kB element dataset, and once it is no longer what a visitor
 * first sees, that belongs in a chunk of its own rather than in first paint.
 */
export function PeriodicTrends() {
  // Which property colours the table, and which element the panel describes, are
  // both part of "what am I looking at" — so both travel in the URL. Hover is
  // not: it is a pointer position, gone the moment the reader moves the mouse.
  const [propertyKey, setPropertyKey] = useRouteString('prop', PROPERTIES[0].key);
  const [selectedSymbol, setSelectedSymbol] = useRouteString('el', 'Fe');
  const [hovered, setHovered] = useState<ElementData | null>(null);

  const property: PropertyDef =
    PROPERTIES.find((p) => p.key === propertyKey) ?? PROPERTIES[0];
  const selected: ElementData | null =
    elements.find((e) => e.symbol === selectedSymbol) ?? null;

  const values = elements
    .map((e) => e[property.key] as number | null)
    .filter((v): v is number => v != null && v > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const hoverValue = hovered ? (hovered[property.key] as number | null) : null;

  return (
    <>
      <div className="controls">
        <label htmlFor="prop">Color by</label>
        <select
          id="prop"
          value={property.key}
          onChange={(e) => setPropertyKey(e.target.value)}
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
            onSelect={(el) => setSelectedSymbol(el.symbol)}
            onHover={setHovered}
          />
          <p className="trend-note">
            <strong>Trend to spot:</strong> {property.trendNote}
          </p>
        </div>
        {selected && <ElementDetail element={selected} />}
      </main>
    </>
  );
}
