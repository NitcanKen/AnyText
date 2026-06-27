/**
 * Motion primitive helpers — the JS half of the Tier-S motion vocabulary (§5).
 *
 * The CSS half lives in `src/styles.css` (the `fx-*` utility classes). These
 * helpers are the small, reusable, composable companions: copy hand-feel state,
 * an optional cursor-follow magnet, a stagger style factory, and a single
 * central reduced-motion gate. Keep this file dependency-light and side-effect
 * free so any component can pull in just the primitive it needs.
 */
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

export type CopyStatus = 'idle' | 'copied' | 'failed';

/**
 * The single source of truth for JS-side reduced-motion gating. Every primitive
 * that touches motion from JS routes through here, so the policy lives in one
 * place (the CSS side mirrors it in the central `prefers-reduced-motion` block).
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Hard cap on particles per burst (§7). Bursts request a count, but the
 * utility never renders more than this — the ceiling is enforced centrally so
 * no call site can exceed the performance budget.
 */
export const PARTICLE_MAX = 24;

// Async low-power signal: the Battery API resolves a promise, so we cache the
// verdict in a module flag the synchronous heuristics fall back to. Until it
// resolves, the sync checks below cover the first burst.
let lowPowerBattery = false;

function detectLowPowerBattery(): void {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & {
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
  }) : undefined;
  nav?.getBattery?.()
    .then((battery) => {
      lowPowerBattery = battery.level < 0.2 && !battery.charging;
    })
    .catch(() => {
      // Battery API unavailable / blocked — leave the flag false; the sync
      // heuristics (cores / memory / Save-Data) still apply.
    });
}

detectLowPowerBattery();

/**
 * Low-power heuristic for the particle utility (§7: "auto-disabled … on
 * low-power heuristics"). Conservative on purpose — only genuinely constrained
 * devices (≤2 cores, ≤2GB, Save-Data, or a low/uncharging battery) opt out, so
 * a normal 4-core laptop keeps the effect.
 */
function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (lowPowerBattery) {
    return true;
  }
  if (nav.connection?.saveData) {
    return true;
  }
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) {
    return true;
  }
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2) {
    return true;
  }
  return false;
}

/**
 * The central gate for the reusable particle utility (§3.3 / §3.4). Returns how
 * many particles a burst may render: `0` (→ render nothing) under reduced motion
 * or a low-power device, otherwise the requested count clamped to `PARTICLE_MAX`.
 * Routing through this file keeps motion policy in one place (§7/§8).
 */
export function particleBudget(requested = PARTICLE_MAX): number {
  if (prefersReducedMotion() || isLowPowerDevice()) {
    return 0;
  }
  return Math.max(0, Math.min(Math.floor(requested), PARTICLE_MAX));
}

/**
 * Subtle confirm haptic for the COPY `imprint` (§3.5). No-op when the device
 * lacks the Vibration API or the user prefers reduced motion.
 */
export function triggerHaptic(durationMs = 8): void {
  if (prefersReducedMotion()) {
    return;
  }
  const vibrate = typeof navigator !== 'undefined' ? navigator.vibrate?.bind(navigator) : undefined;
  vibrate?.(durationMs);
}

/**
 * `stagger` primitive (§5). Returns the CSS custom properties a sibling needs so
 * its entrance animation is offset by `index * step`. Pair with the `.fx-stagger`
 * container (which reads `--stagger-index` / `--stagger-step`) or any element
 * whose own `animation-delay` references those tokens.
 */
export function staggerStyle(index: number, stepMs?: number): CSSProperties {
  const style: Record<string, string | number> = { '--stagger-index': index };
  if (stepMs != null) {
    style['--stagger-step'] = `${stepMs}ms`;
  }
  return style as CSSProperties;
}

export interface CopyImprint {
  /** Drives the `data-copy-state` attribute the `.fx-imprint` CSS keys off. */
  status: CopyStatus;
  /** Bump key — remount the ripple element on each success to retrigger it. */
  rippleKey: number;
  /** Run a copy action, then flash copied/failed and reset after `resetMs`. */
  run: (action: () => void | Promise<void>) => Promise<void>;
}

