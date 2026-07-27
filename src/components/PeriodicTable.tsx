import type { ElementData, PropertyDef } from '../types';
import { normalize, rampColor } from '../color';

interface Props {
  elements: ElementData[];
  property: PropertyDef;
  selected: ElementData | null;
  onSelect: (el: ElementData) => void;
  onHover: (el: ElementData | null) => void;
}

export function PeriodicTable({ elements, property, selected, onSelect, onHover }: Props) {
  const values = elements
    .map((e) => e[property.key] as number | null)
    .filter((v): v is number => v != null && v > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <div className="ptable" role="grid" aria-label={`Periodic table colored by ${property.label}`}>
      {elements.map((el) => {
        const raw = el[property.key] as number | null;
        const hasValue = raw != null && (!property.log || raw > 0);
        const cell = hasValue ? rampColor(normalize(raw, min, max, property.log)) : null;
        return (
          <button
            key={el.number}
            className={`cell ${cell ? `ink-${cell.ink}` : 'cell-missing'} ${
              selected?.number === el.number ? 'cell-selected' : ''
            }`}
            style={{ gridColumn: el.xpos, gridRow: el.ypos, background: cell?.bg }}
            onClick={() => onSelect(el)}
            onMouseEnter={() => onHover(el)}
            onMouseLeave={() => onHover(null)}
            aria-label={`${el.name}${hasValue ? `, ${property.label} ${raw} ${property.unit}` : ''}`}
          >
            <span className="cell-num">{el.number}</span>
            <span className="cell-sym">{el.symbol}</span>
          </button>
        );
      })}
    </div>
  );
}
