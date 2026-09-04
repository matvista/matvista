import { useState } from 'react';

export interface ModuleData {
  id: string;
  pillar: 'structure' | 'microstructure' | 'properties' | 'analysis';
  pillarLabel: string;
  title: string;
  eq: string;
  href: string;
  detail: string;
}

export const ALL_MODULES: ModuleData[] = [
  {
    id: 'trends',
    pillar: 'structure',
    pillarLabel: 'Structure',
    title: 'Periodic trends',
    eq: 'Z_eff = Z - S  (Slater Screening)',
    href: '#/trends?el=W&prop=melt',
    detail:
      'Colour the whole table by electronegativity, ionisation energy, melting point or density, and read the trend across a period or down a group. Elements with no measured value for a property are shown as having none.',
  },
  {
    id: 'crystals',
    pillar: 'structure',
    pillarLabel: 'Structure',
    title: 'Crystal structures',
    eq: 'ρ = (n · A) / (V_c · N_A)',
    href: '#/crystals',
    detail:
      'Eight structures from simple cubic to perovskite, in ball-and-stick or space-filling, with a density calculator that lands within a fraction of a percent for the cubic metals — and shows you where the ideal-c/a assumption breaks down for HCP.',
  },
  {
    id: 'miller',
    pillar: 'structure',
    pillarLabel: 'Structure',
    title: 'Miller indices',
    eq: 'd_hkl = a / √(h² + k² + l²),  τ = σ cos φ cos λ',
    href: '#/miller?plane=111',
    detail:
      'Type any (hkl) and watch the plane cut the cell, with intercepts, d-spacing, family members and a Schmid-factor ranking across all 12 FCC or 48 BCC slip systems.',
  },
  {
    id: 'polymers',
    pillar: 'structure',
    pillarLabel: 'Structure',
    title: 'Polymers',
    eq: 'r_rms = l √N,  Đ = M_w / M_n = 1 + p',
    href: '#/polymers',
    detail:
      'Run a polymerisation and watch the distribution it produces — two histograms of one sample, counted by number and by weight, with the two averages they disagree about. Then the degree of polymerisation becomes a chain: 252 nm of polyethylene folded into a coil 7 nm across.',
  },
  {
    id: 'defects',
    pillar: 'microstructure',
    pillarLabel: 'Microstructure',
    title: 'Defects & diffusion',
    eq: '(C_x - C_0) / (C_s - C_0) = 1 - erf(x / (2√Dt))',
    href: '#/defects',
    detail:
      'Put a point defect into a lattice, compute the equilibrium vacancy fraction, and solve Fick’s second law for a carburising profile.',
  },
  {
    id: 'phase',
    pillar: 'microstructure',
    pillarLabel: 'Microstructure',
    title: 'Phase diagrams',
    eq: 'P + F = C + N  (Gibbs Phase Rule)',
    href: '#/phase?T=650&sys=fe-c&x=0.4',
    detail:
      'Click anywhere on Cu–Ni, Pb–Sn or Fe–Fe₃C and get the phases present, the tie line, lever-rule mass fractions and the microstructure that results.',
  },
  {
    id: 'heattreat',
    pillar: 'microstructure',
    pillarLabel: 'Microstructure',
    title: 'Heat treatment',
    eq: '∫ (dt / τ(T)) = 1  (Scheil Additivity)',
    href: '#/heattreat?rate=1200&steel=4340',
    detail:
      'Drag a cooling rate across an isothermal diagram and see the products it produces, read by Scheil additivity, with a Jominy end-quench comparison across three grades.',
  },
  {
    id: 'mechanical',
    pillar: 'properties',
    pillarLabel: 'Properties',
    title: 'Mechanical properties',
    eq: 'σ_y = σ_0 + k_y d^(-1/2)  (Hall–Petch)',
    href: '#/mechanical',
    detail:
      'Engineering curves for seven metals with the 0.2% offset construction, resilience and toughness areas, a true-stress overlay, and grain-size strengthening.',
  },
  {
    id: 'failure',
    pillar: 'properties',
    pillarLabel: 'Properties',
    title: 'Failure analysis',
    eq: 'K_1c = Y σ √(π a_c),  da/dN = C (ΔK)^m  (Paris)',
    href: '#/failure?geom=vessel&p=12',
    detail:
      'Find the critical crack size for a real alloy, read an S–N curve that only flattens for the alloys that actually have a fatigue limit, grow a crack by Paris’ law, and trade temperature against time with Larson–Miller.',
  },
  {
    id: 'composites',
    pillar: 'properties',
    pillarLabel: 'Properties',
    title: 'Composites',
    eq: 'E_c = V_f E_f + (1 - V_f) E_m  (Voigt Isostrain)',
    href: '#/composites',
    detail:
      'Specify a laminate — fibre, matrix, volume fraction — and get the two bounds on its modulus, the load the fibres actually carry, and a specific stiffness ranked against the 54 materials on the Ashby chart.',
  },
  {
    id: 'thermal',
    pillar: 'properties',
    pillarLabel: 'Properties',
    title: 'Thermal properties',
    eq: 'σ_th = -E α ΔT,  k / (σ T) = L  (Wiedemann–Franz)',
    href: '#/thermal',
    detail:
      'Constrain a bar, change its temperature, and read the stress it cannot relieve — then hand that stress to the failure module and get the flaw size it makes critical. Dulong’s rule is drawn over the app’s own atomic masses.',
  },
  {
    id: 'semiconductors',
    pillar: 'properties',
    pillarLabel: 'Properties',
    title: 'Semiconductors',
    eq: 'λ = hc / E_g = 1239.8 / E_g,  n_i = √(N_c N_v) e^(-E_g / (2 k_B T))',
    href: '#/semiconductors',
    detail:
      'Compare band gaps against the visible spectrum, dope a crystal and watch conductivity cross from extrinsic to intrinsic as it heats, then bend the bands across a junction and read off the built-in potential.',
  },
  {
    id: 'selection',
    pillar: 'analysis',
    pillarLabel: 'Analysis',
    title: 'Material selection',
    eq: 'M = E^(1/2) / ρ  (Beam in Bending)',
    href: '#/selection',
    detail:
      'A log–log chart of 54 materials with movable guide lines for E/ρ, E^½/ρ, E^⅓/ρ, σ/ρ and σ^⅔/ρ, ranking candidates live as you move the line.',
  },
  {
    id: 'corrosion',
    pillar: 'analysis',
    pillarLabel: 'Analysis',
    title: 'Corrosion',
    eq: 'CPR = (K · i_corr · M) / (n · ρ),  E = E° - (0.0592 / n) log Q',
    href: '#/corrosion',
    detail:
      'Pair any two alloys and see which one corrodes, how hard the couple is driven, and why a small anode beside a large cathode is the dangerous arrangement — then read the pH–potential map.',
  },
  {
    id: 'xrd',
    pillar: 'analysis',
    pillarLabel: 'Analysis',
    title: 'XRD simulator',
    eq: 'λ = 2 d_hkl sin θ,  sin θ ≤ 1',
    href: '#/xrd?sample=cu&source=cu',
    detail:
      'Generate a diffraction pattern for four lattice types across four X-ray sources, with every peak indexed and the extinction rules shown working.',
  },
];

