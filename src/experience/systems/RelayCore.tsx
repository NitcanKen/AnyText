/**
 * RelayCore — the generated hero asset (SoT §7.6 / Phase 1). Loads
 * public/assets/relay-core.glb via drei `useGLTF`, keeps its Blender-tuned PBR
 * materials, and:
 *   - tunes envMapIntensity so the dark metal reads as a render under the studio
 *     HDRI without blowing out (§7.7),
 *   - tames the lens emissive so Bloom is a scalpel (a contained glow that just
 *     crosses threshold), not a floodlight blob (§7.7),
 *   - spins slowly + mechanically with independent sub-rings (vanes/bolts/tubes),
 *   - breathes on sync (deck act): amplitude scales with the director's `sync`.
 *
 * The core powers UP on boot: lens emissive ramps 0 → target as `ready` flips,
 * which is what lets the loader "resolve into the deck" with no spinner→swap.
 */

import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { ASSET } from '../assets';
import { useExperienceStore } from '../store';

// Peak emissive intensity of the lens once powered up. Kept modest on purpose:
// the bloom threshold (0.72) should catch it as a sharp glow, never a wash (§7.7).
const LENS_PEAK = 3.1;

export function RelayCore() {
  const { scene } = useGLTF(ASSET.core);

  const tiltRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const lensMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const subRefs = useRef<Record<string, THREE.Object3D | null>>({});

  // One-time material grade + part collection. In a layout effect (not render) so
  // ref writes are legal; runs before paint, and the boot veil covers the gap. Done
  // on the shared cached scene — exactly one RelayCore instance, so mutation is safe.
  useLayoutEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        if (!std || !('envMapIntensity' in std)) continue;
        const name = std.name.toLowerCase();
        if (name.includes('emit')) {
          // The lens: contained, breathing glow.
          std.emissiveIntensity = 0; // powers up from dark on boot
          std.envMapIntensity = 0.4;
          std.toneMapped = true;
          lensMatRef.current = std;
        } else if (name.includes('blue')) {
          // Royal-blue plastic — glossy, picks up sharp blue speculars.
          std.envMapIntensity = 1.15;
        } else {
          // Dark gunmetal — reflective enough to read as machined metal, not maxed.
          std.envMapIntensity = 1.0;
        }
      }
    });
    // Named sub-parts we animate independently (§7.6 separable parts).
    for (const name of ['vanes', 'bolts', 'tube.blue.0', 'tube.blue.1', 'tube.blue.2']) {
      subRefs.current[name] = scene.getObjectByName(name) ?? null;
    }
  }, [scene]);

  // If this instance unmounts (HMR / tier flip), leave the cached materials dark
  // so a remount re-powers-up cleanly rather than flashing a hot lens.
  useEffect(() => {
    return () => {
      if (lensMatRef.current) lensMatRef.current.emissiveIntensity = 0;
    };
  }, []);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const { sync, ready, reducedMotion } = useExperienceStore.getState();
    const t = performance.now() / 1000;
    const motion = reducedMotion ? 0.15 : 1;

    // Slow mechanical rotation of the whole assembly about its own axis.
    if (spinRef.current) spinRef.current.rotation.y += dt * 0.16 * motion;

    // Independent sub-rings — a turbine reads alive when its parts shear past
    // each other at different rates (§7.6 "animate sub-rings independently").
    const vanes = subRefs.current['vanes'];
    if (vanes) vanes.rotation.y += dt * 0.42 * motion;
    const bolts = subRefs.current['bolts'];
    if (bolts) bolts.rotation.y -= dt * 0.10 * motion;
    for (let i = 0; i < 3; i++) {
      const tube = subRefs.current[`tube.blue.${i}`];
      if (tube) tube.rotation.y += dt * (0.06 + i * 0.03) * (i % 2 ? -1 : 1) * motion;
    }

    // Lens breathing on sync: a calm pulse whose depth tracks the director's sync.
    if (lensMatRef.current) {
      const breathe = 1 + Math.sin(t * 1.5) * 0.16 * sync * motion;
      const target = ready ? LENS_PEAK * (0.55 + 0.45 * sync) * breathe : 0;
      lensMatRef.current.emissiveIntensity +=
        (target - lensMatRef.current.emissiveIntensity) * (ready ? 0.06 : 0.04);
    }
  });

  // Outer group tilts the core to the reference's oblique 3/4 framing: the lens
  // funnel (+Y face) leans TOWARD the camera (+rotation.x) so we look into the
  // glowing recessed eye; inner group carries the continuous spin.
  return (
    <group ref={tiltRef} rotation={[0.62, 0, 0.14]} scale={1.55} position={[0, 0.0, 0]}>
      <group ref={spinRef}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(ASSET.core);
