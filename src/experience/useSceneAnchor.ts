/**
 * useSceneAnchor — the hook DOM tool components use to publish their screen-space
 * rect to the Anchor Bridge (SoT §3.1). Light by design (no `three`): a DOM
 * component on the critical path can call this without pulling in the experience
 * chunk. The scene reads the registered rect via `readAnchor(id)`.
 *
 * Usage:
 *   const ref = useRef<HTMLButtonElement>(null);
 *   useSceneAnchor('send', ref);
 *   return <button ref={ref} …/>;
 */

import { useEffect } from 'react';
import { registerAnchor } from './anchors';

export function useSceneAnchor(id: string, ref: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    return registerAnchor(id, () => ref.current?.getBoundingClientRect() ?? null);
  }, [id, ref]);
}
