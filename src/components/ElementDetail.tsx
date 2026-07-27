import type { ElementData } from '../types';
import { PROPERTIES } from '../types';

export function ElementDetail({ element }: { element: ElementData }) {
  return (
    <aside className="detail">
      <div className="detail-head">
        <span className="detail-sym">{element.symbol}</span>
        <div>
          <h2>{element.name}</h2>
          <p className="detail-meta">
            #{element.number} · {element.category} · {element.block}-block ·{' '}
            {element.phase.toLowerCase()} at STP
          </p>
        </div>
      </div>
      <p className="detail-config">
        <code>{element.electron_configuration}</code>
      </p>
      <table className="detail-props">
        <tbody>
          {PROPERTIES.map((p) => {
            const v = element[p.key] as number | null;
            return (
              <tr key={p.key}>
                <th scope="row">{p.label}</th>
                <td>{v != null ? `${v} ${p.unit}` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="detail-summary">{element.summary}</p>
    </aside>
  );
}
