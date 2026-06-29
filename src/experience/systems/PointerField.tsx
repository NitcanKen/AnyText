/**
 * PointerField — the inertial flow field (SoT §3 "PointerField"). A sparse field of
 * depth-staggered motes that the cursor pushes with inertia: this is the signature
 * "the world follows you" feel CSS structurally cannot do, because it reads the same
 * smoothed pointer the camera and core read, every tick.
 *
 * Deliberately sparse + dim (§7.7 "fewer, sculptural objects beat many glowing ones"):
 * it provides depth and motion, not a glowing particle soup. Count scales by tier.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { pointer, sendPulse } from '../store';
import type { QualityTier } from '../quality';

// Radius (world units) within which the send projectile shoves motes out of its
// wake, and how hard. The push grows as the beam gathers travel (mass + follow-
// through, SoT §5.3) so the field visibly parts as the shot crosses it.
const WAKE_RADIUS = 1.15;
const WAKE_PUSH = 0.9;

const COUNT_BY_TIER: Record<QualityTier, number> = { A: 680, B: 420, C: 200, D: 0 };

// Small deterministic RNG so the field (and thus reference screenshots) is stable
// across reloads/HMR.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function PointerField({ tier }: { tier: QualityTier }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, base, drift, phase } = useMemo(() => {
    const count = COUNT_BY_TIER[tier];
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const drift = new Float32Array(count);
    const phase = new Float32Array(count);
    const rand = mulberry32(0x5eed);
    const cool = new THREE.Color('#6f8bff');
    const dim = new THREE.Color('#2a3a66');

    for (let i = 0; i < count; i++) {
      // A wide shell around/behind the core, biased to depth for parallax.
      const ang = rand() * Math.PI * 2;
      const rad = 2.2 + rand() * 6.5;
      const x = Math.cos(ang) * rad * (0.5 + rand() * 0.5);
      const y = (rand() - 0.5) * 7;
      const z = -1.5 - rand() * 8 + (rand() < 0.15 ? rand() * 3 : 0);
      base[i * 3] = x;
      base[i * 3 + 1] = y;
      base[i * 3 + 2] = z;
      positions.set([x, y, z], i * 3);
      drift[i] = 0.2 + rand() * 0.5;
      phase[i] = rand() * Math.PI * 2;
      // Mostly dim, a few cool-blue — never lime/cyan (reserved accents).
      const c = rand() < 0.22 ? cool : dim;
      colors.set([c.r, c.g, c.b], i * 3);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return { geometry, base, drift, phase };
  }, [tier]);

  useFrame(() => {
    const pts = pointsRef.current;
    if (!pts) return;
    const t = performance.now() / 1000;
    const attr = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const count = arr.length / 3;
    // Send projectile wake (SoT §5.3): the beam displaces motes it passes through.
    const wake = sendPulse.active;
    const wakeStrength = WAKE_PUSH * (0.4 + 0.6 * sendPulse.travel);
    for (let i = 0; i < count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];
      // Nearer motes parallax + flow more.
      const f = THREE.MathUtils.clamp((bz + 9.5) / 11, 0.05, 1);
      const dr = drift[i];
      let x = bx + pointer.x * 0.7 * f + pointer.vx * 0.12 * f + Math.sin(t * dr + phase[i]) * 0.18;
      let y =
        by + pointer.y * 0.7 * f + pointer.vy * 0.12 * f + Math.cos(t * dr * 0.8 + phase[i]) * 0.18;
      let z = bz;
      if (wake) {
        const dx = x - sendPulse.tipX;
        const dy = y - sendPulse.tipY;
        const dz = z - sendPulse.tipZ;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < WAKE_RADIUS * WAKE_RADIUS) {
          const d = Math.sqrt(d2) || 1e-3;
          const falloff = (1 - d / WAKE_RADIUS) * wakeStrength;
          x += (dx / d) * falloff;
          y += (dy / d) * falloff;
          z += (dz / d) * falloff * 0.6;
        }
      }
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.03}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
