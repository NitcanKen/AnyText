/**
 * store.ts — the Director store (SoT §3): the single source of runtime truth that
 * every subsystem reads from, which is what makes them feel like "one director".
 *
 * Two channels, by update frequency:
 *  - High-frequency pointer data lives in a plain mutable singleton (`pointer`).
 *    It is mutated in-place by a window listener and *polled* by systems inside
 *    `useFrame`. Routing pointermove through React/zustand would re-render the
 *    tree dozens of times a second; polling a mutable object is the r3f-idiomatic
 *    high-frequency pattern.
 *  - Discrete, low-frequency state (act, ready, sync, energy, tier) lives in a
 *    zustand store so the handful of components that branch on it (Boot, CameraRig)
 *    re-render exactly when it changes.
 */

import { create } from 'zustand';
import type { QualityTier } from './quality';

/** The act state machine that bounds scope (SoT §4). Phase 1 uses boot → deck. */
export type Act =
  | 'boot'
  | 'deck'
  | 'composing'
  | 'sending'
  | 'receiving'
  | 'expiring'
  | 'pairing';

// --------------------------------------------------------------------------------------
// Pointer — mutable singleton with inertia (the signature "field follows you" feel)
// --------------------------------------------------------------------------------------

export interface PointerState {
  /** Smoothed, inertial pointer in normalized device space (-1..1). */
  x: number;
  y: number;
  /** Inertial velocity (smoothed delta), used to push the field. */
  vx: number;
  vy: number;
  /** Raw target the smoothed values chase. */
  tx: number;
  ty: number;
}

export const pointer: PointerState = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };

/** Feed a raw browser pointer event into the singleton's target. */
export function setPointerTarget(clientX: number, clientY: number): void {
  pointer.tx = (clientX / window.innerWidth) * 2 - 1;
  pointer.ty = -((clientY / window.innerHeight) * 2 - 1);
}

/**
 * Integrate the pointer toward its target with inertia. Called once per frame by
 * the master clock. `dt` is the clamped frame delta.
 */
export function integratePointer(dt: number): void {
  const ease = 1 - Math.pow(0.0001, dt); // frame-rate-independent smoothing (~0.1/frame @60)
  const px = pointer.x;
  const py = pointer.y;
  pointer.x += (pointer.tx - pointer.x) * ease;
  pointer.y += (pointer.ty - pointer.y) * ease;
  // Velocity is the smoothed per-second displacement (decays toward 0 when still).
  pointer.vx += ((pointer.x - px) / Math.max(dt, 1e-4) - pointer.vx) * ease;
  pointer.vy += ((pointer.y - py) / Math.max(dt, 1e-4) - pointer.vy) * ease;
}

// --------------------------------------------------------------------------------------
// THE SEND — the send shot's event bus + per-frame signal bus (SoT §5)
// --------------------------------------------------------------------------------------
//
// Two pieces, mirroring the pointer split above:
//  - A discrete *event* (`emitSend`) the App fires once per commit, which the
//    SendBeam system turns into one ~1s GSAP shot. Routed through a plain listener
//    set (not zustand) so it stays a fire-once event, not reactive state, and so the
//    light App critical chunk can fire it without importing `three`.
//  - A high-frequency *signal* singleton (`sendPulse`) the SendBeam writes each frame
//    and every other subsystem polls in `useFrame` — the same mutable-singleton
//    pattern as `pointer`. This is how one shot simultaneously pushes the field,
//    ripples the core, kicks the camera, and spikes chromatic aberration: they all
//    read the same numbers each tick (the "one director" mechanism, SoT §3).

export type SendStatus = 'fire' | 'recoil';
export interface SendEvent {
  id: number;
  status: SendStatus;
}

type SendListener = (event: SendEvent) => void;
const sendListeners = new Set<SendListener>();
let sendSeq = 0;

/** Fire a send event (App → scene). Returns the event id. No-op visually if the
 * experience layer isn't mounted (Tier-D), since nothing is subscribed. */
export function emitSend(status: SendStatus): number {
  sendSeq += 1;
  const event: SendEvent = { id: sendSeq, status };
  for (const listener of sendListeners) listener(event);
  return sendSeq;
}

/** Subscribe to send events (the SendBeam system). Returns an unsubscribe fn. */
export function subscribeSend(listener: SendListener): () => void {
  sendListeners.add(listener);
  return () => {
    sendListeners.delete(listener);
  };
}

/**
 * Per-frame signals the SendBeam writes and other systems read. Plain numbers only
 * (NO `three` — this module is light enough for the critical chunk). World-space
 * vectors are passed as separate scalar fields rather than a Vector3.
 */
export interface SendPulse {
  /** A beam is in flight (charge → impact window) — gates field displacement. */
  active: boolean;
  /** Beam tip in world space (the projectile's current position). */
  tipX: number;
  tipY: number;
  tipZ: number;
  /** 0..1 progress of the fire→impact leg (push strength grows as it travels). */
  travel: number;
  /** 0..1 impulse the core ripples on (spikes at impact, then decays). */
  impact: number;
  /** 0..1 camera-kick impulse (spikes at launch, then decays). */
  kick: number;
  /** 0..1 chromatic-aberration spike (launch + impact). */
  ca: number;
  /** 0..1 fail-recoil danger flash (drives the core's red pulse). */
  danger: number;
}

export const sendPulse: SendPulse = {
  active: false,
  tipX: 0,
  tipY: 0,
  tipZ: 0,
  travel: 0,
  impact: 0,
  kick: 0,
  ca: 0,
  danger: 0,
};

// --------------------------------------------------------------------------------------
// Discrete director state (zustand)
// --------------------------------------------------------------------------------------

export interface ExperienceState {
  /** Current act. */
  act: Act;
  /** Assets + shaders ready → boot can resolve into the deck. */
  ready: boolean;
  /** Sync liveness 0..1 — drives the core's "breathing" amplitude (SoT §4 deck). */
  sync: number;
  /** Composer energy 0..1 (reserved for Phase 2 charge). */
  energy: number;
  /** Effective quality tier (mirrors quality.ts for in-scene branching). */
  tier: QualityTier;
  /** Reduced-motion → calmed render loop. */
  reducedMotion: boolean;

  setAct: (act: Act) => void;
  setReady: (ready: boolean) => void;
  setSync: (sync: number) => void;
  setEnergy: (energy: number) => void;
  setTier: (tier: QualityTier) => void;
  setReducedMotion: (reduced: boolean) => void;
}

export const useExperienceStore = create<ExperienceState>((set) => ({
  act: 'boot',
  ready: false,
  sync: 0.6,
  energy: 0,
  tier: 'A',
  reducedMotion: false,

  setAct: (act) => set({ act }),
  setReady: (ready) => set({ ready }),
  setSync: (sync) => set({ sync: Math.max(0, Math.min(1, sync)) }),
  setEnergy: (energy) => set({ energy: Math.max(0, Math.min(1, energy)) }),
  setTier: (tier) => set({ tier }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
