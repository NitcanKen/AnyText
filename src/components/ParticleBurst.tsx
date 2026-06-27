import { type CSSProperties } from 'react';

import { particleBudget } from '../lib/motion';

export type ParticleDirection = 'scatter' | 'converge';

export interface ParticleBurstProps {
  /**
   * Change this to replay the burst in place — the layer is keyed by it, so a
   * new value remounts every particle and the CSS animation runs again. Omit
   * when the component is conditionally mounted (it plays once on mount).
   */
  burstKey?: number | string;
  /** Requested particle count; clamped to the central budget (≤ PARTICLE_MAX). */
  count?: number;
  /**
   * `scatter` = emit from centre outward (EXPIRY disintegration, §3.4).
   * `converge` = fly in from the perimeter to centre (PAIRING reform, §3.3).
   */
  direction?: ParticleDirection;
  /** Drift radius in px (how far particles travel from centre). */
  spread?: number;
  /** Extra upward bias in px — decay particles "rise" as they fade. */
  rise?: number;
  /** Particle tint (any CSS colour). Defaults to lime `--accent`. */
  color?: string;
  /** Total burst duration; defaults to the signature envelope in CSS. */
  durationMs?: number;
  className?: string;
}

// Deterministic per-index pseudo-jitter in [0, 1) — keeps bursts organic without
// Math.random (so renders are stable and test-safe). Classic hashed-sine.
function jitter(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

interface ParticleStyle extends CSSProperties {
  '--p-tx': string;
  '--p-ty': string;
  '--p-scale': string;
  '--p-delay': string;
}

/**
 * Reusable, capped, reduced-motion-aware particle layer — the shared utility
 * behind the two Phase-4 emotional peaks (PAIRING §3.3, EXPIRY §3.4) and any
 * future signature moment. Decorative only: `aria-hidden`, `pointer-events:none`,
 * pure `transform`/`opacity` (§7/§8). Renders nothing when the budget is 0
 * (reduced motion / low-power device) — callers need no separate guard.
 */
export function ParticleBurst({
  burstKey,
  count = 16,
  direction = 'scatter',
  spread = 64,
  rise = 0,
  color,
  durationMs,
  className,
}: ParticleBurstProps) {
  const total = particleBudget(count);

  if (total === 0) {
    return null;
  }

  const layerStyle = {
    ...(color ? { '--p-color': color } : {}),
    ...(durationMs != null ? { '--p-dur': `${durationMs}ms` } : {}),
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      className={['fx-particle-layer', className].filter(Boolean).join(' ')}
      data-direction={direction}
      key={burstKey}
      style={layerStyle}
    >
      {Array.from({ length: total }, (_, index) => {
        // Even angular spread + a little jitter so it reads as organic, not a clock face.
        const angle = (index / total) * Math.PI * 2 + jitter(index, 1) * 0.7;
        const distance = spread * (0.55 + jitter(index, 2) * 0.45);
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance - rise * (0.5 + jitter(index, 3) * 0.5);
        const scale = 0.55 + jitter(index, 4) * 0.6;
        const delay = Math.round(jitter(index, 5) * 120);

        const style: ParticleStyle = {
          '--p-tx': `${tx.toFixed(1)}px`,
          '--p-ty': `${ty.toFixed(1)}px`,
          '--p-scale': scale.toFixed(2),
          '--p-delay': `${delay}ms`,
        };

        return <span className="fx-particle" key={index} style={style} />;
      })}
    </span>
  );
}
