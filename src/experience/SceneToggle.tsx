/**
 * SceneToggle — the user-facing manual quality toggle (Phase 0). Cycles the
 * persisted preference Auto → On → Off; `off` forces Tier-D (zero canvas, zero asset
 * fetch). Self-contained + light (no `three`), so it lives on the critical path and
 * can switch the experience on even when it auto-resolved to off.
 *
 * Hidden entirely on devices with no WebGL — the toggle would be meaningless there.
 */

import type { ExperienceController, ExperiencePreference } from './quality';

const NEXT: Record<ExperiencePreference, ExperiencePreference> = {
  auto: 'on',
  on: 'off',
  off: 'auto',
};

const LABEL: Record<ExperiencePreference, string> = {
  auto: 'Auto',
  on: 'On',
  off: 'Off',
};

export function SceneToggle({ controller }: { controller: ExperienceController }) {
  const { preference, setPreference, supported, active } = controller;
  if (!supported) return null;

  return (
    <button
      aria-label={`Cinematic scene: ${LABEL[preference]} — click to change`}
      className="scene-toggle"
      onClick={() => setPreference(NEXT[preference])}
      title="Cinematic scene quality"
      type="button"
    >
      <span aria-hidden className="scene-toggle-dot" data-on={active} />
      <span className="scene-toggle-label">Scene · {LABEL[preference]}</span>
    </button>
  );
}
