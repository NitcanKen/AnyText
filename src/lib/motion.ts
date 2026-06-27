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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