/**
 * Reusable copy hand-feel state for the `imprint` primitive (§3.5). Centralises
 * the copied/failed flash + auto-reset + haptic so every copy button (Markdown,
 * code block, pairing) shares one implementation instead of re-deriving it.
 */
export function useCopyImprint(resetMs = 1200): CopyImprint {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const [rippleKey, setRippleKey] = useState(0);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const run = useCallback(
    async (action: () => void | Promise<void>) => {
      try {
        await action();
        setRippleKey((key) => key + 1);
        setStatus('copied');
        triggerHaptic(8);
      } catch {
        setStatus('failed');
      } finally {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => setStatus('idle'), resetMs);
      }
    },
    [resetMs],
  );

  return { status, rippleKey, run };
}

/**
 * `magnet` primitive (§5) — optional cursor-follow upgrade for the CSS
 * `.fx-magnet` hover pull. Writes clamped `--magnet-x` / `--magnet-y` straight to
 * the element's inline style, rAF-throttled and never via React state (§7), so a
 * primary button leans 2–3px toward the pointer. Returns a cleanup fn; no-op
 * under reduced motion so the CSS default (a flat 2px lift) stays authoritative.
 */
export function attachMagnet(el: HTMLElement | null, strengthPx = 3): () => void {
  if (!el || prefersReducedMotion()) {
    return () => {};
  }

  let raf = 0;
  let pending: { x: number; y: number } | null = null;

  const apply = () => {
    raf = 0;
    if (!pending) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const nx = clamp((pending.x - (rect.left + rect.width / 2)) / (rect.width / 2 || 1), -1, 1);
    const ny = clamp((pending.y - (rect.top + rect.height / 2)) / (rect.height / 2 || 1), -1, 1);
    // x follows the pointer; y keeps a steady ~2px lift nudged ±1px by the pointer.
    el.style.setProperty('--magnet-x', `${(nx * strengthPx).toFixed(2)}px`);
    el.style.setProperty('--magnet-y', `${(ny * (strengthPx / 3) - 2).toFixed(2)}px`);
  };

  const onMove = (event: PointerEvent) => {
    pending = { x: event.clientX, y: event.clientY };
    if (!raf) {
      raf = requestAnimationFrame(apply);
    }
  };

  const reset = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    pending = null;
    el.style.removeProperty('--magnet-x');
    el.style.removeProperty('--magnet-y');
  };

  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', reset);
  el.addEventListener('pointercancel', reset);

  return () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', reset);
    el.removeEventListener('pointercancel', reset);
    if (raf) {
      cancelAnimationFrame(raf);
    }
  };
}

/**
 * Cursor spotlight (§4.2) — the JS half of the `--spotlight` panel glow. Mirrors
 * `attachMagnet`: on `pointermove` it writes panel-relative `--spot-x` / `--spot-y`
 * straight to the element's inline style, rAF-throttled and never via React state
 * (§7), so the CSS `.panel-spotlight` layer can track the pointer with a pure
 * transform. Returns a cleanup fn; no-op under reduced motion (the CSS hides the
 * layer there too). The glow's opacity is driven by `:hover` in CSS, so only the
 * active (hovered) panel ever moves — at most one at a time.
 */
export function attachSpotlight(el: HTMLElement | null): () => void {
  if (!el || prefersReducedMotion()) {
    return () => {};
  }

  let raf = 0;
  let pending: { x: number; y: number } | null = null;

  const apply = () => {
    raf = 0;
    if (!pending) {
      return;
    }
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${(pending.x - rect.left).toFixed(1)}px`);
    el.style.setProperty('--spot-y', `${(pending.y - rect.top).toFixed(1)}px`);
  };

  const onMove = (event: PointerEvent) => {
    pending = { x: event.clientX, y: event.clientY };
    if (!raf) {
      raf = requestAnimationFrame(apply);
    }
  };

  const reset = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    pending = null;
  };

  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', reset);
  el.addEventListener('pointercancel', reset);

  return () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', reset);
    el.removeEventListener('pointercancel', reset);
    if (raf) {
      cancelAnimationFrame(raf);
    }
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
