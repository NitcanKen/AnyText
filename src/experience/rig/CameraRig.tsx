/**
 * CameraRig — per-act framing as camera moves, not page swaps (SoT §3 / §4).
 *
 * Phase 1 scope: the idle "deck" shot — a wide, gently breathing frame with pointer
 * parallax (reads the same smoothed `pointer` the field + core read, so the whole
 * world parallaxes as one). Boot resolves by easing the camera *back into* the deck
 * framing as `ready` flips — the "pull back into the deck", no spinner→swap.
 */

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { pointer, sendPulse, useExperienceStore } from '../store';

const TARGET = new THREE.Vector3(0, 0.05, 0);
const DECK_Z = 6.1;
const BOOT_Z = 4.9; // start tighter on the powering-up core, then pull back

export function CameraRig() {
  const zRef = useRef(BOOT_Z);

  // Read the camera from the frame state (not a closed-over hook value) so the
  // per-frame mutation is the idiomatic r3f pattern.
  useFrame((state, rawDelta) => {
    const camera = state.camera;
    const dt = Math.min(rawDelta, 0.05);
    const { ready, reducedMotion } = useExperienceStore.getState();
    const t = performance.now() / 1000;
    const calm = reducedMotion ? 0.2 : 1;

    // Ease the dolly from the boot framing to the deck framing.
    const targetZ = ready ? DECK_Z : BOOT_Z;
    zRef.current += (targetZ - zRef.current) * (1 - Math.pow(0.2, dt));

    // Idle breathing drift + pointer parallax, all smoothed upstream.
    const driftX = Math.sin(t * 0.13) * 0.18 * calm;
    const driftY = Math.cos(t * 0.11) * 0.12 * calm;
    const px = pointer.x * 0.55 * calm;
    const py = pointer.y * 0.4 * calm;

    camera.position.x += (driftX + px - camera.position.x) * (1 - Math.pow(0.05, dt));
    camera.position.y += (0.55 + driftY + py - camera.position.y) * (1 - Math.pow(0.05, dt));
    camera.position.z += (zRef.current - camera.position.z) * (1 - Math.pow(0.05, dt));

    // THE SEND launch kick (SoT §5.2): a quick punch toward the core + a touch of
    // shake on fire, applied on top of the smoothed base so it springs back as the
    // pulse decays. Calmed under reduced motion (calm ≈ 0).
    const kick = sendPulse.kick * calm;
    if (kick > 0.001) {
      camera.position.z -= kick * 0.22;
      camera.position.x += Math.sin(t * 90) * kick * 0.045;
      camera.position.y += Math.cos(t * 76) * kick * 0.03;
    }
    camera.lookAt(TARGET);
  });

  return null;
}
