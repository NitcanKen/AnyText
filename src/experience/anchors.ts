/**
 * anchors.ts — the Anchor Bridge registry (SoT §3.1): DOM tool surfaces publish
 * their screen-space rect here so the WebGL scene can originate/terminate effects
 * (beam, condense, decay) at the *real* button / queue. This is the make-or-break
 * glue that fuses the floating DOM tool with the stage.
 *
 * Light by design — NO `three` import (DOM components register here). World-space
 * projection of these rects happens in the scene (`AnchorBridge.tsx`), which owns
 * the camera.
 *
 * Two registration paths, merged by `readAnchors()`:
 *  1. Imperative ref registration via `useSceneAnchor(id, ref)` (preferred for new
 *     components).
 *  2. Declarative `data-scene-anchor="id"` attributes scanned from the DOM (zero-risk
 *     way to anchor an existing element without threading a ref through it).
 */

export interface AnchorRect {
  id: string;
  /** Center of the element in CSS pixels. */
  cx: number;
  cy: number;
  width: number;
  height: number;
  /** Center in normalized device coordinates (-1..1, +y up) — ready to unproject. */
  ndcX: number;
  ndcY: number;
}

type RectSource = () => DOMRect | null;

const registry = new Map<string, RectSource>();

/** Register an imperative rect source for `id`. Returns an unregister fn. */
export function registerAnchor(id: string, source: RectSource): () => void {
  registry.set(id, source);
  return () => {
    if (registry.get(id) === source) registry.delete(id);
  };
}

function toAnchorRect(id: string, rect: DOMRect): AnchorRect {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return {
    id,
    cx,
    cy,
    width: rect.width,
    height: rect.height,
    ndcX: (cx / window.innerWidth) * 2 - 1,
    ndcY: -((cy / window.innerHeight) * 2 - 1),
  };
}

/** Resolve a single anchor (registry first, then a `data-scene-anchor` lookup). */
export function readAnchor(id: string): AnchorRect | null {
  const source = registry.get(id);
  if (source) {
    const rect = source();
    if (rect) return toAnchorRect(id, rect);
  }
  if (typeof document !== 'undefined') {
    const el = document.querySelector<HTMLElement>(`[data-scene-anchor="${CSS.escape(id)}"]`);
    if (el) return toAnchorRect(id, el.getBoundingClientRect());
  }
  return null;
}

/** All currently-registered anchors (registry ∪ DOM-scanned), de-duplicated by id. */
export function readAnchors(): AnchorRect[] {
  const out = new Map<string, AnchorRect>();
  for (const [id, source] of registry) {
    const rect = source();
    if (rect) out.set(id, toAnchorRect(id, rect));
  }
  if (typeof document !== 'undefined') {
    for (const el of document.querySelectorAll<HTMLElement>('[data-scene-anchor]')) {
      const id = el.dataset.sceneAnchor;
      if (id && !out.has(id)) out.set(id, toAnchorRect(id, el.getBoundingClientRect()));
    }
  }
  return [...out.values()];
}
