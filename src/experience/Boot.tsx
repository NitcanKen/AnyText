/**
 * Boot — the loader that resolves INTO the deck (SoT §4 boot, "no spinner→swap").
 *
 * A near-black veil over the *scene only* (z below the tool chrome, so the tool is
 * functional underneath from frame 0). It lifts — does not get replaced — the moment
 * the director flips `ready` (assets + shaders in, first frame drawn), which is also
 * when the core's lens powers up and the camera pulls back. The result reads as the
 * world coming alive behind the tool, never a spinner swapping for a page.
 *
 * Resilience: if `ready` never fires (asset/WebGL failure), the veil lifts on a
 * timeout so the scene area never stays a dead black rectangle.
 */

import { useEffect, useState } from 'react';
import { useExperienceStore } from './store';

export function Boot() {
  const ready = useExperienceStore((s) => s.ready);
  const [timedOut, setTimedOut] = useState(false);
  const [gone, setGone] = useState(false);
  // Lift on ready (derived, no setState cascade) or on the failure-fallback timeout.
  const lifted = ready || timedOut;

  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setTimedOut(true), 6000);
    return () => window.clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    if (!lifted) return;
    const id = window.setTimeout(() => setGone(true), 1300);
    return () => window.clearTimeout(id);
  }, [lifted]);

  if (gone) return null;
  return <div className="experience-boot" data-ready={lifted} aria-hidden="true" />;
}
