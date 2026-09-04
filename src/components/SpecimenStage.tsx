import { useEffect, useRef, useState } from 'react';

export interface LatticeInfo {
  name: string;
  a: number;
  apf: string;
  n: number;
  caption: string;
  atoms: number[][];
  bonds: [number, number][];
  atomColor: string;
  centerColor?: string;
  faceColor?: string;
}

const LATTICE_DATA: Record<string, LatticeInfo> = {
  fcc: {
    name: 'Copper (Cu) — Face-Centred Cubic',
    a: 0.3615,
    apf: '0.74 (FCC Max)',
    n: 4,
    caption:
      'Figure 1. Face-Centred Cubic (FCC) lattice of Copper (Cu). Twelve nearest neighbours at distance a/√2 = 0.2556 nm. Theoretical density: 8.94 g/cm³.',
    atoms: [
      [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1],
      [0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0],
    ],
    bonds: [
      [0, 1], [1, 3], [3, 2], [2, 0],
      [4, 5], [5, 7], [7, 6], [6, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ],
    atomColor: '#38bdf8',
  },
  bcc: {
    name: 'Iron (α-Fe) — Body-Centred Cubic',
    a: 0.2866,
    apf: '0.68',
    n: 2,
    caption:
      'Figure 1. Body-Centred Cubic (BCC) lattice of α-Iron (Fe). Eight nearest neighbours touching along the body diagonals ⟨111⟩. Theoretical density: 7.87 g/cm³.',
    atoms: [
      [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1],
      [0, 0, 0],
    ],
    bonds: [
      [0, 1], [1, 3], [3, 2], [2, 0],
      [4, 5], [5, 7], [7, 6], [6, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ],
    atomColor: '#38bdf8',
    centerColor: '#f59e0b',
  },
  dia: {
    name: 'Silicon (Si) — Diamond Cubic',
    a: 0.5431,
    apf: '0.34 (Open Covalent)',
    n: 8,
    caption:
      'Figure 1. Diamond Cubic lattice of Silicon (Si). Each atom tetrahedrally coordinated with four sp³ covalent bonds. Open structure with 0.34 packing fraction.',
    atoms: [
      [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1],
      [0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0],
      [-0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, -0.5, 0.5],
    ],
    bonds: [
      [0, 1], [1, 3], [3, 2], [2, 0],
      [4, 5], [5, 7], [7, 6], [6, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ],
    atomColor: '#10b981',
  },
  per: {
    name: 'Barium Titanate (BaTiO₃) — Perovskite',
    a: 0.3905,
    apf: 'Perovskite ABO₃',
    n: 5,
    caption:
      'Figure 1. Perovskite ABO₃ lattice of Barium Titanate. Ba²⁺ cations at unit cell corners, O²⁻ anions at face centres, and Ti⁴⁺ cation at the central octahedral site.',
    atoms: [
      [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1],
      [0, 0, 0],
      [0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0],
    ],
    bonds: [
      [0, 1], [1, 3], [3, 2], [2, 0],
      [4, 5], [5, 7], [7, 6], [6, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ],
    atomColor: '#22c55e',
    centerColor: '#38bdf8',
    faceColor: '#ef4444',
  },
};

export function SpecimenStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [latticeType, setLatticeType] = useState<'fcc' | 'bcc' | 'dia' | 'per'>('fcc');
  const [stageMode, setStageMode] = useState<'ball-stick' | 'space-fill' | 'wireframe'>('ball-stick');
  const [stagePlane, setStagePlane] = useState<'none' | '111' | '110' | '100'>('none');
  const [autoRotate, setAutoRotate] = useState(true);

  const rotXRef = useRef(0.45);
  const rotYRef = useRef(0.65);
  const zoomRef = useRef(1.0);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const isVisibleRef = useRef(true);

  // Keep state accessible to animation loop
  const stateRef = useRef({
    latticeType,
    stageMode,
    stagePlane,
    autoRotate,
  });

  useEffect(() => {
    stateRef.current = { latticeType, stageMode, stagePlane, autoRotate };
  }, [latticeType, stageMode, stagePlane, autoRotate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function project(x: number, y: number, z: number, scale = 110) {
      const rotY = rotYRef.current;
      const rotX = rotXRef.current;
      const zoom = zoomRef.current;
      const x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
      const z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);
      const y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
      const z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);
      const fov = 400;
      const p = fov / (fov + z2 * 80);
      return {
        x: (canvas?.width ?? 600) / 2 + x1 * scale * p * zoom,
        y: (canvas?.height ?? 420) / 2 + y2 * scale * p * zoom,
        z: z2,
      };
    }

    function renderStage() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { latticeType: lat, stageMode: mode, stagePlane: plane } = stateRef.current;
      const data = LATTICE_DATA[lat];

      // Draw slicing plane if selected
      if (plane !== 'none') {
        ctx.save();
        ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
        ctx.lineWidth = 2;
        let pts: { x: number; y: number; z: number }[] = [];
        if (plane === '111') {
          pts = [project(1, -1, -1), project(-1, 1, -1), project(-1, -1, 1)];
        } else if (plane === '110') {
          pts = [project(-1, -1, -1), project(1, 1, -1), project(1, 1, 1), project(-1, -1, 1)];
        } else if (plane === '100') {
          pts = [project(0, -1, -1), project(0, 1, -1), project(0, 1, 1), project(0, -1, 1)];
        }
        if (pts.length > 0) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw bonds
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = mode === 'wireframe' ? 2 : 1.5;
      data.bonds.forEach(([i, j]) => {
        const p1 = project(data.atoms[i][0], data.atoms[i][1], data.atoms[i][2]);
        const p2 = project(data.atoms[j][0], data.atoms[j][1], data.atoms[j][2]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // Draw atoms
      if (mode !== 'wireframe') {
        const baseR = mode === 'space-fill' ? (lat === 'fcc' ? 44 : 38) : 10;
        const sortedAtoms = data.atoms
          .map((pos, idx) => ({ ...project(pos[0], pos[1], pos[2]), idx }))
          .sort((a, b) => a.z - b.z);

        sortedAtoms.forEach((p) => {
          let color = data.atomColor;
          if (lat === 'bcc' && p.idx === 8 && data.centerColor) color = data.centerColor;
          if (lat === 'per' && p.idx === 8 && data.centerColor) color = data.centerColor;
          if (lat === 'per' && p.idx > 8 && data.faceColor) color = data.faceColor;

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(3, baseR * zoomRef.current), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }
    }

    let animId: number;
    function animate() {
      if (stateRef.current.autoRotate && isVisibleRef.current) {
        rotYRef.current += 0.007;
        renderStage();
      }
      animId = requestAnimationFrame(animate);
    }
    renderStage();
    animId = requestAnimationFrame(animate);

    // Freeze animation when off-screen
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            isVisibleRef.current = e.isIntersecting;
            if (e.isIntersecting) renderStage();
          });
        },
        { threshold: 0.05 },
      );
      observer.observe(containerRef.current);
    }

    // Drag and wheel interaction
    function onMouseDown(e: MouseEvent) {
      isDraggingRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    }
    function onMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return;
      rotYRef.current += (e.clientX - lastPosRef.current.x) * 0.01;
      rotXRef.current += (e.clientY - lastPosRef.current.y) * 0.01;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      renderStage();
    }
    function onMouseUp() {
      isDraggingRef.current = false;
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomRef.current = Math.max(0.6, Math.min(2.0, zoomRef.current - e.deltaY * 0.001));
      renderStage();
    }

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      if (observer) observer.disconnect();
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  const activeData = LATTICE_DATA[latticeType];

  return (
    <div ref={containerRef} className="specimen-stage-container">
      <div className="specimen-stage-card">
        <div className="specimen-stage-header">
          <div className="specimen-stage-tabs">
            {(['fcc', 'bcc', 'dia', 'per'] as const).map((id) => (
              <button
                key={id}
                type="button"
                className={`specimen-tab-btn ${latticeType === id ? 'active' : ''}`}
                onClick={() => setLatticeType(id)}
              >
                {id.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="specimen-stage-controls">
            <select
              value={stageMode}
              onChange={(e) => setStageMode(e.target.value as any)}
              className="specimen-select"
              aria-label="Lattice rendering mode"
            >
              <option value="ball-stick">Ball & Stick</option>
              <option value="space-fill">Space-Filling</option>
              <option value="wireframe">Wireframe</option>
            </select>
            <select
              value={stagePlane}
              onChange={(e) => setStagePlane(e.target.value as any)}
              className="specimen-select"
              aria-label="Lattice plane slice"
            >
              <option value="none">Slice: None</option>
              <option value="111">(111) Plane</option>
              <option value="110">(110) Plane</option>
              <option value="100">(100) Plane</option>
            </select>
            <button
              type="button"
              className="specimen-rotate-btn"
              onClick={() => setAutoRotate(!autoRotate)}
              aria-label="Toggle auto-rotation"
            >
              <span className={`rotate-dot ${autoRotate ? 'on' : 'off'}`} />
              {autoRotate ? 'Rotating' : 'Paused'}
            </button>
          </div>
        </div>

        <div className="specimen-stage-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={600}
            height={380}
            className="specimen-canvas"
            title="Drag to rotate, scroll to zoom"
          />
          <div className="specimen-stage-overlay">
            <span className="specimen-overlay-tag">{activeData.name}</span>
            <div className="specimen-overlay-readout">
              <span><em>a</em> = {activeData.a} nm</span>
              <span>APF = {activeData.apf}</span>
              <span><em>n</em> = {activeData.n} atoms</span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="specimen-caption">
        <span className="ld-fig-n">Fig. 1</span>
        {activeData.caption}
      </figcaption>
    </div>
  );
}
