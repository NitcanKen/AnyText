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

import { Suspense, lazy } from 'react';
import { Boot } from './Boot';
import type { QualityTier } from './quality';

const LazyExperience = lazy(() => import('./Experience'));

/** Realtime status → sync liveness (0..1) that drives the lens breathing. */
function syncLevel(status: string): number {
  if (status === 'connected') return 0.95;
  if (status === 'connecting' || status === 'reconnecting') return 0.55;
  return 0.4; // disconnected/closed/error → calm, but still alive
}

export function ExperienceMount({ tier, syncStatus }: { tier: QualityTier; syncStatus: string }) {
  return (
    <>
      <Suspense fallback={null}>
        <LazyExperience tier={tier} sync={syncLevel(syncStatus)} />
      </Suspense>
      <Boot />
    </>
  );
}
