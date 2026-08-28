import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { StructureDef } from '../crystal/structures';
import { buildAtoms, buildCellEdges } from '../crystal/geometry';
import { directionSegment, planePolygon, type Triple } from '../crystal/miller';
import { AXIS_COLORS, DIRECTION_COLOR, PLANE_COLOR } from '../color';

interface Props {
  structure: StructureDef;
  plane: Triple | null;
  direction: Triple | null;
  showAtoms: boolean;
  showIntercepts: boolean;
  autoRotate: boolean;
}

export function MillerScene(props: Props) {
  return (
    <div className="canvas-wrap">
      <Canvas
        camera={{ position: [2.1, 1.6, 2.1], fov: 42 }}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 6, 3]} intensity={1.4} />
        <directionalLight position={[-3, -2, -4]} intensity={0.4} />
        <Contents {...props} />
        <OrbitControls
          enablePan={false}
          minDistance={1.6}
          maxDistance={7}
          autoRotate={props.autoRotate}
          autoRotateSpeed={0.6}
        />
      </Canvas>
    </div>
  );
}

function Contents({ structure, plane, direction, showAtoms, showIntercepts }: Props) {
  const atoms = useMemo(() => buildAtoms(structure), [structure]);
  const edges = useMemo(() => buildCellEdges(structure), [structure]);

  const edgeGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(edges, 3));
    return g;
  }, [edges]);

  const poly = useMemo(() => (plane ? planePolygon(plane) : null), [plane]);
  const seg = useMemo(() => (direction ? directionSegment(direction) : null), [direction]);

  // The cell spans −0.5…0.5, so its half-diagonal is √3/2. Scale to a constant
  // framing radius and the camera holds still while indices change.
  const scale = 1.05 / (Math.sqrt(3) / 2);

  return (
    <group scale={scale}>
      <lineSegments geometry={edgeGeom}>
        <lineBasicMaterial color="#898781" transparent opacity={0.55} />
      </lineSegments>

      <AxisTriad />

      {showAtoms &&
        atoms.map((atom, i) => {
          const sp = structure.species[atom.species];
          return (
            <mesh key={i} position={atom.pos}>
              <sphereGeometry args={[sp.ballRadius * 0.75, 20, 16]} />
              <meshStandardMaterial
                color={sp.color}
                roughness={0.4}
                metalness={0.1}
                transparent
                opacity={0.85}
              />
            </mesh>
          );
        })}

      {poly && <PlanePatch vertices={poly.vertices} />}

      {/* Where the plane meets each axis — the reciprocals students compute by hand. */}
      {showIntercepts && poly && plane && <InterceptMarkers hkl={plane} n={poly.n} />}

      {seg && <DirectionArrow from={seg.from} to={seg.to} />}
    </group>
  );
}

/** Filled patch plus a bright rim, so the cross-section reads at any angle. */
function PlanePatch({ vertices }: { vertices: Triple[] }) {
  const { fill, outline } = useMemo(() => {
    const positions: number[] = [];
    // Triangle fan from the first vertex — the polygon is convex by construction.
    for (let i = 1; i < vertices.length - 1; i++) {
      positions.push(...vertices[0], ...vertices[i], ...vertices[i + 1]);
    }
    const f = new THREE.BufferGeometry();
    f.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    f.computeVertexNormals();

    const ring: number[] = [];
    for (let i = 0; i < vertices.length; i++) {
      ring.push(...vertices[i], ...vertices[(i + 1) % vertices.length]);
    }
    const o = new THREE.BufferGeometry();
    o.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3));

    return { fill: f, outline: o };
  }, [vertices]);

  // These are rebuilt on every keystroke in the index box, and a geometry passed
  // in by prop is not owned by the renderer — so release the GPU buffers here.
  useEffect(() => () => {
    fill.dispose();
    outline.dispose();
  }, [fill, outline]);

  return (
    <group>
      <mesh geometry={fill}>
        <meshStandardMaterial
          color={PLANE_COLOR}
          side={THREE.DoubleSide}
          transparent
          opacity={0.45}
          roughness={0.5}
          emissive={PLANE_COLOR}
          emissiveIntensity={0.15}
        />
      </mesh>
      <lineSegments geometry={outline}>
        <lineBasicMaterial color={PLANE_COLOR} linewidth={2} />
      </lineSegments>
    </group>
  );
}

/**
 * Small spheres on the axes at 1/h, 1/k, 1/l. A zero index has no marker,
 * which is the visual form of "the plane is parallel to that axis".
 */
function InterceptMarkers({ hkl, n }: { hkl: Triple; n: number }) {
  const marks = useMemo(() => {
    const out: { pos: Triple; color: string }[] = [];
    const keys: ('a' | 'b' | 'c')[] = ['a', 'b', 'c'];
    for (let i = 0; i < 3; i++) {
      if (hkl[i] === 0) continue;
      const f = n / hkl[i]; // fractional intercept on this axis
      if (f < -1e-9 || f > 1 + 1e-9) continue; // falls outside the drawn cell
      const pos: Triple = [-0.5, -0.5, -0.5];
      pos[i] = f - 0.5;
      out.push({ pos, color: AXIS_COLORS[keys[i]] });
    }
    return out;
  }, [hkl, n]);

  return (
    <group>
      {marks.map((m, i) => (
        <mesh key={i} position={m.pos}>
          <sphereGeometry args={[0.045, 20, 16]} />
          <meshStandardMaterial color={m.color} emissive={m.color} emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function AxisTriad() {
  const origin: Triple = [-0.5, -0.5, -0.5];
  const axes: { to: Triple; color: string }[] = [
    { to: [0.62, -0.5, -0.5], color: AXIS_COLORS.a },
    { to: [-0.5, 0.62, -0.5], color: AXIS_COLORS.b },
    { to: [-0.5, -0.5, 0.62], color: AXIS_COLORS.c },
  ];
  return (
    <group>
      {axes.map((ax, i) => (
        <Shaft key={i} from={origin} to={ax.to} color={ax.color} radius={0.012} head={0.045} />
      ))}
    </group>
  );
}

function DirectionArrow({ from, to }: { from: Triple; to: Triple }) {
  return <Shaft from={from} to={to} color={DIRECTION_COLOR} radius={0.022} head={0.075} />;
}

/** A cylinder with a cone on the end, oriented from `from` towards `to`. */
function Shaft({
  from,
  to,
  color,
  radius,
  head,
}: {
  from: Triple;
  to: Triple;
  color: string;
  radius: number;
  head: number;
}) {
  const { mid, quaternion, length, tip } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    // Stop the shaft short so the cone occupies the last stretch.
    const shaft = Math.max(len - head, 0.001);
    const m = start.clone().add(dir.clone().normalize().multiplyScalar(shaft / 2));
    const t = start.clone().add(dir.clone().normalize().multiplyScalar(shaft + head / 2));
    return { mid: m, quaternion: q, length: shaft, tip: t };
  }, [from, to, head]);

  return (
    <group>
      <mesh position={mid} quaternion={quaternion}>
        <cylinderGeometry args={[radius, radius, length, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={tip} quaternion={quaternion}>
        <coneGeometry args={[radius * 2.4, head, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}
