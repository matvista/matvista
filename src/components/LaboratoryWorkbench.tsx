import { useEffect, useRef, useState } from 'react';
import { formatIndices } from '../crystal/miller';

export function LaboratoryWorkbench() {
  const [activeTab, setActiveTab] = useState<'miller' | 'ashby' | 'semi'>('miller');

  // Miller Tab State
  const [h, setH] = useState(1);
  const [k, setK] = useState(1);
  const [l, setL] = useState(1);
  const millerCanvasRef = useRef<HTMLCanvasElement>(null);

  // Ashby Tab State
  const [ashbyCat, setAshbyCat] = useState<'all' | 'metals' | 'composites' | 'ceramics' | 'polymers'>('all');
  const [guideSlope, setGuideSlope] = useState<'beam' | 'tie' | 'plate'>('beam');

  // Semiconductor Tab State
  const [activeSemi, setActiveSemi] = useState<{
    id: string;
    name: string;
    eg: number;
    color: string;
    desc: string;
  }>({
    id: 'si',
    name: 'Silicon (Si)',
    eg: 1.12,
    color: '#38bdf8',
    desc: 'Indirect band gap, fundamental to modern CMOS microelectronics.',
  });

  // Miller isometric projection & rendering
  useEffect(() => {
    if (activeTab !== 'miller') return;
    const canvas = millerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const hCanvas = canvas.height;
    ctx.clearRect(0, 0, w, hCanvas);

    const ox = w / 2;
    const oy = hCanvas / 2 + 35;
    const scale = 70;

    function iso(x: number, y: number, z: number) {
      return {
        x: ox + (x - y) * Math.cos(Math.PI / 6) * scale,
        y: oy + (x + y) * Math.sin(Math.PI / 6) * scale - z * scale,
      };
    }

    // Draw cube edges
    const corners = [
      [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
      [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
    ];
    const pts = corners.map((c) => iso(c[0], c[1], c[2]));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    const edges: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    edges.forEach(([i, j]) => {
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[j].x, pts[j].y);
      ctx.stroke();
    });

    // Draw plane cut
    if (!(h === 0 && k === 0 && l === 0)) {
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();

      if (h === 1 && k === 1 && l === 1) {
        const p1 = iso(1, 0, 0);
        const p2 = iso(0, 1, 0);
        const p3 = iso(0, 0, 1);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
      } else if (h === 1 && k === 1 && l === 0) {
        const p1 = iso(1, 0, 0);
        const p2 = iso(0, 1, 0);
        const p3 = iso(0, 1, 1);
        const p4 = iso(1, 0, 1);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
      } else if (h === 1 && k === 0 && l === 0) {
        const p1 = iso(1, 0, 0);
        const p2 = iso(1, 1, 0);
        const p3 = iso(1, 1, 1);
        const p4 = iso(1, 0, 1);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
      } else {
        const p1 = iso(1, 0, 0);
        const p2 = iso(0, 1, 0);
        const p3 = iso(0, 0, 1);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }, [activeTab, h, k, l]);

  // Miller calculations for Copper (FCC, a = 0.3615 nm)
  const isZero = h === 0 && k === 0 && l === 0;
  const dSpacingCalc = isZero ? 'Undefined' : (0.3615 / Math.sqrt(h * h + k * k + l * l)).toFixed(4);
  const allOdd = h % 2 !== 0 && k % 2 !== 0 && l % 2 !== 0;
  const allEven = h % 2 === 0 && k % 2 === 0 && l % 2 === 0;
  const isAllowed = !isZero && (allOdd || allEven);

  const getIntercept = (v: number) => (v === 0 ? '∞' : 1 / v === 1 ? '1a' : (1 / v).toFixed(2) + 'a');
  const intercepts = `${getIntercept(h)}, ${getIntercept(k)}, ${getIntercept(l)}`;

  // Semiconductors List
  const SEMICONDUCTORS = [
    { id: 'insb', name: 'Indium Antimonide (InSb)', eg: 0.17, color: '#9333ea', desc: 'Narrow gap, infrared detectors' },
    { id: 'si', name: 'Silicon (Si)', eg: 1.12, color: '#38bdf8', desc: 'Indirect gap, CMOS electronics' },
    { id: 'gaas', name: 'Gallium Arsenide (GaAs)', eg: 1.42, color: '#10b981', desc: 'Direct gap, high-speed optoelectronics' },
    { id: 'cds', name: 'Cadmium Sulfide (CdS)', eg: 2.42, color: '#eab308', desc: 'Visible green/yellow photoconductors' },
    { id: 'gan', name: 'Gallium Nitride (GaN)', eg: 3.44, color: '#3b82f6', desc: 'Wide bandgap, blue LEDs & power devices' },
    { id: 'dia', name: 'Diamond (C)', eg: 5.47, color: '#a855f7', desc: 'Deep ultraviolet transparent insulator' },
  ];

  const semiWavelength = (1239.8 / activeSemi.eg).toFixed(1);
  const spectrumPct = Math.max(0, Math.min(100, ((parseFloat(semiWavelength) - 380) / (750 - 380)) * 100));

  return (
    <div className="ld-workbench-sec">
      <div className="ld-workbench-head">
        <p className="ld-kicker">Interactive Laboratory</p>
        <h2 className="ld-h2">Live Laboratory Workbench</h2>
        <p className="ld-sub">
          Test crystallographic planes, explore material performance envelopes, and probe optoelectronic band structures with live mathematical instruments.
        </p>
      </div>

      <div className="ld-workbench-box">
        {/* Tab Headers */}
        <div className="ld-workbench-tabs" role="tablist" aria-label="Laboratory workbench instruments">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'miller'}
            className={`workbench-tab-btn ${activeTab === 'miller' ? 'active' : ''}`}
            onClick={() => setActiveTab('miller')}
          >
            <span className="tab-icon">◈</span>
            Miller Plane Slicer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ashby'}
            className={`workbench-tab-btn ${activeTab === 'ashby' ? 'active' : ''}`}
            onClick={() => setActiveTab('ashby')}
          >
            <span className="tab-icon">📈</span>
            Ashby Material Frontier
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'semi'}
            className={`workbench-tab-btn ${activeTab === 'semi' ? 'active' : ''}`}
            onClick={() => setActiveTab('semi')}
          >
            <span className="tab-icon">⚡</span>
            Semiconductor Bandgap & Optics
          </button>
        </div>

        {/* Tab 1: Miller Slicer */}
        {activeTab === 'miller' && (
          <div className="workbench-panel" role="tabpanel">
            <div className="workbench-grid">
              <div className="workbench-controls-col">
                <h3 className="wb-title">FCC Lattice Plane Slicer</h3>
                <p className="wb-desc">
                  Select or drag Miller indices (<em>hkl</em>) to cut through the unit cell. Watch intercepts and Bragg d-spacing recalculate live.
                </p>

                <div className="wb-presets-row">
                  <span className="wb-label">Standard planes:</span>
                  {[
                    [1, 1, 1],
                    [1, 0, 0],
                    [1, 1, 0],
                    [2, 1, 1],
                  ].map(([ph, pk, pl]) => {
                    const planeLabel = formatIndices([ph, pk, pl], 'plane');
                    return (
                      <button
                        key={planeLabel}
                        type="button"
                        className={`wb-preset-chip ${h === ph && k === pk && l === pl ? 'active' : ''}`}
                        onClick={() => {
                          setH(ph);
                          setK(pk);
                          setL(pl);
                        }}
                      >
                        {planeLabel}
                      </button>
                    );
                  })}
                </div>

                <div className="wb-slider-group">
                  <div className="wb-slider-row">
                    <label htmlFor="h-slider">Index <em>h</em>: <strong>{h}</strong></label>
                    <input
                      id="h-slider"
                      type="range"
                      min={0}
                      max={3}
                      value={h}
                      onChange={(e) => setH(Number(e.target.value))}
                    />
                  </div>
                  <div className="wb-slider-row">
                    <label htmlFor="k-slider">Index <em>k</em>: <strong>{k}</strong></label>
                    <input
                      id="k-slider"
                      type="range"
                      min={0}
                      max={3}
                      value={k}
                      onChange={(e) => setK(Number(e.target.value))}
                    />
                  </div>
                  <div className="wb-slider-row">
                    <label htmlFor="l-slider">Index <em>l</em>: <strong>{l}</strong></label>
                    <input
                      id="l-slider"
                      type="range"
                      min={0}
                      max={3}
                      value={l}
                      onChange={(e) => setL(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="wb-data-cards">
                  <div className="wb-card">
                    <span className="wb-card-label">Intercepts</span>
                    <span className="wb-card-value font-mono">{intercepts}</span>
                  </div>
                  <div className="wb-card">
                    <span className="wb-card-label">Interplanar d-spacing</span>
                    <span className="wb-card-value font-mono">{dSpacingCalc} {dSpacingCalc !== 'Undefined' ? 'nm' : ''}</span>
                  </div>
                  <div className="wb-card">
                    <span className="wb-card-label">FCC Extinction Rule</span>
                    <span className={`wb-card-value font-mono ${isAllowed ? 'text-ok' : 'text-bad'}`}>
                      {isAllowed ? 'ALLOWED (Peak Visible)' : 'EXTINCT (Forbidden Peak)'}
                    </span>
                  </div>
                </div>

                <div className="wb-link-row">
                  <a className="ld-link" href="#/miller?plane=111">
                    Open full Miller indices & slip systems module
                    <span className="ld-arrow" aria-hidden="true">→</span>
                  </a>
                </div>
              </div>

              <div className="workbench-canvas-col">
                <canvas
                  ref={millerCanvasRef}
                  width={420}
                  height={320}
                  className="wb-canvas"
                  title="Unit cell isometric plane cut"
                />
                <p className="wb-caption">
                  Isometric projection of copper unit cell cut by the {formatIndices([h, k, l], 'plane')} crystallographic plane.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Ashby Chart */}
        {activeTab === 'ashby' && (
          <div className="workbench-panel" role="tabpanel">
            <div className="workbench-grid">
              <div className="workbench-controls-col">
                <h3 className="wb-title">Ashby Material Performance Frontier</h3>
                <p className="wb-desc">
                  Young's modulus (<em>E</em>) versus density (<em>ρ</em>) for 54 engineering materials on log–log axes. Filter by material class or move performance guide lines.
                </p>

                <div className="wb-presets-row">
                  <span className="wb-label">Material Class:</span>
                  {(['all', 'metals', 'ceramics', 'polymers', 'composites'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`wb-preset-chip ${ashbyCat === cat ? 'active' : ''}`}
                      onClick={() => setAshbyCat(cat)}
                    >
                      {cat.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="wb-presets-row">
                  <span className="wb-label">Performance Metric:</span>
                  {(['beam', 'tie', 'plate'] as const).map((slope) => (
                    <button
                      key={slope}
                      type="button"
                      className={`wb-preset-chip ${guideSlope === slope ? 'active' : ''}`}
                      onClick={() => setGuideSlope(slope)}
                    >
                      {slope === 'beam' ? 'Beam (E¹/²/ρ)' : slope === 'tie' ? 'Tie (E/ρ)' : 'Plate (E¹/³/ρ)'}
                    </button>
                  ))}
                </div>

                <div className="wb-data-cards">
                  <div className="wb-card">
                    <span className="wb-card-label">Active Criterion</span>
                    <span className="wb-card-value font-mono">
                      {guideSlope === 'beam' ? 'Minimum mass beam in bending' : guideSlope === 'tie' ? 'Minimum mass tie in tension' : 'Minimum mass panel in bending'}
                    </span>
                  </div>
                  <div className="wb-card">
                    <span className="wb-card-label">Top Contenders</span>
                    <span className="wb-card-value font-mono">
                      {ashbyCat === 'polymers' ? 'CFRP, High-density Polyethylene' : 'Balsa, CFRP, Silicon Carbide, Ti-6Al-4V'}
                    </span>
                  </div>
                </div>

                <div className="wb-link-row">
                  <a className="ld-link" href="#/selection">
                    Open material selection module with 54 materials
                    <span className="ld-arrow" aria-hidden="true">→</span>
                  </a>
                </div>
              </div>

              <div className="workbench-canvas-col">
                <svg viewBox="0 0 520 340" className="wb-svg-chart" aria-label="Ashby Chart scatter plot">
                  <rect width="520" height="340" fill="#14151b" rx="8" />
                  
                  {/* Grid Lines */}
                  {[60, 120, 180, 240, 300].map((y) => (
                    <line key={y} x1="50" y1={y} x2="490" y2={y} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
                  ))}
                  {[120, 200, 280, 360, 440].map((x) => (
                    <line key={x} x1={x} y1="30" x2={x} y2="300" stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
                  ))}

                  {/* Axes */}
                  <line x1="50" y1="300" x2="490" y2="300" stroke="#475569" strokeWidth="1.5" />
                  <line x1="50" y1="30" x2="50" y2="300" stroke="#475569" strokeWidth="1.5" />
                  <text x="270" y="325" fill="#94a3b8" fontSize="11" textAnchor="middle" fontFamily="monospace">Density ρ (Mg/m³)</text>
                  <text x="20" y="165" fill="#94a3b8" fontSize="11" textAnchor="middle" transform="rotate(-90 20 165)" fontFamily="monospace">Young's Modulus E (GPa)</text>

                  {/* Guide line */}
                  <line
                    x1={guideSlope === 'tie' ? 80 : guideSlope === 'beam' ? 70 : 60}
                    y1={guideSlope === 'tie' ? 260 : guideSlope === 'beam' ? 240 : 210}
                    x2={guideSlope === 'tie' ? 470 : guideSlope === 'beam' ? 470 : 470}
                    y2={guideSlope === 'tie' ? 50 : guideSlope === 'beam' ? 90 : 120}
                    stroke="#f43f5e"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />

                  {/* Clusters */}
                  <g style={{ opacity: ashbyCat === 'all' || ashbyCat === 'metals' ? 1 : 0.15, transition: 'opacity 0.2s' }}>
                    <circle cx="380" cy="90" r="14" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" />
                    <text x="380" y="93" fill="#e0f2fe" fontSize="9" textAnchor="middle">Steels</text>
                    <circle cx="310" cy="140" r="12" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" />
                    <text x="310" y="143" fill="#e0f2fe" fontSize="9" textAnchor="middle">Ti Alloys</text>
                    <circle cx="230" cy="180" r="13" fill="#38bdf8" fillOpacity="0.3" stroke="#38bdf8" />
                    <text x="230" y="183" fill="#e0f2fe" fontSize="9" textAnchor="middle">Al Alloys</text>
                  </g>

                  <g style={{ opacity: ashbyCat === 'all' || ashbyCat === 'ceramics' ? 1 : 0.15, transition: 'opacity 0.2s' }}>
                    <circle cx="260" cy="70" r="15" fill="#10b981" fillOpacity="0.3" stroke="#10b981" />
                    <text x="260" y="73" fill="#d1fae5" fontSize="9" textAnchor="middle">Alumina/SiC</text>
                    <circle cx="210" cy="110" r="12" fill="#10b981" fillOpacity="0.3" stroke="#10b981" />
                    <text x="210" y="113" fill="#d1fae5" fontSize="9" textAnchor="middle">Glasses</text>
                  </g>

                  <g style={{ opacity: ashbyCat === 'all' || ashbyCat === 'composites' ? 1 : 0.15, transition: 'opacity 0.2s' }}>
                    <circle cx="180" cy="130" r="16" fill="#f59e0b" fillOpacity="0.3" stroke="#f59e0b" />
                    <text x="180" y="133" fill="#fef3c7" fontSize="9" textAnchor="middle">CFRP</text>
                    <circle cx="190" cy="170" r="13" fill="#f59e0b" fillOpacity="0.3" stroke="#f59e0b" />
                    <text x="190" y="173" fill="#fef3c7" fontSize="9" textAnchor="middle">GFRP</text>
                  </g>

                  <g style={{ opacity: ashbyCat === 'all' || ashbyCat === 'polymers' ? 1 : 0.15, transition: 'opacity 0.2s' }}>
                    <circle cx="120" cy="240" r="16" fill="#ec4899" fillOpacity="0.3" stroke="#ec4899" />
                    <text x="120" y="243" fill="#fce7f3" fontSize="9" textAnchor="middle">Polymers</text>
                    <circle cx="140" cy="270" r="12" fill="#ec4899" fillOpacity="0.3" stroke="#ec4899" />
                    <text x="140" y="273" fill="#fce7f3" fontSize="9" textAnchor="middle">Elastomers</text>
                  </g>
                </svg>
                <p className="wb-caption">Log–log Ashby scatter plot with moving performance boundary line.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Semiconductor Optics */}
        {activeTab === 'semi' && (
          <div className="workbench-panel" role="tabpanel">
            <div className="workbench-grid">
              <div className="workbench-controls-col">
                <h3 className="wb-title">Semiconductor Optical Emission & Bandgap</h3>
                <p className="wb-desc">
                  Explore direct and indirect band gaps across key semiconductor materials and calculate their characteristic emission / absorption wavelength: λ = <em>hc</em> / <em>E</em><sub>g</sub> = 1239.8 / <em>E</em><sub>g</sub>.
                </p>

                <div className="wb-semi-grid">
                  {SEMICONDUCTORS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`wb-semi-card ${activeSemi.id === s.id ? 'active' : ''}`}
                      onClick={() => setActiveSemi(s)}
                    >
                      <div className="wb-semi-name">{s.name}</div>
                      <div className="wb-semi-stat font-mono">
                        <em>E</em><sub>g</sub> = {s.eg} eV · λ = {(1239.8 / s.eg).toFixed(0)} nm
                      </div>
                    </button>
                  ))}
                </div>

                <div className="wb-data-cards">
                  <div className="wb-card">
                    <span className="wb-card-label">Bandgap Energy</span>
                    <span className="wb-card-value font-mono">{activeSemi.eg} eV</span>
                  </div>
                  <div className="wb-card">
                    <span className="wb-card-label">Wavelength</span>
                    <span className="wb-card-value font-mono">{semiWavelength} nm</span>
                  </div>
                </div>

                <div className="wb-link-row">
                  <a className="ld-link" href="#/semiconductors">
                    Open full semiconductors & carrier statistics module
                    <span className="ld-arrow" aria-hidden="true">→</span>
                  </a>
                </div>
              </div>

              <div className="workbench-canvas-col">
                {/* Bandgap Schematic */}
                <div className="wb-semi-schematic">
                  <div className="band band-cb">
                    <span>Conduction Band (<em>E</em><sub>c</sub>)</span>
                  </div>
                  <div className="band-gap-space">
                    <div className="band-arrow">
                      <span>ΔE = {activeSemi.eg} eV</span>
                    </div>
                    <div
                      className="emission-glow"
                      style={{
                        backgroundColor: activeSemi.color,
                        boxShadow: `0 0 35px ${activeSemi.color}`,
                      }}
                    />
                  </div>
                  <div className="band band-vb">
                    <span>Valence Band (<em>E</em><sub>v</sub>)</span>
                  </div>
                </div>

                {/* Visible Spectrum Rainbow Bar */}
                <div className="wb-spectrum-wrap">
                  <div className="wb-spectrum-labels">
                    <span>380 nm (UV)</span>
                    <span>Visible Spectrum</span>
                    <span>750 nm (IR)</span>
                  </div>
                  <div className="wb-spectrum-bar">
                    <div
                      className="wb-spectrum-marker"
                      style={{
                        left: `${spectrumPct}%`,
                        borderColor: activeSemi.color,
                      }}
                      title={`${semiWavelength} nm`}
                    />
                  </div>
                </div>

                <p className="wb-caption">
                  {activeSemi.name}: {activeSemi.desc}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
