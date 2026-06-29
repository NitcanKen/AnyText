/**
 * Spheres — floating glossy black spheres with hard speculars at varying depth
 * (SoT §1.5 / §7.7). Staggered in Z so DepthOfField throws the near + far ones into
 * soft bokeh while the core stays sharp — the "premium render" feel. Sparse on
 * purpose. Mostly black metal with a couple of royal-blue; never lime/cyan.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { QualityTier } from '../quality';

const COUNT_BY_TIER: Record<QualityTier, number> = { A: 11, B: 8, C: 5, D: 0 };

interface Sphere {
  pos: THREE.Vector3;
  r: number;
  baseY: number;
  ph: number;
  spin: number;
  blue: boolean;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Spheres({ tier }: { tier: QualityTier }) {
  const groupRef = useRef<THREE.Group>(null);

  const spheres = useMemo<Sphere[]>(() => {
    const count = COUNT_BY_TIER[tier];
    const rand = mulberry32(0xb0ba);
    const out: Sphere[] = [];
    for (let i = 0; i < count; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = 2.9 + rand() * 3.6;
      // ~2 of them sit in front of the core → soft foreground bokeh (kept small so
      // they read as depth, not as hero objects competing with the core).
      const front = i < 2;
      const z = front ? 3.0 + rand() * 1.2 : -1.4 - rand() * 4.5;
      const y = (rand() - 0.5) * 3.4;
      out.push({
        pos: new THREE.Vector3(Math.cos(ang) * rad * (front ? 0.8 : 1), y, z),
        r: (front ? 0.16 : 0.15) + rand() * 0.26,
        baseY: y,
        ph: rand() * Math.PI * 2,
        spin: (rand() - 0.5) * 0.3,
        blue: rand() < 0.22,
      });
    }
    return out;
  }, [tier]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const t = performance.now() / 1000;
    g.children.forEach((child, i) => {
      const s = spheres[i];
      if (!s) return;
      child.position.y = s.baseY + Math.sin(t * 0.45 + s.ph) * 0.16;
      child.rotation.y += 0.003 * s.spin * 60 * 0.016;
    });
  });

  return (
    <group ref={groupRef}>
      {spheres.map((s, i) => (
        <mesh key={i} position={s.pos} scale={s.r}>
          <sphereGeometry args={[1, 32, 32]} />
          {s.blue ? (
            <meshPhysicalMaterial
              color="#142a66"
              metalness={0.2}
              roughness={0.18}
              clearcoat={1}
              clearcoatRoughness={0.12}
              envMapIntensity={1.2}
            />
          ) : (
            <meshPhysicalMaterial
              color="#080b12"
              metalness={1}
              roughness={0.16}
              clearcoat={1}
              clearcoatRoughness={0.2}
              envMapIntensity={1.25}
            />
          )}
        </mesh>
      ))}
    </group>
  );
}