export function ModulesDirectory() {
  const [pillarFilter, setPillarFilter] = useState<'all' | 'structure' | 'microstructure' | 'properties' | 'analysis'>('all');
  const [selectedModule, setSelectedModule] = useState<ModuleData | null>(null);

  // Mini-simulator interactive parameters
  const [polyP, setPolyP] = useState(0.95);
  const [diffT, setDiffT] = useState(4);
  const [phaseC, setPhaseC] = useState(0.40);
  const [heatRate, setHeatRate] = useState(1200);
  const [failSigma, setFailSigma] = useState(250);
  const [thermDt, setThermDt] = useState(120);
  const [compVf, setCompVf] = useState(0.50);
  const [crysLat, setCrysLat] = useState('fcc');
  const [semiAlloy, setSemiAlloy] = useState('gaas');
  const [selectionObj, setSelectionObj] = useState('beam');
  const [corrosionCouple, setCorrosionCouple] = useState('zn-fe');

  const filtered = pillarFilter === 'all' ? ALL_MODULES : ALL_MODULES.filter((m) => m.pillar === pillarFilter);

  function renderSimulator(id: string) {
    switch (id) {
      case 'trends':
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Target Refractory Element:</span>
              <span className="text-ok font-bold">Tungsten (W, Z=74, Period 6)</span>
            </div>
            <div className="mod-sim-readout">
              <div>Melting Point: <strong className="text-amber">3,422 °C (Refractory Peak)</strong></div>
              <div>Electronegativity: <strong>2.36 Pauling</strong> · Density: <strong>19.25 g/cm³</strong></div>
              <div className="text-muted text-xs">Filled 5d-half shell promotes maximum covalent cohesive binding.</div>
            </div>
          </div>
        );
      case 'crystals':
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Structure Lattice:</span>
              <select value={crysLat} onChange={(e) => setCrysLat(e.target.value)} className="mod-sim-select">
                <option value="fcc">FCC (Copper, a = 0.3615 nm)</option>
                <option value="bcc">BCC (α-Iron, a = 0.2866 nm)</option>
                <option value="dia">Diamond Cubic (Silicon, a = 0.5431 nm)</option>
                <option value="sc">Simple Cubic (Polonium, a = 0.3359 nm)</option>
              </select>
            </div>
            <div className="mod-sim-readout">
              <div>Atoms per unit cell (<em>n</em>): <strong className="text-sky">{crysLat === 'fcc' ? '4' : crysLat === 'bcc' ? '2' : crysLat === 'dia' ? '8' : '1'} atoms</strong></div>
              <div>Atomic Packing Fraction: <strong className="text-amber">{crysLat === 'fcc' ? '0.74 (Close-packed)' : crysLat === 'bcc' ? '0.68' : crysLat === 'dia' ? '0.34' : '0.52'}</strong></div>
              <div>Coordination Number: <strong className="text-ok">{crysLat === 'fcc' ? '12' : crysLat === 'bcc' ? '8' : crysLat === 'dia' ? '4' : '6'}</strong></div>
            </div>
          </div>
        );
      case 'miller':
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Standard FCC Copper Plane:</span>
              <span className="text-sky font-bold">(111) Close-Packed Plane</span>
            </div>
            <div className="mod-sim-readout">
              <div>Interplanar d-spacing: <strong className="text-sky">d₁₁₁ = 0.2087 nm</strong></div>
              <div>FCC Selection Rule: <strong className="text-ok">ALLOWED (All-odd reflection)</strong></div>
              <div>Max Schmid Factor: <strong className="text-amber">m = 0.50 on {'{111}⟨110⟩'}</strong></div>
            </div>
          </div>
        );
      case 'polymers': {
        const xn = Math.round(1 / (1 - polyP));
        const pdi = (1 + polyP).toFixed(2);
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Extent of Conversion <em>p</em>:</span>
              <strong className="text-sky font-mono">{polyP.toFixed(3)}</strong>
            </div>
            <input type="range" min={0.80} max={0.999} step={0.005} value={polyP} onChange={(e) => setPolyP(Number(e.target.value))} className="mod-sim-slider" />
            <div className="mod-sim-readout">
              <div>Number-Average DP (X_n = 1/(1-p)): <strong className="text-sky">{xn} repeat units</strong></div>
              <div>Polydispersity Index (Đ = 1+p): <strong className="text-amber">{pdi}</strong></div>
              <div>Polyethylene Coil RMS Size: <strong className="text-ok">{(polyP * 7.2).toFixed(1)} nm</strong></div>
            </div>
          </div>
        );
      }
      case 'defects': {
        const diffLength = (2 * Math.sqrt(1.7e-11 * diffT * 3600) * 1000).toFixed(2);
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Carburizing Time <em>t</em> (at 927 °C):</span>
              <strong className="text-amber font-mono">{diffT} hours</strong>
            </div>
            <input type="range" min={1} max={16} step={1} value={diffT} onChange={(e) => setDiffT(Number(e.target.value))} className="mod-sim-slider" />
            <div className="mod-sim-readout">
              <div>Diffusion Penetration (2√Dt): <strong className="text-sky">{diffLength} mm</strong></div>
              <div>Effective Case Depth (0.4 wt% C): <strong className="text-ok">{(Number(diffLength) * 0.78).toFixed(2)} mm</strong></div>
            </div>
          </div>
        );
      }
      case 'phase': {
        const isHypo = phaseC < 0.76;
        const wPro = isHypo ? ((0.76 - phaseC) / (0.76 - 0.022)) * 100 : ((phaseC - 0.76) / (6.70 - 0.76)) * 100;
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Carbon Content (at 650 °C):</span>
              <strong className="text-sky font-mono">{phaseC.toFixed(2)} wt% C</strong>
            </div>
            <input type="range" min={0.10} max={1.40} step={0.05} value={phaseC} onChange={(e) => setPhaseC(Number(e.target.value))} className="mod-sim-slider" />
            <div className="mod-sim-readout">
              <div>Classification: <strong className="text-sky">{isHypo ? 'Hypoeutectoid Steel' : 'Hypereutectoid Steel'}</strong></div>
              <div>Proeutectoid {isHypo ? 'Ferrite (α)' : 'Cementite (Fe₃C)'}: <strong className="text-amber">{wPro.toFixed(1)} wt%</strong></div>
              <div>Eutectoid Pearlite: <strong className="text-ok">{(100 - wPro).toFixed(1)} wt%</strong></div>
            </div>
          </div>
        );
      }
      case 'heattreat':
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Cooling Rate:</span>
              <strong className="text-amber font-mono">{heatRate} °C/s</strong>
            </div>
            <input type="range" min={50} max={2000} step={50} value={heatRate} onChange={(e) => setHeatRate(Number(e.target.value))} className="mod-sim-slider" />
            <div className="mod-sim-readout">
              <div>AISI 4340 Microstructure: <strong className="text-ok">{heatRate >= 800 ? '100% Martensite' : heatRate >= 200 ? 'Bainite + Martensite' : 'Pearlite + Ferrite'}</strong></div>
              <div>As-Quenched Hardness: <strong className="text-amber">{heatRate >= 800 ? '58 HRC' : heatRate >= 200 ? '46 HRC' : '28 HRC'}</strong></div>
            </div>
          </div>
        );
      case 'mechanical':
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-readout">
              <div>AISI 1020 Normalized Steel: <strong className="text-sky">Yield σ_y = 220 MPa</strong></div>
              <div>Ultimate Tensile Strength (UTS): <strong className="text-amber">380 MPa</strong></div>
              <div>Ductility (Fracture Strain): <strong className="text-ok">25 % (High Toughness)</strong></div>
            </div>
          </div>
        );
      case 'failure': {
        const ac = (Math.pow(50 / (1.12 * failSigma), 2) * (1000 / Math.PI)).toFixed(1);
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Applied Tensile Stress σ:</span>
              <strong className="text-bad font-mono">{failSigma} MPa</strong>
            </div>
            <input type="range" min={100} max={600} step={25} value={failSigma} onChange={(e) => setFailSigma(Number(e.target.value))} className="mod-sim-slider" />
            <div className="mod-sim-readout">
              <div>4340 Steel Fracture Toughness: <strong className="text-sky">K_1c = 50 MPa√m</strong></div>
              <div>Critical Crack Size (a_c): <strong className="text-bad">{ac} mm</strong></div>
            </div>
          </div>
        );
      }
      case 'thermal': {
        const stress = (200e3 * 12e-6 * thermDt).toFixed(0);
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Constrained ΔT:</span>
              <strong className="text-amber font-mono">{thermDt} °C</strong>
            </div>
            <input type="range" min={20} max={400} step={10} value={thermDt} onChange={(e) => setThermDt(Number(e.target.value))} className="mod-sim-slider" />
            <div className="mod-sim-readout">
              <div>Thermal Shock Stress (σ = -E α ΔT): <strong className="text-bad">{stress} MPa (Compressive)</strong></div>
              <div>Wiedemann–Franz Lorenz Ratio: <strong className="text-sky">L = 2.44 × 10⁻⁸ W·Ω/K²</strong></div>
            </div>
          </div>
        );
      }
      case 'composites': {
        const eVoigt = (compVf * 230 + (1 - compVf) * 3.5).toFixed(1);
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Carbon Fiber Fraction V_f:</span>
              <strong className="text-sky font-mono">{(compVf * 100).toFixed(0)} %</strong>
            </div>
            <input type="range" min={0.10} max={0.70} step={0.05} value={compVf} onChange={(e) => setCompVf(Number(e.target.value))} className="mod-sim-slider" />
            <div className="mod-sim-readout">
              <div>Voigt Upper Bound (E_1): <strong className="text-sky">{eVoigt} GPa</strong></div>
              <div>Reuss Lower Bound (E_2): <strong className="text-amber">{(3.5 / (1 - compVf * 0.98)).toFixed(1)} GPa</strong></div>
              <div>Fiber Load Carry: <strong className="text-ok">{((compVf * 230 / Number(eVoigt)) * 100).toFixed(1)} %</strong></div>
            </div>
          </div>
        );
      }
      case 'semiconductors':
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Semiconductor:</span>
              <select value={semiAlloy} onChange={(e) => setSemiAlloy(e.target.value)} className="mod-sim-select">
                <option value="gaas">GaAs (Eg = 1.42 eV, Direct)</option>
                <option value="si">Silicon (Eg = 1.12 eV, Indirect)</option>
                <option value="gan">GaN (Eg = 3.44 eV, Blue LED)</option>
                <option value="insb">InSb (Eg = 0.17 eV, Infrared)</option>
              </select>
            </div>
            <div className="mod-sim-readout">
              <div>Bandgap Energy: <strong className="text-sky">{semiAlloy === 'gaas' ? '1.42 eV' : semiAlloy === 'si' ? '1.12 eV' : semiAlloy === 'gan' ? '3.44 eV' : '0.17 eV'}</strong></div>
              <div>Emission Wavelength λ: <strong className="text-amber">{semiAlloy === 'gaas' ? '873 nm (Near-IR)' : semiAlloy === 'si' ? '1,107 nm (Infrared)' : semiAlloy === 'gan' ? '360 nm (UV/Blue)' : '7,293 nm (Far-IR)'}</strong></div>
            </div>
          </div>
        );
      case 'selection':
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Design Metric:</span>
              <select value={selectionObj} onChange={(e) => setSelectionObj(e.target.value)} className="mod-sim-select">
                <option value="beam">Light Stiff Beam (E^(1/2) / ρ)</option>
                <option value="tie">Light Strong Tie (σ_y / ρ)</option>
                <option value="plate">Light Stiff Plate (E^(1/3) / ρ)</option>
              </select>
            </div>
            <div className="mod-sim-readout">
              <div>Top Material Candidate: <strong className="text-ok">CFRP (Carbon Fiber Epoxy, M = 5.2)</strong></div>
              <div>Second Ranked: <strong className="text-sky">Beryllium (M = 4.8)</strong></div>
              <div>Best Metal: <strong className="text-amber">Al 7075-T6 (M = 3.1) beats Steel (M = 1.9)</strong></div>
            </div>
          </div>
        );
      case 'corrosion':
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-row">
              <span className="mod-sim-label">Galvanic Couple:</span>
              <select value={corrosionCouple} onChange={(e) => setCorrosionCouple(e.target.value)} className="mod-sim-select">
                <option value="zn-fe">Zinc + Carbon Steel (Cathodic Protection)</option>
                <option value="cu-fe">Copper + Carbon Steel (Dangerous Couple)</option>
              </select>
            </div>
            <div className="mod-sim-readout">
              <div>Driving Potential ΔV: <strong className="text-sky">{corrosionCouple === 'zn-fe' ? '0.32 V' : '0.78 V'}</strong></div>
              <div>Sacrificial Anode: <strong className="text-bad">{corrosionCouple === 'zn-fe' ? 'Zinc (Dissolves safely)' : 'Carbon Steel (Corrodes rapidly!)'}</strong></div>
              <div>Protected Cathode: <strong className="text-ok">{corrosionCouple === 'zn-fe' ? 'Carbon Steel (Immune)' : 'Copper'}</strong></div>
            </div>
          </div>
        );
      case 'xrd':
        return (
          <div className="mod-sim-box">
            <div className="mod-sim-readout">
              <div>Copper Powder under Cu Kα (λ = 0.1542 nm):</div>
              <div>Peak (111) Bragg Angle: <strong className="text-ok">2θ = 43.32° (Allowed)</strong></div>
              <div>Peak (200) Bragg Angle: <strong className="text-sky">2θ = 50.43° (Allowed)</strong></div>
              <div>Peak (100) Reflection: <strong className="text-bad">EXTINCT (Structure Factor F=0)</strong></div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="ld-directory-sec">
      <div className="ld-directory-head">
        <div className="ld-directory-filters-wrapper">
          <div className="ld-directory-title-box">
            <h3 className="ld-directory-h3">Interactive Module Directory</h3>
            <p className="ld-directory-desc">
              Filter by curriculum pillar. Click any card to launch its live simulation sandbox or open in the app.
            </p>
          </div>

          {/* Pillar Filter Tabs */}
          <div className="ld-directory-filters" role="toolbar" aria-label="Filter modules by curriculum pillar">
            {[
              { id: 'all', label: 'All (15)' },
              { id: 'structure', label: 'Structure (4)' },
              { id: 'microstructure', label: 'Microstructure (3)' },
              { id: 'properties', label: 'Properties (5)' },
              { id: 'analysis', label: 'Analysis (3)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`filter-btn ${pillarFilter === tab.id ? 'active' : ''}`}
                onClick={() => setPillarFilter(tab.id as any)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 15 Modules Cards Grid */}
      <div className="ld-module-cards-grid">
        {filtered.map((m) => (
          <div
            key={m.id}
            className="ld-module-card"
            onClick={() => setSelectedModule(m)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedModule(m);
              }
            }}
          >
            <div className="ld-card-top">
              <div className="ld-card-badges">
                <span className="pillar-badge">{m.pillarLabel}</span>
                <span className="verified-badge">Test Verified ✓</span>
              </div>
              <h3 className="ld-card-title">{m.title}</h3>
              <p className="ld-card-detail">{m.detail}</p>
              <div className="ld-card-eq font-mono">{m.eq}</div>
            </div>

            <div className="ld-card-actions">
              <button
                type="button"
                className="btn-explore-sim"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedModule(m);
                }}
              >
                <span>Explore Simulator</span>
                <span>⚡</span>
              </button>
              <a
                href={m.href}
                className="btn-open-app"
                onClick={(e) => e.stopPropagation()}
              >
                <span>Open in App</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Module Inspector Modal */}
      {selectedModule && (
        <div
          className="ld-modal-backdrop"
          onClick={() => setSelectedModule(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-mod-title"
        >
          <div
            className="ld-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ld-modal-header">
              <div>
                <span className="pillar-badge">{selectedModule.pillarLabel}</span>
                <h3 id="modal-mod-title" className="ld-modal-title">{selectedModule.title}</h3>
              </div>
              <button
                type="button"
                className="ld-modal-close"
                onClick={() => setSelectedModule(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="ld-modal-body">
              <p className="ld-modal-desc">{selectedModule.detail}</p>

              <div className="ld-modal-eq-box">
                <span className="eq-box-label">Governing Physical Relation:</span>
                <div className="eq-box-formula font-mono">{selectedModule.eq}</div>
              </div>

              <div className="ld-modal-sim-section">
                <div className="sim-header">
                  <span>Live Interactive Simulator</span>
                  <span className="active-dot">● Active Telemetry</span>
                </div>
                {renderSimulator(selectedModule.id)}
              </div>

              <div className="ld-modal-footer">
                <code className="font-mono text-xs">{selectedModule.href}</code>
                <div className="ld-modal-buttons">
                  <button
                    type="button"
                    className="modal-btn-copy"
                    onClick={() => navigator.clipboard.writeText(window.location.origin + '/' + selectedModule.href)}
                  >
                    Copy Link
                  </button>
                  <a
                    href={selectedModule.href}
                    className="modal-btn-launch"
                    onClick={() => setSelectedModule(null)}
                  >
                    Launch Full Module ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
