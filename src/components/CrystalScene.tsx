import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { StructureDef } from '../crystal/structures';
import { buildAtoms, buildBonds, buildCellEdges, coordinationShell, distance } from '../crystal/geometry';
import { applyDefect, type DefectKind } from '../crystal/defects';
import { interstitialSites, type InterstitialKind } from '../crystal/interstitial';

export type ViewMode = 'ball' | 'fill';

interface Props {
  structure: StructureDef;
  mode: ViewMode;
  showCell: boolean;
  showBonds: boolean;
  showCoordination: boolean;
  defect?: DefectKind;
  /**
   * Whether the cell turns on its own. A prop, not a literal: auto-updating
   * motion has to be stoppable (WCAG 2.2.2), and both views that render this
   * scene now own a checkbox for it.
   */
  autoRotate: boolean;
  /** Draw the interstitial holes as wireframe spheres sized to what fits. */
  showVoids: boolean;
}

/**
 * One colour per hole shape. Wireframe throughout: these are absences, and a
 * solid sphere would read as another atom.
 */
const VOID_COLOR: Record<InterstitialKind, string> = {
  octahedral: '#4a3aa7',
  tetrahedral: '#1baf7a',
  cubic: '#eda100',
};

export function CrystalScene({
  structure,
  mode,
  showCell,
  showBonds,
  showCoordination,
  defect,
  autoRotate,
  showVoids,
}: Props) {
  return (
    <div className="canvas-wrap">
      {/* preserveDrawingBuffer keeps the frame readable after present, so the
          view can be screenshotted (and verified) rather than coming out blank. */}
      <Canvas
        camera={{ position: [2.4, 1.8, 2.4], fov: 42 }}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 6, 3]} intensity={1.5} />
        <directionalLight position={[-3, -2, -4]} intensity={0.4} />
        <Cell
          structure={structure}
          mode={mode}
          showCell={showCell}
          showBonds={showBonds}
          showCoordination={showCoordination}
          defect={defect}
          showVoids={showVoids}
        />
        <OrbitControls
          enablePan={false}
          minDistance={1.6}
          maxDistance={7}
          autoRotate={autoRotate}
          autoRotateSpeed={0.6}
        />
      </Canvas>
    </div>
  );
}

function Cell({
  structure,
  mode,
  showCell,
  showBonds,
  showCoordination,
  defect,
  showVoids,
}: Omit<Props, 'autoRotate'>) {
  const defectResult = useMemo(
    () => (defect && defect !== 'none' ? applyDefect(structure, defect) : null),
    [structure, defect],
  );
  const atoms = useMemo(
    () => defectResult?.atoms ?? buildAtoms(structure),
    [structure, defectResult],
  );
  const edges = useMemo(() => buildCellEdges(structure), [structure]);
  const bonds = useMemo(
    () => (showBonds ? buildBonds(atoms, structure.bondCutoff) : []),
    [atoms, structure, showBonds],
  );
  const shell = useMemo(
    () => (showCoordination ? coordinationShell(structure) : null),
    [structure, showCoordination],
  );

  const edgeGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(edges, 3));
    return g;
  }, [edges]);

  /**
   * Cells differ in span — the hexagonal prism reaches a=1 in the basal plane
   * where a cubic cell reaches 0.5 — so normalise to a common bounding radius
   * and the camera framing holds for every structure.
   */
  const scale = useMemo(() => {
    let maxR = 0;
    for (const a of atoms) {
      const sp = structure.species[a.species];
      const r = Math.hypot(...a.pos) + (mode === 'fill' ? sp.fillRadius : sp.ballRadius);
      if (r > maxR) maxR = r;
    }
    return maxR > 0 ? 1.05 / maxR : 1;
  }, [atoms, structure, mode]);

  return (
    <group scale={scale}>
      {showCell && (
        <lineSegments geometry={edgeGeom}>
          <lineBasicMaterial color="#898781" transparent opacity={0.6} />
        </lineSegments>
      )}

      {bonds.map(([a, b], i) => (
        <Bond key={i} from={a.pos} to={b.pos} />
      ))}

      {atoms.map((atom, i) => {
        const sp = structure.species[atom.species];
        const scale = 'radiusScale' in atom ? ((atom as { radiusScale?: number }).radiusScale ?? 1) : 1;
        const marked = 'defect' in atom ? (atom as { defect?: string }).defect : undefined;
        const r = (mode === 'fill' ? sp.fillRadius : sp.ballRadius) * scale;
        return (
          <mesh key={i} position={atom.pos}>
            <sphereGeometry args={[r, 32, 24]} />
            <meshStandardMaterial
              color={marked ? '#eb6834' : sp.color}
              roughness={0.35}
              metalness={0.1}
              emissive={marked ? '#eb6834' : '#000000'}
              emissiveIntensity={marked ? 0.28 : 0}
              transparent={mode === 'fill'}
              opacity={mode === 'fill' ? 0.92 : 1}
            />
          </mesh>
        );
      })}

      {/* The holes between the atoms, each drawn at the largest sphere that
          fits without pushing its hosts apart. `aOverR` is the host radius in
          cell units, so `ratio / aOverR` puts the void on the same scale as
          the space-filling atoms. */}
      {showVoids &&
        structure.aOverR != null &&
        (interstitialSites(structure) ?? []).map((set) => (
          <group key={set.kind}>
            {set.positions.map((p, i) => (
              <mesh key={i} position={[p[0] - 0.5, p[1] - 0.5, p[2] - 0.5]}>
                <sphereGeometry args={[set.radiusRatio / structure.aOverR!, 16, 12]} />
                <meshBasicMaterial color={VOID_COLOR[set.kind]} wireframe />
              </mesh>
            ))}
          </group>
        ))}

      {/* An empty site: dashed-looking wireframe so the absence reads as deliberate. */}
      {defectResult?.vacancySite && (
        <mesh position={defectResult.vacancySite}>
          <sphereGeometry args={[structure.species.M?.ballRadius ?? 0.13, 16, 12]} />
          <meshBasicMaterial color="#e34948" wireframe />
        </mesh>
      )}

      {shell && (
        <group>
          <mesh position={shell.centre}>
            <sphereGeometry args={[0.16, 32, 24]} />
            <meshStandardMaterial color="#eb6834" emissive="#eb6834" emissiveIntensity={0.35} />
          </mesh>
          {shell.neighbours.map((p, i) => (
            <group key={i}>
              <mesh position={p}>
                <sphereGeometry args={[0.11, 24, 18]} />
                <meshStandardMaterial color="#eda100" />
              </mesh>
              <Bond from={shell.centre} to={p} color="#eda100" radius={0.018} />
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

function Bond({
  from,
  to,
  color = '#898781',
  radius = 0.024,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  radius?: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(end, start);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    return { position: mid, quaternion: q, length: distance(from, to) };
  }, [from, to]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}
