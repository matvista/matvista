import { useMemo, useState } from 'react';
import { useRouteEnum, useRouteNumber, useRouteString } from '../useRoute';
import {
  CLASS_LABEL,
  INDICES,
  SELECTION_MATERIALS,
  indexValue,
  type MaterialClass,
  type SelectionMaterial,
} from '../selection/materials';

const W = 760;
const H = 500;
const PAD = { l: 68, r: 24, t: 20, b: 56 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

/**
 * Class identity is carried by colour AND marker shape. A scatter puts every
 * pair of series adjacent, which is exactly the case the palette's three-slot
 * all-pairs cap covers — so shape is the redundant channel that keeps identity
 * from resting on hue alone.
 */
const CLASS_STYLE: Record<MaterialClass, { color: string; shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'cross' }> = {
  metal: { color: '#2a78d6', shape: 'circle' },
  ceramic: { color: '#eb6834', shape: 'square' },
  polymer: { color: '#1baf7a', shape: 'triangle' },
  elastomer: { color: '#eda100', shape: 'diamond' },
  composite: { color: '#9085e9', shape: 'cross' },
};

type YProp = 'modulus' | 'strength';

const Y_PROPS: YProp[] = ['modulus', 'strength'];

export function AshbyChart() {
  const [yProp, setYProp] = useRouteEnum<YProp>('y', 'modulus', Y_PROPS);
  const [indexId, setIndexId] = useRouteString('index', 'e12-rho');
  const [hidden, setHidden] = useState<Set<MaterialClass>>(new Set());
  const [selected, setSelected] = useState<SelectionMaterial | null>(null);
  /** Guide-line position, as a fraction of the index range. */
  const [guide, setGuide] = useRouteNumber('guide', 0.82, 0, 1);

  const applicable = INDICES.filter((i) => i.property === yProp);
  const index = applicable.find((i) => i.id === indexId) ?? applicable[0];

  const visible = SELECTION_MATERIALS.filter((m) => !hidden.has(m.cls));

  const yOf = (m: SelectionMaterial) => (yProp === 'modulus' ? m.modulus : m.strength);

  // Fixed log bounds so toggling classes doesn't rescale the whole chart.
  const xMin = 0.3;
  const xMax = 30;
  const yMin = yProp === 'modulus' ? 0.001 : 10;
  const yMax = yProp === 'modulus' ? 1200 : 5000;

  const lx = (v: number) => PAD.l + ((Math.log10(v) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))) * plotW;
  const ly = (v: number) => PAD.t + plotH - ((Math.log10(v) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin))) * plotH;

  const decades = (min: number, max: number) => {
    const out: number[] = [];
    for (let e = Math.ceil(Math.log10(min)); e <= Math.floor(Math.log10(max)); e++) out.push(10 ** e);
    return out;
  };

  // Guide line: log(y) = slope·log(ρ) + c. Sweep c across the data's range.
  const guideLine = useMemo(() => {
    const values = visible.map((m) => Math.log10(yOf(m)) - index.slope * Math.log10(m.density));
    if (values.length === 0) return null;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const c = lo + (hi - lo) * guide;
    const y1 = 10 ** (index.slope * Math.log10(xMin) + c);
    const y2 = 10 ** (index.slope * Math.log10(xMax) + c);
    return { c, y1, y2 };
  }, [visible, index, guide, yProp]);

  // Materials above the guide line beat the index threshold.
  const passing = useMemo(() => {
    if (!guideLine) return [];
    return visible
      .filter((m) => Math.log10(yOf(m)) - index.slope * Math.log10(m.density) >= guideLine.c)
      .sort((a, b) => indexValue(b, index) - indexValue(a, index));
  }, [visible, index, guideLine, yProp]);

  function toggleClass(c: MaterialClass) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  return (
    <div className="ss-layout">
      <section className="dd-block">
        <div className="crystal-controls">
          <div className="toggle-group" role="group" aria-label="Vertical axis">
            <button
              className={`toggle ${yProp === 'modulus' ? 'toggle-on' : ''}`}
              aria-pressed={yProp === 'modulus'}
              onClick={() => {
                setYProp('modulus');
                setIndexId('e12-rho');
              }}
            >
              Modulus
            </button>
            <button
              className={`toggle ${yProp === 'strength' ? 'toggle-on' : ''}`}
              aria-pressed={yProp === 'strength'}
              onClick={() => {
                setYProp('strength');
                setIndexId('s-rho');
              }}
            >
              Strength
            </button>
          </div>
          <select value={index.id} onChange={(e) => setIndexId(e.target.value)} aria-label="Performance index">
            {applicable.map((i) => (
              <option key={i.id} value={i.id}>
                Index: {i.label}
              </option>
            ))}
          </select>
          <span className="drag-hint">Click any point for detail</span>
        </div>

        <svg className="ss-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Ashby chart: ${yProp} versus density`}>
          {decades(yMin, yMax).map((v) => (
            <g key={`y${v}`}>
              <line x1={PAD.l} x2={W - PAD.r} y1={ly(v)} y2={ly(v)} className="dd-grid" />
              <text x={PAD.l - 8} y={ly(v) + 4} className="dd-tick" textAnchor="end">
                {v >= 1 ? v : v.toString()}
              </text>
            </g>
          ))}
          {decades(xMin, xMax).map((v) => (
            <g key={`x${v}`}>
              <line x1={lx(v)} x2={lx(v)} y1={PAD.t} y2={PAD.t + plotH} className="dd-grid" />
              <text x={lx(v)} y={H - 34} className="dd-tick" textAnchor="middle">
                {v}
              </text>
            </g>
          ))}

          {guideLine && (
            <>
              <line
                x1={lx(xMin)}
                x2={lx(xMax)}
                y1={ly(guideLine.y1)}
                y2={ly(guideLine.y2)}
                className="ab-guide"
              />
              <text x={lx(xMax) - 6} y={ly(guideLine.y2) - 8} className="ab-guide-label" textAnchor="end">
                {index.label}
              </text>
            </>
          )}

          {visible.map((m) => {
            const style = CLASS_STYLE[m.cls];
            const x = lx(m.density);
            const y = ly(yOf(m));
            const isSel = selected?.name === m.name;
            return (
              <g
                key={m.name}
                className="ab-point"
                onClick={() => setSelected(m)}
                role="button"
                aria-label={m.name}
              >
                <Marker shape={style.shape} x={x} y={y} r={isSel ? 8 : 5.5} color={style.color} selected={isSel} />
              </g>
            );
          })}

          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="dd-axis" />
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} className="dd-axis" />
          <text x={W / 2} y={H - 10} className="dd-tick" textAnchor="middle">
            density ρ (Mg/m³) — log scale
          </text>
          <text
            x={18}
            y={PAD.t + plotH / 2}
            className="dd-tick"
            transform={`rotate(-90 18 ${PAD.t + plotH / 2})`}
            textAnchor="middle"
          >
            {yProp === 'modulus' ? 'Young’s modulus E (GPa)' : 'strength σ (MPa)'} — log scale
          </text>
        </svg>

        <div className="ab-legend">
          {(Object.keys(CLASS_LABEL) as MaterialClass[]).map((c) => (
            <button
              key={c}
              className={`ab-legend-item ${hidden.has(c) ? 'ab-off' : ''}`}
              onClick={() => toggleClass(c)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <Marker shape={CLASS_STYLE[c].shape} x={7} y={7} r={5} color={CLASS_STYLE[c].color} />
              </svg>
              {CLASS_LABEL[c]}
            </button>
          ))}
        </div>

        <label className="dd-slider ab-slider">
          <span>
            Guide line — raise it to demand more of the index{' '}
            <strong>
              {passing.length} of {visible.length} materials pass
            </strong>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={guide}
            onChange={(e) => setGuide(+e.target.value)}
          />
        </label>

        <p className="trend-note">{index.scenario}</p>
      </section>

      <aside className="detail">
        <h2 className="crystal-title">Best by {index.label}</h2>
        <p className="detail-meta">Materials above the guide line, ranked</p>
        <ol className="ab-rank">
          {passing.slice(0, 10).map((m) => (
            <li key={m.name}>
              <button className="ab-rank-item" onClick={() => setSelected(m)}>
                <span className="pd-swatch" style={{ background: CLASS_STYLE[m.cls].color }} />
                {m.name}
                <span className="ab-rank-val">{indexValue(m, index).toFixed(2)}</span>
              </button>
            </li>
          ))}
          {passing.length === 0 && <li className="density-note">Nothing passes — lower the guide line.</li>}
        </ol>

        {selected && (
          <div className="density-box">
            <h3>{selected.name}</h3>
            <table className="detail-props">
              <tbody>
                <tr>
                  <th scope="row">Class</th>
                  <td>{CLASS_LABEL[selected.cls]}</td>
                </tr>
                <tr>
                  <th scope="row">Density ρ</th>
                  <td>{selected.density} Mg/m³</td>
                </tr>
                <tr>
                  <th scope="row">Modulus E</th>
                  <td>{selected.modulus} GPa</td>
                </tr>
                <tr>
                  <th scope="row">Strength σ</th>
                  <td>{selected.strength} MPa</td>
                </tr>
                <tr>
                  <th scope="row">{index.label}</th>
                  <td>{indexValue(selected, index).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            {selected.note && <p className="detail-summary">{selected.note}</p>}
            {selected.ranged && (
              <p className="density-note">
                One or more values is the midpoint of a published range.
              </p>
            )}
          </div>
        )}

        <p className="density-note">
          All values from Callister Appendix B. For ceramics the quoted strength is{' '}
          <strong>flexural</strong>, not tensile — ceramics are far weaker in tension, and
          concrete’s figure is compressive. Treat the ceramic strengths as an upper bound and never
          design a tensile member from them.
        </p>
      </aside>
    </div>
  );
}

function Marker({
  shape,
  x,
  y,
  r,
  color,
  selected,
}: {
  shape: 'circle' | 'square' | 'triangle' | 'diamond' | 'cross';
  x: number;
  y: number;
  r: number;
  color: string;
  selected?: boolean;
}) {
  const stroke = selected ? { stroke: 'var(--ink)', strokeWidth: 2 } : {};
  switch (shape) {
    case 'square':
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill={color} {...stroke} />;
    case 'triangle':
      return (
        <polygon points={`${x},${y - r} ${x + r},${y + r} ${x - r},${y + r}`} fill={color} {...stroke} />
      );
    case 'diamond':
      return (
        <polygon points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} fill={color} {...stroke} />
      );
    case 'cross':
      return (
        <g stroke={color} strokeWidth={r * 0.75} strokeLinecap="round">
          <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} />
          <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} />
          {selected && <circle cx={x} cy={y} r={r * 1.6} fill="none" stroke="var(--ink)" strokeWidth={1.5} />}
        </g>
      );
    default:
      return <circle cx={x} cy={y} r={r} fill={color} {...stroke} />;
  }
}
