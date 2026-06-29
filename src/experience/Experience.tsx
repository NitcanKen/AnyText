/**
 * Experience — the single persistent WebGL world (SoT §3). One <Canvas>, lazy-loaded
 * (this module + all of `three` is dynamically imported, so it never bloats the
 * critical path). Everything inside reads the shared director store, which is what
 * makes the subsystems feel like "one director, one clock, one lighting model".
 *
 * `flat` sets the renderer to NoToneMapping → the scene lands in PostFX's HalfFloat
 * HDR buffer with emissives intact, and the AGX tone-map happens there (§7.7).
 *
 * Default export so it can be `React.lazy`-imported by ExperienceMount.
 */

import { PerformanceMonitor, Preload } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { QualityTier } from './quality';
import {
  integratePointer,
  setPointerTarget,
  useExperienceStore,
} from './store';
import { CameraRig } from './rig/CameraRig';
import { Lighting } from './rig/Lighting';
import { PostFX } from './rig/PostFX';
import { AnchorBridge } from './rig/AnchorBridge';
import { RelayCore } from './systems/RelayCore';
import { PointerField } from './systems/PointerField';
import { Spheres } from './systems/Spheres';
import { Connectors } from './systems/Connectors';
import { SendBeam } from './systems/SendBeam';

/** The master clock: integrates the inertial pointer + mirrors live state into the store. */
function Director({ tier, sync }: { tier: QualityTier; sync: number }) {
  const setTier = useExperienceStore((s) => s.setTier);
  const setSync = useExperienceStore((s) => s.setSync);
  const setReducedMotion = useExperienceStore((s) => s.setReducedMotion);

  useEffect(() => setTier(tier), [tier, setTier]);
  useEffect(() => setSync(sync), [sync, setSync]);

  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [setReducedMotion]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => setPointerTarget(e.clientX, e.clientY);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // Runs first each frame (mounted first) so every other system reads an
  // already-integrated pointer this tick.
  useFrame((_, dt) => integratePointer(Math.min(dt, 0.05)));
  return null;
}

/** Flips the director from boot → deck once assets are in and a frame has drawn. */
function ReadyGate() {
  const setReady = useExperienceStore((s) => s.setReady);
  const setAct = useExperienceStore((s) => s.setAct);
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current < 0) return;
    frames.current += 1;
    if (frames.current >= 2) {
      setReady(true);
      setAct('deck');
      frames.current = -1;
    }
  });
  return null;
}

export default function Experience({ tier, sync }: { tier: QualityTier; sync: number }) {
  const [frameloop, setFrameloop] = useState<'always' | 'never'>(() =>
    typeof document !== 'undefined' && document.hidden ? 'never' : 'always',
  );
  const debugAnchor = useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('debugAnchor'),
    [],
  );

  // Render loop pauses entirely when the tab is hidden (SoT §6).
  useEffect(() => {
    const onVis = () => setFrameloop(document.hidden ? 'never' : 'always');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Adaptive DPR: start conservative and let PerformanceMonitor climb to the tier
  // cap only when the GPU has headroom (and drop back under load). Tier C is pinned.
  const dprMax = tier === 'A' ? 1.75 : tier === 'B' ? 1.5 : 1;
  const [dpr, setDpr] = useState(Math.min(1.25, dprMax));

  return (
    <div className="experience-stage" aria-hidden="true">
      <Canvas
        className="experience-canvas"
        flat
        frameloop={frameloop}
        dpr={dpr}
        gl={{ antialias: tier !== 'C', alpha: false, powerPreference: 'high-performance' }}
        camera={{ fov: 42, near: 0.1, far: 100, position: [0, 0.35, 4.5] }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color('#04060a');
          scene.fog = new THREE.FogExp2(0x04060a, 0.055);
        }}
      >
        <Director tier={tier} sync={sync} />
        <CameraRig />
        <Suspense fallback={null}>
          <Lighting />
          <RelayCore />
          <Connectors tier={tier} />
          <ReadyGate />
          <Preload all />
        </Suspense>
        <PointerField tier={tier} />
        <Spheres tier={tier} />
        <SendBeam />
        <AnchorBridge debug={debugAnchor} />
        <PostFX tier={tier} />
        <PerformanceMonitor
          onIncline={() => setDpr((d) => Math.min(dprMax, +(d + 0.25).toFixed(2)))}
          onDecline={() => setDpr((d) => Math.max(1, +(d - 0.25).toFixed(2)))}
        />
      </Canvas>
    </div>
  );
}
