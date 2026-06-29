/**
 * Connectors — the reference render's signature: royal-blue plastic pipe/elbow/T
 * fittings floating at depth (SoT §1.5 / §7.6). Cloned from the generated
 * connectors.glb and scattered sparsely, each slowly tumbling + bobbing. Their
 * glossy blue plastic catches the same HDRI speculars as the core, tying the field
 * to the hero asset.
 */

import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ASSET } from '../assets';
import type { QualityTier } from '../quality';

const COUNT_BY_TIER: Record<QualityTier, number> = { A: 6, B: 4, C: 2, D: 0 };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Drifter {
  object: THREE.Object3D;
  baseY: number;
  ph: number;
  spin: THREE.Vector3;
}

export function Connectors({ tier }: { tier: QualityTier }) {
  const { scene } = useGLTF(ASSET.connectors);
  const groupRef = useRef<THREE.Group>(null);

  const drifters = useMemo<Drifter[]>(() => {
    const count = COUNT_BY_TIER[tier];
    const rand = mulberry32(0xc0ffee);
    const sources = scene.children.filter((c) => (c as THREE.Mesh).isMesh);
    if (sources.length === 0) return [];
    const out: Drifter[] = [];
    for (let i = 0; i < count; i++) {
      const src = sources[i % sources.length].clone();
      src.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat && 'envMapIntensity' in mat) mat.envMapIntensity = 1.15;
          m.frustumCulled = false;
        }
      });
      const ang = rand() * Math.PI * 2;
      const rad = 2.5 + rand() * 2.8;
      const y = (rand() - 0.5) * 3.2;
      src.position.set(Math.cos(ang) * rad, y, -1.0 - rand() * 3.5);
      src.rotation.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
      src.scale.setScalar(0.8 + rand() * 0.7);
      out.push({
        object: src,
        baseY: y,
        ph: rand() * Math.PI * 2,
        spin: new THREE.Vector3((rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3),
      });
    }
    return out;
  }, [scene, tier]);

  useFrame((_, rawDelta) => {
    const g = groupRef.current;
    if (!g) return;
    const dt = Math.min(rawDelta, 0.05);
    const t = performance.now() / 1000;
    // Iterate the group's live children (ref-derived) and read per-item params
    // from the memoized array by index — children[i] is drifters[i].object.
    g.children.forEach((child, i) => {
      const d = drifters[i];
      if (!d) return;
      child.rotation.x += dt * d.spin.x;
      child.rotation.y += dt * d.spin.y;
      child.rotation.z += dt * d.spin.z;
      child.position.y = d.baseY + Math.sin(t * 0.4 + d.ph) * 0.18;
    });
  });

  return (
    <group ref={groupRef}>
      {drifters.map((d, i) => (
        <primitive key={i} object={d.object} />
      ))}
    </group>
  );
}

useGLTF.preload(ASSET.connectors);
