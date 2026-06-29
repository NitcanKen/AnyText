/**
 * ExperienceMount — the lazy boundary (SoT §7). Statically importing this module
 * pulls in only light code (React + the zustand store + the Boot veil); the entire
 * `three` / r3f world is behind `React.lazy(() => import('./Experience'))`, so it is
 * code-split out of the critical chunk and Tier-D never loads it (App only renders
 * this when the tier resolves to A/B/C).
 *
 * Maps the app's Supabase realtime `syncStatus` to the core's breathing depth so the
 * RelayCore literally breathes on sync (SoT §4 deck).
 */

import { Component, Suspense, lazy, type ReactNode } from 'react';
import { Boot } from './Boot';
import type { QualityTier } from './quality';

const LazyExperience = lazy(() => import('./Experience'));

/** Realtime status → sync liveness (0..1) that drives the lens breathing. */
function syncLevel(status: string): number {
  if (status === 'connected') return 0.95;
  if (status === 'connecting' || status === 'reconnecting') return 0.55;
  return 0.4; // disconnected/closed/error → calm, but still alive
}

/**
 * The cinematic stage is progressive enhancement (SoT §2.3): if WebGL is lost or any
 * scene code throws, it must NEVER take the functional tool down with it. This
 * boundary drops the canvas on error and keeps the DOM tool — and the boot veil's own
 * timeout (Boot.tsx) lifts the dark veil so the scene area doesn't stay a dead frame.
 */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (typeof console !== 'undefined') {
      console.warn('[experience] scene disabled after error; tool stays functional:', error);
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function ExperienceMount({ tier, syncStatus }: { tier: QualityTier; syncStatus: string }) {
  return (
    <>
      <SceneErrorBoundary>
        <Suspense fallback={null}>
          <LazyExperience tier={tier} sync={syncLevel(syncStatus)} />
        </Suspense>
      </SceneErrorBoundary>
      <Boot />
    </>
  );
}
